class B3Propagation {
  static DEFAULT = new B3Propagation();

  headers = {
    TraceId: 'X-B3-TraceId',
    SpanId: 'X-B3-SpanId',
    ParentSpanId: 'X-B3-ParentSpanId',
    Sampled: 'X-B3-Sampled',
    Flags: 'X-B3-Flags'
  };

  extractor(readHeader) {
    if (this.containsRequiredHeaders(readHeader)) {
      const SpanId = readHeader(this.headers.SpanId);
      const parentId = SpanId.map((sid) => {
        const TraceId = readHeader(this.headers.TraceId);
        const ParentSpanId = readHeader(this.headers.ParentSpanId);
        const Sampled = readHeader(this.headers.Sampled);
        const Flags = readHeader(this.headers.Flags)
          .flatMap(stringToIntOption)
          .getOrElse(0);
        return new TraceId({
          TraceId: TraceId.getOrElse(),
          parentId: ParentSpanId,
          SpanId: sid,
          debug: Flags === 1,
          Sampled: Sampled.map(stringToBoolean),
        });
      });

      return new Some(this.tracer.join(parentId.getOrElse()));
    } else if (readHeader(this.headers.Flags) !== None || readHeader(this.headers.Sampled) !== None) {
      const Sampled = readHeader(this.headers.Sampled) === None
        ? None : readHeader(this.headers.Sampled)
          .map(stringToBoolean);
      const Flags = readHeader(this.headers.Flags)
        .flatMap(stringToIntOption)
        .getOrElse(0);
      return new Some(this.tracer.createRootId(Sampled, Flags === 1));
    } else {
      return new Some(this.tracer.createRootId());
    }
  }

  #containsRequiredHeaders(readHeader) {
    return readHeader(this.headers.TraceId) !== None && readHeader(this.headers.SpanId) !== None;
  }

}

module.exports = B3Propagation;
