import React, { useState, useRef, useEffect } from 'react';
import { 
  Button, 
  Space, 
  Typography, 
  Card, 
  Input, 
  Tag, 
  message, 
  Upload, 
  Progress, 
  List,
  Divider
} from 'antd';
import {
  RobotOutlined,
  CameraOutlined,
  BulbOutlined,
  FileTextOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

// --- 类型定义 ---
interface AIPlannerPanelProps {
  onAISuggestion: (type: 'room' | 'layout' | 'material', data: any) => void;
  currentRoom: number[][];
}

interface MaterialItem {
  name: string;
  quantity: number;
  unit: string;
  price?: number;
}

// --- AI规划师组件 ---
const AIPlannerPanel: React.FC<AIPlannerPanelProps> = ({ onAISuggestion, currentRoom }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'ai', text: string}>>([]);
  const [userInput, setUserInput] = useState('');
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);

  // 上传照片处理
  const uploadProps: UploadProps = {
    name: 'roomPhoto',
    showUploadList: true,
    beforeUpload: () => {
      handlePhotoAnalyze();
      return false;
    },
    accept: 'image/*'
  };

  // 模拟AI分析照片
  const handlePhotoAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    message.info('AI正在识别户型...');

    // 模拟进度
    const steps = [
      { text: '正在识别墙体...', p: 20 },
      { text: '发现门和窗户...', p: 50 },
      { text: '建立3D模型...', p: 80 },
      { text: '生成建议方案...', p: 100 }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx >= steps.length) {
        clearInterval(interval);
        setIsAnalyzing(false);
        message.success('户型识别完成！');
        
        // 模拟返回结果
        const aiRoom = [[0,0],[3600,0],[3600,4200],[0,4200]];
        onAISuggestion('room', aiRoom);
        
      } else {
        const s = steps[stepIdx];
        setAnalysisProgress(s.p);
        message.loading({ content: s.text, key: 'ai-msg', duration: 1 });
        stepIdx++;
      }
    }, 700);
  };

  // 自然语言交互
  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    
    // 添加用户消息
    const newHistory = [...chatHistory, { type: 'user', text: userInput }];
    setChatHistory(newHistory);
    const input = userInput;
    setUserInput('');
    
    // 模拟AI思考
    setTimeout(() => {
      let aiReply = "收到！正在处理...";
      
      if (input.includes("宽") || input.includes("大")) {
        aiReply = "好的，我已将房间加宽30cm！";
      } else if (input.includes("砖")) {
        aiReply = "800*800的砖效果很大气，但考虑到空间，我推荐600*1200，更显档次，损耗也低。";
      } else if (input.includes("钱") || input.includes("预算")) {
        aiReply = "预算已算好！";
        calculateMaterials();
      } else {
        aiReply = "明白了！我正在为您优化方案。";
      }
      
      setChatHistory([...newHistory, { type: 'ai', text: aiReply }]);
    }, 800);
  };

  // 计算物料清单 (AI预算师)
  const calculateMaterials = () => {
    // 简单模拟
    const items: MaterialItem[] = [
      { name: '800*800 主砖', quantity: 28, unit: '片', price: 168 },
      { name: '瓷砖胶', quantity: 65, unit: 'kg', price: 5 },
      { name: '美缝剂', quantity: 4, unit: '支', price: 45 },
      { name: '十字卡 2.0mm', quantity: 200, unit: '颗', price: 0.1 },
      { name: '水泥', quantity: 8, unit: '袋', price: 35 },
      { name: '河沙', quantity: 0.5, unit: 'm³', price: 180 },
    ];
    
    setMaterials(items);
    const total = items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);
    setTotalPrice(total);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200" style={{ width: 420 }}>
      {/* 头部 */}
      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center gap-3">
          <RobotOutlined className="text-2xl" />
          <Title level={4} style={{ color: '#fff', margin: 0 }}>AI 规划师</Title>
        </div>
        <Text type="secondary" className="text-blue-100">您的智能瓷砖助手</Text>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* 功能1：拍照识别 */}
        <Card size="small" className="shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CameraOutlined className="text-blue-500 text-lg" />
            <Text strong>拍照秒识别</Text>
          </div>
          
          {isAnalyzing ? (
            <div className="text-center py-4">
              <Progress percent={analysisProgress} status="active" />
              <Text type="secondary" className="block mt-2">AI正在工作中...</Text>
            </div>
          ) : (
            <Upload.Dragger {...uploadProps} height={100} className="bg-gray-50">
              <p className="ant-upload-drag-icon">
                <CameraOutlined className="text-blue-500" />
              </p>
              <p className="ant-upload-text">点击或拖拽户型照片</p>
              <p className="ant-upload-hint text-xs">AI自动识别墙/门/窗</p>
            </Upload.Dragger>
          )}
        </Card>

        {/* 功能2：智能建议 */}
        <Card size="small" className="shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BulbOutlined className="text-yellow-500 text-lg" />
            <Text strong>AI 建议</Text>
          </div>
          
          <List
            size="small"
            dataSource={[
              { id: 1, t: '门位置建议', c: '建议把开在东南侧', tag: '美学' },
              { id: 2, t: '省砖方案', c: '微调2cm，省4片砖', tag: '省钱' },
              { id: 3, t: '尺寸推荐', c: '600*1200更显档次', tag: '效果' }
            ]}
            renderItem={(item) => (
              <List.Item
                actions={[<Button type="link" size="small" onClick={() => message.info('已采纳！')}>采纳</Button>]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {item.t}
                      <Tag color={item.tag === '省钱' ? 'red' : 'blue'}>{item.tag}</Tag>
                    </Space>
                  }
                  description={item.c}
                />
              </List.Item>
            )}
          />
        </Card>

        {/* 功能3：自然语言对话 */}
        <Card size="small" className="shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ThunderboltOutlined className="text-indigo-500 text-lg" />
            <Text strong>跟我说话</Text>
          </div>

          <div className="bg-gray-50 rounded p-3 mb-3 h-32 overflow-y-auto">
             {chatHistory.length === 0 ? (
               <Text type="secondary" className="text-sm">试试对我说：「房间加宽30cm」</Text>
             ) : (
               chatHistory.map((msg, i) => (
                 <div key={i} className={`mb-2 ${msg.type === 'user' ? 'text-right' : ''}`}>
                   <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                     msg.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                   }`}>
                     {msg.text}
                   </span>
                 </div>
               ))
             )}
          </div>

          <Space.Compact style={{ width: '100%' }}>
             <TextArea 
               value={userInput}
               onChange={(e) => setUserInput(e.target.value)}
               placeholder="说点什么..."
               autoSize={{ minRows: 1, maxRows: 3 }}
               onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
             />
             <Button type="primary" onClick={handleSendMessage}>发送</Button>
          </Space.Compact>
        </Card>

        {/* 功能4：算料清单 */}
        <Card size="small" className="shadow-sm">
           <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileTextOutlined className="text-green-500 text-lg" />
                <Text strong>AI 算料清单</Text>
              </div>
              <Button type="link" size="small" onClick={calculateMaterials}>重新计算</Button>
           </div>

           {materials.length > 0 && (
             <>
               <div className="bg-green-50 p-3 rounded-lg mb-3 text-center">
                 <Text strong className="text-2xl text-green-600">
                   ¥{totalPrice.toLocaleString()}
                 </Text>
                 <Text type="secondary" className="block text-xs">预估总价</Text>
               </div>
               
               <List
                 size="small"
                 dataSource={materials}
                 renderItem={(item) => (
                   <List.Item>
                     <div className="flex justify-between w-full">
                       <span>{item.name}</span>
                       <span className="text-gray-600">
                         {item.quantity} {item.unit}
                         {item.price && <span className="ml-2 text-gray-400 text-xs">¥{item.price * item.quantity}</span>}
                       </span>
                     </div>
                   </List.Item>
                 )}
               />
               
               <Divider className="my-2" />
               <div className="flex gap-2">
                 <Button type="default" block size="small">导出Excel</Button>
                 <Button type="primary" block size="small">生成报价单</Button>
               </div>
             </>
           )}
        </Card>

      </div>
    </div>
  );
};

export default AIPlannerPanel;
