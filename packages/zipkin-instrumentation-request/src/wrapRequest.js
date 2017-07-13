const {Request, Annotation, InetAddress} = require('zipkin');
const URL = require('url');

function wrapRequest(request, {tracer, serviceName = 'unknown', remoteServiceName}) {
  return request.defaults((options, callback) => tracer.scoped(() => {
    tracer.setId(tracer.createChildId());
    const traceId = tracer.id;

    const wrappedOptions = Request.addZipkinHeaders(options, tracer.id);
    const method = wrappedOptions.method || 'GET';
    const url = wrappedOptions.uri || wrappedOptions.url || '';
    const parsed = URL.parse(url);

    tracer.recordServiceName(serviceName);
    tracer.recordRpc(method.toUpperCase());
    tracer.recordBinary('http.url', url);
    tracer.recordAnnotation(new Annotation.ClientSend());

    const req = request(wrappedOptions, callback);

    let recorded = false;
    const recordServer = (socket) => {
      if (!recorded) {
        tracer.setId(traceId);
        const remoteAddress = socket ? socket.remoteAddress : parsed.hostname;
        const remotePort = socket ? socket.remotePort : req.port;
        const localPort = socket ? socket.localPort : undefined;
        tracer.recordAnnotation(new Annotation.LocalAddr({port: localPort}));
        if (remoteServiceName) {
          tracer.recordAnnotation(new Annotation.ServerAddr({
            serviceName: remoteServiceName,
            host: new InetAddress(remoteAddress),
            port: remotePort
          }));
        }
        recorded = true;
      }
    };

    const recordResponse = (response) => {
      tracer.setId(traceId);
      tracer.recordBinary('http.status_code', response.statusCode.toString());
      tracer.recordAnnotation(new Annotation.ClientRecv());
    };

    const recordError = (error) => {
      recordServer(req.connection);
      tracer.setId(traceId);
      tracer.recordBinary('error', error.toString());
      tracer.recordAnnotation(new Annotation.ClientRecv());
    };

    return req
      .on('socket', s => s.on('connect', () => recordServer(s)))
      .on('response', recordResponse)
      .on('error', recordError);
  }));
}

module.exports = wrapRequest;
