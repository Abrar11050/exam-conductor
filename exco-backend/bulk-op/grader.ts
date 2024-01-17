import { DBCon } from '../utils/db';
import { COL_QUES, COL_ANS, COL_USER } from '../utils/decls';
import { Result } from '../utils/common';
import { ObjectId } from 'mongodb';
import { QuesType, scorify } from '../utils/shared';

export interface QuesEntity {
    _id:         ObjectId,
    correct:     number[],
    quesType:    QuesType,
    points:      number,
    optLength:   number
}

export interface ExamEntity {
    _id:         ObjectId,
    title:       string,
    windowStart: Date,
    windowEnd:   Date,
    duration:    number,
    questions:   QuesEntity[]
}

export interface SubmissionEntity {
    _id: ObjectId,
    givenBy: {
        _id:       ObjectId,
        firstName: string,
        lastName:  string,
        email:     string
    } | null,
    answers: {
        question:     ObjectId,
        usedAttempts: number,
        provided:     number[]
    }[]
}

export interface ProcessedEntity {
    stdID:    ObjectId | null,
    stdName:  string | null,
    stdEmail: string | null,
    scores:   number[]
    total:    number
}

const MAX_BATCH_SIZE = 10;

async function fetchExam(examID: ObjectId): Promise<Result<ExamEntity>> {
    try {
        const exam = await DBCon.colls[COL_QUES].aggregate([
            {
                $match: {
                    _id: examID
                }
            },
            {
                $project: {
                    questions: {
                        $map: {
                            input: "$questions",
                            as: "questions",
                            in: {
                                _id:      "$$questions._id",
                                correct:  "$$questions.correct",
                                quesType: "$$questions.quesType",
                                points:   "$$questions.points",
                                optLength: { $size: "$$questions.options" }
                            }
                        }
                    },
                    title:       1,
                    windowStart: 1,
                    windowEnd:   1,
                    duration:    1
                }
            }
        ]).toArray();
    
        if (exam.length === 0) {
            return Result.failure("Exam not found");
        } else {
            return Result.success(exam[0] as ExamEntity);
        }
    } catch (err) {
        console.error(err);
        return Result.failure("Error fetching exam");
    }
}

async function fetchSubmissions(examID: ObjectId, skip: number, limit: number): Promise<Result<SubmissionEntity[]>> {
    try {
        const ag = await DBCon.colls[COL_ANS].aggregate([
            {
                $match: { exam: examID }
            },
            {
                $project: { givenBy: 1, answers: 1, }
            },
            {
                $lookup: {
                    from: DBCon.collNames[COL_USER],
                    localField: "givenBy",
                    foreignField: "_id",
                    as: "givenBy"
                }
            },
            {
                $project: {
                    givenBy: {
                        $map: {
                            input: "$givenBy",
                            as: "givenBy",
                            in: {
                                _id:       "$$givenBy._id",
                                firstName: "$$givenBy.firstName",
                                lastName:  "$$givenBy.lastName",
                                email:     "$$givenBy.email"
                            }
                        }
                    },
                    answers: 1
                }
            },
            {
                $project: {
                    givenBy: {
                        $cond: {
                            if: { $eq: [ { $size: "$givenBy" }, 1 ] },
                            then: { $arrayElemAt: [ "$givenBy", 0 ] },
                            else: null
                        }
                    },
                    answers: 1
                }
            },
            {   $skip: skip   },
            {   $limit: limit   }
        ]).toArray();
    
        return Result.success(ag as SubmissionEntity[]);
    } catch(err) {
        console.error(err);
        return Result.failure(`Error fetching submissions [examID: ${examID}, skip: ${skip}, limit: ${limit}]`);
    }
}

type BATCHRES = { proceed: boolean, entities: ProcessedEntity[], failures: string[] };

function processOne(questions: QuesEntity[], submission: SubmissionEntity): Result<ProcessedEntity> {
    const quesArray = questions;
    const ansArray  = submission.answers;

    const _res = scorify(quesArray, ansArray, submission._id);
    if(!_res.ok) return _res.transmute();

    const { total, scores } = _res.get();

    const entity: ProcessedEntity = {
        stdID:    submission.givenBy?._id || null,
        stdName:  submission.givenBy !== null ? `${submission.givenBy.firstName} ${submission.givenBy.lastName}` : '<Unknown Name>',
        stdEmail: submission.givenBy?.email || '<N/A>',
        scores, total
    };

    return Result.success(entity);
}

async function runBatch(exam: ExamEntity, skip: number): Promise<Result<BATCHRES>> {
    const _sub = await fetchSubmissions(exam._id, skip, MAX_BATCH_SIZE);
    if(!_sub.ok) return _sub.transmute();

    const subs = _sub.get();
    const entities: ProcessedEntity[] = [];
    const failures: string[] = [];

    for (const sub of subs) {
        try {
            const res = processOne(exam.questions, sub);
            if(res.ok) {
                entities.push(res.get());
            } else {
                failures.push(res.msg);
            }
        } catch (err) {
            failures.push(`Error processing submission ${sub._id}`);
            console.error(err);
        }
    }

    const proceed = subs.length === MAX_BATCH_SIZE;

    return Result.success({ proceed, entities, failures });
}

export interface GradingHandler {
    onInitiate(exam: ExamEntity): void;
    onBatchDone(exam: ExamEntity, procs: ProcessedEntity[]): void;
    onComplete(exam: ExamEntity): void;
    onFailure(msg: string): void;
}

export class GradingTask {
    private examID:  ObjectId;
    private examNTT: ExamEntity | null = null;
    private handler: GradingHandler;

    public constructor(examID: ObjectId, handler: GradingHandler) {
        this.examID  = examID;
        this.handler = handler;
    }

    public async prepare(): Promise<Result<void>> {
        const _exam = await fetchExam(this.examID);
        if(!_exam.ok) return _exam.transmute();

        this.examNTT = _exam.get();

        return Result.success(void 0);
    }

    public async run(): Promise<Result<void>> {
        if(this.examNTT === null) return Result.failure('Exam not prepared');

        const exam = this.examNTT;

        this.handler.onInitiate(exam);

        let skip = 0;
        let proceed = true;
        while(proceed) {
            const _batch = await runBatch(exam, skip);
            if(!_batch.ok) return _batch.transmute();

            const batch = _batch.get();
            proceed = batch.proceed;
            skip += MAX_BATCH_SIZE;

            this.logFailures(batch.failures);

            this.handler.onBatchDone(exam, batch.entities);
        }

        this.handler.onComplete(exam);

        return Result.success(void 0);
    }

    private logFailures(failures: string[]): void {
        for(const failure of failures) {
            this.handler.onFailure(failure);
        }
    }
}