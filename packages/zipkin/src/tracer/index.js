const {None, Some, fromNullable} = require('../option');
const {Sampler, alwaysSample} = require('./sampler');

const Annotation = require('../annotation');
const Record = require('./record');
const TraceId = require('./TraceId');
const {randomTraceId, randomTraceId128bit} = require('./randomTraceId');
const {now, hrtime} = require('../time');
const {Endpoint} = require('../model');

const isPromise = require('is-promise');

function requiredArg(name) {
  throw new Error(`Tracer: Missing required argument ${name}.`);
}

class Tracer {
  constructor({
    ctxImpl = requiredArg('ctxImpl'),
    recorder = requiredArg('recorder'),
    sampler = new Sampler(alwaysSample),
    generateSpanId = randomTraceId,
    generateTraceId,
    // traceID128Bit enables the generation of 128 bit traceIDs in case the tracer
    // needs to create a root span. By default regular 64 bit traceIDs are used.
    // Regardless of this setting, the library will propagate and support both
    // 64 and 128 bit incoming traces from upstream sources.
    traceId128Bit = false,
    // supportsJoin enables using the same span ID for both server spans and client
    // spans. By default it is set to true, but if you are sending the tracing data
    // to a service that expects to have a unique span ID for each span you must set
    // this to false.
    supportsJoin = true,
    localServiceName,
    localEndpoint,
    /* eslint-disable no-console */
    log = console,
    defaultTags
  }) {
    this.log = log;
    this.recorder = recorder;
    this.sampler = sampler;
    this.traceId128Bit = traceId128Bit;
    this.generateSpanId = generateSpanId;
    this.generateTraceId = generateTraceId || (traceId128Bit ? randomTraceId128bit : randomTraceId);
    this.supportsJoin = supportsJoin;
    if (localEndpoint) {
      this._localEndpoint = localEndpoint;
    } else {
      this._localEndpoint = new Endpoint({
        serviceName: localServiceName || 'unknown'
      });
    }
    this._ctxImpl = ctxImpl;
    this._defaultTraceId = this.createRootId();
    this._startTimestamp = now();
    this._startTick = hrtime();
    if (defaultTags) {
      this.setTags(defaultTags);
    }
  }

  scoped(callback) {
    return this._ctxImpl.scoped(callback);
  }

  letId(id, callback) {
    return this._ctxImpl.letContext(id, callback);
  }

  createRootId(isSampled = None, isDebug = false) {
    const rootSpanId = this.generateSpanId();
    const traceId = new Some(this.generateTraceId());
    const id = new TraceId({
      traceId,
      parentId: None,
      spanId: rootSpanId,
      sampled: isSampled,
      flags: isDebug ? 1 : 0
    });

    if (isSampled === None) {
      id._sampled = this.sampler.shouldSample(id);
    }

    return id;
  }

  createChildId() {
    const currentId = fromNullable(
      this._ctxImpl.getContext()
    );

    const childId = new TraceId({
      traceId: currentId.map(id => id.traceId),
      parentId: currentId.map(id => id.spanId),
      spanId: this.generateSpanId(),
      sampled: currentId.flatMap(id => id.sampled),
      flags: currentId.map(id => id.flags).getOrElse(0)
    });
    if (childId.sampled.present === false) {
      childId._sampled = this.sampler.shouldSample(childId);
    }
    return childId;
  }

  // creates a span, timing the given callable, adding any error as a tag
  // if the callable returns a promise, a span stops after the promise resolves
  local(operationName, callable) {
    if (typeof callable !== 'function') {
      throw new Error('you must pass a function');
    }
    return this.scoped(() => {
      const traceId = this.createChildId();
      this.setId(traceId);
      this.recordServiceName(this._localEndpoint.serviceName);
      this.recordAnnotation(new Annotation.LocalOperationStart(operationName));

      let result;
      try {
        result = callable();
      } catch (err) {
        this.recordBinary('error', err.message ? err.message : err.toString());
        this.recordAnnotation(new Annotation.LocalOperationStop());
        throw err;
      }

      // Finish the span on a synchronous success
      if (!isPromise(result)) {
        this.recordAnnotation(new Annotation.LocalOperationStop());
        return result;
      }

      if (!traceId.sampled.getOrElse(false)) {
        return result; // no need to stop as it was never started
      }

      // At this point we know we are sampled. Explicitly record against the ID
      const explicitRecord = (annotation) => this.recorder.record(new Record({
        traceId,
        timestamp: now(this._startTimestamp, this._startTick),
        annotation
      }));

      // Ensure the span representing the promise completes
      return result
        .then((output) => {
          explicitRecord(new Annotation.LocalOperationStop());
          return output;
        })
        .catch((err) => {
          const message = err.message ? err.message : err.toString();
          explicitRecord(new Annotation.BinaryAnnotation('error', message));
          explicitRecord(new Annotation.LocalOperationStop());
          throw err;
        });
    });
  }

  setId(traceId) {
    this._ctxImpl.setContext(traceId);
  }

  get id() {
    return this._ctxImpl.getContext() || this._defaultTraceId;
  }

  get localEndpoint() {
    return this._localEndpoint;
  }

  recordAnnotation(annotation, timestamp = now(this._startTimestamp, this._startTick)) {
    this.id.sampled.ifPresent(sampled => {
      if (!sampled) return;

      this.recorder.record(new Record({
        traceId: this.id,
        timestamp,
        annotation
      }));
    });
  }

  recordMessage(message) {
    this.recordAnnotation(
      new Annotation.Message(message)
    );
  }

  recordServiceName(serviceName) {
    this.recordAnnotation(
      new Annotation.ServiceName(serviceName)
    );
  }

  recordRpc(name) {
    this.recordAnnotation(
      new Annotation.Rpc(name)
    );
  }

  recordClientAddr(ia) {
    this.recordAnnotation(
      new Annotation.ClientAddr(ia)
    );
  }

  recordServerAddr(ia) {
    this.recordAnnotation(
      new Annotation.ServerAddr(ia)
    );
  }

  recordLocalAddr(ia) {
    this.recordAnnotation(
      new Annotation.LocalAddr(ia)
    );
  }

  recordBinary(key, value) {
    this.recordAnnotation(
      new Annotation.BinaryAnnotation(key, value)
    );
  }

  writeIdToConsole(message) {
    this.log.info(`${message}: ${this.id.toString()}`);
  }

  setTags(tags = {}) {
    // eslint-disable-next-line no-restricted-syntax
    for (const tag in tags) {
      if (tags.hasOwnProperty(tag)) {
        this.recordBinary(tag, tags[tag]);
      }
    }
  }
}

module.exports = Tracer;
