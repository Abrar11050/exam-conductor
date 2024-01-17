import { ObjectId, PushOperator } from 'mongodb';
import { WithOID, Result } from '../utils/common';
import { DBCon } from '../utils/db';
import { COL_QUES } from '../utils/decls';
import { QuesType } from '../utils/shared';
import { User } from './user';

export interface Question extends WithOID {
    text?:        string,
    points?:      number,
    maxAttempts?: number,
    quesType?:    QuesType,
    options?:     string[],
    correct?:     number[]
}

export interface Exam extends WithOID {
    madeBy?:      ObjectId,
    title?:       string,
    description?: string,
    windowStart?: Date,
    windowEnd?:   Date,
    duration?:    number,
    clampTime?:   boolean,
    showScores?:  boolean,
    hasScripts?:  boolean,
    questions?:   Question[]
}

export interface MicroExamInfo {
    examID:      ObjectId,
    madeBy:      ObjectId,
    title:       string,
    windowStart: Date,
    windowEnd:   Date,
    duration:    number,
    showScores:  boolean,

    subID?:        ObjectId,
    subGivenBy?:   User,
    subStartTime?: Date,
    subFinished?:  boolean
}

export class ExamOps {
    static async create(exam: Exam): Promise<Result<ObjectId>> {
        if(!exam.title || !exam.windowStart || !exam.windowEnd || !exam.duration || !exam.madeBy) {
            return Result.failure<ObjectId>("Invalid exam properties").setExtra(400);
        }
        if(exam.windowStart.getTime() > exam.windowEnd.getTime()) {
            return Result.failure<ObjectId>("Invalid exam window").setExtra(400);
        }
        if(exam.duration <= 0) {
            return Result.failure<ObjectId>("Invalid exam duration").setExtra(400);
        }

        exam.description = exam.description || "";
        exam.questions   = [];
        exam.clampTime   = exam.clampTime  || false;
        exam.showScores  = exam.showScores || false;
        exam.hasScripts  = false;

        try {
            const res = await DBCon.colls[COL_QUES].insertOne(exam);
            return Result.success<ObjectId>(res.insertedId);
        } catch(e) {
            console.error(e);
            return Result.failure<ObjectId>("Failed to create exam").setExtra(500);
        }
    }

