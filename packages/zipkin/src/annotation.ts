const InetAddress = require('./InetAddress');

class SimpleAnnotation {
  toString(): string {
    return `${this.annotationType}()`;
  }
}
class ClientSend extends SimpleAnnotation {}
class ClientRecv extends SimpleAnnotation {}
class ServerSend extends SimpleAnnotation {}
class ServerRecv extends SimpleAnnotation {}
class ProducerStart extends SimpleAnnotation {}
class ProducerStop extends SimpleAnnotation {}
class ConsumerStart extends SimpleAnnotation {}
class ConsumerStop extends SimpleAnnotation {}

function LocalOperationStart(name): void {
  this.name = name;
}
LocalOperationStart.prototype.toString = function (): string {
  return `LocalOperationStart("${this.name}")`;
};

class LocalOperationStop extends SimpleAnnotation {}

function Message(message): void {
  this.message = message;
}
Message.prototype.toString = function (): string {
  return `Message("${this.message}")`;
};

function ServiceName(serviceName): void {
  this.serviceName = serviceName;
}
ServiceName.prototype.toString = function (): string {
  return `ServiceName("${this.serviceName}")`;
};

function Rpc(name): void {
  this.name = name;
}
Rpc.prototype.toString = function (): string {
  return `Rpc("${this.name}")`;
};

function ClientAddr({host, port}): void {
  this.host = host;
  this.port = port;
}
ClientAddr.prototype.toString = function (): string {
  return `ClientAddr(host="${this.host}", port=${this.port})`;
};

function ServerAddr({serviceName, host, port}): void {
  this.serviceName = serviceName;
  this.host = host || undefined;
  this.port = port || 0;
}
ServerAddr.prototype.toString = function (): string {
  return `ServerAddr(serviceName="${this.serviceName}", host="${this.host}", port=${this.port})`;
};

function LocalAddr({host, port}): void {
  this.host = host || InetAddress.getLocalAddress();
  this.port = port || 0;
}
LocalAddr.prototype.toString = function (): string {
  return `LocalAddr(host="${this.host.toString()}", port=${this.port})`;
};

function MessageAddr({serviceName, host, port}): void {
  this.serviceName = serviceName;
  this.host = host;
  this.port = port;
}
MessageAddr.prototype.toString = function (): string {
  return `MessageAddr(serviceName="${this.serviceName}", host="${this.host}", port=${this.port})`;
};

function BinaryAnnotation(key, value): void {
  this.key = key;
  this.value = value;
}
BinaryAnnotation.prototype.toString = function (): string {
  return `BinaryAnnotation(${this.key}="${this.value}")`;
};

new ServiceName('teste');

const annotation = {
  ClientSend,
  ClientRecv,
  ServerSend,
  ServerRecv,
  ProducerStart,
  ProducerStop,
  ConsumerStart,
  ConsumerStop,
  MessageAddr,
  Message,
  ServiceName,
  Rpc,
  ClientAddr,
  ServerAddr,
  LocalAddr,
  BinaryAnnotation,
  LocalOperationStart,
  LocalOperationStop
};

Object.keys(annotation).forEach(key => {
  annotation[key].prototype.annotationType = key;
});

export default annotation;
