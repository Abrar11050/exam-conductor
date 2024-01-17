import React, { useState } from 'react';

import { Card, Input, Typography, Form, Button, message, Layout } from 'antd';

import { ExcoFetcher } from '../utils/exco-fetcher';

import { saveAuthStuffs } from '../utils/common';

import '../Acid.css';
import NavMenu from './components/NavMenu';

const { Content, Footer } = Layout;
const { Paragraph } = Typography;

const waitToHome = () => {
    setTimeout(() => {
        window.location.href = '/';
    }, 2000);
};


const LoginPage: React.FC = () => {

    document.title = "Login";

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isLogged, _setIsLogged] = useState<boolean>(localStorage.getItem('token') !== null);
    const [ldState, setLdState] = useState<boolean>(false);

    const [messageApi, contextHolder] = message.useMessage();

    function onFinish(values: any) {
        const creds = values as { email: string, password: string };

        // login: api/login [POST]

        setLdState(true);

        new ExcoFetcher()
            .post('api/login')
            .body(creds)
            .failure(msg => messageApi.error(msg))
            .error(err => messageApi.error(err))
            .success((data, fetcher) => {
                if(data !== undefined && data !== null && typeof data.token === 'string' && typeof data.role === 'number') {
                    saveAuthStuffs(data.token, data.role);
                    messageApi.success('Login successful.');
                    waitToHome();
                } else {
                    const msg = fetcher?._parsed?.msg || 'Login failed due to unknown reason';
                    messageApi.error(msg);
                }
            })
            .finally(() => setLdState(false))
            .exec();
    }

    function onFinishFailed(errorInfo: any) {
        console.log('Failed:', errorInfo);
    }

    return (
        <>
            <NavMenu pseudoRoute={{ title: 'Login', key: 'log' }} selected="log" />
            <Content className="contentjam">
                {contextHolder}
                {
                    isLogged ? (
                        <div style={{ padding: '0 50px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '85vh' }}>
                            <Card title="Login" style={{ width: 500 }}>
                                <Paragraph>You are already logged in.</Paragraph>
                                <Button type="primary" style={{ width: '100%' }} onClick={() => { window.location.href = '/'; }}>
                                    Go to Home
                                </Button>
                            </Card>
                        </div>
                    ) : (
                        <div style={{ padding: '0 50px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '85vh' }}>
                            <Card title="Login" style={{ width: 500 }}>
                                <Form
                                    name="login"
                                    initialValues={{ remember: true }}
                                    onFinish={onFinish}
                                    onFinishFailed={onFinishFailed}
                                >
                                    <Form.Item
                                        name="email"
                                        rules={[{ required: true, message: 'Please input your email!' }]}
                                    >
                                        <Input type="email" placeholder="Email" />
                                    </Form.Item>
            
                                    <Form.Item
                                        name="password"
                                        rules={[{ required: true, message: 'Please input your password!' }]}
                                    >
                                        <Input.Password placeholder="Password" />
                                    </Form.Item>
            
                                    <Form.Item>
                                        <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={ldState}>
                                            Login
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </Card>
                        </div>
                    )
                }
            </Content>
            <Footer style={{ textAlign: 'center' }}>Exco ©2022 Created by Abrar Mahmud</Footer>
        </>
    );
};

export default LoginPage;