    static async update(exam: Exam, authorID: ObjectId): Promise<Result<void>> {
        // deny updating _id, madeBy, questions
        const { _id, madeBy, questions, ...update } = exam;

        if(!exam._id) return Result.failure<void>("Invalid exam ID").setExtra(400);

        const _tvl = await ExamOps.validateTime(exam._id, exam.windowStart, exam.windowEnd);
        if(!_tvl.ok) return _tvl.transmute();

        const timeOK = _tvl.data || false;

        if(!timeOK) {
            return Result.failure<void>("Invalid exam window").setExtra(400);
        }

        try {
            // update only if madeBy matches authorID
            const res = await DBCon.colls[COL_QUES].updateOne(
                { _id: exam._id, madeBy: authorID },
                { $set: update }
            );

            if(res.matchedCount === 0) {
                return Result.failure<void>("Exam not found").setExtra(404);
            } else if(res.modifiedCount === 0) {
                return Result.failure<void>("Exam not modified").setExtra(406);
            } else {
                return Result.success<void>(void 0);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<void>("Failed to update exam").setExtra(500);
        }
    }

    private static async validateTime(examID: ObjectId, windowStart?: Date, windowEnd?: Date): Promise<Result<boolean>> {
        if(windowStart !== undefined && windowEnd !== undefined) {
            return Result.success<boolean>(windowStart.getTime() < windowEnd.getTime());
        }

        if(windowStart === undefined && windowEnd === undefined) {
            return Result.success<boolean>(true);
        }

        const _exam = await DBCon.colls[COL_QUES].findOne(
            { _id: examID },
            { projection: { windowStart: 1, windowEnd: 1 } }
        );

        if(_exam === null) {
            return Result.failure<boolean>("Exam not found").setExtra(404);
        } else {
            const exam = _exam as Exam;

            if(exam.windowStart === undefined || exam.windowEnd === undefined) {
                return Result.failure<boolean>("Invalid exam window").setExtra(500);
            }

            if(windowStart !== undefined) {
                return Result.success<boolean>(windowStart.getTime() < exam.windowEnd.getTime());
            }

            if(windowEnd !== undefined) {
                return Result.success<boolean>(exam.windowStart.getTime() < windowEnd.getTime());
            }

            return Result.failure<boolean>("Invalid exam window").setExtra(500);
        }
    }

    static async erase(examID: ObjectId, authorID: ObjectId): Promise<Result<void>> {
        try {
            // delete only if madeBy matches authorID
            const res = await DBCon.colls[COL_QUES].deleteOne(
                { _id: examID, madeBy: authorID }
            );
            if(res.deletedCount === 0) {
                return Result.failure<void>("Exam not found").setExtra(404);
            } else {
                return Result.success<void>(void 0);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<void>("Failed to erase exam").setExtra(500);
        }
    }

    static async getExam(examID: ObjectId, full: boolean, authorID: ObjectId): Promise<Result<Exam>> {
        try {
            const ag = DBCon.colls[COL_QUES].aggregate([
                {   $match: { _id: examID } },
                {   $project: {
                        madeBy:      1,
                        title:       1,
                        description: 1,
                        windowStart: 1,
                        windowEnd:   1,
                        duration:    1,
                        clampTime:   1,
                        showScores:  1,
                        hasScripts:  1,
                        questions:   full ? {
                            $cond: {
                                'if':   { $eq: ["$madeBy", authorID] },
                                'then': "$questions",
                                'else': null
                            }
                        } : null
                    }
                }
            ]);

            const res = await ag.next();

            if(res === null) {
                return Result.failure<Exam>("Exam not found").setExtra(404);
            } else {
                return Result.success<Exam>(res as Exam);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<Exam>("Failed to get exam").setExtra(500);
        }
    }

    static async checkIfOwner(examID: ObjectId, authorID: ObjectId): Promise<Result<boolean>> {
        try {
            const res = await DBCon.colls[COL_QUES].findOne(
                { _id: examID },
                { projection: { madeBy: 1 } }
            );

            if(res === null) {
                return Result.failure<boolean>("Exam not found").setExtra(404);
            } else {
                const exam = res as Exam;
                return Result.success<boolean>(authorID.equals(exam.madeBy as ObjectId));
            }
        } catch(e) {
            console.error(e);
            return Result.failure<boolean>("Failed to check if owner").setExtra(500);
        }
    }

    static async getOwnedExams(authorID: ObjectId, newest: boolean, limit: number, cursor: number): Promise<Result<MicroExamInfo[]>> {
        try {
            const ag = DBCon.colls[COL_QUES].aggregate([
                {   $match: { madeBy: authorID } },
                {   $project: {
                        _id:         1,
                        title:       1,
                        windowStart: 1,
                        windowEnd:   1,
                        duration:    1,
                        showScores:  1
                    }
                },
                {   $sort: { windowStart: newest ? -1 : 1 } },
                {   $skip: cursor   },
                {   $limit: limit   }
            ]);

            const _res = await ag.toArray();

            const res = _res.map((e: Exam): MicroExamInfo => ({
                examID:      e._id as ObjectId,
                madeBy:      authorID,
                title:       e.title as string,
                windowStart: e.windowStart as Date,
                windowEnd:   e.windowEnd as Date,
                duration:    e.duration as number,
                showScores:  e.showScores as boolean
            }));

            return Result.success<MicroExamInfo[]>(res);
        } catch(e) {
            console.error(e);
            return Result.failure<MicroExamInfo[]>("Failed to get owned exams").setExtra(500);
        }
    }

    static async getQuestions(examID: ObjectId, showCorrects: boolean): Promise<Result<Question[]>> {
        const project : { [key: string]: number } = {
            madeBy:      0, title:       0,
            description: 0, windowStart: 0,
            windowEnd:   0, duration:    0,
            clampTime:   0, showScores:  0
        };
        if(!showCorrects) {
            project["questions.correct"] = 0;
        }
        try {
            const res = await DBCon.colls[COL_QUES].findOne(
                { _id: examID },
                { projection: project }
            );

            if(res === null) {
                return Result.failure<Question[]>("Exam not found").setExtra(404);
            } else {
                const exam = res as Exam;
                return Result.success<Question[]>(exam.questions || []);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<Question[]>("Failed to get questions").setExtra(500);
        }
    }

    static async canAddDelQuestions(examID: ObjectId): Promise<Result<boolean>> {
        try {
            const res = await DBCon.colls[COL_QUES].findOne(
                { _id: examID },
                { projection: { hasScripts: 1 } }
            );

            if(res === null) {
                return Result.failure<boolean>("Exam not found").setExtra(404);
            } else {
                const exam = res as Exam;
                return Result.success<boolean>(exam.hasScripts === false);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<boolean>("Failed to check if exam has scripts").setExtra(500);
        }
    }

    static async canUpdateQuestions(examID: ObjectId, quesID: ObjectId, newOptLength: number | undefined): Promise<Result<boolean>> {
        if(newOptLength === undefined) return Result.success<boolean>(true);

        try {
            const ag = DBCon.colls[COL_QUES].aggregate([
                {
                    $match: { _id: examID }
                },
                {
                    $project: {
                        questions: {
                            $filter: { input: "$questions", as: "questions", cond: { $eq: [ "$$questions._id", quesID ] } }
                        },
                        hasScripts: 1
                    }
                },
                {
                    $project: {
                        optionCount: {
                            $map: { input: "$questions", as: "questions", in: { $size: "$$questions.options" } }
                        },
                        hasScripts: 1
                    }
                },
                {
                    $project: {
                        optionCount: {
                            $cond: { if: { $eq: [ { $size: "$optionCount" }, 1 ] }, then: { $arrayElemAt: [ "$optionCount", 0 ] }, else: null }
                        },
                        hasScripts: 1
                    }
                }
            ]);

            const res = await ag.next();
            if(res === null) {
                return Result.failure<boolean>("Exam/Ques not found").setExtra(404);
            }

            const oldOptLength = res.optionCount as number;
            const hasScripts   = res.hasScripts as boolean;

            if(hasScripts === false) return Result.success<boolean>(true);

            if(oldOptLength === undefined || newOptLength === undefined) return Result.success<boolean>(false);

            if(newOptLength !== oldOptLength) return Result.success<boolean>(false);

            return Result.success<boolean>(true);
        } catch(e) {
            console.error(e);
            return Result.failure<boolean>("Failed to ques update permission").setExtra(500);
        }
    }
}

export class QuestionOps {
    static async create(examID: ObjectId, ques: Question, authorID: ObjectId, index?: number): Promise<Result<ObjectId>> {
        const _adddelres = await ExamOps.canAddDelQuestions(examID);
        if(!_adddelres.ok) return _adddelres.transmute();

        if(_adddelres.data !== true) {
            return Result.failure<ObjectId>("This exam has scripts, cannot add new questions").setExtra(400);
        }

        if(!ques.text)
            return Result.failure<ObjectId>("Question text is required").setExtra(400);
        if(ques.options === undefined || ques.options?.length === 0)
            return Result.failure<ObjectId>("Question options are required").setExtra(400);

        ques.points      = ques.points      || 1;
        ques.maxAttempts = ques.maxAttempts || 1;
        ques.quesType    = ques.quesType    || QuesType.RADIO;
        ques.correct     = ques.correct     || [];
        ques._id         = new ObjectId();

        for(let cr of ques.correct)
            if(cr >= ques.options.length)
                return Result.failure<ObjectId>("Invalid correct answer index").setExtra(400);
        
        ques.correct.sort((a, b) => a - b);

        try {
            let insertable : Question | PushOperator<Question> = ques;
            if(index !== undefined) {
                insertable = { $each: [ques], $position: index };
            }

            // update only if madeBy matches authorID
            const res = await DBCon.colls[COL_QUES].updateOne(
                { _id: examID, madeBy: authorID },
                { $push: { questions: insertable } }
            );

            if(res.matchedCount === 0) {
                return Result.failure<ObjectId>("Exam not found").setExtra(404);
            } else if(res.modifiedCount === 0) {
                return Result.failure<ObjectId>("Exam not modified").setExtra(406);
            } else {
                return Result.success<ObjectId>(ques._id);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<ObjectId>("Failed to create question").setExtra(500);
        }
    }

    static async update(examID: ObjectId, ques: Question, authorID: ObjectId): Promise<Result<void>> {
        // deny updating _id
        const { _id, ...update } = ques;
        const updateCopy : { [key: string]: any } = update;
        const updateDoc  : { [key: string]: any } = {};

        if(!examID) return Result.failure<void>("Invalid exam ID").setExtra(400);

        if(update.correct !== undefined) {
            update.correct.sort((a, b) => a - b);
        }

        if('options' in updateCopy && Array.isArray(updateCopy.options)) {
            const _updtres = await ExamOps.canUpdateQuestions(examID, ques._id as ObjectId, updateCopy.options.length);
            if(!_updtres.ok) return _updtres.transmute();

            if(_updtres.data !== true) {
                return Result.failure<void>("This questions's exam has scripts, cannot add/remove options").setExtra(400);
            }
        }

        ["text", "points", "maxAttempts", "quesType", "options", "correct"].forEach(key => {
            if(key in updateCopy) {
                updateDoc[`questions.$.${key}`] = updateCopy[key];
            }
        });

        try {
            // update only if madeBy matches authorID
            const res = await DBCon.colls[COL_QUES].updateOne(
                { _id: examID, madeBy: authorID, "questions._id": ques._id },
                { $set: updateDoc }
            );

            if(res.matchedCount === 0) {
                return Result.failure<void>("Exam not found").setExtra(404);
            } else if(res.modifiedCount === 0) {
                return Result.failure<void>("Exam not modified").setExtra(406);
            } else {
                return Result.success<void>(void 0);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<void>("Failed to update question").setExtra(500);
        }
    }

    static async erase(examID: ObjectId, quesID: ObjectId, authorID: ObjectId): Promise<Result<void>> {
        const _adddelres = await ExamOps.canAddDelQuestions(examID);
        if(!_adddelres.ok) return _adddelres.transmute();

        if(_adddelres.data !== true) {
            return Result.failure<void>("This exam has scripts, cannot delete questions").setExtra(400);
        }

        try {
            // update only if madeBy matches authorID
            const res = await DBCon.colls[COL_QUES].updateOne(
                { _id: examID, madeBy: authorID },
                { $pull: { questions: { _id: quesID } } }
            );

            if(res.matchedCount === 0) {
                return Result.failure<void>("Exam not found").setExtra(404);
            } else if(res.modifiedCount === 0) {
                return Result.failure<void>("Exam not modified").setExtra(406);
            } else {
                return Result.success<void>(void 0);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<void>("Failed to erase question").setExtra(500);
        }
    }
}