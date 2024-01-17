// Author: Abrar Mahmud
// Email: abrar.mahmud@g.bracu.ac.bd

import { Application, Request, Response } from 'express';
import { Result, PayloadResult } from '../utils/common';

type AsyncFunc = (...args: any[]) => Promise<any>;

enum ParamType {
    URL_PARAM   = 0,
    QUERY_PARAM = 1,
    BODY_VALUE  = 2,
    JWT_VALUE   = 3,
    REQ_OBJECT  = 4,
    RES_OBJECT  = 5,
    PARAM_TYPE_COUNT = 6
}

interface ParamMapper {
    paramType: ParamType;
}

export type VREPORT = { error: string | null };
type CONVTOFX   = (val: any) => any;
type VALIDATEFX = (val: any, reportOBJ: VREPORT) => boolean;

interface KeyedParamMapper extends ParamMapper {
    key: string;
    convertTo?: CONVTOFX | null;
    validate?: VALIDATEFX[] | null;
}

interface MandatoryKPM extends KeyedParamMapper {
    mandatory: boolean;
}

interface RequestConfig {
    fx: AsyncFunc;
    route?: string;
    methods?: string[];
    needsAuth?: boolean;
    params?: ParamMapper[];
}

type REQMETHODS = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

///////////////////////////////

export interface WithConfigMap extends Function {
    __webcfg__: Map<string, RequestConfig>;
}

function _getConfigForMethod(target: any, key: string | symbol, descriptor: PropertyDescriptor): RequestConfig {
    const wcm = target as WithConfigMap;

    if(!wcm.__webcfg__ || !(wcm.__webcfg__ instanceof Map)) {
        wcm.__webcfg__ = new Map<string, RequestConfig>();
    }

    if(!wcm.__webcfg__.has(key.toString())) {
        const reqConf: RequestConfig = { fx: descriptor.value };
        wcm.__webcfg__.set(key.toString(), reqConf);
    }

    const reqConf = wcm.__webcfg__.get(key.toString()) as RequestConfig;

    return reqConf;
}

function _getConfigForParam(target: any, key: string | symbol): RequestConfig {
    const wcm = target as WithConfigMap;

    if(!wcm.__webcfg__ || !(wcm.__webcfg__ instanceof Map)) {
        wcm.__webcfg__ = new Map<string, RequestConfig>();
    }

    if(!wcm.__webcfg__.has(key.toString())) {
        const reqConf: RequestConfig = { fx: target[key] };
        wcm.__webcfg__.set(key.toString(), reqConf);
    }

    return wcm.__webcfg__.get(key.toString()) as RequestConfig;
}

function _addParamMapper(target: any, key: string | symbol, index: number, mapper: ParamMapper) {
    const conf = _getConfigForParam(target, key);
    if(!conf.params) {
        conf.params = new Array(index + 1);
        conf.params[index] = mapper;
    } else {
        if(conf.params.length < index + 1) {
            conf.params.length = index + 1;
        }
        conf.params[index] = mapper;
    }
}

/////////////////////////////// method decorators ///////////////////////////////

export function setRoute(route: string) {
    return function(target: any, key: string | symbol, descriptor: PropertyDescriptor) {
        const conf = _getConfigForMethod(target, key, descriptor);
        if(conf.route) { throw new Error(`Route already set for ${key.toString()} in ${target.constructor.name}`); }
        conf.route = route;
    }
}

export function addMethod(method: REQMETHODS) {
    return function(target: any, key: string | symbol, descriptor: PropertyDescriptor) {
        const conf = _getConfigForMethod(target, key, descriptor);
        if(!conf.methods) conf.methods = [];
        if(!conf.methods.includes(method)) conf.methods.push(method);
    }
}

export function onRoute(route: string, method: REQMETHODS, moreMethods?: REQMETHODS[]) {
    return function(target: any, key: string | symbol, descriptor: PropertyDescriptor) {
        const conf = _getConfigForMethod(target, key, descriptor);
        if(conf.route) { throw new Error(`Route already set for ${key.toString()} in ${target.constructor.name}`); }
        conf.route = route;
        conf.methods = [method, ...(moreMethods || [])];
    }
}

export function needsAuth() {
    return function(target: any, key: string | symbol, descriptor: PropertyDescriptor) {
        _getConfigForMethod(target, key, descriptor).needsAuth = true;
    }
}

/////////////////////////////// param decorators ///////////////////////////////

