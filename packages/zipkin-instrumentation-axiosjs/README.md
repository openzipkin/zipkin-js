# zipkin-instrumentation-axiosjs

Adds Zipkin tracing support for the [axios](https://www.npmjs.com/package/axios) JS HTTP client library. It **supports all features of `axios`**.

## Installation

```shell
npm install zipkin-instrumentation-axiosjs --save
```

## Usage

You need to use `wrapAxios` fucntion to wrap the native `axios` instance, and the `axios` instance's type/functions/attributes are not affected. As a result, you can use `zipkinAxios` the same as `axios`

For example:

- Performing a GET request

```javascript
const axios = require('axios');
const wrapAxios = require('zipkin-instrumentation-axiosjs');
const { Tracer, ExplicitContext, ConsoleRecorder } = require('zipkin');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ ctxImpl, recorder, localServiceName });

const remoteServiceName = 'weather-api';
const zipkinAxios = wrapAxios(axios, { tracer, serviceName: localServiceName, remoteServiceName });

zipkinAxios.get('/user?ID=12345')
  .then(function (response) {
    console.log(response);
  })
  .catch(function (error) {
    console.log(error);
  });
```

- Wrap an axios instance

```javascript
  let axiosInstance = axios.create({
    baseURL: 'https://some-domain.com/api/',
    timeout: 1000,
    headers: {'X-Custom-Header': 'foobar'}
});
  axiosInstance = wrapAxios(axiosInstance, {
    tracer,
    serviceName: localServiceName,
    remoteServiceName
  });
```


### Interceptors of Axios also supported

You can intercept requests or responses before they are handled by then or catch.
```javascript
// Add a request interceptor
axios.interceptors.request.use(function (config) {
    // Do something before request is sent
    return config;
  }, function (error) {
    // Do something with request error
    return Promise.reject(error);
  });
 
// Add a response interceptor
axios.interceptors.response.use(function (response) {
    // Do something with response data
    return response;
  }, function (error) {
    // Do something with response error
    return Promise.reject(error);
  });
```

### The test cases all passed:
```
 axios instrumentation - integration test
    ✓ should add headers to requests
    ✓ should support request shorthand (defaults to GET)
    ✓ should support both url and uri options
    ✓ should support promise callback
    ✓ should report 404 when path does not exist
    ✓ should report when service does not exist (41ms)
    ✓ should report when service returns 400
    ✓ should report when service returns 500
```
