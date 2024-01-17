export function calcDuration(examEnd: Date, startTime: Date, duration: number, clampDuration: boolean): number {
    if(clampDuration) {
        return Math.min(duration, examEnd.getTime() - startTime.getTime());
    } else {
        return duration;
    }
}

export enum RESSTATE {
    SUCCESS = 1,
    FAILURE = 2,
    ERROR = 3
}

export class Res {
    public status: RESSTATE;
    public msg: string | null;

    constructor(state: RESSTATE, msg: string | null) {
        this.status = state;
        this.msg = msg;
    }

    public static success(msg?: string) {
        return new Res(RESSTATE.SUCCESS, msg || null);
    }

    public static failure(msg?: string) {
        return new Res(RESSTATE.FAILURE, msg || null);
    }

    public static error(msg?: string) {
        return new Res(RESSTATE.ERROR, msg || null);
    }

    public ok(): boolean {
        return this.status === RESSTATE.SUCCESS;
    }
}

export type ResCallback = (res: Res) => void;

export const isMongoID = (id: string): boolean => {
    return /^[a-f\d]{24}$/i.test(id);
};

export function millisToHHMMSS(millis: number) {
    var hours = Math.floor(millis / 3600000); // 1 Hour = 36000 Milliseconds
    var minutes = Math.floor((millis % 3600000) / 60000); // 1 Minutes = 60000 Milliseconds
    var seconds = Math.floor(((millis % 360000) % 60000) / 1000); // 1 Second = 1000 Milliseconds
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

type GSFORMAT = 'csv' | 'html';
type GSSTATUS = 'running' | 'done' | 'error';

export interface GSDescriptor {
    title:     string,
    authorID:  string,
    examID:    string,
    uuid:      string,
    format:    GSFORMAT,
    timestamp: number,
    timeTaken: number,
    status:    GSSTATUS,
    error:     string | null
}

export function saveAuthStuffs(token: string, role: number) {
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', role.toString());
}

export function clearAuthStuffs() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
}

export enum LoadState {
    LOADING = 1,
    LOADED = 2,
    ERROR = 3,
    WARNING = 4
};

export function errorStateToText(state: LoadState) {
    if(state === LoadState.ERROR) {
        return 'error';
    } else if(state === LoadState.WARNING) {
        return 'warning';
    } else {
        return 'warning';
    }
}