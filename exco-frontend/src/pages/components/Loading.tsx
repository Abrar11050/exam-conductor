import React from 'react';
import { Spin, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const Loading: React.FC<{
    title?: string;
    subTitle?: string;
}> = ({ title, subTitle }) => (
  <>
    <div style={{ display : "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", height: "80vh" }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 70 }} spin />} />
        <div style={{ marginLeft: 20 }}>
            <Typography.Title level={3} style={{ textAlign: "center" }}>{title || "Loading..."}</Typography.Title>
            <Typography.Text style={{ textAlign: "center" }}>{subTitle || "Please wait while we load this resource."}</Typography.Text>
        </div>
    </div>
  </>
);

export default Loading;