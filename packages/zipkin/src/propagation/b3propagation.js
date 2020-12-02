const {Some, None} = require('../option');
const TraceId = require('../tracer/TraceId');
const Tracer = require('../tracer');

function stringToBoolean(str) {
  return str === '1' || str === 'true';
}

function stringToIntOption(str) {
  try {
    return new Some(parseInt(str));
  } catch (err) {
    return None;
  }
}

class B3Extractor {

  constructor(b3Propagation, getter) {
    this._propagation = b3Propagation
    this._getter = getter
  }

  extract(request) {
    const traceId = this._getter.get(request, this._propagation._TRACE_ID);
    const spanId = this._getter.get(request, this._propagation._SPAN_ID);
    const flags = this._getter.get(request, this._propagation._FLAGS);
    const sampled = this._getter.get(request, this._propagation._SAMPLED);
    if(traceId !== None && spanId !== None){
        return spanId.map((sid) => {
          const parentSpanId = this._getter.get(request, this._propagation._PARENT_SPAN_ID);
          return new TraceId({
            traceId: traceId.getOrElse(),
            parentId: parentSpanId,
            spanId: sid,
            debug: flags.flatMap(stringToIntOption).getOrElse(0) === 1,
            sampled: sampled.map(stringToBoolean),
          });
        });
    } else if(flags !== None || sampled !== None){
      // TODO Change ??
      return Tracer.createRootId(sampled === None ? None : sampled.map(stringToBoolean),
        flags.flatMap(stringToIntOption).getOrElse(0) === 1)
    }
    return Tracer.createRootId();
  }
}

class B3Injector {

  constructor(b3Propagation, setter) {
    this._propagation = b3Propagation
    this._setter = setter
  }

  inject(context, request) {
    this._setter.put(request, this._propagation._TRACE_ID, context.traceId);
    this._setter.put(request, this._propagation._SPAN_ID, context.spanId);
    context.sampled.ifPresent((psid) => { this._setter.put(request, this._propagation._PARENT_SPAN_ID, psid) });
    context.sampled.ifPresent((sampled) => { this._setter.put(request, this._propagation._SAMPLED, sampled? '1' : '0') });
    if(context.isDebug()){
      this._setter.put(request, this._propagation._FLAGS, '1');
    }
  }

}

class B3Propagation {

  _TRACE_ID = 'X-B3-TraceId'
  _SPAN_ID = 'X-B3-SpanId'
  _PARENT_SPAN_ID = 'X-B3-ParentSpanId'
  _SAMPLED = 'X-B3-Sampled'
  _FLAGS =  'X-B3-Flags'

  get keys() {
    return [
      this._TRACE_ID,
      this._SPAN_ID,
      this._PARENT_SPAN_ID,
      this._SAMPLED,
      this._FLAGS
    ];
  }

  extractor(getter) {
    return new B3Extractor(this, getter);
  }

  injector(setter) {
    return new B3Injector(this, setter);
  }
}

module.exports = B3Propagation;
