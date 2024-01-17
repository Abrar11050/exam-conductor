import { Res, RESSTATE } from './common';
import { Fetcher } from './fetcher';

const REACT_APP_BASE_API_URL = process.env.REACT_APP_BASE_API_URL || undefined;

export class ExcoFetcher extends Fetcher {
    private _needAuth: boolean = false;
    private _noAuth?: (fetcher: ExcoFetcher) => void;
    private _genericHandler?: (fetcher: ExcoFetcher) => void;

    constructor() {
        super(new URL('api', REACT_APP_BASE_API_URL ? REACT_APP_BASE_API_URL : window.location.origin).href);
    }

    public static start(): ExcoFetcher {
        return new ExcoFetcher();
    }

    public needAuth(): ExcoFetcher {
        this._needAuth = true;
        return this;
    }

    public whenNoAuth(noAuth: (fetcher: ExcoFetcher) => void): ExcoFetcher {
        this._noAuth = noAuth;
        return this;
    }

    public genericHandler(handler: (fetcher: ExcoFetcher) => void): ExcoFetcher {
        this._genericHandler = handler;
        return this;
    }

    public async exec(): Promise<void> {
        if(this._result.status === RESSTATE.SUCCESS) {
            if(this._needAuth) {
                const token = localStorage.getItem('token');
                if(token)
                    this.addHeader('Authorization', `Bearer ${token}`);
                else
                    if(this._noAuth)
                        this._noAuth(this);
                    else
                        this._result = Res.failure('Not authenticated');
            }
            await this.fetch();
        }

        if(this._genericHandler) {
            this._genericHandler(this);
        } else {
            if(this._result.status === RESSTATE.SUCCESS && this._response) {
                const code = this._response.status;
                if(code !== 200) {
                    this._result = Res.failure(this._parsed ? this._parsed.msg : 'Unknown error occured');
                }
            }
            this.runCallback();
        }
        
        this._onFinally?.(this);
    }
}