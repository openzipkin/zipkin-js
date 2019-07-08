const {Tracer, ExplicitContext} = require('zipkin');
const axios = require('axios');
const sinon = require('sinon');
const {expect} = require('chai');
const wrapAxios = require('../src/index');

describe('axios instrumentation - unit test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';
  let tracer;
  beforeEach(() => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    tracer = new Tracer({recorder, localServiceName: serviceName, ctxImpl});
  });
  it('should return an axios instance when pass axios', (done) => {
    const axiosInstance = wrapAxios(axios, {tracer, remoteServiceName});
    expect(axiosInstance.create).to.equal(undefined);
    done();
  });

  it('should return itself when pass an axiosInstance', (done) => {
    const axiosInstance = axios.create();
    const zipkinAxiosInstance = wrapAxios(axiosInstance, {tracer, remoteServiceName});
    expect(axiosInstance).to.equal(zipkinAxiosInstance);
    done();
  });
});
