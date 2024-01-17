import React, { useState, useEffect } from 'react';

import { Card, Row, Col, Typography, Button, Space, Tag, Badge, Avatar, Empty, Segmented, Layout } from 'antd';
import { QuestionCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined  } from '@ant-design/icons';

import { ExcoFetcher } from '../utils/exco-fetcher';

import { GSDescriptor, millisToHHMMSS, LoadState, errorStateToText } from '../utils/common';

import LoadError from './components/LoadError';
import Loading from './components/Loading';
import NavMenu from './components/NavMenu';

import '../Acid.css';

const REACT_APP_BASE_API_URL = process.env.REACT_APP_BASE_API_URL || undefined;

const { Content, Footer } = Layout;
const { Text, Link, Paragraph } = Typography;

function FileTask({ gs }: { gs: GSDescriptor }) {
    const timeText = new Date(gs.timestamp).toLocaleString('en-GB').toLocaleUpperCase();
    const timeTakenText = gs.timeTaken === -1
                        ? null
                        : (gs.timeTaken < 1000 ? `${gs.timeTaken}ms` : millisToHHMMSS(gs.timeTaken));
    
    const titleText = <Link href={`/exam/${gs.examID}`}>{gs.title}</Link>;

    let openButton: JSX.Element = <></>;
    let errorText: JSX.Element = <></>;
    let avatar: JSX.Element = <></>;
    let statusTag: JSX.Element = <></>;

    const fileURL = new URL(`/grades/${gs.authorID}/${gs.format}/${gs.uuid}.${gs.format}`, REACT_APP_BASE_API_URL ? REACT_APP_BASE_API_URL : window.location.origin);

    if(gs.format === 'html') {
        avatar = <Avatar shape="square" size={40} style={{ color: 'white', backgroundColor: '#e34c26' }}>HTML</Avatar>;
    } else if(gs.format === 'csv') {
        avatar = <Avatar shape="square" size={40} style={{ color: 'white', backgroundColor: '#1d6f42' }}>CSV</Avatar>;
    } else {
        avatar = <Avatar shape="square" icon={<QuestionCircleOutlined />} />;
    }

    if(gs.status === 'running') {
        avatar = <Badge count={<ClockCircleOutlined style={{ color: '#ebac00' }} />}>{avatar}</Badge>;
        statusTag = <Tag color="processing" style={{ fontSize: '12px' }}>Running</Tag>;
    } else if(gs.status === 'error') {
        avatar = <Badge count={<ExclamationCircleOutlined style={{ color: '#eb0000' }} />}>{avatar}</Badge>;
        errorText = <Paragraph type="danger">{gs.error || 'Unknown Error'}</Paragraph>;
        statusTag = <Tag color="error">Error</Tag>;
    } else if(gs.status === 'done') {
        openButton = <Button type="primary" size="small" href={fileURL.href} target="_blank" download={`${gs.title}.${gs.format}`}>Open</Button>;
        statusTag = <Tag color="success">Done</Tag>;
    }

    return (
        <Card style={{ width: '100%', margin: '10px 0px' }}>
            <Row>
                <Col span={2} style={{ display: 'flex', alignItems: 'center' }}>
                    {avatar}
                </Col>
                <Col span={20}>
                    <Text strong>{titleText}</Text> &nbsp;&nbsp;
                    <br />
                    <Text type="secondary">{timeText}</Text>
                    <br />
                    { timeTakenText && <Text type="secondary">Time Taken: {timeTakenText}</Text> }
                    <div style={{ margin: '6px 0px' }}>
                        {statusTag}
                    </div>
                    {errorText}
                </Col>
                <Col span={2} style={{ display: 'flex', alignItems: 'center' }}>
                    {openButton}
                </Col>
            </Row>
        </Card>
    );
}

const typeFilters = [
    { label: 'All',  value: 'all'  },
    { label: 'HTML', value: 'html' },
    { label: 'CSV',  value: 'csv'  }
];

const statFilters = [
    { label: 'All',     value: 'all'     },
    { label: 'Running', value: 'running' },
    { label: 'Done',    value: 'done'    },
    { label: 'Error',   value: 'error'   }
];

function TaskList({ tasks }: { tasks: GSDescriptor[] }) {
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statFilter, setStatFilter] = useState<string>('all');

    const filteredList = tasks.filter(gs => {
        if(typeFilter !== 'all' && gs.format !== typeFilter) return false;
        if(statFilter !== 'all' && gs.status !== statFilter) return false;
        return true;
    });

    return (
            <>
                <Segmented options={typeFilters} value={typeFilter} onChange={val => setTypeFilter(val as string)} style={{ backgroundColor: '#dfdfdf', margin: '4px 8px', marginBottom: '10px' }} />
                <Segmented options={statFilters} value={statFilter} onChange={val => setStatFilter(val as string)} style={{ backgroundColor: '#dfdfdf', margin: '4px 8px' }} />
                {
                    filteredList.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                            <Empty />
                        </div>
                    ) : (
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {
                                filteredList.map((gs, i) => <FileTask key={i} gs={gs} />)
                            }
                        </Space>
                    )
                }
            </>
    );
}

interface LoadEntity {
    state: LoadState;
    tasks: GSDescriptor[] | null;
    msg?: string;
}

const GradesheetsPage: React.FC = () => {

    document.title = "Gradesheets";

    const [lden, setLden] = useState<LoadEntity>({ state: LoadState.LOADING, tasks: null });

    // taskList: api/gdlist?full=true [GET]

    useEffect(() => {
        new ExcoFetcher()
            .needAuth()
            .get('api/gdlist')
            .addQuery('full', 'true')
            .failure(msg => setLden({ state: LoadState.WARNING, tasks: null, msg }))
            .error(msg => setLden({ state: LoadState.ERROR, tasks: null, msg }))
            .success(data => {
                if(!Array.isArray(data)) {
                    setLden({ state: LoadState.ERROR, tasks: null, msg: 'Invalid response' });
                } else {
                    data = data.sort((a: GSDescriptor, b: GSDescriptor) => b.timestamp - a.timestamp);
                    setLden({ state: LoadState.LOADED, tasks: data as GSDescriptor[] });
                }
            })
            .exec();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    let toDisplay: JSX.Element | null = null;

    switch(lden.state) {
        case LoadState.LOADING:
            toDisplay = <Loading />;
            break;
        case LoadState.LOADED: {
                const list = lden.tasks as GSDescriptor[];
                toDisplay = <TaskList tasks={list} />;
            }
            break;
        case LoadState.ERROR:
        case LoadState.WARNING:
            toDisplay = <LoadError subTitle={lden.msg} status={errorStateToText(lden.state)} />;
            break;
    }

    return (
        <>
            <NavMenu selected="files" />
            <Content className="contentjam">{toDisplay}</Content>
            <Footer style={{ textAlign: 'center' }}>Exco ©2022 Created by Abrar Mahmud</Footer>
        </>
    );
};

export default GradesheetsPage;