require('colors');
const {None, fromNullable} = require('../option');
const {Sampler, alwaysSample} = require('./sampler');

const Annotation = require('../annotation');
const Record = require('./record');
const TraceId = require('./TraceId');
const randomTraceId = require('./randomTraceId');
const {now} = require('../time');

function requiredArg(name) {
  throw new Error(`Tracer: Missing required argument ${name}.`);
}

class Tracer {
  constructor({
    ctxImpl = requiredArg('ctxImpl'),
    recorder = requiredArg('recorder'),
    sampler = new Sampler(alwaysSample)
  }) {
    this.recorder = recorder;
    this.sampler = sampler;
    this._ctxImpl = ctxImpl;
    this._defaultTraceId = this.createRootId();
  }

  scoped(callback) {
    this._ctxImpl.scoped(callback);
  }

  createRootId() {
    const id = new TraceId({
      traceId: None,
      parentId: None,
      spanId: randomTraceId(),
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

  setId(traceId) {
    this._ctxImpl.setContext(traceId);
  }

  get id() {
    return this._ctxImpl.getContext() || this._defaultTraceId;
  }

  recordAnnotation(annotation, duration) {
    this.recorder.record(new Record({
      traceId: this.id,
      timestamp: now(),
      annotation,
      duration: fromNullable(duration)
    }));
  }

  recordMessage(message, duration) {
    this.recordAnnotation(
      new Annotation.Message(message), duration
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
    console.log(`${message.red}: ${this.id.toString()}`);
  }
}

module.exports = Tracer;
