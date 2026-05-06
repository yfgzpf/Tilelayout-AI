import React, { useState, useCallback } from 'react';
import { Layout, Typography, Button, Card, Space, message } from 'antd';
import { ArrowLeftOutlined, RocketOutlined } from '@ant-design/icons';
import RoomEditorV2 from '@/components/RoomEditor/RoomEditorV2';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// 默认演示房间数据 (3m x 4m)
const DEFAULT_ROOM = [
  [0, 0],
  [3000, 0],
  [3000, 4000],
  [0, 4000]
];

const AdvancedTilePlanner = () => {
  const [roomShape, setRoomShape] = useState(DEFAULT_ROOM);
  const [selectedLayout, setSelectedLayout] = useState<any>(null);

  const handleRoomChange = useCallback((newShape: number[][]) => {
    setRoomShape(newShape);
  }, []);

  const handleLayoutSelect = useCallback((layout: any) => {
    setSelectedLayout(layout);
    message.success(`已选择方案：${layout.name}`);
  }, []);

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <RocketOutlined style={{ fontSize: 24, color: '#fff' }} />
          <Title level={4} style={{ color: '#fff', margin: 0 }}>排砖宝 · 智能版</Title>
        </div>
        <Space>
          <Button onClick={() => {
              if(confirm('返回会丢失当前工作，确定吗？')) {
                  // navigate back
              }
          }} icon={<ArrowLeftOutlined />}>返回</Button>
        </Space>
      </Header>

      <Content style={{ padding: 24, height: 'calc(100vh - 64px)' }}>
        <RoomEditorV2
          polygon={roomShape}
          onChange={handleRoomChange}
          width={1000}
          height={600}
          onLayoutChange={handleLayoutSelect}
        />

        {/* 确认方案后的操作栏 */}
        {selectedLayout && (
          <div className="mt-4 flex justify-end gap-4">
             <Card size="small" className="flex-1">
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong>当前方案：{selectedLayout.name}</Text>
                    <Text type="secondary" className="ml-4">
                      预估用砖：{selectedLayout.totalTiles} 片
                    </Text>
                  </div>
                  <Space>
                    <Button type="default">生成报价单</Button>
                    <Button type="primary">导出施工图</Button>
                  </Space>
                </div>
             </Card>
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default AdvancedTilePlanner;
