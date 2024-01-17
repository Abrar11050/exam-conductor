import React, { useState } from 'react';
import { Space, message } from 'antd';

import ViewQues from './ViewQues';
import ViewExam from './ViewExam';

import { ExamData, QuesType, ExamDeliveryState } from '../../models/exam';

import { ExcoFetcher } from '../../utils/exco-fetcher';

interface QuesEntity {
    quesID:      string;
    text:        string;
    points:      number;
    maxAttempts: number;
    quesType:    QuesType;
    options:     string[];

    correct?:      number[];

    usedAttempts?: number;
    provided?:     number[];

    subAchieved?:  number;
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

type QMapperRes = { value: QuesEntity[] | null; hasError: boolean; };

function mapQuesEntity(examData: ExamData): QMapperRes {
    const state     = examData.state;
    const hasScores = examData.showScores;
    const questions = examData.questions;

    const subAnswers = examData.subAnswers;

    if(showQues(state, hasScores) && questions !== null) {
        if(Array.isArray(subAnswers) && subAnswers.length !== questions.length) {
            console.error('subAnswers.length !== questions.length');
            return { value: null, hasError: true };
        }

        const qents = new Array<QuesEntity>(questions.length);

        const addCorrect = showCorrects(state, hasScores);

        if(addCorrect && examData.subScores === null) {
            console.error('addCorrect && examData.subScores === null');
            return { value: null, hasError: true };
        }

        const subScores    = examData.subScores;
        const hasSubScores = addCorrect && subScores !== null;

        for(let i = 0; i < questions.length; i++) {
            const q = questions[i];
            qents[i] = {
                quesID:      q._id as string,
                text:        q.text,
                points:      q.points,
                maxAttempts: q.maxAttempts,
                quesType:    q.quesType,
                options:     q.options,

                correct:     addCorrect ? q.correct : undefined,
            };
        }

        if(subAnswers) {
            for(let i = 0; i < subAnswers.length; i++) {
                const a  = subAnswers[i];
                const qn = qents[i];

                if(a.question !== qn.quesID) {
                    console.error(`a.question !== qn.quesID @[${i}]`);
                    return { value: null, hasError: true };
                }

                qn.usedAttempts = a.usedAttempts;
                qn.provided     = a.provided;

                qn.subAchieved  = hasSubScores ? subScores[i] : undefined;
            }
        }

        return { value: qents, hasError: false };
    } else {
        return { value: null, hasError: false };
    }
}

interface Subdata {
    subID?:        string;
    subGivenBy?:   string;
    subStartTime?: Date;
    subFinished?:  boolean;
    subTotal?:     number;
    subGrand?:     number;
}

const ViewExamPage: React.FC<{ examData: ExamData }> = ({ examData }) => {
    const [messageApi, contextHolder] = message.useMessage();

    const qMapRes = mapQuesEntity(examData);

    const [state, setState] = useState<ExamDeliveryState>(qMapRes.hasError ? ExamDeliveryState.GEN_EXAM_ERROR : examData.state);
    
    const [qents, setQents] = useState<QuesEntity[] | null>(qMapRes.value);

    const [subData, setSubData] = useState<Subdata>({
        subID:        examData.subID        !== null ? examData.subID        : undefined,
        subGivenBy:   examData.subGivenBy   !== null ? examData.subGivenBy   : undefined,
        subStartTime: examData.subStartTime !== null ? examData.subStartTime : undefined,
        subFinished:  examData.subFinished  !== null ? examData.subFinished  : undefined,
        subTotal:     examData.subTotal     !== null ? examData.subTotal     : undefined,
        subGrand:     examData.subGrand     !== null ? examData.subGrand     : undefined
    });

    //////////////////////////

    function startExam(setSpinner?: (loading: boolean) => void) {
        setSpinner?.(true);
        // startExam: api/exam/{{ _.exam }}/start (POST)
        new ExcoFetcher()
            .needAuth()
            .post(`api/exam/${examData.examID}/start`)
            .failure(err => messageApi.error(err))
            .error(err => messageApi.error(err))
            .success(res => {
                if(!Array.isArray(res)) {
                    messageApi.error('Invalid response');
                    return;
                }

                const questions = new Array<QuesEntity>(res.length);

                for(let i = 0; i < res.length; i++) {
                    const qSrc = res[i];
                    const qDst: QuesEntity = {
                        quesID:      qSrc._id,
                        text:        qSrc.text,
                        points:      qSrc.points,
                        maxAttempts: qSrc.maxAttempts,
                        quesType:    qSrc.quesType,
                        options:     qSrc.options,
                    };
                    questions[i] = qDst;
                }

                setQents(questions);
                setSubData({ ...subData, subStartTime: new Date(), subFinished: false });
                setState(ExamDeliveryState.STD_EXAM_STARTED);
            })
            .finally(() => setSpinner?.(false))
            .exec();
    }

    function endExam(setSpinner?: (loading: boolean) => void) {
        setSpinner?.(true);

        // endExam: api/exam/{{ _.exam }}/finish (PATCH)

        new ExcoFetcher()
            .needAuth()
            .patch(`api/exam/${examData.examID}/finish`)
            .failure(err => messageApi.error(err))
            .error(err => messageApi.error(err))
            .success(() => {
                setQents(null);
                setSubData({ ...subData, subFinished: true });
                setState(ExamDeliveryState.STD_EXAM_SUBMITTED);
            })
            .finally(() => setSpinner?.(false))
            .exec();
    }

    function attemptQues(quesID: string, provided: number[], incTrialCount: () => void, setSpinner?: (loading: boolean) => void) {
        setSpinner?.(true);

        // attemptQues: api/exam/{{ _.exam }}/attempt/{{ _.ques }} (PATCH)

        new ExcoFetcher()
            .needAuth()
            .patch(`api/exam/${examData.examID}/attempt/${quesID}`)
            .body({ provided })
            .failure(err => messageApi.error(err))
            .error(err => messageApi.error(err))
            .success(() => incTrialCount())
            .finally(() => setSpinner?.(false))
            .exec();
    }

    function endExamAuto() {
        setQents(null);
        setSubData({ ...subData, subFinished: true });
        setState(ExamDeliveryState.STD_EXAM_SUBMITTED);
    }

    function examMissed() {
        setState(ExamDeliveryState.STD_EXAM_MISSED);
    }

    return (
        <>
            {contextHolder}
            <ViewExam
                examID={examData.examID}
                madeBy={examData.madeBy}

                title={examData.title}
                description={examData.description}
                windowStart={examData.windowStart}
                windowEnd={examData.windowEnd}
                duration={examData.duration}
                clampTime={examData.clampTime}
                showScores={examData.showScores}

                subID={subData.subID}
                subGivenBy={subData.subGivenBy}
                subStartTime={subData.subStartTime}
                subFinished={subData.subFinished}
                subTotal={subData.subTotal}
                subGrand={subData.subGrand}

                state={state}

                onEndExam={endExam}
                onStartExam={startExam}
                onMissed={examMissed}
                onEndExamAuto={endExamAuto}
            />
            {qents !== null && (
                <Space direction="vertical" size="middle" style={{ display: 'flex', margin: '20px 0px', width: '100%' }}>
                    {
                        qents.map((q, i) => (
                            <ViewQues
                                index={i}
                                key={i}
                                text={q.text}
                                points={q.points}
                                maxAttempts={q.maxAttempts}
                                quesType={q.quesType}
                                options={q.options}
                            
                                state={state}
                                hasScores={examData.showScores}
                                correct={q.correct}
                            
                                usedAttempts={q.usedAttempts}
                                provided={q.provided}
                            
                                subAchieved={q.subAchieved}
                            
                                canEdit={false}

                                onQuesAttempt={(provided, incTrialCount, setSpinner) => attemptQues(q.quesID, provided, incTrialCount, setSpinner)}
                            />
                        ))
                    }
                </Space>
            )}
        </>
    );
};

export default ViewExamPage;