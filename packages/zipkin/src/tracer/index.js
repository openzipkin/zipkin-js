const isPromise = require('is-promise');
const {None, Some} = require('../option');
const {Sampler, alwaysSample} = require('./sampler');

const Annotation = require('../annotation');
const Record = require('./record');
const TraceId = require('./TraceId');
const randomTraceId = require('./randomTraceId');
const {now, hrtime} = require('../time');
const {Endpoint} = require('../model');


function requiredArg(name) {
  throw new Error(`Tracer: Missing required argument ${name}.`);
}

function isUndefinedOrNull(obj) {
  return typeof obj === 'undefined' || obj === null;
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
    this.supportsJoin = supportsJoin;
    if (localEndpoint) {
      this._localEndpoint = localEndpoint;
    } else {
      this._localEndpoint = new Endpoint({
        serviceName: localServiceName || 'unknown'
      });
    }
    this._ctxImpl = ctxImpl;
    // The sentinel is used until there's a trace ID in scope.
    // Technically, this ID should have been unsampled, but it can break code to change that now.
    this._sentinelTraceId = this.createRootId();
    this._startTimestamp = now();
    this._startTick = hrtime();
    // only set defaultTags in recorders which know about it
    if (this.recorder.setDefaultTags) {
      this.recorder.setDefaultTags(defaultTags);
    }
  }

  scoped(callback) {
    return this._ctxImpl.scoped(callback);
  }

  letId(id, callback) {
    return this._ctxImpl.letContext(id, callback);
  }

  createRootId(isSampled = None, isDebug = false) {
    const rootSpanId = randomTraceId();
    const traceId = this.traceId128Bit
      ? randomTraceId() + rootSpanId
      : rootSpanId;
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

  createChildId(parentId) {
    if (isUndefinedOrNull(parentId)) {
      /* eslint-disable no-param-reassign */
      parentId = this._ctxImpl.getContext();
    }

    if (parentId === this._sentinelTraceId || isUndefinedOrNull(parentId)) {
      return this.createRootId();
    }

    const childId = new TraceId({
      traceId: parentId.traceId,
      parentId: new Some(parentId.spanId),
      spanId: randomTraceId(),
      debug: parentId.isDebug(),
      sampled: parentId.sampled,
    });
    if (childId.sampled.present === false) {
      childId._sampled = this.sampler.shouldSample(childId);
    }
    return childId;
  }

  // this allows you to avoid use of implicit trace ID and defer implicit timestamp derivation
  _explicitRecord(traceId, annotation, timestamp = now(this._startTimestamp, this._startTick)) {
    this.recorder.record(new Record({traceId, timestamp, annotation}));
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

      // Ensure the span representing the promise completes
      return result
        .then((output) => {
          this._explicitRecord(traceId, new Annotation.LocalOperationStop());
          return output;
        })
        .catch((err) => {
          const message = err.message ? err.message : err.toString();
          this._explicitRecord(traceId, new Annotation.BinaryAnnotation('error', message));
          this._explicitRecord(traceId, new Annotation.LocalOperationStop());
          throw err;
        });
    });
  }

  join(traceId) {
    if (isUndefinedOrNull(traceId)) {
      throw new Error('traceId is a required arg');
    }

    // duck type check until we sort out a better way. We don't want to break
    // transpiled usage ex. `traceId instanceof TraceId_1: false` See #422
    if (isUndefinedOrNull(traceId._spanId)) {
      throw new Error('Must be valid TraceId instance');
    }

    if (!this.supportsJoin) {
      return this.createChildId(traceId);
    }

    if (traceId.sampled === None) {
      /* eslint-disable no-param-reassign */
      traceId._sampled = this.sampler.shouldSample(traceId);
    } else {
      /* eslint-disable no-param-reassign */
      traceId._shared = true;
    }
    return traceId;
  }

  setId(traceId) {
    this._ctxImpl.setContext(traceId);
  }

  // Returns the current trace ID or a sentinel value indicating its absence.
  get id() {
    return this._ctxImpl.getContext() || this._sentinelTraceId;
  }

  get localEndpoint() {
    return this._localEndpoint;
  }

  recordAnnotation(annotation, timestamp) {
    if (this.id.sampled.getOrElse(false)) {
      this._explicitRecord(this.id, annotation, timestamp);
    }
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
      if (Object.prototype.hasOwnProperty.call(tags, tag)) {
        this.recordBinary(tag, tags[tag]);
      }
    }
  }
}

module.exports = Tracer;
