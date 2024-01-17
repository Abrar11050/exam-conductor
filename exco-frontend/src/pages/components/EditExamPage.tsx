import React, { useState } from 'react';
import { Button, Space, message } from 'antd';

import ViewQues from './ViewQues';
import EditQues from './EditQues';
import ViewExam from './ViewExam';
import EditExam from './EditExam';

import { Question, ExamData, QuesType, EDataDynamic, QDataDynamic } from '../../models/exam';

import { ExcoFetcher } from '../../utils/exco-fetcher';

import { Res } from '../../utils/common';


function validateEData(edata: EDataDynamic): Res {
    if(edata.title.trim().length === 0) {
        return Res.failure('Title cannot be empty');
    }

    if(edata.windowStart.getTime() > edata.windowEnd.getTime()) {
        return Res.failure('Start time cannot be after end time');
    }

    if(edata.duration < 0) {
        return Res.failure('Duration cannot be negative');
    }

    return Res.success();
}

function validateQues(ques: QDataDynamic): Res {
    if(ques.text.trim().length === 0) {
        return Res.failure('Question text cannot be empty');
    }

    if(ques.points <= 0) {
        return Res.failure('Invalid points');
    }

    if(!(ques.maxAttempts === -1 || ques.maxAttempts > 0)) {
        return Res.failure('Invalid max attempts');
    }

    if(ques.options.length === 0) {
        return Res.failure('Question must have at least one option');
    }

    if(ques.correct.length === 0) {
        return Res.failure('Question must have at least one correct option');
    }

    return Res.success();
}

// msgApi: MessageInstance

