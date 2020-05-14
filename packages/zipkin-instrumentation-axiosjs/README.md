# zipkin-instrumentation-axiosjs

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-axiosjs.svg)

Adds Zipkin tracing support for the [axios](https://www.npmjs.com/package/axios) JS HTTP client library. It **supports all features of `axios`**.

## Installation

```shell
npm install zipkin-instrumentation-axiosjs --save
```

## Usage

You need to use `wrapAxios` function to wrap the native `axios` instance, and the `axios` instance's type/functions/attributes are not affected. As a result, you can use `zipkinAxios` the same as `axios`

For example:

- Performing a GET request

```javascript
const axios = require('axios');
const wrapAxios = require('zipkin-instrumentation-axiosjs');
const { Tracer, ExplicitContext, ConsoleRecorder } = require('zipkin');

const ctxImpl = new ExplicitContext(); // the in-process context
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ ctxImpl, recorder, localServiceName });

const remoteServiceName = 'weather-api'; // name of the application you are
                                         // calling (optional)
const zipkinAxios = wrapAxios(axios, { tracer, remoteServiceName });

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
  axiosInstance = wrapAxios(axiosInstance, {tracer, remoteServiceName});
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
