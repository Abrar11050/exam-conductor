import { needsAuth, onRoute, urlParam, queryParam, bodyValue, jwtValue } from "../express-extend/extend";

import { IsMongoID, Num, Str, Bool, IsNumberArray, IsBoolStr, IsIntStr } from "../express-extend/helpers";

import { ObjectId } from "mongodb";

import { Answer, AnswerOps, SubmitState } from "../classes/answers";

import { UserRole } from "../classes/user";

import { Result } from "../utils/common";

import { Exam, ExamOps, Question } from "../classes/questions";

import { Astruct, Qstruct, scorify } from "../utils/shared";

enum ExamDeliveryState {
    // SubmitState: start
    STD_EXAM_NOT_STARTED  = 1, // student: exam window is running, user has not started
    STD_EXAM_STARTED      = 2, // student: exam window is running, user has not finished
    STD_EXAM_SUBMITTED    = 3, // student: exam window is running, user has finished
    STD_EXAM_DONE_EXPIRED = 4, // student: exam window has passed, user has finished
    STD_EXAM_MISSED       = 5, // student: exam window has passed, but user has not started the exam
    STD_EXAM_EARLY        = 6, // student: window hasn't started yet
    STD_EXAM_NOT_FOUND    = 7, // student: exam does not exist

    GEN_EXAM_ERROR        = 8, // general: when something goes wrong
    // SubmitState: end

    TCH_EXAM_EDIT         = 9,  // teacher: owns that exam and can edit
    TCH_EXAM_READONLY     = 10, // teacher: does not own the exam and can only view
    TCH_EXAM_STDVIEW      = 11, // teacher: owns that exam and viewing student submission
}

interface ExamPayload {
    // ques part
    examID:      ObjectId,
    madeBy:      ObjectId,
    title:       string,
    description: string,
    windowStart: Date,
    windowEnd:   Date,
    duration:    number,
    clampTime:   boolean,
    showScores:  boolean,
    hasScripts?: boolean,
    questions:   Question[] | null,
    
    // submission part
    subID?:        ObjectId,
    subGivenBy?:   ObjectId,
    subStartTime?: Date,
    subFinished?:  boolean,
    subAnswers?:   Answer[] | null,

    subScores?:    number[],
    subTotal?:     number,
    subGrand?:     number,

    state:         ExamDeliveryState,
    stateText:     string
}

function substateToDlvState(state: SubmitState | null): ExamDeliveryState {
    if(state === null)
        return ExamDeliveryState.GEN_EXAM_ERROR;

    switch(state) {
        case SubmitState.EXAM_NOT_STARTED:  return ExamDeliveryState.STD_EXAM_NOT_STARTED;
        case SubmitState.EXAM_STARTED:      return ExamDeliveryState.STD_EXAM_STARTED;
        case SubmitState.EXAM_SUBMITTED:    return ExamDeliveryState.STD_EXAM_SUBMITTED;
        case SubmitState.EXAM_DONE_EXPIRED: return ExamDeliveryState.STD_EXAM_DONE_EXPIRED;
        case SubmitState.EXAM_MISSED:       return ExamDeliveryState.STD_EXAM_MISSED;
        case SubmitState.EXAM_EARLY:        return ExamDeliveryState.STD_EXAM_EARLY;
        case SubmitState.EXAM_NOT_FOUND:    return ExamDeliveryState.STD_EXAM_NOT_FOUND;
        case SubmitState.EXAM_ERROR:        return ExamDeliveryState.GEN_EXAM_ERROR;
        default:                            return ExamDeliveryState.GEN_EXAM_ERROR;
    }
}

function showQues(state: ExamDeliveryState, hasScores: boolean): boolean {
    return (
        (state === ExamDeliveryState.STD_EXAM_STARTED) ||
        (hasScores && (state === ExamDeliveryState.STD_EXAM_DONE_EXPIRED || state === ExamDeliveryState.STD_EXAM_SUBMITTED)) ||
        (state === ExamDeliveryState.TCH_EXAM_STDVIEW)
    );
}


function showCorrects(state: ExamDeliveryState, hasScores: boolean): boolean {
    return (
        (hasScores && (state === ExamDeliveryState.STD_EXAM_DONE_EXPIRED || state === ExamDeliveryState.STD_EXAM_SUBMITTED)) ||
        (state === ExamDeliveryState.TCH_EXAM_STDVIEW)
    );
}

function validateQAList(ques: Question[] | null, ans: Answer[] | null): boolean {
    if(ques === null || ans === null)
        return true;
    
    if(ques !== null && ans === null)
        return true;
    
    if(ques === null && ans !== null)
        return false;
    
    if(Array.isArray(ques) && Array.isArray(ans)) {
        if(ques.length !== ans.length)
            return false;
        
        for(let i = 0; i < ques.length; i++) {
            const q = ques[i];
            const a = ans[i];

            if(q._id === undefined || a.question === undefined)
                return false;
            
            if(!q._id.equals(a.question))
                return false;
        }

        return true;
    } else {
        return false;
    }
}

