import {Instrumentation} from 'zipkin';

export const wrapAxios = (axios, options = {}) => {
  const {tracer} = options;
  const instrumentation = new Instrumentation.HttpClient(options);
  const zipkinRecordError = error => {
    const traceId = error.config.traceId;
    if (error.response) {
      instrumentation.recordResponse(traceId, error.response.status);
    } else {
      instrumentation.recordError(traceId, error);
    }
    return Promise.reject(error);
  };
  const zipkinRecordRequest = config => {
    const newConfig = instrumentation.recordRequest(
      config,
      config.url,
      config.method
    );
    newConfig.traceId = tracer.id;
    return newConfig;
  };
  const zipkinRecordResponse = res => {
    instrumentation.recordResponse(res.config.traceId, res.status);
    return res;
  };
  let axiosInstance = axios;
  if (axios.create) {
    axiosInstance = axios.create();
  }
  axiosInstance.interceptors.request.use(
    config => zipkinRecordRequest(config),
    err => zipkinRecordError(err)
  );
  axiosInstance.interceptors.response.use(
    res => zipkinRecordResponse(res),
    err => zipkinRecordError(err)
  );
  return axiosInstance;
};
export default wrapAxios;
