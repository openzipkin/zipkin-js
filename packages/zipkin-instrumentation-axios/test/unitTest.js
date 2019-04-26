import {Tracer, ExplicitContext} from 'zipkin';
import axios from 'axios';
import sinon from 'sinon';
import {expect} from 'chai';
import wrapAxios from '../src/index';

describe('axios instrumentation - unit test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';
  let tracer;
  beforeEach(() => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    tracer = new Tracer({recorder, ctxImpl});
  });
  it('should return an axios instance when pass axios', done => {
    const axiosInstance = wrapAxios(axios, {tracer, serviceName, remoteServiceName});
    expect(axiosInstance.create).to.equal(undefined);
    done();
  });

  it('should return itself when pass an axiosInstance', done => {
    const axiosInstance = axios.create();
    const zipkinAxiosInstance = wrapAxios(axiosInstance, {tracer, serviceName, remoteServiceName});
    expect(axiosInstance).to.equal(zipkinAxiosInstance);
    done();
  });
});