export function urlParam(name: string, mandatory: boolean = false, options?: { convertTo?: CONVTOFX, validate?: VALIDATEFX | VALIDATEFX[] }) {
    return function(target: any, key: string | symbol, index: number) {
        const { convertTo, validate } = options || {};
        const _validate: VALIDATEFX[] | undefined = validate ? (Array.isArray(validate) ? validate : [validate]) : undefined;
        const pm : MandatoryKPM = { paramType: ParamType.URL_PARAM, key: name, mandatory, validate: _validate, convertTo };
        _addParamMapper(target, key, index, pm);
    }
}

export function queryParam(name: string, mandatory: boolean = false, options?: { convertTo?: CONVTOFX, validate?: VALIDATEFX | VALIDATEFX[] }) {
    return function(target: any, key: string | symbol, index: number) {
        const { convertTo, validate } = options || {};
        const _validate: VALIDATEFX[] | undefined = validate ? (Array.isArray(validate) ? validate : [validate]) : undefined;
        const pm : MandatoryKPM = { paramType: ParamType.QUERY_PARAM, key: name, mandatory, validate: _validate, convertTo };
        _addParamMapper(target, key, index, pm);
    }
}

export function bodyValue(name: string, mandatory: boolean = false, options?: { convertTo?: CONVTOFX, validate?: VALIDATEFX | VALIDATEFX[] }) {
    return function(target: any, key: string | symbol, index: number) {
        const { convertTo, validate } = options || {};
        const _validate: VALIDATEFX[] | undefined = validate ? (Array.isArray(validate) ? validate : [validate]) : undefined;
        const pm : MandatoryKPM = { paramType: ParamType.BODY_VALUE, key: name, mandatory, validate: _validate, convertTo };
        _addParamMapper(target, key, index, pm);
    }
}

export function jwtValue(name: string) {
    return function(target: any, key: string | symbol, index: number) {
        const pm : KeyedParamMapper = { paramType: ParamType.JWT_VALUE, key: name };
        _addParamMapper(target, key, index, pm);
    }
}

export function reqObject() {
    return function(target: any, key: string | symbol, index: number) {
        const pm : ParamMapper = { paramType: ParamType.REQ_OBJECT };
        _addParamMapper(target, key, index, pm);
    }
}

export function resObject() {
    return function(target: any, key: string | symbol, index: number) {
        const pm : ParamMapper = { paramType: ParamType.RES_OBJECT };
        _addParamMapper(target, key, index, pm);
    }
}

/////////////////////////////// processing part ///////////////////////////////

export type STRKEYOBJ = { [key: string]: any };
type REQRESFUNC       = (req: Request, res: Response) => void;
type ITERPARAMSTATE   = { pm: ParamMapper | null, jwt_obj: STRKEYOBJ | null };
type EXTRACTORFX      = (state: ITERPARAMSTATE, req: Request, res: Response) => [boolean, any];
type JWTDECODER       = (bearerHeader: string, req: Request, res: Response) => STRKEYOBJ;

const emptyJWTDecoder: JWTDECODER = (_1: string, _2: Request, _3: Response) => { return {}; };

export class ExpressExtender {
    // key: (METHOD + ":" + ROUTE) as string
    // value: REQRESFUNC
    private registeredRoutes: Map<string, REQRESFUNC> = new Map<string, REQRESFUNC>();
    private registeredClasses: Set<Function> = new Set<Function>();
    private jwt_decoder: JWTDECODER;
    private static valueExtractorFX: EXTRACTORFX[] = new Array<EXTRACTORFX>(ParamType.PARAM_TYPE_COUNT);

    // <value-extractors>

    private static xtUrlParam(state: ITERPARAMSTATE, req: Request, res: Response): [boolean, any] {
        const pm = state.pm as MandatoryKPM;
        const val = req.params ? req.params[pm.key] : undefined;
        if(pm.mandatory && val === undefined) {
            res.status(400).send(PayloadResult.failure(`Missing mandatory url parameter ${pm.key}`));
            return [false, undefined];
        }
        return val !== undefined ? ExpressExtender.validateAndConvert(val, pm, res) : [true, val];
    }

