import { Res, RESSTATE } from "./common";

enum HTTPMETHOD { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, TRACE, __UNKNOWN__ }

export abstract class Fetcher {
    protected _url: URL;
    protected _result: Res;
    protected _method: HTTPMETHOD;
    protected _body?: { [key: string]: any};
    protected _headers: { [key: string]: string } = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    protected _onSuccess: (data?: any, fetcher?: Fetcher) => void = () => {};
    protected _onFailure: (msg?: string, fetcher?: Fetcher) => void = () => {};
    protected _onError: (msg?: string, fetcher?: Fetcher) => void = () => {};
    protected _onFinally: (fetcher?: Fetcher) => void = () => {};
    public _response: Response | null = null;
    public _parsed: any = null;

    protected constructor(base?: string) {
        if(base) {
            this._url = new URL(base);
        } else {
            this._url = new URL(window.location.origin);
        }
        this._result = Res.success();
        this._method = HTTPMETHOD.__UNKNOWN__;
    }

    private route(subpath: string, method: HTTPMETHOD): Fetcher {
        if(this._method !== HTTPMETHOD.__UNKNOWN__) {
            throw new Error("Route already set");
        } else {
            this._url = new URL(subpath, this._url);
            this._method = method;
            return this;
        }
    }

    public get(subpath: string):     Fetcher { return this.route(subpath, HTTPMETHOD.GET); }
    public post(subpath: string):    Fetcher { return this.route(subpath, HTTPMETHOD.POST); }
    public put(subpath: string):     Fetcher { return this.route(subpath, HTTPMETHOD.PUT); }
    public delete(subpath: string):  Fetcher { return this.route(subpath, HTTPMETHOD.DELETE); }
    public patch(subpath: string):   Fetcher { return this.route(subpath, HTTPMETHOD.PATCH); }
    public head(subpath: string):    Fetcher { return this.route(subpath, HTTPMETHOD.HEAD); }
    public options(subpath: string): Fetcher { return this.route(subpath, HTTPMETHOD.OPTIONS); }
    public trace(subpath: string):   Fetcher { return this.route(subpath, HTTPMETHOD.TRACE); }

    public body(body: { [key: string]: any }): Fetcher {
        this._body = body;
        return this;
    }

    public addQuery(key: string, value: string): Fetcher {
        this._url.searchParams.append(key, value);
        return this;
    }

    public addQueries(queries: { [key: string]: string }): Fetcher {
        for(let key in queries) {
            this.addQuery(key, queries[key]);
        }
        return this;
    }

    public addHeader(key: string, value: string): Fetcher {
        this._headers[key] = value;
        return this;
    }

    public addHeaders(headers: { [key: string]: string }): Fetcher {
        for(let key in headers) {
            this.addHeader(key, headers[key]);
        }
        return this;
    }

    public success(callback: (data?: any, fetcher?: Fetcher) => void): Fetcher {
        this._onSuccess = callback;
        return this;
    }

    public failure(callback: (msg?: any, fetcher?: Fetcher) => void): Fetcher {
        this._onFailure = callback;
        return this;
    }

    public error(callback: (msg?: any, fetcher?: Fetcher) => void): Fetcher {
        this._onError = callback;
        return this;
    }

    public finally(callback: (fetcher?: Fetcher) => void): Fetcher {
        this._onFinally = callback;
        return this;
    }

    protected async fetch(): Promise<void> {
        if(this._method === HTTPMETHOD.__UNKNOWN__) {
            throw new Error("Route not set");
        }

        try {
            this._response = await fetch(this._url.toString(), {
                method: HTTPMETHOD[this._method],
                headers: this._headers,
                body: this._body ? JSON.stringify(this._body) : undefined
            });
        } catch(e: any) {
            this._result = Res.error(e.message);
        }

        if(this._response) {
            try {
                this._parsed = await this._response.json();
            } catch(e: any) {
                this._result = Res.error(e.message);
            }
        }
    }

    protected runCallback(): void {
        switch(this._result.status) {
            case RESSTATE.SUCCESS:
                this._onSuccess && this._onSuccess(this._parsed.data || null, this);
                break;
            case RESSTATE.FAILURE:
                this._onFailure && this._onFailure(this._result.msg as string || 'Unknown Failure', this);
                break;
            case RESSTATE.ERROR:
                this._onError && this._onError(this._result.msg as string || 'Unknown Error', this);
                break;
        }
    }

    public abstract exec(): Promise<void>;
}