import React, { useState, useEffect } from 'react';

import { Layout } from 'antd';

import { ExamMetaDataT, ExamMetaDataS } from '../models/exam';

import { UserRole } from '../models/user';

import { ExcoFetcher } from '../utils/exco-fetcher';

import { errorStateToText, LoadState } from '../utils/common';

import ViewExamListT from './components/ViewExamListT';
import ViewExamListS from './components/ViewExamListS';

import LoadError from './components/LoadError';
import Loading from './components//Loading';
import NavMenu from './components/NavMenu';

import '../Acid.css';

const { Content, Footer } = Layout;

interface LoadEntity {
    state: LoadState;
    exam: ExamMetaDataT[] | ExamMetaDataS[] | null;
    role: UserRole | null;
    msg?: string;
}

const ExamListPage: React.FC = () => {

    document.title = "All Exams";

    const [lden, setLden] = useState<LoadEntity>({ state: LoadState.LOADING, exam: null, role: null });

    // examList: api/exam/ [GET]

    useEffect(() => {
        new ExcoFetcher()
            .needAuth()
            .get(`api/exam/`)
            .failure(msg => setLden({ state: LoadState.WARNING, exam: null, msg, role: null }))
            .error(msg => setLden({ state: LoadState.ERROR, exam: null, msg, role: null }))
            .success(data => {
                if(typeof data !== 'object' || data.list === undefined || data.role === undefined) {
                    setLden({ state: LoadState.ERROR, exam: null, msg: 'Invalid response from server', role: null });
                    return;
                }

                const { list, role } = data as { list: ExamMetaDataT[] | ExamMetaDataS[], role: UserRole };

                switch(role) {
                    case UserRole.TEACHER:
                        setLden({ state: LoadState.LOADED, exam: list as ExamMetaDataT[], role });
                        break;
                    case UserRole.STUDENT:
                        setLden({ state: LoadState.LOADED, exam: list as ExamMetaDataS[], role });
                        break;
                    default:
                        setLden({ state: LoadState.WARNING, exam: null, msg: 'Unknown Role Access', role: null });
                        break;
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
                const examList = lden.exam as ExamMetaDataT[] | ExamMetaDataS[];
                const role = lden.role as UserRole;
                toDisplay = role === UserRole.TEACHER
                          ? <ViewExamListT exents={examList as ExamMetaDataT[]} />
                          : <ViewExamListS exents={examList as ExamMetaDataS[]} />;
            }
            break;
        case LoadState.ERROR:
        case LoadState.WARNING:
            toDisplay = <LoadError subTitle={lden.msg} status={errorStateToText(lden.state)} />;
            break;
    }

    return (
        <>
            <NavMenu selected="exams" />
            <Content className="contentjam">{toDisplay}</Content>
            <Footer style={{ textAlign: 'center' }}>Exco ©2022 Created by Abrar Mahmud</Footer>
        </>
    );
};

export default ExamListPage;