import {Instrumentation} from 'zipkin';

export const wrapAxios = (axios, options = {}) => {
  const {tracer} = options;
  const instrumentation = new Instrumentation.HttpClient(options);
  const zipkinRecordRequest = config => tracer.scoped(() => {
    const newConfig = instrumentation.recordRequest(
        config,
        config.url,
        config.method
      );
    newConfig.traceId = tracer.id;
    return newConfig;
  });
  const zipkinRecordResponse = res => tracer.scoped(() => {
    instrumentation.recordResponse(res.config.traceId, res.status);
    return res;
  });
  const zipkinRecordError = error => tracer.scoped(() => {
    const traceId = error.config.traceId;
    if (error.response) {
      instrumentation.recordResponse(traceId, error.response.status);
    } else {
      instrumentation.recordError(traceId, error);
    }
    return Promise.reject(error);
  });
  let axiosInstance = axios;
  if (axios.create) {
    axiosInstance = axios.create();
  }
  axiosInstance.interceptors.request.use(zipkinRecordRequest, zipkinRecordError);
  axiosInstance.interceptors.response.use(zipkinRecordResponse, zipkinRecordError);
  return axiosInstance;
};
export default wrapAxios;
