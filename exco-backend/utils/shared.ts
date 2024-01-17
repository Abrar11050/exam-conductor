import { ObjectId } from "mongodb";
import { Result } from "./common";
import { DBOPTIONS } from "./db";
import fs from 'fs';
import path from 'path';

export function correctFactor(correct: number[], provided: number[]): number {
    if(correct.length === 0) 
        if(provided.length === 0)
            return 1;
        else
            return 0;
    
    let success = 0;
    let failure = 0;
    for (const sample of provided) {
        if (correct.includes(sample)) {
            success++;
        } else {
            failure++;
        }
    }
    let score = 1.0 * success - 0.25 * failure;
    score = Math.max(0, score);

    return score / correct.length;
}

export enum QuesType {
    RADIO    = 0,
    CHECKBOX = 1
}

export type Qstruct = {
    _id:         ObjectId,

    points:      number,
    quesType:    QuesType,
    correct:     number[],
    
    optLength?:  number
};

export type Astruct = {
    question:     ObjectId,
    usedAttempts: number,
    provided:     number[]
};

export type QAScores = {
    scores: number[],
    total:  number,
    grand:  number
};

export function scorify(qx: Qstruct[], ax: Astruct[], subID?: ObjectId): Result<QAScores> {
    if(qx.length !== ax.length)
        return Result.failure(`Question and Answer array length mismatch for: ${subID}`).setExtra(500).transmute();
    
    const scores: number[] = new Array<number>(qx.length);
    let total = 0;
    let grand = 0;
    
    for(let i = 0; i < qx.length; i++) {
        const ques = qx[i];
        const ans  = ax[i];

        if(!ques._id.equals(ans.question))
            return Result.failure(`Out of sync Q&A at index ${i} for ${subID}`).setExtra(500).transmute();
        
        if(ans.usedAttempts === 0) {
            total += scores[i] = 0;
        } else {
            total += scores[i] = ques.points * correctFactor(ques.correct, ans.provided);
        }

        grand += ques.points;
    }

    return Result.success({ scores, total, grand });
}

/////////// WORKER RELATED ///////////

export enum WORKER_COMMAND {
    CONNECT_DB,
    CONVERT_CSV,
    CONVERT_HTML
}

export enum WORKER_REPLY {
    DB_CONNECTED,
    CSV_CONVERTED,
    HTML_CONVERTED,

    // errors
    DB_CONN_ERROR,
    CSV_CONV_ERROR,
    HTML_CONV_ERROR,
    NOT_IMPLEMENTED
}

export interface WorkerCommand {
    cmd: WORKER_COMMAND
}

export interface WorkerConvertCmd extends WorkerCommand {
    id:     string,
    uuid:   string,
    author: string
}

export interface WorkerReply {
    reply: WORKER_REPLY,
    error?: string
}

export interface WorkerConvertReply extends WorkerReply {
    uuid:   string,
    author: string
}

export interface DBConfig {
    url:             string,
    dbName:          string,
    collectionNames: string[],
    dbOptions?:      DBOPTIONS
}

export interface WorkerData {
    dbConfig: DBConfig
}

export class WorkerException extends Error {
    public reason: string;
    constructor(message: string) {
        super(message);
        this.name = 'WorkerException';
        this.reason = message;
    }
}

export function ensureDirectory(fullFilePath: string) {
    const dir = path.dirname(fullFilePath);
    if(!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}