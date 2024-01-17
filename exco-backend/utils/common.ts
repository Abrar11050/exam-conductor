import { ObjectId } from 'mongodb';

export interface WithOID {
    _id?: ObjectId;
}

export class Result<T> {
    public data: T | null;
    public msg: string;
    public ok: boolean;
    public extraCode: number = 0;

    constructor(data: T | null, msg: string, ok: boolean) {
        this.data = data;
        this.msg  = msg;
        this.ok   = ok;
    }

    public static success<T>(data: T, msg: string = "OK"): Result<T> {
        return new Result<T>(data, msg, true);
    }

    public static failure<T>(msg: string): Result<T> {
        return new Result<T>(null, msg, false);
    }

    public setExtra(code: number): Result<T> {
        this.extraCode = code;
        return this;
    }

    public get(): T {
        if (this.ok) {
            return this.data as T;
        } else {
            throw new Error(this.msg);
        }
    }

    public transmute<U>(): Result<U> {
        return new Result<U>(this.data as unknown as U, this.msg, this.ok).setExtra(this.extraCode);
    }
}

export class PayloadResult<T> {
    public data: T | null;
    public msg: string;
    public ok: boolean;

    constructor(data: T | null, msg: string, ok: boolean) {
        this.data = data;
        this.msg  = msg;
        this.ok   = ok;
    }

    public static success<T>(data: T, msg: string = "OK"): PayloadResult<T> {
        return new PayloadResult<T>(data, msg, true);
    }

    public static failure<T>(msg: string): PayloadResult<T> {
        return new PayloadResult<T>(null, msg, false);
    }

    public static fromResult<T>(result: Result<T>): PayloadResult<T> {
        return new PayloadResult<T>(result.data, result.msg, result.ok);
    }
}