const {None, Some, fromNullable} = require('../option');
const {Sampler, alwaysSample} = require('./sampler');

const Annotation = require('../annotation');
const Record = require('./record');
const TraceId = require('./TraceId');
const randomTraceId = require('./randomTraceId');
const {now, hrtime} = require('../time');

function requiredArg(name) {
  throw new Error(`Tracer: Missing required argument ${name}.`);
}

class Tracer {
  constructor({
    ctxImpl = requiredArg('ctxImpl'),
    recorder = requiredArg('recorder'),
    sampler = new Sampler(alwaysSample),
    // traceID128Bit enables the generation of 128 bit traceIDs in case the tracer
    // needs to create a root span. By default regular 64 bit traceIDs are used.
    // Regardless of this setting, the library will propagate and support both
    // 64 and 128 bit incoming traces from upstream sources.
    traceId128Bit = false
  }) {
    this.recorder = recorder;
    this.sampler = sampler;
    this.traceId128Bit = traceId128Bit;
    this._ctxImpl = ctxImpl;
    this._defaultTraceId = this.createRootId();
    this._startTimestamp = now();
    this._startTick = hrtime();
  }

  scoped(callback) {
    return this._ctxImpl.scoped(callback);
  }

  createRootId() {
    const rootSpanId = randomTraceId();
    const traceId = this.traceId128Bit
      ? new Some(randomTraceId() + rootSpanId)
      : None;
    const id = new TraceId({
      traceId,
      parentId: None,
      spanId: rootSpanId,
      sampled: None,
      flags: 0
    });
    id._sampled = this.sampler.shouldSample(id);
    return id;
  }

  createChildId() {
    const currentId = fromNullable(
      this._ctxImpl.getContext()
    );

    const childId = new TraceId({
      traceId: currentId.map(id => id.traceId),
      parentId: currentId.map(id => id.spanId),
      spanId: randomTraceId(),
      sampled: currentId.flatMap(id => id.sampled),
      flags: currentId.map(id => id.flags).getOrElse(0)
    });
    if (childId.sampled.present === false) {
      childId._sampled = this.sampler.shouldSample(childId);
    }
    return childId;
  }

  letChildId(callable) {
    return this.scoped(() => {
      const traceId = this.createChildId();
      this.setId(traceId);
      return callable(traceId);
    });
  }

  setId(traceId) {
    this._ctxImpl.setContext(traceId);
  }

  get id() {
    return this._ctxImpl.getContext() || this._defaultTraceId;
  }

  recordAnnotation(annotation) {
    this.recorder.record(new Record({
      traceId: this.id,
      timestamp: now(this._startTimestamp, this._startTick),
      annotation
    }));
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
    /* eslint-disable no-console */
    console.log(`${message}: ${this.id.toString()}`);
  }
}

module.exports = Tracer;
