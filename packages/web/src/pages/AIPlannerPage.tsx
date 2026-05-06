import React, { useState, useCallback } from 'react';
import { Layout, Typography, Button, message } from 'antd';
import { ArrowLeftOutlined, RocketOutlined } from '@ant-design/icons';
import RoomEditorV2 from '@/components/RoomEditor/RoomEditorV2';
import AIPlannerPanel from '@/components/AIPlanner/AIPlannerPanel';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// 默认演示房间数据 (3m x 4m)
const DEFAULT_ROOM = [
  [0, 0],
  [3600, 0],
  [3600, 4200],
  [0, 4200]
];

const AIPlannerPage: React.FC = () => {
  const [roomShape, setRoomShape] = useState(DEFAULT_ROOM);
  const [selectedLayout, setSelectedLayout] = useState<any>(null);

  const handleRoomChange = useCallback((newShape: number[][]) => {
    setRoomShape(newShape);
  }, []);

  const handleLayoutSelect = useCallback((layout: any) => {
    setSelectedLayout(layout);
    message.success(`已选择方案：${layout.name}');
  };

  // 处理AI建议
  const handleAISuggestion = useCallback((type: 'room' | 'layout' | 'material', data: any) => {
    if (type === 'room') {
      setRoomShape(data);
      message.success('AI已帮您生成户型！');
    }
  }, []);

  return (
    <Layout className="h-screen flex flex-col bg-gray-50">
      {/* 顶部导航 */}
      <Header 
        style={{ 
          background: 'linear-gradient(90deg, #0f172a, #1e293b)', 
          padding: '0 24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid #334155'
        }}
      >
        <div className="flex items-center gap-4">
          <Button type="text" style={{ color: '#fff' }} icon={<ArrowLeftOutlined />}>
            返回
          </Button>
          <div className="h-6 w-px bg-gray-700" />
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <RocketOutlined className="text-white text-xl" />
            </div>
            <div className="flex flex-col">
              <Title level={4} style={{ color: '#fff', margin: 0, fontSize: 16 }}>
              排砖宝 · AI 智能版
            </Title>
              <Text className="text-gray-400 text-xs">AI 辅助工作流
            </Text>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">今日已服务 128 位客户</span>
          <Button type="primary" size="small" onClick={() => message.info('保存成功')}>
            保存方案
          </Button>
        </div>
      </Header>

      {/* 主体区域：左侧画布 + 右侧AI面板 */}
      <Layout className="flex-1 flex">
        {/* 左侧：编辑器 */}
        <Content className="flex-1 relative bg-gray-100 overflow-hidden flex justify-center items-center p-6">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 w-full h-full flex flex-col">
            <RoomEditorV2
              polygon={roomShape}
              onChange={handleRoomChange}
              width={1000}
              height={600}
              onLayoutChange={handleLayoutSelect}
            />
          </div>
        </Content>

        {/* 右侧：AI 规划师面板 */}
        <AIPlannerPanel 
          onAISuggestion={handleAISuggestion}
          currentRoom={roomShape}
        />
      </Layout>
    </Layout>
  );
};

export default AIPlannerPage;
