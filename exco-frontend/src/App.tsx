import React from 'react';
import { Layout } from 'antd';
import './Acid.css';

import { Routes, Route, BrowserRouter } from "react-router-dom";

import Home            from './pages/Home';
import ExamPage        from './pages/ExamPage';
import ExamListPage    from './pages/ExamListPage';
import SubListPage     from './pages/SubListPage';
import GradesheetsPage from './pages/GradesheetsPage';
import RegisterPage    from './pages/RegisterPage';
import LoginPage       from './pages/LoginPage';

const App: React.FC = () => {

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout className="site-layout" style={{ height: '100vh', overflow: 'scroll' }}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            
            <Route path="/exam/:examID" element={<ExamPage />} />
            <Route path="/exam/:examID/by/:stdID" element={<ExamPage />} />

            <Route path="/exams" element={<ExamListPage />} />

            <Route path="/exam/:examID/subs" element={<SubListPage />} />

            <Route path="/files" element={<GradesheetsPage />} />

            <Route path="/register" element={<RegisterPage />} />

            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </BrowserRouter>
      </Layout>
    </Layout>
  );
};

export default App;