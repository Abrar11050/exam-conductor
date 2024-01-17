import React, { useState, useEffect } from 'react';

import { useParams } from "react-router-dom";

import { Layout } from 'antd';

import { ExamData, ExamDeliveryState } from '../models/exam';

import { ExcoFetcher } from '../utils/exco-fetcher';

import { errorStateToText, LoadState } from '../utils/common';

import EditExamPage from './components/EditExamPage';

import LoadError from './components/LoadError';
import Loading from './components/Loading';
import ViewExamPage from './components/ViewExamPage';

import NavMenu from './components/NavMenu';

import '../Acid.css';

const { Content, Footer } = Layout;

interface LoadEntity {
    state: LoadState;
    exam: ExamData | null;
    msg?: string;
}

const ExamPage: React.FC = () => {

    document.title = "Exam";

    const { examID, stdID } = useParams<{ examID: string, stdID?: string }>() as { examID: string, stdID?: string };

    const [lden, setLden] = useState<LoadEntity>({ state: LoadState.LOADING, exam: null });

    // exam: api/exam/{{ _.exam }}/ [GET]
    // optional: ?std={{ _.std }}

    useEffect(() => {
        const exf = new ExcoFetcher().needAuth().get(`api/exam/${examID}/`) as ExcoFetcher;

        if(stdID) { exf.addQuery('std', stdID); }

        exf.genericHandler(fetcher => {
            const resData = fetcher._parsed;
            if(!resData || typeof resData !== 'object') {
                setLden({ state: LoadState.WARNING, exam: null, msg: 'Invalid response from server' });
                return;
            }

            if(resData.data === undefined || resData.msg === undefined || resData.ok === undefined) {
                setLden({ state: LoadState.WARNING, exam: null, msg: 'Invalid response from server' });
                return;
            }

            const { ok, msg, data } = resData as { ok: boolean, msg: string, data: object };

            if(typeof data !== 'object') {
                setLden({ state: LoadState.WARNING, exam: null, msg: 'Invalid response from server' });
                return;
            }

            if(!ok) {
                setLden({ state: LoadState.WARNING, exam: null, msg });
                return;
            }

            let edata: ExamData | null = null;

            try {
                edata = ExamData.fromJSON(data);

                setLden({ state: LoadState.LOADED, exam: edata });

                document.title = edata.title ?? "Exam";
            } catch(e) {
                setLden({ state: LoadState.ERROR, exam: null, msg: 'Failed to parse response from server' });
                console.error(e);
                return;
            }
        });
        exf.exec();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    let toDisplay: JSX.Element | null = null;

    switch(lden.state) {
        case LoadState.LOADING:
            toDisplay = <Loading />;
            break;
        case LoadState.LOADED: {
                const exam = lden.exam as ExamData;
                const state = exam.state;
                toDisplay = state === ExamDeliveryState.TCH_EXAM_EDIT ? <EditExamPage examData={exam} /> : <ViewExamPage examData={exam} />;
            }
            break;
        case LoadState.ERROR:
        case LoadState.WARNING:
            toDisplay = <LoadError subTitle={lden.msg} status={errorStateToText(lden.state)} />;
            break;
    }

    return (
        <>
            <NavMenu pseudoRoute={{ title: 'Exam', key: 'exam' }} selected="exam" />
            <Content className="contentjam">{toDisplay}</Content>
        </>
    );
};

export default ExamPage;