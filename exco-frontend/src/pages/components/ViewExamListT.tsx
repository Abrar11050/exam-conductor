import React, { useState } from 'react';

import { Card, Input, Button, Space, Descriptions, Empty, Modal } from 'antd';

import { ExamMetaDataT } from '../../models/exam';

import { millisToHHMMSS } from '../../utils/common';

import { ExcoFetcher } from '../../utils/exco-fetcher';

const { Item: DescItem } = Descriptions;

const ExListItem: React.FC<{ exent: ExamMetaDataT }> = ({ exent }) => {
    const winStart = new Date(exent.windowStart).toLocaleString('en-GB').toLocaleUpperCase();
    const winEnd   = new Date(exent.windowEnd).toLocaleString('en-GB').toLocaleUpperCase();

    return (
        <Card
            title={
                <>
                    {exent.title} &nbsp;&nbsp;
                    <Button target="_blank" href={`/exam/${exent.examID}`} style={{ marginRight: '10px' }}>Open</Button>
                    <Button target="_blank" href={`/exam/${exent.examID}/subs`}>View Submissions</Button>
                </>
            }
            style={{ width: '100%', margin: 10 }}
            >
            <Descriptions bordered>
                <DescItem label="Title">{exent.title}</DescItem>
                <DescItem label="Window Start">{winStart}</DescItem>
                <DescItem label="Window End">{winEnd}</DescItem>
                <DescItem label="Duration">{millisToHHMMSS(exent.duration)}</DescItem>
                <DescItem label="Show Scores">{exent.showScores ? 'Yes' : 'No'}</DescItem>
            </Descriptions>
        </Card>
    );
};

const waitToExam = (examID: string) => {
    setTimeout(() => {
        window.location.href = `/exam/${examID}`;
    }, 2000);
};

const ViewExamListT: React.FC<{ exents: ExamMetaDataT[] }> = ({ exents }) => {
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [confLoading, setConfLoading] = useState<boolean>(false);
    const [xmName, setXmName] = useState<string>('');
    const [errMsg, setErrMsg] = useState<string>('');

    function handleOK() {
        setErrMsg('');

        if(xmName === '') {
            setErrMsg('Exam Name cannot be empty');
            return;
        }

        // newExam: api/exam [POST]

        setConfLoading(true);

        new ExcoFetcher()
            .needAuth()
            .post('api/exam')
            .body({
                title: xmName,
                description: 'A test about your skills',
                windowStart: new Date(Date.now() + 1000 * 60 * 60 * 1),
                windowEnd:   new Date(Date.now() + 1000 * 60 * 60 * 7),
                duration:    1000 * 60 * 60 * 1,
                clampTime:   false,
                showScores:  false
            })
            .failure(msg => setErrMsg(msg))
            .error(msg => setErrMsg(msg))
            .success(examID => {
                if(typeof examID !== 'string' && examID.length !== 24) {
                    setErrMsg('Invalid response from server');
                } else {
                    setModalOpen(false);
                    waitToExam(examID);
                }
            })
            .finally(() => setConfLoading(false))
            .exec();
    }

    return (
        <>
        <Button type="primary" style={{ margin: '10px 0px', float: 'right' }} onClick={() => setModalOpen(true)}>Create New Exam</Button>
        <Modal
            title="Create New Exam"
            open={modalOpen}
            onOk={handleOK}
            confirmLoading={confLoading}
            onCancel={() => setModalOpen(false)}
            >
            <Input required={true} value={xmName} onChange={e => setXmName(e.currentTarget.value)} placeholder="Exam Name" />
            {
                (errMsg !== '') && (
                    <div style={{ color: 'red', marginTop: '10px' }}>
                        {errMsg}
                    </div>
                )
            }
        </Modal>
        {
            exents.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <Empty />
                </div>
            ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                    {exents.map((exent, i) => <ExListItem key={i} exent={exent} />)}
                </Space>
            )
        }
        </>
    );
};

export default ViewExamListT;