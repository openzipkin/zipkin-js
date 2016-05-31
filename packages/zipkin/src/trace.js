const {createNamespace, getNamespace} = require('continuation-local-storage');
const randomTraceId = require('./randomTraceId');
const Annotation = require('./annotation');
const TraceId = require('./TraceId');
const {now} = require('./time');
const {Some, None, fromNullable} = require('./option');

const trace = {};

const session = getNamespace('zipkin') || createNamespace('zipkin');
const defaultContext = session.createContext();
session.enter(defaultContext);

function State({id, terminal, tracers}) {
  this.id = id;
  this.terminal = terminal;
  this.tracers = tracers;
}
State.prototype.toString = function() {
  return `State(id=${this.id.toString()}, terminal=${this.terminal}, tracers=[${
    this.tracers.map(t => t.toString()).join(', ')
    }])`;
};

const defaultId = new TraceId({
  traceId: None,
  parentId: None,
  spanId: randomTraceId(),
  sampled: None,
  flags: 0
});

let tracingEnabled = true;

let sampleRate = 1;

function local() {
  return session.get('trace') || None;
}

function setLocal(value) {
  session.set('trace', value);
}

function setState(state) {
  setLocal(new Some(state));
}

function shouldSample() {
  let sample;
  if (sampleRate === 1) {
    sample = new Some(true);
  } else {
    sample = new Some(Math.random() <= sampleRate);
  }
  return sample;
}

// This can be used for cls-patching other libraries;
// e.g. cls-bluebird, cls-q, cls-redis
trace.getClsNamespace = function getClsNamespace() {
  return session;
};

// A last-resort alternative, if you for some reason
// cannot patch CLS, and you lose the trace context
// somewhere in your code.
// Use "const unfreeze = trace.freezeContext()" in the code
// before you lose your context, and call "unfreeze()" where
// you lost the context. It will then be restored.
trace.freezeContext = function freezeContext() {
  const data = local();
  return function unfreeze() {
    setLocal(data);
  };
};

trace.setSampleRate = function setSampleRate(rate) {
  sampleRate = rate;
};

trace.withContext = function withContext(callback) {
  return session.run(callback);
};

trace.bindContext = function bindContext(callback) {
  return session.bind(callback);
};

trace.dumpLocal = function dumpLocal(message) {
  /* eslint-disable no-console */
  console.log(`${message}: ${local().toString()}`);
};

trace.bindEmitter = function bindEmitter(obj) {
  session.bindEmitter(obj);
};

trace.id = function id() {
  return trace.idOption().getOrElse(defaultId);
};

trace.idOption = function idOption() {
  return local().flatMap(state => state.id);
};

trace.isTerminal = function isTerminal() {
  return local().map(state => state.terminal).getOrElse(false);
};

trace.tracers = function tracers() {
  return local().map(state => state.tracers).getOrElse([]);
};

trace.clear = function clear() {
  session.set('trace', None);
};

trace.enable = function enable() {
  tracingEnabled = true;
};

trace.disable = function disable() {
  tracingEnabled = false;
};

trace.cleanId = function cleanId() {
  return new TraceId({
    spanId: randomTraceId()
  });
};

trace.nextId = function nextId() {
  const currentId = trace.idOption();
  const _nextId = new TraceId({
    traceId: currentId.map(id => id.traceId),
    parentId: currentId.map(id => id.spanId),
    spanId: randomTraceId(),
    sampled: currentId.flatMap(id => id.sampled),
    flags: currentId.map(id => id.flags).getOrElse(0)
  });
  if (_nextId.sampled === None) {
    _nextId._sampled = shouldSample(_nextId);
  }
  return _nextId;
};

trace.withNextId = function withNextId(callback) {
  trace.withContext(() => {
    const id = trace.nextId();
    trace.setId(id);
    callback(id);
  });
};

trace.setId = function setId(traceId, terminal = false) {
  if (!trace.isTerminal()) {
    setState(new State({
      id: new Some(traceId),
      terminal,
      tracers: trace.tracers()
    }));
  }
};

trace.setTerminalId = function setTerminalId(traceId) {
  trace.setId(traceId, true);
};

trace.setTracer = function setTracer(tracer) {
  local().map(state => {
    setState(new State({
      id: state.id,
      termimal: state.terminal,
      tracers: [tracer]
    }));
    return true;
  }).getOrElse(() => {
    setState(new State({
      id: None,
      terminal: false,
      tracers: [tracer]
    }));
  });
};

trace.pushTracer = function pushTracer(additionalTracer) {
  local().map(state => {
    setState(new State({
      id: state.id,
      terminal: state.terminal,
      tracers: [...state.tracers, additionalTracer]
    }));
    return true;
  }).getOrElse(() => {
    setState(new State({
      id: None,
      terminal: false,
      tracers: [additionalTracer]
    }));
  });
};

trace.setState = setState;

trace.letTracer = function letTracer(tracer, f) {
  return trace.withContext(() => {
    trace.setTracer(tracer);
    return f();
  });
};

trace.isActivelyTracing = function isActivelyTracing() {
  let res;
  if (!tracingEnabled) {
    res = false;
  } else if (local() === None) {
    res = false;
  } else {
    const sampled = trace.id().sampled;
    res = !sampled.equals(new Some(false));
  }
  return res;
};

function arrayUnique(array) {
  return array.filter((val, i, arr) => i <= arr.indexOf(val));
}

function uncheckedRecord(rec) {
  arrayUnique(trace.tracers()).forEach(tracer => {
    tracer.record(rec);
  });
}

trace.record = function record(rec) {
  if (trace.isActivelyTracing()) {
    uncheckedRecord(rec);
  }
};

class Record {
  constructor({traceId, timestamp, annotation, duration}) {
    this.traceId = traceId;
    this.timestamp = timestamp;
    this.annotation = annotation;
    this.duration = duration;
  }
  toString() {
    return `Record(traceId=${this.traceId.toString()}, annotation=${this.annotation.toString()})`;
  }
}

trace.recordAnnotation = function recordAnnotation(ann, duration) {
  trace.record(new Record({
    traceId: trace.id(),
    timestamp: now(),
    annotation: ann,
    duration: fromNullable(duration)
  }));
};

trace.recordMessage = function recordMessage(message, duration) {
  trace.recordAnnotation(new Annotation.Message(message), duration);
};

trace.recordServiceName = function recordServiceName(serviceName) {
  trace.recordAnnotation(new Annotation.ServiceName(serviceName));
};

trace.recordRpc = function recordRpc(name) {
  trace.recordAnnotation(new Annotation.Rpc(name));
};

trace.recordClientAddr = function recordClientAddr(ia) {
  trace.recordAnnotation(new Annotation.ClientAddr(ia));
};

trace.recordServerAddr = function recordServerAddr(ia) {
  trace.recordAnnotation(new Annotation.ServerAddr(ia));
};

trace.recordLocalAddr = function recordLocalAddr(ia) {
  trace.recordAnnotation(new Annotation.LocalAddr(ia));
};

trace.recordBinary = function recordBinary(key, value) {
  trace.recordAnnotation(new Annotation.BinaryAnnotation(key, value));
};

module.exports = trace;
