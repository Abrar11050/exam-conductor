import { needsAuth, onRoute, urlParam, bodyValue, jwtValue } from "../express-extend/extend";

import { MinLength, IsMongoID, Num, Str, Bool, Time, IsNumberArray, IsStringArray } from "../express-extend/helpers";

import { ObjectId } from "mongodb";

import { QuestionOps, ExamOps } from "../classes/questions";

import { UserRole } from "../classes/user";

import { Result } from "../utils/common";

import { AnswerOps } from "../classes/answers";

export class ExamService {
    @onRoute('/api/exam', 'POST')
    @needsAuth()
    async createExam(
        @jwtValue('id')                                                              madeBy:      string,
        @jwtValue('role')                                                            role:        number,
        @bodyValue('title',       true, { convertTo: Str,  validate: MinLength(1) }) title:       string,
        @bodyValue('description', true, { convertTo: Str,  validate: MinLength(1) }) description: string,
        @bodyValue('windowStart', true, { convertTo: Time })                         windowStart: Date,
        @bodyValue('windowEnd',   true, { convertTo: Time })                         windowEnd:   Date,
        @bodyValue('duration',    true, { convertTo: Num  })                         duration:    number,
        @bodyValue('clampTime',   true, { convertTo: Bool })                         clampTime:   boolean,
        @bodyValue('showScores',  true, { convertTo: Bool })                         showScores:  boolean
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to create exams').setExtra(403);
        }

        const res = await ExamOps.create({
            madeBy: new ObjectId(madeBy),
            title, description,
            windowStart, windowEnd,
            duration, clampTime,
            showScores
        });

        return res;
    }

    @onRoute('/api/exam/:id', 'PATCH')
    @needsAuth()
    async updateExam(
        @jwtValue('id')                                                              madeBy:      string,
        @jwtValue('role')                                                            role:        number,
        @urlParam('id',           true, { convertTo: Str, validate: IsMongoID })     id:          string,
        @bodyValue('title',       true, { convertTo: Str, validate: MinLength(1) })  title:       string,
        @bodyValue('description', true, { convertTo: Str, validate: MinLength(1) })  description: string,
        @bodyValue('windowStart', true, { convertTo: Time })                         windowStart: Date,
        @bodyValue('windowEnd',   true, { convertTo: Time })                         windowEnd:   Date,
        @bodyValue('duration',    true, { convertTo: Num  })                         duration:    number,
        @bodyValue('clampTime',   true, { convertTo: Bool })                         clampTime:   boolean,
        @bodyValue('showScores',  true, { convertTo: Bool })                         showScores:  boolean
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to update exams').setExtra(403);
        }

        const res = await ExamOps.update({
            _id: new ObjectId(id),
            title, description,
            windowStart, windowEnd,
            duration, clampTime,
            showScores
        }, new ObjectId(madeBy));

        return res;
    }

    @onRoute('/api/exam/:id', 'DELETE')
    @needsAuth()
    async deleteExam(
        @jwtValue('id')                                                madeBy: string,
        @jwtValue('role')                                              role:   number,
        @urlParam('id', true, { convertTo: Str, validate: IsMongoID }) id:     string
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to delete exams').setExtra(403);
        }

        const res = await ExamOps.erase(new ObjectId(id), new ObjectId(madeBy));

        AnswerOps.removeAllUnderExam(new ObjectId(id), false);

        return res;
    }

    @onRoute('/api/exam/:id/ques', 'POST')
    @needsAuth()
    async addQuestion(
        @jwtValue('id')                                                             madeBy:      string,
        @jwtValue('role')                                                           role:        number,
        @urlParam('id',           true, { convertTo: Str, validate: IsMongoID })    examID:      string,
        @bodyValue('text',        true, { convertTo: Str, validate: MinLength(1) }) text:        string,
        @bodyValue('points',      true, { convertTo: Num })                         points:      number,
        @bodyValue('maxAttempts', true, { convertTo: Num })                         maxAttempts: number,
        @bodyValue('quesType',    true, { convertTo: Num })                         quesType:    number,
        @bodyValue('options',     true, { validate: IsStringArray })                options:     string[],
        @bodyValue('correct',     true, { validate: IsNumberArray })                correct:     number[],
        @bodyValue('index',      false, { convertTo: Num })                         index:       number
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to add questions').setExtra(403);
        }

        const res = await QuestionOps.create(
            new ObjectId(examID),
            {
                text, points, maxAttempts,
                quesType, options, correct
            },
            new ObjectId(madeBy),
            index !== undefined ? index : undefined,
        );

        return res;
    }

    @onRoute('/api/exam/:id/ques/:qid', 'PATCH')
    @needsAuth()
    async updateQuestion(
        @jwtValue('id')                                                             madeBy:      string,
        @jwtValue('role')                                                           role:        number,
        @urlParam('id',           true, { convertTo: Str, validate: IsMongoID })    examID:      string,
        @urlParam('qid',          true, { convertTo: Str, validate: IsMongoID })    quesID:      string,
        @bodyValue('text',        true, { convertTo: Str, validate: MinLength(1) }) text:        string,
        @bodyValue('points',      true, { convertTo: Num })                         points:      number,
        @bodyValue('maxAttempts', true, { convertTo: Num })                         maxAttempts: number,
        @bodyValue('quesType',    true, { convertTo: Num })                         quesType:    number,
        @bodyValue('options',     true, { validate: IsStringArray })                options:     string[],
        @bodyValue('correct',     true, { validate: IsNumberArray })                correct:     number[]
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to update questions').setExtra(403);
        }

        const res = await QuestionOps.update(
            new ObjectId(examID),
            {
                _id: new ObjectId(quesID),
                text, points, maxAttempts,
                quesType, options, correct
            },
            new ObjectId(madeBy)
        );

        return res;
    }

    @onRoute('/api/exam/:id/ques/:qid', 'DELETE')
    @needsAuth()
    async deleteQuestion(
        @jwtValue('id')                                                 madeBy: string,
        @jwtValue('role')                                               role:   number,
        @urlParam('id', true,  { convertTo: Str, validate: IsMongoID }) examID: string,
        @urlParam('qid', true, { convertTo: Str, validate: IsMongoID }) quesID: string
    ) {
        if(role !== UserRole.TEACHER) {
            return Result.failure('Your role does not allow you to delete questions').setExtra(403);
        }

        const res = await QuestionOps.erase(
            new ObjectId(examID),
            new ObjectId(quesID),
            new ObjectId(madeBy)
        );

        return res;
    }
}