export class AnswerService {
    @onRoute('/api/exam/:id/start', 'POST')
    @needsAuth()
    async createScript(
        @jwtValue('id')                                                  studentID: string,
        @jwtValue('role')                                                role:      number,
        @urlParam('id',   true, { convertTo: Str, validate: IsMongoID }) examID:    string
    ) {
        if(role !== UserRole.STUDENT) {
            return Result.failure('Your role does not allow you to start exams').setExtra(403);
        }

        const stateRes = await AnswerOps.getState(
            new ObjectId(examID),
            new ObjectId(studentID)
        );

        if(!stateRes.ok) return stateRes;

        const state = stateRes.data;

        if(state === SubmitState.EXAM_NOT_STARTED) {
            const res = await AnswerOps.create(
                new ObjectId(examID),
                new ObjectId(studentID)
            );
    
            return res;
        } else {
            return Result.failure(`You cannot start this exam. Reason: ${state ? SubmitState[state] : 'Unknown error'}`).setExtra(406);
        }
    }

    @onRoute('/api/exam/:id/attempt/:qid', 'PATCH')
    @needsAuth()
    async attemptQuestion(
        @jwtValue('id')                                                       studentID:  string,
        @jwtValue('role')                                                     role:       number,
        @urlParam('id',        true, { convertTo: Str, validate: IsMongoID }) examID:     string,
        @urlParam('qid',       true, { convertTo: Str, validate: IsMongoID }) questionID: string,
        @bodyValue('provided', true, { validate: IsNumberArray })             provided:   number[]
    ) {
        if(role !== UserRole.STUDENT) {
            return Result.failure('Your role does not allow you to attempt questions').setExtra(403);
        }

        const res = await AnswerOps.attemptQuestion(
            new ObjectId(examID),
            new ObjectId(questionID),
            new ObjectId(studentID),
            provided
        );

        return res;
    }

    @onRoute('/api/exam/:id/finish', 'PATCH')
    @needsAuth()
    async finishExam(
        @jwtValue('id')                                                  studentID: string,
        @jwtValue('role')                                                role:      number,
        @urlParam('id',   true, { convertTo: Str, validate: IsMongoID }) examID:    string
    ) {
        if(role !== UserRole.STUDENT) {
            return Result.failure('Your role does not allow you to finish exams').setExtra(403);
        }

        const res = await AnswerOps.markAsFinished(
            new ObjectId(examID),
            new ObjectId(studentID)
        );

        return res;
    }

