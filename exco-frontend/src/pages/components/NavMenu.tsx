/* eslint-disable jsx-a11y/anchor-is-valid */
import { useState } from 'react';
import { Button, Menu, Layout, Popconfirm } from 'antd';
import { UserRole } from '../../models/user';
import { clearAuthStuffs } from '../../utils/common';

function getLocalRole(): UserRole {
  const item = localStorage.getItem('userRole');

  if(item === null) return UserRole.UNKNOWN;

  try {
    const num = parseInt(item);

    switch(num) {
        case 0:  return UserRole.STUDENT;
        case 1:  return UserRole.TEACHER;
        default: return UserRole.UNKNOWN;
    }

  } catch(e) {
    return UserRole.UNKNOWN;
  }
}

const waitToLogin = () => {
    setTimeout(() => {
        window.location.href = '/login';
    }, 0);
};

const { Header } = Layout;

function NavMenu({ pseudoRoute, selected } : { pseudoRoute?: { title: string, key: string }, selected?: string }) {
    const [urole, setRole] = useState(getLocalRole());

    const navLinks = [
        { title: 'Home', key: 'home', path: '/' }
    ];

    if(pseudoRoute && urole !== UserRole.UNKNOWN) {
        navLinks.push({
            title: pseudoRoute.title,
            key:   pseudoRoute.key,
            path: '#'
        });
    }

    const defaultSelected = selected || navLinks[0].key;

    if(urole === UserRole.STUDENT) {
        navLinks.push({ title: 'My Exams', key: 'exams', path: '/exams' });
    } else if(urole === UserRole.TEACHER) {
        navLinks.push({ title: 'My Exams', key: 'exams', path: '/exams' });
        navLinks.push({ title: 'Files',    key: 'files', path: '/files' });
    }

    function logMeOut() {
        clearAuthStuffs();
        setRole(getLocalRole());

        waitToLogin();
    }

    return (
        <Header className="site-layout-background" style={{ padding: 0, backgroundColor: 'white' }}>
            <div style={{ float: 'left', margin: '0px 24px', height: '100%', fontFamily: 'tesla', fontSize: '30px' }}>
                EXCO
            </div>
            <div style={{ float: 'right', margin: '0px 16px' }}>
                {
                    (urole === UserRole.UNKNOWN) ? (
                        <>
                            <Button style={{ margin: '0px 5px', display: 'inline-block' }} onClick={() => window.location.href = '/login'}>Log In</Button>
                            <Button style={{ margin: '0px 5px', display: 'inline-block' }} onClick={() => window.location.href = '/register'}>Register</Button>
                        </>
                    ) : (
                        <>
                            <Popconfirm
                                title="Are you sure to log out?"
                                onConfirm={logMeOut}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button style={{ margin: '0px 5px', display: 'inline-block' }}>Log Out</Button>
                            </Popconfirm>
                        </>
                    )
                }
            </div>
            <Menu theme="light" style={{ margin: '0px 16px' }} mode="horizontal" defaultSelectedKeys={[defaultSelected]}>
                {
                    navLinks.map(link => (
                        <Menu.Item key={link.key}>
                            <a href={link.path}>{link.title}</a>
                        </Menu.Item>
                    ))
                }
            </Menu>
        </Header>
    );
}

export default NavMenu;