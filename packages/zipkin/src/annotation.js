const InetAddress = require('./InetAddress');

class SimpleAnnotation {
  toString() {
    return `${this.annotationType}()`;
  }
}
class ClientSend extends SimpleAnnotation {}
class ClientRecv extends SimpleAnnotation {}
class ServerSend extends SimpleAnnotation {}
class ServerRecv extends SimpleAnnotation {}

function Message(message) {
  this.message = message;
}
Message.prototype.toString = function() {
  return `Message("${this.message}")`;
};

function ServiceName(serviceName) {
  this.serviceName = serviceName;
}
ServiceName.prototype.toString = function() {
  return `ServiceName("${this.serviceName}")`;
};

function Rpc(name) {
  this.name = name;
}
Rpc.prototype.toString = function() {
  return `Rpc("${this.name}")`;
};

function ClientAddr({host, port}) {
  this.host = host;
  this.port = port;
}
ClientAddr.prototype.toString = function() {
  return `ClientAddr(host="${this.host}", port=${this.port})`;
};

function ServerAddr({serviceName, host, port}) {
  this.serviceName = serviceName;
  this.host = host || undefined;
  this.port = port || 0;
}
ServerAddr.prototype.toString = function() {
  return `ServerAddr(serviceName="${this.serviceName}", host="${this.host}", port=${this.port})`;
};

function LocalAddr({host, port}) {
  this.host = host || InetAddress.getLocalAddress();
  this.port = port || 0;
}
LocalAddr.prototype.toString = function() {
  return `LocalAddr(host="${this.host.toString()}", port=${this.port})`;
};

function BinaryAnnotation(key, value) {
  this.key = key;
  this.value = value;
}
BinaryAnnotation.prototype.toString = function() {
  return `BinaryAnnotation(${this.key}="${this.value}")`;
};

const annotation = {
  ClientSend,
  ClientRecv,
  ServerSend,
  ServerRecv,
  Message,
  ServiceName,
  Rpc,
  ClientAddr,
  ServerAddr,
  LocalAddr,
  BinaryAnnotation
};

Object.keys(annotation).forEach(key => {
  annotation[key].prototype.annotationType = key;
});

module.exports = annotation;
