import React from 'react';
import { Button, Result } from 'antd';
import { ResultStatusType } from 'antd/es/result';

const LoadError: React.FC<{
    status?: ResultStatusType;
    title?: string;
    subTitle?: string;
}> = ({ status, title, subTitle }) => (
    <div style={{ display : "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", height: "80vh" }}>
        <Result
            status={status || "error"}
            title={title || "Loading Failed"}
            subTitle={subTitle || "Failed to load this resource. Please try again later."}
            extra={
                <Button type="primary" href="/" key="console">Go To Home</Button>
            }
        >
        </Result>
    </div>
);

export default LoadError;