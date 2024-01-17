import React, { useState } from 'react';

import { Card, Input, Typography, Form, Button, Radio, message, Layout } from 'antd';

import { User, UserRole } from '../models/user';

import { ExcoFetcher } from '../utils/exco-fetcher';

import '../Acid.css';
import NavMenu from './components/NavMenu';

const { Content, Footer } = Layout;
const { Paragraph } = Typography;

const waitToLogin = () => {
    setTimeout(() => {
        window.location.href = '/login';
    }, 2000);
};

const RegisterPage: React.FC = () => {

    document.title = "Register";

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isLogged, _setIsLogged] = useState<boolean>(localStorage.getItem('token') !== null);
    const [ldState, setLdState] = useState<boolean>(false);

    const [messageApi, contextHolder] = message.useMessage();

    function onFinish(values: any) {
        const user = User.fromJSON(values);

        // register: api/register [POST]

        setLdState(true);

        new ExcoFetcher()
            .post('api/register')
            .body(user)
            .failure(msg => messageApi.error(msg))
            .error(err => messageApi.error(err))
            .success((isOK, fetcher) => {
                if(isOK) {
                    messageApi.success('Registration successful.');
                    waitToLogin();
                } else {
                    const msg = fetcher?._parsed?.msg || 'Registration failed due to unknown reason';
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
            <NavMenu pseudoRoute={{ title: 'Register', key: 'reg' }} selected="reg" />
            <Content className="contentjam">
                {contextHolder}
                {
                    isLogged ? (
                        <div style={{ padding: '0 50px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '85vh' }}>
                            <Card title="Register" style={{ width: 500 }}>
                                <Paragraph>You are already logged in.</Paragraph>
                                <Button type="primary" style={{ width: '100%' }} onClick={() => { window.location.href = '/'; }}>
                                    Go to Home
                                </Button>
                            </Card>
                        </div>
                    ) : (
                        <div style={{ padding: '0 50px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '85vh' }}>
                            <Card title="Register" style={{ width: 500 }}>
                                <Form
                                    name="register"
                                    initialValues={{ remember: true }}
                                    onFinish={onFinish}
                                    onFinishFailed={onFinishFailed}
                                >
                                    <Form.Item
                                        name="firstName"
                                        rules={[{ required: true, message: 'Please input your first name!' }]}
                                    >
                                        <Input placeholder="First Name" />
                                    </Form.Item>
            
                                    <Form.Item
                                        name="lastName"
                                        rules={[{ required: true, message: 'Please input your last name!' }]}
                                    >
                                        <Input placeholder="Last Name" />
                                    </Form.Item>
            
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
            
                                    <Form.Item
                                        name="role"
                                        rules={[{ required: true, message: 'Please select your role!' }]}
                                        style={{ width: '100%' }}
                                    >
                                        <Radio.Group style={{ width: '100%' }} optionType="button" buttonStyle="solid">
                                            <Radio value={UserRole.STUDENT} style={{ width: '50%', textAlign: 'center' }}>Student</Radio>
                                            <Radio value={UserRole.TEACHER} style={{ width: '50%', textAlign: 'center' }}>Teacher</Radio>
                                        </Radio.Group>
                                    </Form.Item>
            
                                    <Form.Item>
                                        <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={ldState}>
                                            Register
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

export default RegisterPage;