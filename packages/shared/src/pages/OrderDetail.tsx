import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

const OrderDetail: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <Title level={3}>订单详情</Title>
          <Text type="secondary">订单详情功能开发中...</Text>
        </Card>
      </div>
    </div>
  );
};

export default OrderDetail;
