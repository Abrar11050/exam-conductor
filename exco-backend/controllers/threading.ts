import { needsAuth, onRoute, urlParam, queryParam, jwtValue } from "../express-extend/extend";

import { IsString, IsMongoID, Str, IsUUIDv4 } from "../express-extend/helpers";

import { ObjectId } from "mongodb";

import { UserRole } from '../classes/user';

import { Result } from "../utils/common";

import { Worker } from 'worker_threads';

import { dbConfig } from "../utils/constants";

import { v4 as uuidv4 } from 'uuid';

import fs from 'fs';

import path from 'path';

import {
    WORKER_COMMAND, WORKER_REPLY,
    WorkerCommand, WorkerConvertCmd,
    WorkerReply, WorkerConvertReply,
    WorkerData,
    WorkerException,
    ensureDirectory
} from "../utils/shared";

import { ExamOps } from "../classes/questions";

type GSFORMAT = 'csv' | 'html';
type GSSTATUS = 'running' | 'done' | 'error';

interface GSDescriptor {
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

function formatToCmd(format: GSFORMAT): WORKER_COMMAND {
    switch(format) {
        case 'csv':  return WORKER_COMMAND.CONVERT_CSV;
        case 'html': return WORKER_COMMAND.CONVERT_HTML;
        default: throw new WorkerException(`Unknown format: ${format}`);
    }
}

export class WorkerService {
    private static worker: Worker;
    private static workerConnectedDB: boolean = false;

    static {
        // TODO: Move this to config
        WorkerService.worker = new Worker('./out/bulk-op/main.js', { workerData: { dbConfig: dbConfig } as WorkerData });

        WorkerService.worker.on('message', WorkerService.handleWorkerReply);

        WorkerService.worker.postMessage({
            cmd: WORKER_COMMAND.CONNECT_DB
        } as WorkerCommand);

        console.log('[>>> WORKER] DB Connection Request');
    }

    @onRoute('/api/newgrade/:id/', 'POST')
    @needsAuth()
    async generateGradesheet(
        @jwtValue('id')                                                      userID: string,
        @jwtValue('role')                                                    role:   number,
        @urlParam('id',       true, { convertTo: Str, validate: IsMongoID }) examID: string,
        @queryParam('format', true, { convertTo: Str, validate: IsString  }) format: string
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to perform this action').setExtra(403);
        }

        if(format !== 'csv' && format !== 'html') {
            return Result.failure(`Invalid format provided: ${format}`).setExtra(400);
        }

        if(!WorkerService.workerConnectedDB) {
            return Result.failure('Grading service is currently unavailable. Please try again later.').setExtra(503);
        }

        const authorID = new ObjectId(userID);

        const _res = await ExamOps.getExam(new ObjectId(examID), false, authorID);
        if(!_res.ok) return _res;

        const exam = _res.get();

        if(!authorID.equals(exam.madeBy as ObjectId)) {
            return Result.failure('You are not the author of this exam').setExtra(403);
        }

        const uuid = uuidv4();

        const gsd: GSDescriptor = {
            title:     exam.title || 'Untitled Exam',
            authorID:  userID,
            examID:    examID,
            uuid:      uuid,
            format:    format as GSFORMAT,
            timestamp: Date.now(),
            timeTaken: -1,
            status:    'running',
            error:     null
        };

        const jsonPath = `./generated/${userID}/metadata/${uuid}.json`;
        ensureDirectory(jsonPath);

        WorkerService.worker.postMessage({
            cmd:    formatToCmd(format as GSFORMAT),
            id:     examID,
            uuid:   uuid,
            author: userID
        } as WorkerConvertCmd);

        fs.writeFileSync(jsonPath, JSON.stringify(gsd, null, 4), { encoding: 'utf-8' });

        return Result.success(gsd);
    }

    @onRoute('/api/gstatus', 'GET')
    @needsAuth()
    async getGradesheetStatus(
        @jwtValue('id')                                                 userID: string,
        @jwtValue('role')                                               role:   number,
        @queryParam('id', true, { convertTo: Str, validate: IsUUIDv4 }) uuid:   string
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to perform this action').setExtra(403);
        }

