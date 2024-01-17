import { parentPort, workerData } from 'worker_threads';
import { DBCon } from "../utils/db";

import {
    WORKER_COMMAND, WORKER_REPLY,
    WorkerCommand, WorkerConvertCmd,
    WorkerReply, WorkerConvertReply,
    WorkerData,
    WorkerException,
    ensureDirectory
} from "../utils/shared";

import { GradingTask } from "./grader";
import { CSVWriter }   from "./csv-writer";
import { HTMLWriter }  from "./html-writer";
import { ObjectId } from 'mongodb';

const wdata = workerData as WorkerData;

DBCon.initDatabse(
    wdata.dbConfig.url,
    wdata.dbConfig.dbName,
    wdata.dbConfig.collectionNames,
    wdata.dbConfig.dbOptions
);

function msgHandler(command: WorkerCommand) {
    switch(command.cmd) {
        case WORKER_COMMAND.CONNECT_DB: {
            DBCon.connect()
                .then(() => {
                    parentPort?.postMessage({
                        reply: WORKER_REPLY.DB_CONNECTED
                    } as WorkerReply);
                })
                .catch(err => {
                    parentPort?.postMessage({
                        reply: WORKER_REPLY.DB_CONN_ERROR,
                        error: String(err)
                    } as WorkerReply);
                });
        }
        break;

        case WORKER_COMMAND.CONVERT_CSV: {
            const cmd = command as WorkerConvertCmd;
            const fullPath = `./generated/${cmd.author}/csv/${cmd.uuid}.csv`;
            ensureDirectory(fullPath);
            const task = new GradingTask(new ObjectId(cmd.id), new CSVWriter(fullPath));
            task
                .prepare()
                .then(res => {
                    if(!res.ok) {
                        throw new WorkerException(res.msg);
                    }
                    return task.run();
                })
                .then(res => {
                    if(!res.ok) {
                        throw new WorkerException(res.msg);
                    }
                })
                .then(() => {
                    parentPort?.postMessage({
                        reply:  WORKER_REPLY.CSV_CONVERTED,
                        uuid:   cmd.uuid,
                        author: cmd.author
                    } as WorkerConvertReply);
                })
                .catch(err => {
                    parentPort?.postMessage({
                        reply:  WORKER_REPLY.CSV_CONV_ERROR,
                        error:  err.reason || String(err),
                        uuid:   cmd.uuid,
                        author: cmd.author
                    } as WorkerConvertReply);
                });
        }
        break;

        case WORKER_COMMAND.CONVERT_HTML: {
            const cmd = command as WorkerConvertCmd;
            const fullPath = `./generated/${cmd.author}/html/${cmd.uuid}.html`;
            ensureDirectory(fullPath);
            const task = new GradingTask(new ObjectId(cmd.id), new HTMLWriter(fullPath));
            task
                .prepare()
                .then(res => {
                    if(!res.ok) {
                        throw new WorkerException(res.msg);
                    }
                    return task.run();
                })
                .then(res => {
                    if(!res.ok) {
                        throw new WorkerException(res.msg);
                    }
                })
                .then(() => {
                    parentPort?.postMessage({
                        reply:  WORKER_REPLY.HTML_CONVERTED,
                        uuid:   cmd.uuid,
                        author: cmd.author
                    } as WorkerConvertReply);
                })
                .catch(err => {
                    parentPort?.postMessage({
                        reply:  WORKER_REPLY.HTML_CONV_ERROR,
                        error:  err.reason || String(err),
                        uuid:   cmd.uuid,
                        author: cmd.author
                    } as WorkerConvertReply);
                });
        }
        break;

        default: {
            parentPort?.postMessage({
                reply: WORKER_REPLY.NOT_IMPLEMENTED,
                error: `Command ${WORKER_COMMAND[command.cmd]} not implemented`
            } as WorkerReply);
        }  
    }
}

parentPort?.on('message', msgHandler);