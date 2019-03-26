import { Instrumentation } from 'zipkin';
const zipkinRecordError = (error, options) => {
  const instrumentation = new Instrumentation.HttpClient(options);
  if (error.response) {
    instrumentation.recordResponse(options.tracer.id, error.response.status);
  } else {
    instrumentation.recordError(options.tracer.id, error);
  }
  return Promise.reject(error);
};
const zipkinRecordRequest = (config, options) => {
  const instrumentation = new Instrumentation.HttpClient(options);
  return instrumentation.recordRequest(config, config.url, config.method);
};
const zipkinRecordResponse = (res, options) => {
  const instrumentation = new Instrumentation.HttpClient(options);
  instrumentation.recordResponse(options.tracer.id, res.status);
  return res;
};

const wrapAxios = (axios, options = {}) => {
  axios.interceptors.request.use(config => zipkinRecordRequest(config, options), err => zipkinRecordError(err, options));
  axios.interceptors.response.use(res => zipkinRecordResponse(res, options), err => zipkinRecordError(err, options));
  return axios;
};
export default wrapAxios;
