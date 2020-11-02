// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import {PluginBase} from 'hapi';
import {Tracer} from 'zipkin';

export interface ZipkinPluginOptions {
    tracer: Tracer;
    port?: number;
}

export declare const hapiMiddleware: PluginBase<ZipkinPluginOptions>;
