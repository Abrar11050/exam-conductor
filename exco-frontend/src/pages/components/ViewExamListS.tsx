import React from 'react';

import { Card, Button, Space, Descriptions, Empty } from 'antd';

import { ExamMetaDataS } from '../../models/exam';

import { millisToHHMMSS } from '../../utils/common';

const { Item: DescItem } = Descriptions;

const ExListItem: React.FC<{ exent: ExamMetaDataS }> = ({ exent }) => {
    const winStart = new Date(exent.windowStart).toLocaleString('en-GB').toLocaleUpperCase();
    const winEnd   = new Date(exent.windowEnd).toLocaleString('en-GB').toLocaleUpperCase();
    const subStart = new Date(exent.subStartTime).toLocaleString('en-GB').toLocaleUpperCase();

    return (
        <Card
            title={<>{exent.title} &nbsp;&nbsp; <Button href={`/exam/${exent.examID}`}>Open</Button></>}
            style={{ width: '100%', margin: 10 }}
            >
            <Descriptions bordered>
                <DescItem label="Title">{exent.title}</DescItem>
                <DescItem label="Window Start">{winStart}</DescItem>
                <DescItem label="Window End">{winEnd}</DescItem>
                <DescItem label="Duration">{millisToHHMMSS(exent.duration)}</DescItem>
                <DescItem label="Scores Available">{exent.showScores ? 'Yes' : 'No'}</DescItem>
                
                <DescItem label="Started At">{subStart}</DescItem>
                <DescItem label="Submitted">{exent.subFinished ? 'Yes' : 'No'}</DescItem>
            </Descriptions>
        </Card>
    );
};

const ViewExamListS: React.FC<{ exents: ExamMetaDataS[] }> = ({ exents }) => {
    return (
        exents.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Empty />
            </div>
        ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
                {exents.map((exent, i) => <ExListItem key={i} exent={exent} />)}
            </Space>
        )
    );
};

export default ViewExamListS;