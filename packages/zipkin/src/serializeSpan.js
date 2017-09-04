const {fromByteArray: base64encode} = require('base64-js');

module.exports = function serializeSpan(span, format = 'base64') {
  // eslint-disable-next-line global-require
  const {TBufferedTransport, TBinaryProtocol} = require.call(null, 'thrift');

  let serialized;
  const transport = new TBufferedTransport(null, res => {
    serialized = res;
  });

  const protocol = new TBinaryProtocol(transport);

  span.toThrift().write(protocol);
  protocol.flush();
  if (format === 'base64') {
    return base64encode(serialized);
  } else {
    return serialized;
  }
};
