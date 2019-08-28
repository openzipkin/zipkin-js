import { expect } from 'chai';

import {Agent as HttpAgent } from 'http';
import {Agent as HttpsAgent} from 'https';
import * as noop from 'noop-logger';

import {jsonEncoder} from 'zipkin';

import { HttpLogger } from 'zipkin-transport-http';

describe('HttpLogger', () => {
  it('should have correct type', () => {
    const options = {
      endpoint: 'testEndpoint',
      httpInterval: 1000,
      jsonEncoder: jsonEncoder.JSON_V1,
      timeout: 0,
      maxPayloadSize: 0,
      headers: {},
      agent: new HttpAgent(),
      log: console
    };
    const httpLogger: HttpLogger = new HttpLogger(options);

    expect(httpLogger.logSpan).to.be.a('function');
  });

  it('should accept Http(s) Agent or function which returns Agent', () => {
    const agents = [new HttpAgent(), new HttpsAgent(), () => new HttpAgent(), () => new HttpsAgent(),
      (url: URL) => new HttpAgent(), (url: URL) => new HttpsAgent(), null, undefined];

    agents.forEach(agent => {
      const options = {
        endpoint: 'testEndpoint',
        agent
      };

      const httpLogger: HttpLogger = new HttpLogger(options);

      expect(httpLogger).to.have.property('agent', agent || null);
    });
  });

  it('should accept loggers containing error function', () => {
    const loggers = [console, noop, undefined];

    loggers.forEach(log => {
      const options = {
        endpoint: 'testEndpoint',
        log
      };

      const httpLogger: HttpLogger = new HttpLogger(options);

      expect(httpLogger).to.have.property('log', log || console);
    });
  });
});
