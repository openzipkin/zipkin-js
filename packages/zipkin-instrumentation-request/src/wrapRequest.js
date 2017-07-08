const {Request, Annotation, InetAddress} = require('zipkin');
const URL = require('url');

function wrapRequest(request, {tracer, serviceName = 'unknown', remoteServiceName}) {
  return request.defaults((options, callback) => tracer.scoped(() => {
    tracer.setId(tracer.createChildId());
    const traceId = tracer.id;

    const wrappedOptions = Request.addZipkinHeaders(options, tracer.id);
    const method = wrappedOptions.method || 'GET';
    const url = wrappedOptions.uri || wrappedOptions.url || '';
    const parsed =  URL.parse(url);
    const port = wrappedOptions.port || parsed.port;
    const localAddrAnnot = new Annotation.LocalAddr({port})

    tracer.recordServiceName(serviceName);
    tracer.recordRpc(method.toUpperCase());
    tracer.recordBinary('http.url', url);
    tracer.recordAnnotation(new Annotation.ClientSend());
    tracer.recordAnnotation(localAddrAnnot);

    const req = request(wrappedOptions, callback);

    let serverRecorded = false;
    const recordServer = (socket) => {
      if (!serverRecorded && remoteServiceName) {
        tracer.setId(traceId);
        tracer.recordAnnotation(new Annotation.ServerAddr({
          serviceName: remoteServiceName,
          host: new InetAddress(socket ? socket.address().address : parsed.hostname),
          port
        }));
        serverRecorded = true;
      }
    }

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