    private static xtQueryParam(state: ITERPARAMSTATE, req: Request, res: Response): [boolean, any] {
        const pm = state.pm as MandatoryKPM;
        const val = req.query ? req.query[pm.key] : undefined;
        if(pm.mandatory && val === undefined) {
            res.status(400).send(PayloadResult.failure(`Missing mandatory query parameter ${pm.key}`));
            return [false, undefined];
        }
        return val !== undefined ? ExpressExtender.validateAndConvert(val, pm, res) : [true, val];
    }

    private static xtBodyValue(state: ITERPARAMSTATE, req: Request, res: Response): [boolean, any] {
        const pm = state.pm as MandatoryKPM;
        const val = req.body ? req.body[pm.key] : undefined;
        if(pm.mandatory && val === undefined) {
            res.status(400).send(PayloadResult.failure(`Missing mandatory body value ${pm.key}`));
            return [false, undefined];
        }
        return val !== undefined ? ExpressExtender.validateAndConvert(val, pm, res) : [true, val];
    }

    private static validateAndConvert(val: any, pm: MandatoryKPM, res: Response): [boolean, any] {
        if(pm.validate) {
            try {
                const reportOBJ : VREPORT = { error: null };
                for(let vfn of pm.validate) {
                    const valid = vfn(val, reportOBJ);
                    if(!valid) {
                        res.status(400).send(PayloadResult.failure(reportOBJ.error || `Invalid value: "${val}"`));
                        return [false, undefined];
                    }
                }
            } catch(e) {
                res.status(500).send(PayloadResult.failure('Internal server error'));
                console.error('Error validating value', e);
                return [false, undefined];
            }
        }
        if(pm.convertTo) {
            try {
                val = pm.convertTo(val);
            } catch(e) {
                res.status(400).send(PayloadResult.failure(`Failed to convert provided value: "${val}"`));
                return [false, undefined];
            }
        }
        return [true, val];
    }

    private static xtJwtValue(state: ITERPARAMSTATE, req: Request, res: Response): [boolean, any] {
        const pm = state.pm as KeyedParamMapper;
        if(!state.jwt_obj) {
            res.status(401).send(PayloadResult.failure('Unfulfilled JWT requirement'));
            return [false, undefined];
        }
        const val = state.jwt_obj[pm.key];
        if(val === undefined) {
            res.status(401).send(PayloadResult.failure(`Missing JWT value ${pm.key}`));
            return [false, undefined];
        }
        return [true, val];
    }

    private static xtReqObject(state: ITERPARAMSTATE, req: Request, res: Response): [boolean, any] {
        return [true, req];
    }

    private static xtResObject(state: ITERPARAMSTATE, req: Request, res: Response): [boolean, any] {
        return [true, res];
    }

    static {
        ExpressExtender.valueExtractorFX[ParamType.URL_PARAM]   = ExpressExtender.xtUrlParam;
        ExpressExtender.valueExtractorFX[ParamType.QUERY_PARAM] = ExpressExtender.xtQueryParam;
        ExpressExtender.valueExtractorFX[ParamType.BODY_VALUE]  = ExpressExtender.xtBodyValue;
        ExpressExtender.valueExtractorFX[ParamType.JWT_VALUE]   = ExpressExtender.xtJwtValue;
        ExpressExtender.valueExtractorFX[ParamType.REQ_OBJECT]  = ExpressExtender.xtReqObject;
        ExpressExtender.valueExtractorFX[ParamType.RES_OBJECT]  = ExpressExtender.xtResObject;
    }

    // </value-extractors>

    private constructor(jwt_decoder?: JWTDECODER) {
        this.jwt_decoder = jwt_decoder || emptyJWTDecoder;
    }

    static init(jwt_decoder?: JWTDECODER): ExpressExtender {
        return new ExpressExtender(jwt_decoder);
    }

    private static recordJWTProps(needsAuth: boolean, jwt_decoder: JWTDECODER, req: Request, res: Response): [boolean, STRKEYOBJ | null] {
        if(needsAuth) {
            const bearerHeader = req.headers['authorization'];
            if(!bearerHeader) {
                res.status(401).send(PayloadResult.failure('Unauthorized'));
                return [false, null];
            }

            try {
                const temp_obj = jwt_decoder(bearerHeader, req, res);
                return [true, temp_obj];
            } catch(e) {
                res.status(400).send(PayloadResult.failure('Internal server error'));
                console.error('Error decoding JWT', e);
                return [false, null];
            }
        } else {
            return [true, null];
        }
    }

