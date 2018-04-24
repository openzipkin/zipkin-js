import {Tracer} from "zipkin"
import {PluginBase} from "hapi"

export interface ZipkinPluginOptions {
    tracer: Tracer;
    port?: number;
}

export declare const hapiMiddleware: PluginBase<ZipkinPluginOptions>