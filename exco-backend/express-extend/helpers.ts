// Author: Abrar Mahmud
// Email: abrar.mahmud@g.bracu.ac.bd

import { VREPORT } from "./extend";

export function IsString(val: any, reportOBJ: VREPORT): boolean {
    if(typeof val === 'string') {
        return true;
    } else {
        reportOBJ.error = `Expected string, got ${typeof val} for ${val}`;
        return false;
    }
}

export function NotEmpty(val: string, reportOBJ: VREPORT): boolean {
    if(typeof val === 'string' && val.length > 0) {
        return true;
    } else {
        reportOBJ.error = `Expected non-empty string, got empty string`;
        return false;
    }
}

export function MinLength(length: number) {
    return function(val: string, reportOBJ: VREPORT): boolean {
        if(typeof val === 'string' && val.length >= length) {
            return true;
        } else {
            reportOBJ.error = `Expected string "${val}" to be at least ${length} characters long, got ${val.length}`;
            return false;
        }
    }
}

export function MaxLength(length: number) {
    return function(val: string, reportOBJ: VREPORT): boolean {
        if(typeof val === 'string' && val.length <= length) {
            return true;
        } else {
            reportOBJ.error = `Expected string "${val}" to be at most ${length} characters long, got ${val.length}`;
            return false;
        }
    }
}

export function REGEX(regex: RegExp) {
    return function(val: string, reportOBJ: VREPORT): boolean {
        if(typeof val === 'string' && regex.test(val)) {
            return true;
        } else {
            reportOBJ.error = `Expected string "${val}" to match regex ${regex}`;
            return false;
        }
    }
}

export function IsEmail(val: string, reportOBJ: VREPORT): boolean {
    if(typeof val === 'string' && val.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        return true;
    } else {
        reportOBJ.error = `Expected email, got ${val}`;
        return false;
    }
}

export function IsNumberArray(val: any, reportOBJ: VREPORT): boolean {
    const unique = new Set();
    if(Array.isArray(val)) {
        for(const item of val) {
            if(typeof item !== 'number') {
                reportOBJ.error = `Expected number array, got ${typeof item} for ${item}`;
                return false;
            } else if(unique.has(item)) {
                reportOBJ.error = `Expected number array, got duplicate ${item}`;
                return false;
            } else {
                unique.add(item);
            }
        }
        return true;
    } else {
        reportOBJ.error = `Expected array, got ${typeof val} for ${val}`;
        return false;
    }
}

export function IsStringArray(val: any, reportOBJ: VREPORT): boolean {
    if(Array.isArray(val)) {
        for(const item of val) {
            if(typeof item !== 'string') {
                reportOBJ.error = `Expected string array, got ${typeof item} for ${item}`;
                return false;
            }
        }
        return true;
    } else {
        reportOBJ.error = `Expected array, got ${typeof val} for ${val}`;
        return false;
    }
}

export function ValidRole(val: number, reportOBJ: VREPORT): boolean {
    if(typeof val === 'number' && val >= 0 && val <= 1) {
        return true;
    } else {
        reportOBJ.error = `Expected valid role, got ${val}`;
        return false;
    }
}

export function IsMongoID(val: string, reportOBJ: VREPORT): boolean {
    if(typeof val === 'string' && val.match(/^[a-f\d]{24}$/i)) {
        return true;
    } else {
        reportOBJ.error = `Expected valid ID, got ${val}`;
        return false;
    }
}


export function IsBoolStr(val: string, reportOBJ: VREPORT): boolean {
    if(typeof val === 'string' && (val === 'true' || val === 'false')) {
        return true;
    } else {
        reportOBJ.error = `Expected valid boolean string, got ${val}`;
        return false;
    }
}

export function IsIntStr(val: string, reportOBJ: VREPORT): boolean {
    if(typeof val === 'string' && val.match(/^[0-9]+$/)) {
        return true;
    } else {
        reportOBJ.error = `Expected valid integer string, got ${val}`;
        return false;
    }
}

export function IsUUIDv4(val: string, reportOBJ: VREPORT): boolean {
    if(typeof val === 'string' && val.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
        return true;
    } else {
        reportOBJ.error = `Expected valid UUIDv4, got ${val}`;
        return false;
    }
}

export const Num  = (val: any) => val !== undefined ? Number(val)   : undefined;
export const Str  = (val: any) => val !== undefined ? String(val)   : undefined;
export const Bool = (val: any) => val !== undefined ? Boolean(val)  : undefined;
export const Time = (val: any) => val !== undefined ? new Date(val) : undefined;