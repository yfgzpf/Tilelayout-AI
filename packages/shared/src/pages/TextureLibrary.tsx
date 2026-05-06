import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

const TextureLibrary: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <Title level={3}>材质库</Title>
          <Text type="secondary">材质库功能开发中...</Text>
        </Card>
      </div>
    </div>
  );
};

export default TextureLibrary;
