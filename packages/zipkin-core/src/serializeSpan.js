const {TBufferedTransport, TBinaryProtocol} = require('thrift');
const {fromByteArray: base64encode} = require('base64-js');

let serialized;
const transport = new TBufferedTransport(null, res => {
  serialized = res;
});

const protocol = new TBinaryProtocol(transport);

module.exports = function serializeSpan(span, format = 'base64') {
  span.toThrift().write(protocol);
  protocol.flush();
  if (format === 'base64') {
    return base64encode(serialized);
  } else {
    return serialized;
  }
};
