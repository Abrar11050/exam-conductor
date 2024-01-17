import { ObjectId } from 'mongodb';
import { Result, WithOID } from '../utils/common';
import { DBCon } from '../utils/db';
import { COL_QUES, COL_ANS, COL_USER } from '../utils/decls';
import { Exam, MicroExamInfo, Question } from './questions';
import { User } from './user';

export enum SubmitState {
    EXAM_NOT_STARTED  = 1, // exam window is running, user has not started
    EXAM_STARTED      = 2, // exam window is running, user has not finished
    EXAM_SUBMITTED    = 3, // exam window is running, user has finished
    EXAM_DONE_EXPIRED = 4, // exam window has passed, user has finished
    EXAM_MISSED       = 5, // exam window has passed, but user has not started the exam
    EXAM_EARLY        = 6, // window hasn't started yet
    EXAM_NOT_FOUND    = 7, // exam does not exist
    EXAM_ERROR        = 8  // when something goes wrong
}

export interface Answer extends WithOID  {
    question?:     ObjectId,
    usedAttempts?: number,
    provided?:     number[]
}

export interface Submission extends WithOID {
    exam?:      ObjectId,
    givenBy?:   ObjectId,
    startTime?: Date,
    finished?:  boolean,
    answers?:   Answer[]
}

interface SubmissionWithUser extends WithOID {
    startTime: Date,
    finished:  boolean,
    givenBy:   User
}

export class AnswerOps {
    static async create(examID: ObjectId, studentID : ObjectId): Promise<Result<Question[] | null>> {
        try {
            const exam = await DBCon.colls[COL_QUES].findOne(
                { _id: examID },
                { projection: { "questions.correct": 0 } }
            );
            if(exam === null) return Result.failure<Question[]>("Exam not found").setExtra(404);

            const examObj : Exam = exam;

            // <reduntant reason="already checked using getState()">
            // const timeNow = Date.now();

            // if(examObj.windowStart !== undefined && timeNow < examObj.windowStart.getTime())
            //     return Result.success<null>(null, "Exam window has not started yet");
            
            // if(examObj.windowEnd !== undefined && timeNow > examObj.windowEnd.getTime())
            //     return Result.success<null>(null, "Exam window has ended");
            // </reduntant>
            
            const submission : Submission = {
                exam: examID,
                givenBy: studentID,
                startTime: new Date(),
                finished: false,
                answers: examObj.questions?.map(q => ({
                    question: q._id,
                    usedAttempts: 0,
                    provided: []
                }))
            };

            const res = await DBCon.colls[COL_ANS].insertOne(submission);
            if(!res.acknowledged)
                return Result.failure<Question[]>("Failed to create submission").setExtra(500);
            
            if(examObj.hasScripts !== true) {
                const examUpdate = await DBCon.colls[COL_QUES].updateOne(
                    { _id: examID },
                    { $set: { hasScripts: true } }
                );

                if(!examUpdate.acknowledged)
                    return Result.failure<Question[]>("Failed to update exam").setExtra(500);
            }
            
            return Result.success<Question[]>(examObj.questions as Question[]);
        } catch (e) {
            console.error(e);
            return Result.failure<null>("Failed to create submission").setExtra(500);
        }
    }

    static async getSubmission(examID: ObjectId, studentID: ObjectId): Promise<Result<Submission>> {
        try {
            const submission = await DBCon.colls[COL_ANS].findOne({ exam: examID, givenBy: studentID });
            if(submission === null) return Result.failure<Submission>("Submission not found").setExtra(404);
            return Result.success<Submission>(submission);
        } catch (e) {
            console.error(e);
            return Result.failure<Submission>("Failed to get submission").setExtra(500);
        }
    }

