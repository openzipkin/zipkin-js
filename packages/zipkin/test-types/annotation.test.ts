import {expect} from 'chai';
import { Annotation, InetAddress } from 'zipkin';

describe('Annotation types', () => {
    describe('[ClientSend, ClientRecv, ServerSend, ServerRecv, ProducerStart, ProducerStop, ConsumerStart, ConsumerStop, LocalOperationStop]', () => {
        it('should return correct type', () => {
            const clientSend: Annotation.ClientSend = new Annotation.ClientSend();
            const clientRecv: Annotation.ClientRecv = new Annotation.ClientRecv();
            const serverSend: Annotation.ServerSend = new Annotation.ServerSend();
            const serverRecv: Annotation.ServerRecv = new Annotation.ServerRecv();
            const ProducerStart: Annotation.ProducerStart = new Annotation.ProducerStart();
            const ProducerStop: Annotation.ProducerStop = new Annotation.ProducerStop();
            const ConsumerStart: Annotation.ConsumerStart = new Annotation.ConsumerStart();
            const ConsumerStop: Annotation.ConsumerStop = new Annotation.ConsumerStop();
            const localOperationStop: Annotation.LocalOperationStop = new Annotation.LocalOperationStop();

            expect(clientSend).to.have.property('annotationType');
            expect(clientRecv).to.have.property('annotationType');
            expect(serverSend).to.have.property('annotationType');
            expect(serverRecv).to.have.property('annotationType');
            expect(ProducerStart).to.have.property('annotationType');
            expect(ProducerStop).to.have.property('annotationType');
            expect(ConsumerStart).to.have.property('annotationType');
            expect(ConsumerStop).to.have.property('annotationType');
            expect(localOperationStop).to.have.property('annotationType');
        });
    });
    describe('[LocalOperationStart, Message, ServiceName, Rpc]', () => {
        it('should return correct type', () => {
            const localOperationStart: Annotation.LocalOperationStart = new Annotation.LocalOperationStart('name');
            const message: Annotation.Message = new Annotation.Message('name');
            const serviceName: Annotation.ServiceName = new Annotation.ServiceName('name');
            const rpc: Annotation.Rpc = new Annotation.Rpc('name');

            expect(localOperationStart).to.have.property('name');
            expect(message).to.have.property('message');
            expect(serviceName).to.have.property('serviceName');
            expect(rpc).to.have.property('name');
        });
    });
    describe('[ClientAddr, ServerAddr, MessageAddr, LocalAddr]', () => {
        it('should return correct type', () => {
            const clientAddr: Annotation.ClientAddr = new Annotation.ClientAddr({
                host: InetAddress.getLocalAddress(),
                port: 8000
            });
            const serverAddr: Annotation.ServerAddr = new Annotation.ServerAddr({
                serviceName: 'name',
                host: InetAddress.getLocalAddress(),
                port: 8000
            });
            const MessageAddr: Annotation.MessageAddr = new Annotation.MessageAddr({
                serviceName: 'name',
                host: InetAddress.getLocalAddress(),
                port: 8000
            });
            const localAddr: Annotation.LocalAddr = new Annotation.LocalAddr({
                host: InetAddress.getLocalAddress(),
                port: 8000
            });

            expect(clientAddr).to.have.property('annotationType');
            expect(serverAddr).to.have.property('serviceName');
            expect(MessageAddr).to.have.property('serviceName');
            expect(localAddr).to.have.property('host');
        });
    });
    describe('BinaryAnnotation', () => {
        it('should return correct type', () => {
            const binaryAnnotation: Annotation.BinaryAnnotation = new Annotation.BinaryAnnotation('binary-annotation', 'some-value');

            expect(binaryAnnotation.value).to.equal('some-value');
        });
    });
});
