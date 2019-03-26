import {PluginBase} from 'hapi';
import {Tracer} from 'zipkin';

export interface ZipkinPluginOptions {
    tracer: Tracer;
    port?: number;
}

export declare const hapiMiddleware: PluginBase<ZipkinPluginOptions>;