const EditExamPage: React.FC<{ examData: ExamData }> = ({ examData }) => {
    const [messageApi, contextHolder] = message.useMessage();

    const [edata, setEdata] = useState<EDataDynamic>({
        title:       examData.title,
        description: examData.description,
        windowStart: examData.windowStart,
        windowEnd:   examData.windowEnd,
        duration:    examData.duration,
        clampTime:   examData.clampTime,
        showScores:  examData.showScores
    });

    const limitedEdit = examData.hasScripts;

    const [questions, setQuestions] = useState<Question[]>(examData.questions || []);

    const [showEditor, setShowEditor] = useState<boolean>(false);

    const [editIndex, setEditIndex] = useState<number>(-1);

    function addNewQues() {
        const qs = new Question(
            null, '', 1, 1,
            QuesType.RADIO, [], []
        );
        const qIndex = questions.length;
        setQuestions([...questions, qs]);
        setEditIndex(qIndex);
    }

    function editExisting(index: number) {
        setEditIndex(index);
    }

    function cancelEditing(index: number) {
        const ques = questions[index];
        if (ques._id === null) {
            setQuestions(questions.filter((_, i) => i !== index));
        }
        setEditIndex(-1);
    }

    function settleQues(index: number, ques: Question, id: string) {
        setQuestions(questions.map((q, i) => {
            if(i === index) {
                ques._id = id;
                return ques;
            } else {
                return q;
            }
        }));
    }

    function removeQues(index: number) {
        setQuestions(questions.filter((_, i) => i !== index));
    }

    function canEditNow() {
        return editIndex === -1;
    }

    const canEdit = canEditNow();

    //////////////////////////

    function updateExamData(newData: EDataDynamic, setSpinner?: (loading: boolean) => void) {
        const _val = validateEData(newData);
        if(!_val.ok()) {
            messageApi.error(_val.msg);
            return;
        }
        

        setSpinner?.(true);
        
        new ExcoFetcher()
            .needAuth()
            .patch(`api/exam/${examData.examID}`)
            .body(newData)
            .failure(err => messageApi.error(err))
            .error(err => messageApi.error(err))
            .success(() => {
                messageApi.success('Exam updated successfully');
                setEdata({ ...newData });
            })
            .finally(() => setSpinner?.(false))
            .exec();
    }

    function deleteExam(setSpinner?: (loading: boolean) => void) {
        setSpinner?.(true);

        new ExcoFetcher()
            .needAuth()
            .delete(`api/exam/${examData.examID}`)
            .failure(err => messageApi.error(err))
            .error(err => messageApi.error(err))
            .success(() => messageApi.success('Exam deleted successfully'))
            .finally(() => setSpinner?.(false))
            .exec();
    }

    function saveQues(index: number, quesID: string | null, quesData: QDataDynamic, setSpinner?: (loading: boolean) => void) {
        const _val = validateQues(quesData);
        if(!_val.ok()) {
            messageApi.error(_val.msg);
            return;
        }
        

        const isNew = quesID === null;
        
        // add: api/exam/{{ _.examID }}/ques (POST)
        // update: api/exam/{{ _.examID }}/ques/{{ _.quesID }} (PATCH)

        const exf = new ExcoFetcher()
            .needAuth()
            .failure(err => messageApi.error(err))
            .error(err => messageApi.error(err))
            .finally(() => setSpinner?.(false))
            .body(quesData);
        
        if(isNew) {
            exf
            .post(`api/exam/${examData.examID}/ques`)
            .success(res => {
                messageApi.success('Question added successfully');
                settleQues(index, { ...quesData, _id: res }, res);
                setEditIndex(-1);
            });
        } else {
            exf
            .patch(`api/exam/${examData.examID}/ques/${quesID}`)
            .success(() => {
                messageApi.success('Question updated successfully');
                settleQues(index, { ...quesData, _id: quesID }, quesID);
                setEditIndex(-1);
            });
        }
        
        setSpinner?.(true);
        exf.exec();
    }

    function deleteQues(index: number, quesID: string, setSpinner?: (loading: boolean) => void) {
        // delete: api/exam/{{ _.exam }}/ques/{{ _.quesID }} (DELETE)

        setSpinner?.(true);

        new ExcoFetcher()
            .needAuth()
            .delete(`api/exam/${examData.examID}/ques/${quesID}`)
            .failure(err => messageApi.error(err))
            .error(err => messageApi.error(err))
            .success(() => {
                messageApi.success('Question deleted successfully');
                removeQues(index);
            })
            .finally(() => setSpinner?.(false))
            .exec();
    }

    return (
        <>
            {contextHolder}
            <Button onClick={() => setShowEditor(!showEditor)} style={{ margin: '10px 5px' }}>{showEditor ? 'Hide Editor' : 'Show Editor'}</Button>
            {
                showEditor ? (
                    <EditExam
                        examID={examData.examID}
                        madeBy={examData.madeBy}

                        title={edata.title}
                        description={edata.description}
                        windowStart={edata.windowStart}
                        windowEnd={edata.windowEnd}
                        duration={edata.duration}
                        clampTime={edata.clampTime}
                        showScores={edata.showScores}

                        onSave={updateExamData}
                        onDelete={deleteExam}
                    />
                ) : (
                    <ViewExam
                        examID={examData.examID}
                        madeBy={examData.madeBy}

                        title={edata.title}
                        description={edata.description}
                        windowStart={edata.windowStart}
                        windowEnd={edata.windowEnd}
                        duration={edata.duration}
                        clampTime={edata.clampTime}
                        showScores={edata.showScores}

                        state={examData.state}

                        limitedEdit={limitedEdit}
                    />
                )
            }
            <Space direction="vertical" size="middle" style={{ display: 'flex', margin: '20px 0px', width: '100%' }}>
                {
                    questions.map((ques, i) => (
                        (editIndex === i) ? (
                            <EditQues
                                key={i}
                                index={i}
                                quesID={ques._id}
                                text={ques.text}
                                points={ques.points}
                                maxAttempts={ques.maxAttempts}
                                quesType={ques.quesType}
                                options={ques.options}

                                correct={ques.correct}

                                onEditClose={() => cancelEditing(i)}
                                onEditSave={(quesData, setSpinner) => saveQues(i, ques._id, quesData, setSpinner)}

                                limitedEdit={limitedEdit}
                            />
                        ) : (
                            <ViewQues
                                key={i}
                                index={i}
                                text={ques.text}
                                points={ques.points}
                                maxAttempts={ques.maxAttempts}
                                quesType={ques.quesType}
                                options={ques.options}

                                state={examData.state}
                                hasScores={examData.showScores}

                                correct={ques.correct}

                                canEdit={canEdit}

                                onGotoEdit={() => editExisting(i)}
                                onDelete={(setSpinner) => deleteQues(i, ques._id as string, setSpinner)}

                                limitedEdit={limitedEdit}
                            />
                        )
                    ))
                }
                <Button type="dashed" style={{ height: '48px' }} disabled={!canEdit || limitedEdit} onClick={addNewQues} block>Add Question</Button>
            </Space>
        </>
    );
};

export default EditExamPage;