        const jsonPath = `./generated/${userID}/metadata/${uuid}.json`;

        if(!fs.existsSync(jsonPath)) {
            return Result.failure(`Cannot find gradesheet status for UUID: ${uuid}`).setExtra(404);
        }

        try {
            const gsd: GSDescriptor = JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf-8' }).toString());

            return Result.success(gsd);
        } catch(e) {
            return Result.failure(`Error reading gradesheet status for UUID: ${uuid}`).setExtra(500);
        }
    }

    @onRoute('/api/gdlist', 'GET')
    @needsAuth()
    async getGradesheetList(
        @jwtValue('id')                                                    userID: string,
        @jwtValue('role')                                                  role:   number,
        @queryParam('full', false, { convertTo: Str, validate: IsString }) full:   string
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to perform this action').setExtra(403);
        }

        const dirPath = `./generated/${userID}/metadata/`;

        if(!fs.existsSync(dirPath)) {
            return Result.success([]);
        }

        const getFull = full === 'true';

        // RegEx to match: {uuidv4}.json
        const VALID_FILE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;

        const files = fs.readdirSync(dirPath).filter(f => VALID_FILE_REGEX.test(f));
        
        if(!getFull) {
            return Result.success(files.map(f => f.replace('.json', '')));
        }

        const gsdList: GSDescriptor[] = [];

        for(const file of files) {
            try {
                const gsd: GSDescriptor = JSON.parse(
                    fs.readFileSync(
                        path.join(dirPath, file),
                        { encoding: 'utf-8' }
                    ).toString()
                );

                gsdList.push(gsd);
            } catch(e) {
                continue;
            }
        }

        return Result.success(gsdList);
    }

    static handleWorkerReply(reply: WorkerReply) {
        switch(reply.reply) {
            case WORKER_REPLY.DB_CONNECTED: {
                WorkerService.workerConnectedDB = true;
                console.log('[<<< WORKER] DB Connected');
            }
            break;

            case WORKER_REPLY.CSV_CONVERTED:
            case WORKER_REPLY.HTML_CONVERTED: {
                const rep = reply as WorkerConvertReply;
                try {
                    const jsonPath = `./generated/${rep.author}/metadata/${rep.uuid}.json`;
                    const gsd: GSDescriptor = JSON.parse(
                        fs.readFileSync(jsonPath, { encoding: 'utf-8' }).toString()
                    );

                    gsd.status    = 'done';
                    gsd.timeTaken = Date.now() - gsd.timestamp;

                    fs.writeFileSync(jsonPath, JSON.stringify(gsd, null, 4), { encoding: 'utf-8' });
                } catch(e) {
                    return;
                }
            }
            break;

            case WORKER_REPLY.DB_CONN_ERROR: {
                WorkerService.workerConnectedDB = false;
                console.error('[<<< WORKER] DB Connection Error');
            }
            break;

            case WORKER_REPLY.CSV_CONV_ERROR:
            case WORKER_REPLY.HTML_CONV_ERROR: {
                const rep = reply as WorkerConvertReply;
                try {
                    const jsonPath = `./generated/${rep.author}/metadata/${rep.uuid}.json`;
                    const gsd: GSDescriptor = JSON.parse(
                        fs.readFileSync(jsonPath, { encoding: 'utf-8' }).toString()
                    );

                    gsd.status    = 'error';
                    gsd.timeTaken = Date.now() - gsd.timestamp;
                    gsd.error     = rep.error || 'Unknown error';

                    fs.writeFileSync(jsonPath, JSON.stringify(gsd, null, 4), { encoding: 'utf-8' });
                } catch(e) {
                    return;
                }
            }
            break;

            case WORKER_REPLY.NOT_IMPLEMENTED: {
                console.error('[<<< WORKER] Not implemented');
            }
            break;

            default: {
                console.error('[<<< WORKER] Unknown reply');
            }
        }
    }
}