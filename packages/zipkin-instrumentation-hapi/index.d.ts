import {Tracer} from "zipkin"
import {PluginRegistrationObject} from "hapi"

export interface ZipkinPluginOptions {
    tracer: Tracer;
    serviceName?: string;
    port?: number;
}

export declare const hapiMiddleware: PluginRegistrationObject<ZipkinPluginOptions>