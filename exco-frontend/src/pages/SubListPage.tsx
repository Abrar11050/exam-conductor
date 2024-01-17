import React, { useState, useEffect } from 'react';
import { useParams } from "react-router-dom";

import { Typography, Button, Tag, message, Table, Select, Layout } from 'antd';

import { SubMetaData } from '../models/exam';

import { ExcoFetcher } from '../utils/exco-fetcher';

import { errorStateToText, LoadState } from '../utils/common';

import LoadError from './components/LoadError';
import Loading from './components/Loading';
import NavMenu from './components/NavMenu';

import '../Acid.css';

const { Column, ColumnGroup } = Table;
const { Content, Footer } = Layout;
const { Text } = Typography;

function SubTable({ subs, examID, onGenerate }: {
    subs: SubMetaData[],
    examID: string,
    onGenerate: (format: string, setSpinner?: (loading: boolean) => void) => void
}) {
    const [ldState, setLdState] = useState<boolean>(false);
    const [format, setFormat] = useState<string>('csv');

    return (
        <>
            <div style={{ float: 'right', margin: '10px 6px' }}>
                <Text type="secondary" style={{ margin: '0px 5px' }}>Generate Gradesheet</Text>
                <Select defaultValue={format} style={{ width: 120, margin: '0px 5px' }} onChange={val => setFormat(val)}>
                    <Select.Option value="csv">CSV</Select.Option>
                    <Select.Option value="html">HTML</Select.Option>
                </Select>
                <Button
                    style={{ margin: '0px 5px' }}
                    loading={ldState}
                    onClick={() => onGenerate(format, setLdState)}
                >Generate</Button>
            </div>
            <Table dataSource={subs} pagination={false} scroll={{ y: '70vh' }}>
                <ColumnGroup title="Name">
                    <Column title="First Name" dataIndex={["givenBy", "firstName"]} key="givenBy.firstName" />
                    <Column title="Last Name"  dataIndex={["givenBy", "lastName"]}  key="givenBy.lastName" />
                </ColumnGroup>
                <Column title="Start Time" dataIndex="startTime" key="startTime"
                    render={dateStr => new Date(dateStr).toLocaleString('en-GB').toLocaleUpperCase()}
                />
                <Column title="Marked Finished" dataIndex="finished" key="finished"
                    render={finished => finished ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
                />
                <Column title="View" dataIndex={["givenBy", "_id"]} key="givenBy._id"
                    render={userID => <Button href={`/exam/${examID}/by/${userID}`}>Open</Button>}
                />
            </Table>
        </>
    );
}

interface LoadEntity {
    state: LoadState;
    subs: SubMetaData[] | null;
    msg?: string;
}

const SubListPage: React.FC = () => {

    document.title = "Submissions";

    const { examID } = useParams<{ examID: string }>() as { examID: string };

    const [lden, setLden] = useState<LoadEntity>({ state: LoadState.LOADING, subs: null });

    const [messageApi, contextHolder] = message.useMessage();

    // subList: api/exam/{{ _.exam }}/subs [GET]

    useEffect(() => {
        new ExcoFetcher()
            .needAuth()
            .get(`api/exam/${examID}/subs`)
            .failure(msg => setLden({ state: LoadState.WARNING, subs: null, msg }))
            .error(msg => setLden({ state: LoadState.ERROR, subs: null, msg }))
            .success(data => {
                if(!Array.isArray(data)) {
                    setLden({ state: LoadState.ERROR, subs: null, msg: 'Invalid response from server' });
                    return;
                }

                setLden({ state: LoadState.LOADED, subs: data as SubMetaData[] });
            })
            .exec();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function generateGS(format: string, setSpinner?: (loading: boolean) => void) {
        // generateGS: api/newgrade/{{ _.exam }}/?format={{ format }} [POST]

        setSpinner?.(true);

        new ExcoFetcher()
            .needAuth()
            .post(`api/newgrade/${examID}/`)
            .addQuery('format', format)
            .failure(msg => messageApi.error(msg))
            .error(msg => messageApi.error(msg))
            .finally(() => setSpinner?.(false))
            .success(data => {
                if(typeof data === 'object' && typeof data.uuid === 'string') {
                    messageApi.success('Done, you can check status in the files page');
                } else {
                    messageApi.error('Failed to request for gradesheet generation');
                }
            })
            .exec();
    }

    let toDisplay: JSX.Element | null = null;

    switch(lden.state) {
        case LoadState.LOADING:
            toDisplay = <Loading />;
            break;
        case LoadState.LOADED: {
                const subList = lden.subs as SubMetaData[];
                toDisplay = <>
                                {contextHolder}
                                <SubTable subs={subList} examID={examID} onGenerate={generateGS} />
                            </>;
            }
            break;
        case LoadState.ERROR:
        case LoadState.WARNING:
            toDisplay = <LoadError subTitle={lden.msg} status={errorStateToText(lden.state)} />;
            break;
    }

    return (
        <>
            <NavMenu pseudoRoute={{ title: 'Submissions', key: 'subs' }} selected="subs" />
            <Content className="contentjam">{toDisplay}</Content>
            <Footer style={{ textAlign: 'center' }}>Exco ©2022 Created by Abrar Mahmud</Footer>
        </>
    );
};

export default SubListPage;