    private static recordParamValues(paramsMaps: ParamMapper[], jwtProps: STRKEYOBJ | null, req: Request, res: Response): [boolean, any[]] {
        const paramVals: any[] = new Array<any>(paramsMaps.length);
        const iterState: ITERPARAMSTATE = {
            pm: null,
            jwt_obj: jwtProps
        };

        for(let i = 0; i < paramsMaps.length; i++) {
            const paramMap = paramsMaps[i];
            if(!paramMap) { continue; }
            iterState.pm = paramMap;

            const [success, val] = ExpressExtender.valueExtractorFX[paramMap.paramType](iterState, req, res);

            if(!success) {
                return [false, []];
            } else {
                paramVals[i] = val;
            }
        }

        return [true, paramVals];
    }

    private static async genericHandler(needsAuth: boolean, jwt_decoder: JWTDECODER, fx: AsyncFunc, paramsMaps: ParamMapper[], req: Request, res: Response) {
        const [jwtOk, jwtProps] = ExpressExtender.recordJWTProps(needsAuth, jwt_decoder, req, res);
        if(!jwtOk) return;

        const [paramOk, params] = ExpressExtender.recordParamValues(paramsMaps, jwtProps, req, res);
        if(!paramOk) return;

        try {
            const result = await fx(...params);
            if(result instanceof Result) {
                res.status(result.extraCode || 200).send(PayloadResult.fromResult(result));
            } else {
                res.status(200).send(PayloadResult.success(result));
            }
        } catch(e) {
            res.status(500).send(PayloadResult.failure('Internal server error'));
            console.error('Error executing route handler function', e);
        }
    }

    private registerRoute(method: string, route: string, needsAuth: boolean, fx: AsyncFunc, paramsMaps: ParamMapper[]) {
        const key = `${method}:${route}`;
        if(this.registeredRoutes.has(key)) {
            console.warn(`Attempt to re-register ${key}, ignoring.`);
            return;
        }

        this.registeredRoutes.set(key, async (req: Request, res: Response) => {
            ExpressExtender.genericHandler(needsAuth, this.jwt_decoder, fx, paramsMaps, req, res);
            // await ExpressExtender.genericHandler(needsAuth, this.jwt_decoder, fx, paramsMaps, req, res);
        });
    }

    public registerClass(ClassRef: Function) {
        const Class = ClassRef as unknown as WithConfigMap;
        if(this.registeredClasses.has(Class)) {
            console.warn(`Attempt to re-register ${Class.name}, ignoring.`);
            return this;
        }

        if(Class.prototype.__webcfg__ === undefined || !(Class.prototype.__webcfg__ instanceof Map)) {
            throw new Error(`Class ${Class.name} does not have a valid __webcfg__ property`);
        }

        const cfgMap = Class.prototype.__webcfg__ as Map<string, RequestConfig>;

        for(const [key, reqCfg] of cfgMap) {
            let { fx, methods, route, needsAuth, params } = reqCfg;

            if((fx     === undefined)
            || methods === undefined
            || route   === undefined) {
                throw new Error(`Invalid configuration for ${Class.name}.${key}`);
            }

            if(!fx.constructor.name.startsWith('AsyncFunction')) {
                throw new Error(`Function ${Class.name}.${key} is not an async function`);
            }

            params    = params    || [];
            needsAuth = needsAuth || false;

            for(const method of methods) {
                this.registerRoute(method, route, needsAuth, fx, params);
            }
        }

        this.registeredClasses.add(Class);

        return this;
    }

    public applyToExpress(app: Application) {
        for(const [key, handler] of this.registeredRoutes) {
            const [method, ..._route] = key.split(':');
            const route = _route.join(':');

            switch(method) {
                case 'GET':     app.get(route, handler);     break;
                case 'POST':    app.post(route, handler);    break;
                case 'PUT':     app.put(route, handler);     break;
                case 'DELETE':  app.delete(route, handler);  break;
                case 'PATCH':   app.patch(route, handler);   break;
                case 'HEAD':    app.head(route, handler);    break;
                case 'OPTIONS': app.options(route, handler); break;
                default: throw new Error(`Invalid method ${method} for route ${key}`);
            }
        }

        return this;
    }

    public clearRegistrations() {
        this.registeredRoutes.clear();
        this.registeredClasses.clear();
    }

    public updateJWTDecoder(jwt_decoder: (bearerHeader: string) => STRKEYOBJ) {
        this.jwt_decoder = jwt_decoder;
    }
}