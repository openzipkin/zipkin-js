import React, { Component } from "react";
import testCases from '../shared';
const zipkin = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const { HttpLogger } = require('zipkin-transport-http');
const ctxImpl = new CLSContext();

const ZIPKIN_ENDPOINT = 'http://localhost:9411/api/v2/spans';

const tracer = new zipkin.Tracer({
  ctxImpl,
  recorder: new zipkin.BatchRecorder({
    logger: new HttpLogger({
      endpoint: ZIPKIN_ENDPOINT,
      jsonEncoder: zipkin.jsonEncoder.JSON_V2
    }),
  }),
  sampler: new zipkin.sampler.CountingSampler(1),
});

export default class BasicScreen extends Component {
  constructor(props) {
    super(props);
    this.state = {
      pressed: false
    };
  }

  render() {
    return (
      <div style={{ flex: 1, paddingTop: 40, justifyContent: "flex-start" }}>
        <a
          id="basicButton"
          onClick={() => {
            testCases.createSpan({tracer, zipkin});
            this.setState({ pressed: true });
          }}
        >
          <span id="buttonLabel">
            {this.state.pressed ? "Is-Pressed" : "Not-Pressed"}
          </span>
        </a>
      </div>
    );
  }
}