    @onRoute('/api/exam/:id', 'GET')
    @needsAuth()
    async getExam(
        @jwtValue('id')                                                    userID: string,
        @jwtValue('role')                                                  role:   number,
        @urlParam('id',    true,  { convertTo: Str, validate: IsMongoID }) mainID: string,
        @queryParam('std', false, { convertTo: Str, validate: IsMongoID }) stdID:  string
    ) {
        const examID              = new ObjectId(mainID);
        let madeBy:      ObjectId = new ObjectId('000000000000000000000000');
        let title:       string   = '';
        let description: string   = '';
        let windowStart: Date     = new Date();
        let windowEnd:   Date     = new Date();
        let duration:    number   = 0;
        let clampTime:   boolean  = false;
        let showScores:  boolean  = false;
        let hasScripts:  boolean | undefined = undefined;
        let questions:   Question[] | null = null;

        let subID:      ObjectId | undefined = undefined;
        let subGivenBy: ObjectId | undefined = undefined;
        let subStartTime:   Date | undefined = undefined;
        let subFinished: boolean | undefined = undefined;
        let subAnswers: Answer[] | null      = null;

        let subScores: number[] | undefined = undefined;
        let subTotal:  number   | undefined = undefined;
        let subGrand:  number   | undefined = undefined;

        let dlvState = ExamDeliveryState.GEN_EXAM_ERROR;

        if(role === UserRole.STUDENT) {
            const examOBJ : Exam = {};
            const _state = await AnswerOps.getState(new ObjectId(mainID), new ObjectId(userID), examOBJ);
            if(!_state.ok || _state.data === null) return _state;
            dlvState = substateToDlvState(_state.data);

            madeBy      = examOBJ.madeBy      as ObjectId;
            title       = examOBJ.title       as string;
            description = examOBJ.description as string;
            windowStart = examOBJ.windowStart as Date;
            windowEnd   = examOBJ.windowEnd   as Date;
            duration    = examOBJ.duration    as number;
            clampTime   = examOBJ.clampTime   as boolean;
            showScores  = examOBJ.showScores  as boolean;

            if(showQues(dlvState, showScores)) {
                const _ques = await ExamOps.getQuestions(examID, showScores);
                if(!_ques.ok) return _ques;
                questions = _ques.data;

                const _sub = await AnswerOps.getSubmission(examID, new ObjectId(userID));
                if(!_sub.ok || _sub.data === null) return _sub;
                
                subID        = _sub.data._id;
                subGivenBy   = _sub.data.givenBy;
                subStartTime = _sub.data.startTime;
                subFinished  = _sub.data.finished;
                subAnswers   = _sub.data.answers || null;

                if(showCorrects(dlvState, showScores) && (questions !== null && subAnswers !== null)) {
                    const _res = scorify(questions as Qstruct[], subAnswers as Astruct[], subID);
                    if(!_res.ok) return Result.failure('Error processing grades').setExtra(500);

                    const { scores, total, grand } = _res.get();

                    subScores = scores;
                    subTotal  = total;
                    subGrand  = grand;
                }
            }
        } else if(role === UserRole.TEACHER) {
            const _exam = await ExamOps.getExam(examID, true, new ObjectId(userID));
            if(!_exam.ok || _exam.data === null) return _exam;
            const examOBJ = _exam.data as Exam;
            const teacherID = new ObjectId(userID);

            madeBy      = examOBJ.madeBy      as ObjectId;
            title       = examOBJ.title       as string;
            description = examOBJ.description as string;
            windowStart = examOBJ.windowStart as Date;
            windowEnd   = examOBJ.windowEnd   as Date;
            duration    = examOBJ.duration    as number;
            clampTime   = examOBJ.clampTime   as boolean;
            showScores  = examOBJ.showScores  as boolean;
            hasScripts  = examOBJ.hasScripts  as boolean;

            if(teacherID.equals(examOBJ.madeBy as ObjectId)) {
                dlvState = ExamDeliveryState.TCH_EXAM_EDIT;
                questions = examOBJ.questions || null;

                if(stdID) {
                    const _sub = await AnswerOps.getSubmission(examID, new ObjectId(stdID));
                    if(!_sub.ok || _sub.data === null) return _sub;

                    subID        = _sub.data._id;
                    subGivenBy   = _sub.data.givenBy;
                    subStartTime = _sub.data.startTime;
                    subFinished  = _sub.data.finished;
                    subAnswers   = _sub.data.answers || null;

                    dlvState = ExamDeliveryState.TCH_EXAM_STDVIEW;

                    if(questions !== null && subAnswers !== null) {
                        const _res = scorify(questions as Qstruct[], subAnswers as Astruct[], subID);
                        if(!_res.ok) return Result.failure('Error processing grades').setExtra(500);

                        const { scores, total, grand } = _res.get();

                        subScores = scores;
                        subTotal  = total;
                        subGrand  = grand;
                    }
                }
            } else {
                dlvState = ExamDeliveryState.TCH_EXAM_READONLY;
            }
        } else {
            return Result.failure('Invalid access attempt').setExtra(403);
        }

        if(!validateQAList(questions, subAnswers)) {
            return Result.failure('Question and answer list mismatch').setExtra(500);
        }

        const payload: ExamPayload = {
            examID, madeBy, title, description, windowStart, windowEnd, duration, clampTime, showScores, hasScripts,
            questions,
            subID, subGivenBy, subStartTime, subFinished,
            subAnswers: subAnswers || undefined,
            state: dlvState,
            stateText: ExamDeliveryState[dlvState],
            subScores, subTotal, subGrand
        };

        return Result.success(payload);
    }

    @onRoute('/api/exam/:id/subs', 'GET')
    @needsAuth()
    async getSubmissions(
        @jwtValue('id')                                                    userID: string,
        @jwtValue('role')                                                  role:   number,
        @urlParam('id',    true,  { convertTo: Str, validate: IsMongoID }) examID: string
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to view submissions').setExtra(403);
        }

        const _ownerCheck = await ExamOps.checkIfOwner(new ObjectId(examID), new ObjectId(userID));
        if(!_ownerCheck.ok || _ownerCheck.data === null) return _ownerCheck;

        const isOwner = _ownerCheck.data as boolean;

        if(!isOwner) {
            return Result.failure('You are not the owner of this exam').setExtra(403);
        }

        const res = await AnswerOps.getSubmissionsWithUser(new ObjectId(examID));
        return res;
    }

    @onRoute('/api/exam/', 'GET')
    @needsAuth()
    async getExams(
        @jwtValue('id')   userID: string,
        @jwtValue('role') role:   number,
        @queryParam('newest', false, { convertTo: Bool, validate: IsBoolStr }) newest?: boolean,
        @queryParam('limit',  false, { convertTo: Num,  validate: IsIntStr })  limit?:  number,
        @queryParam('skip',   false, { convertTo: Num,  validate: IsIntStr })  skip?:   number
    ) {
        newest = newest || false;
        limit  = limit  || 20;
        skip   = skip   || 0;
        if(role === UserRole.STUDENT) {
            const res = await AnswerOps.getOwnedSubmissions(new ObjectId(userID), newest, limit, skip);
            if(!res.ok) return res;
            return Result.success({ list: res.data, role: UserRole.STUDENT });
        } else if(role === UserRole.TEACHER) {
            const res = await ExamOps.getOwnedExams(new ObjectId(userID), newest, limit, skip);
            if(!res.ok) return res;
            return Result.success({ list: res.data, role: UserRole.TEACHER });
        } else {
            return Result.failure('Invalid access attempt').setExtra(403);
        }
    }
}