    static async getOwnedSubmissions(studentID: ObjectId, newest: boolean, limit: number, cursor: number): Promise<Result<MicroExamInfo[]>> {
        // newest = newest || false;
        // limit = limit   || 20;
        try {
            const ag = await DBCon.colls[COL_ANS].aggregate([
                {   $match: { givenBy: studentID }   },
                {   $project: { answers: 0 }   },
                {
                    $lookup: {
                        from: DBCon.collNames[COL_QUES],
                        localField: "exam",
                        foreignField: "_id",
                        as: "exam"
                    }
                },
                {
                    $project: {
                        _id: 1, startTime: 1, finished: 1,
                        exam: {
                            $map: {
                                input: "$exam",
                                as: "exam",
                                in: {
                                    _id:         "$$exam._id",
                                    madeBy:      "$$exam.madeBy",
                                    title:       "$$exam.title",
                                    windowStart: "$$exam.windowStart",
                                    windowEnd:   "$$exam.windowEnd",
                                    duration:    "$$exam.duration",
                                    showScores:  "$$exam.showScores"
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 1, startTime: 1, finished: 1,
                        exam: {
                            $cond: {
                                if: { $eq: [ { $size: "$exam" }, 1 ] },
                                then: { $arrayElemAt: [ "$exam", 0 ] },
                                else: null
                            }
                        }
                    }
                },
                {  $sort: { startTime: newest ? -1 : 1 } },
                {  $skip: cursor  },
                {  $limit: limit  }
            ]).toArray();

            const res = ag.map((s): MicroExamInfo => ({
                examID:      s?.exam?._id,
                madeBy:      s?.exam?.madeBy,
                title:       s?.exam?.title,
                windowStart: s?.exam?.windowStart,
                windowEnd:   s?.exam?.windowEnd,
                duration:    s?.exam?.duration,
                showScores:  s?.exam?.showScores,

                subID:        s?._id,
                subGivenBy:   { _id: studentID },
                subStartTime: s?.startTime,
                subFinished:  s?.finished
            }));

            return Result.success<MicroExamInfo[]>(res);
        } catch(e) {
            console.error(e);
            return Result.failure<MicroExamInfo[]>("Failed to get submissions").setExtra(500);
        }
    }

    // TODO
    static async getState(examID: ObjectId, studentID: ObjectId, fillableExam?: Exam): Promise<Result<SubmitState>> {
        const extras = fillableExam !== undefined
                     ? { title: 1, description: 1, madeBy: 1 }
                     : { };
        try {
            const _exam = await DBCon.colls[COL_QUES].findOne(
                { _id: examID },
                { projection: {
                        windowStart: 1, windowEnd: 1, duration: 1, clampTime: 1, showScores: 1, ...extras
                    }
                }
            );
            if(_exam === null)
                return Result.success<SubmitState>(SubmitState.EXAM_NOT_FOUND).setExtra(404);

            const { windowStart, windowEnd, title, description, duration, clampTime, madeBy, showScores } = _exam as Exam;
            if(windowStart === undefined || windowEnd === undefined || duration === undefined || clampTime === undefined || showScores === undefined)
                return Result.success<SubmitState>(SubmitState.EXAM_ERROR).setExtra(500);

            if(fillableExam !== undefined) {
                fillableExam.madeBy      = madeBy;
                fillableExam.title       = title;
                fillableExam.description = description;
                fillableExam.windowStart = windowStart;
                fillableExam.windowEnd   = windowEnd;
                fillableExam.duration    = duration;
                fillableExam.clampTime   = clampTime;
                fillableExam.showScores  = showScores;
            }

            if(Date.now() < windowStart.getTime())
                return Result.success<SubmitState>(SubmitState.EXAM_EARLY); // before window
            
            const _sub = await DBCon.colls[COL_ANS].findOne({ exam: examID, givenBy: studentID }, { projection: { finished: 1, startTime: 1 } });
            const hasSubmission = _sub !== null;

            if(hasSubmission) {
                const { finished, startTime } = _sub as Submission;

                if(finished === undefined || startTime === undefined) {
                    return Result.success<SubmitState>(SubmitState.EXAM_ERROR);
                }
                
                if(finished) {
                    return Result.success<SubmitState>(SubmitState.EXAM_SUBMITTED); // explicit submission
                }
                
                const canCarryOn = AnswerOps.hasTime(windowEnd, startTime, duration, clampTime);

                if(Date.now() < windowEnd.getTime()) {
                    // within window
                    if(canCarryOn) {
                        return Result.success<SubmitState>(SubmitState.EXAM_STARTED);
                    } else {
                        return Result.success<SubmitState>(SubmitState.EXAM_SUBMITTED); // implicit submission
                    }
                } else {
                    // after window
                    if(canCarryOn) {
                        return Result.success<SubmitState>(SubmitState.EXAM_STARTED);
                    } else {
                        return Result.success<SubmitState>(SubmitState.EXAM_DONE_EXPIRED);
                    }
                }

                // if(carryOn)
                //     return Result.success<SubmitState>(SubmitState.EXAM_STARTED);

                // if(Date.now() >= windowEnd.getTime()) {
                //     // after window
                //     return Result.success<SubmitState>(SubmitState.EXAM_DONE_EXPIRED);
                // } else {
                //     // within window
                //     return Result.success<SubmitState>(SubmitState.EXAM_STARTED);
                // }

                // if(Date.now() >= windowEnd.getTime()) {
                //     // after window
                //     const carryOn = AnswerOps.hasTime(windowEnd, startTime, duration, clampTime);
                //     if(carryOn) {
                //         return Result.success<SubmitState>(SubmitState.EXAM_STARTED);
                //     } else {
                //         return Result.success<SubmitState>(SubmitState.EXAM_DONE_EXPIRED);
                //     }
                // } else {
                //     // within window
                //     return Result.success<SubmitState>(SubmitState.EXAM_STARTED);
                // }
            } else {
                if(Date.now() >= windowEnd.getTime()) {
                    // after window
                    return Result.success<SubmitState>(SubmitState.EXAM_MISSED);
                } else {
                    // within window
                    return Result.success<SubmitState>(SubmitState.EXAM_NOT_STARTED);
                }
            }
        } catch (e) {
            console.error(e);
            return Result.failure<SubmitState>("Failed to check submission state").setExtra(500);
        }
    }

    static async removeAllUnderExam(examID: ObjectId, mark: boolean): Promise<Result<number>> {
        try {
            const res = await DBCon.colls[COL_ANS].deleteMany({ exam: examID });
            // update hasScripts to false in exam (COL_QUES)
            if(mark) {
                await DBCon.colls[COL_QUES].updateOne({ _id: examID }, { $set: { hasScripts: false } });
            }
            return Result.success<number>(res.deletedCount);
        } catch (e) {
            console.error(e);
            return Result.failure<number>("Failed to delete submissions").setExtra(500);
        }
    }

    static async removeStudentSubmission(examID: ObjectId, studentID: ObjectId): Promise<Result<void>> {
        try {
            const res = await DBCon.colls[COL_ANS].deleteOne({ exam: examID, givenBy: studentID });
            if(res.deletedCount === 0)
                return Result.failure<void>("Submission not found").setExtra(404);
            
            // get count of submissions under exam
            const count = await DBCon.colls[COL_ANS].countDocuments({ exam: examID });

            // update hasScripts to false in exam (COL_QUES)
            if(count === 0)
                await DBCon.colls[COL_QUES].updateOne({ _id: examID }, { $set: { hasScripts: false } });
            
            return Result.success<void>(void 0);
        } catch (e) {
            console.error(e);
            return Result.failure<void>("Failed to delete submission").setExtra(500);
        }
    }

    // duration in milliseconds
    static hasTime(examEnd: Date, startTime: Date, duration: number, clampDuration: boolean): boolean {
        const now = new Date();

        const actualDuration = !clampDuration
                             ? duration
                             : Math.min(duration, examEnd.getTime() - startTime.getTime());

        const actualEndTime = new Date(startTime.getTime() + actualDuration);
        return now < actualEndTime;
    }

    static async markAsFinished(examID: ObjectId, studentID: ObjectId): Promise<Result<void>> {
        try {
            const res = await DBCon.colls[COL_ANS].updateOne(
                { exam: examID, givenBy: studentID },
                { $set: { finished: true } }
            );
            if(res.modifiedCount === 0)
                return Result.failure<void>("Submission was not updated").setExtra(406);
            return Result.success<void>(void 0);
        } catch (e) {
            console.error(e);
            return Result.failure<void>("Failed to mark submission as finished").setExtra(500);
        }
    }

    static async getSubmissionsWithUser(examID: ObjectId): Promise<Result<SubmissionWithUser[]>> {
        try {
            const submissions = await DBCon.colls[COL_ANS].aggregate([
                {   $match: { exam: examID } },
                {   $project: { givenBy: 1, startTime: 1, finished: 1 } },
                {
                    $lookup: {
                        from:         DBCon.collNames[COL_USER],
                        localField:   "givenBy",
                        foreignField: "_id",
                        as:           "givenBy"
                    }
                },
                {
                    $project: {
                        givenBy: {
                            $map: {
                                input: "$givenBy", as: "givenBy", in: {
                                    _id:      "$$givenBy._id",      firstName: "$$givenBy.firstName",
                                    lastName: "$$givenBy.lastName", email:     "$$givenBy.email"
                                }
                            }
                        },
                        startTime: 1, finished: 1
                    }
                },
                {
                    $project: {
                        givenBy: {
                            $cond: {
                                if:   { $eq: [ { $size: "$givenBy" }, 1 ] },
                                then: { $arrayElemAt: [ "$givenBy",   0 ] },
                                else: null
                            }
                        },
                        startTime: 1, finished: 1
                    }
                }
            ]).toArray();
            return Result.success<SubmissionWithUser[]>(submissions as SubmissionWithUser[]);
        } catch (e) {
            console.error(e);
            return Result.failure<SubmissionWithUser[]>("Failed to get submissions").setExtra(500);
        }
    }

    // TODO
    static async attemptQuestion(
            examID:       ObjectId,
            questionID:   ObjectId,
            studentID:    ObjectId,
            provided:     number[]
        ): Promise<Result<void>> {
        try {
            const _exam = await DBCon.colls[COL_QUES].aggregate([
                {
                    $match: { _id: examID }
                },
                {
                    $project: {
                        windowStart: 1, windowEnd: 1, duration: 1, clampTime: 1,
                        questions: {
                            $filter: {
                                input: '$questions',
                                as: 'question',
                                cond: { $eq: ['$$question._id', questionID] }
                            }
                        }
                    }
                },
                {
                    $project: {
                        windowStart: 1, windowEnd: 1, duration: 1, clampTime: 1,
                        questions: {
                            $map: {
                                input: '$questions',
                                as: 'question',
                                in: {
                                    _id: '$$question._id',
                                    maxAttempts: '$$question.maxAttempts',
                                    optionLength: { $size: '$$question.options' }
                                }
                            }
                        }
                    }
                }
            ]);

            const exam : Exam | null = await _exam.next();

            if(exam === null)
                return Result.failure<void>("Exam not found").setExtra(404);

            if(exam.questions === undefined || exam.questions?.length === 0)
                return Result.failure<void>("Question not found").setExtra(404);

            if(exam.windowStart && Date.now() < exam.windowStart.getTime()) {
                return Result.failure<void>("Cannot attempt outside of exam window").setExtra(406);
            }

            //////////////////////////

            const _sub = await DBCon.colls[COL_ANS].aggregate([
                {
                    $match: { exam: examID, givenBy: studentID }
                },
                {
                    $project: {
                        exam: 1, givenBy: 1, startTime: 1, finished: 1,
                        answers: {
                            $filter: {
                                input: '$answers',
                                as: 'answer',
                                cond: { $eq: ['$$answer.question', questionID] }
                            }
                        }
                    }
                }
            ]);

            const sub : Submission | null = await _sub.next();

            if(sub === null)
                return Result.failure<void>("Submission not found").setExtra(404);

            if(sub.finished)
                return Result.failure<void>("Exam has already been finished").setExtra(406);

            if(sub.answers === undefined || sub.answers?.length === 0)
                return Result.failure<void>("Question submission not found").setExtra(404);

            if(exam.duration    !== undefined
            && sub.startTime    !== undefined
            && exam.windowEnd   !== undefined
            && exam.clampTime   !== undefined
            && !AnswerOps.hasTime(exam.windowEnd, sub.startTime, exam.duration, exam.clampTime)) {
                return Result.failure<void>("Cannot submit outside of exam duration").setExtra(406);
            }

            //////////////////////////
            const ques : Question = exam.questions[0];
            const ans  : Answer   = sub.answers[0];
            const optionLength = (exam.questions[0] as { optionLength: number }).optionLength;

            if(ans.usedAttempts !== undefined
            && ques.maxAttempts !== undefined
            && ques.maxAttempts !== -1
            && ans.usedAttempts >= ques.maxAttempts)
                return Result.failure<void>("Maximum attempts reached").setExtra(406);

            if(provided.length > optionLength)
                return Result.failure<void>("Too many options provided").setExtra(406);
            
            for(let sel of provided)
                if(sel < 0 || sel >= optionLength)
                    return Result.failure<void>("Invalid option selected").setExtra(406);
            
            //////////////////////////

            provided.sort((a, b) => a - b);

            const update = await DBCon.colls[COL_ANS].updateOne(
                { exam: examID, givenBy: studentID, 'answers.question': questionID },
                {
                    $set: {
                        'answers.$.usedAttempts': (ans.usedAttempts ?? 0) + 1,
                        'answers.$.provided': provided
                    }
                }
            );

            if(update.modifiedCount === 0)
                return Result.failure<void>("Failed to proceed into submission").setExtra(500);

            return Result.success<void>(void 0);
        } catch (e) {
            console.error(e);
            return Result.failure<void>("Failed to attempt question").setExtra(500);
        }
    }
}