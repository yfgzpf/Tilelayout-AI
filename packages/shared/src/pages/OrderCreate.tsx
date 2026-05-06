import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

const OrderCreate: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <Title level={3}>创建订单</Title>
          <Text type="secondary">订单创建功能开发中...</Text>
        </Card>
      </div>
    </div>
  );
};

export default OrderCreate;
