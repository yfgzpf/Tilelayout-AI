/**
 * 瓷砖门店成交流程 - 销售导向
 * 
 * 核心流程：接待 → 选砖 → 出方案 → 报价 → 签单
 * 目标：10分钟内完成一单
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Layout,
  Typography,
  Button,
  Card,
  Steps,
  Space,
  Input,
  InputNumber,
  Select,
  Divider,
  Tag,
  Table,
  message,
  Modal,
  QRCode,
  Result,
} from 'antd';
import {
  CameraOutlined,
  DollarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  HomeOutlined,
  ShopOutlined,
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 步骤定义
const STEPS = [
  { title: '户型信息', icon: <HomeOutlined /> },
  { title: '选砖规格', icon: <ShopOutlined /> },
  { title: '方案对比', icon: <CheckCircleOutlined /> },
  { title: '报价签单', icon: <DollarOutlined /> },
];

// 模拟瓷砖产品库
const TILE_PRODUCTS = [
  { id: 1, name: '诺贝尔经典灰', spec: '800×800', price: 128, unit: '片', texture: '#666' },
  { id: 2, name: '马可波罗爵士白', spec: '600×1200', price: 198, unit: '片', texture: '#eee' },
  { id: 3, name: '蒙娜丽莎现代灰', spec: '750×1500', price: 268, unit: '片', texture: '#888' },
  { id: 4, name: '冠珠素色砖', spec: '800×800', price: 88, unit: '片', texture: '#999' },
  { id: 5, name: '东鹏通体大理石', spec: '900×900', price: 188, unit: '片', texture: '#aaa' },
];

// 模拟辅料
const AUXILIARY = [
  { name: '瓷砖胶', spec: '20kg/袋', price: 45, unit: '袋', consumption: '5kg/㎡' },
  { name: '美缝剂', spec: '400ml/支', price: 35, unit: '支', consumption: '3m/㎡' },
  { name: '十字卡', spec: '2mm', price: 0.5, unit: '颗', consumption: '4颗/㎡' },
];

interface Scheme {
  id: string;
  name: string;
  description: string;
  tile: typeof TILE_PRODUCTS[0];
  tileCount: number;
  waste: number;
  tileCost: number;
  auxiliaryCost: number;
  laborCost: number;
  totalCost: number;
  recommended?: boolean;
}

const TileShopFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  
  // 步骤1：户型信息
  const [roomArea, setRoomArea] = useState(25); // 面积㎡
  const [roomType, setRoomType] = useState('客厅');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // 步骤2：选砖
  const [selectedTile, setSelectedTile] = useState<typeof TILE_PRODUCTS[0] | null>(null);
  
  // 步骤3：方案对比
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);
  
  // 步骤4：签单
  const [showConfirm, setShowConfirm] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  // 根据面积和选砖生成方案
  const generateSchemes = () => {
    if (!selectedTile) {
      message.warning('请先选择瓷砖');
      return;
    }

    const baseTileCount = Math.ceil(roomArea / (parseInt(selectedTile.spec) / 1000) ** 2);

    const newSchemes: Scheme[] = [
      {
        id: '1',
        name: '经济实惠方案',
        description: '标准铺贴，损耗较低',
        tile: selectedTile,
        tileCount: Math.ceil(baseTileCount * 1.08),
        waste: 8,
        tileCost: Math.ceil(baseTileCount * 1.08) * selectedTile.price,
        auxiliaryCost: 320,
        laborCost: roomArea * 35,
        totalCost: 0,
      },
      {
        id: '2',
        name: '推荐方案',
        description: '优化排版，损耗最低',
        tile: selectedTile,
        tileCount: Math.ceil(baseTileCount * 1.05),
        waste: 5,
        tileCost: Math.ceil(baseTileCount * 1.05) * selectedTile.price,
        auxiliaryCost: 280,
        laborCost: roomArea * 40,
        totalCost: 0,
        recommended: true,
      },
      {
        id: '3',
        name: '品质方案',
        description: '师傅手艺要求高，效果最好',
        tile: selectedTile,
        tileCount: Math.ceil(baseTileCount * 1.1),
        waste: 10,
        tileCost: Math.ceil(baseTileCount * 1.1) * selectedTile.price,
        auxiliaryCost: 350,
        laborCost: roomArea * 50,
        totalCost: 0,
      },
    ];

    // 计算总价
    newSchemes.forEach(s => {
      s.totalCost = s.tileCost + s.auxiliaryCost + s.laborCost;
    });

    // 按总价排序
    newSchemes.sort((a, b) => a.totalCost - b.totalCost);

    setSchemes(newSchemes);
    setSelectedScheme(newSchemes.find(s => s.recommended) || newSchemes[0]);
    setCurrentStep(2);
  };

  // 确认订单
  const confirmOrder = () => {
    if (!customerName || !customerPhone) {
      message.warning('请填写客户信息');
      return;
    }
    setShowConfirm(false);
    setOrderConfirmed(true);
    message.success('订单已确认！');
  };

  // 重置流程
  const resetFlow = () => {
    setCurrentStep(0);
    setRoomArea(25);
    setSelectedTile(null);
    setSchemes([]);
    setSelectedScheme(null);
    setOrderConfirmed(false);
    setCustomerName('');
    setCustomerPhone('');
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 头部 */}
      <Header style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShopOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              瓷砖成交流程
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
              快速成单 · 专业高效
            </Text>
          </div>
        </div>
        
        <Space>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            今日成单: <Text strong style={{ color: '#fff' }}>12</Text> 单
          </Text>
        </Space>
      </Header>

      <Content style={{ padding: '24px 48px' }}>
        {/* 步骤条 */}
        <Card style={{ marginBottom: 24, borderRadius: 12 }}>
          <Steps 
            current={currentStep} 
            items={STEPS.map(step => ({
              title: step.title,
              icon: step.icon,
            }))}
          />
        </Card>

        {/* 步骤内容 */}
        <div style={{ display: 'flex', gap: 24 }}>
          {/* 左侧主内容 */}
          <div style={{ flex: 1 }}>
            
            {/* 步骤1：户型信息 */}
            {currentStep === 0 && (
              <Card title="客户户型信息" style={{ borderRadius: 12 }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div>
                      <Text strong>客户姓名</Text>
                      <Input 
                        size="large" 
                        placeholder="请输入客户姓名"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                    <div>
                      <Text strong>联系电话</Text>
                      <Input 
                        size="large" 
                        placeholder="请输入手机号"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  </div>
                  
                  <Divider />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div>
                      <Text strong>房间类型</Text>
                      <Select
                        size="large"
                        style={{ width: '100%', marginTop: 8 }}
                        value={roomType}
                        onChange={setRoomType}
                      >
                        <Option value="客厅">客厅</Option>
                        <Option value="卧室">卧室</Option>
                        <Option value="厨房">厨房</Option>
                        <Option value="卫生间">卫生间</Option>
                        <Option value="阳台">阳台</Option>
                      </Select>
                    </div>
                    <div>
                      <Text strong>房间面积 (㎡)</Text>
                      <InputNumber
                        size="large"
                        style={{ width: '100%', marginTop: 8 }}
                        value={roomArea}
                        onChange={v => setRoomArea(v || 25)}
                        min={5}
                        max={500}
                      />
                    </div>
                  </div>
                  
                  {/* 拍照上传 */}
                  <div>
                    <Text strong>户型照片（可选）</Text>
                    <div style={{
                      border: '2px dashed #ddd',
                      borderRadius: 12,
                      padding: 48,
                      textAlign: 'center',
                      marginTop: 8,
                      background: '#fafafa',
                      cursor: 'pointer',
                    }}>
                      <CameraOutlined style={{ fontSize: 48, color: '#999' }} />
                      <Paragraph type="secondary" style={{ marginTop: 16 }}>
                        点击上传户型照片，AI自动识别
                      </Paragraph>
                    </div>
                  </div>
                  
                  <Button 
                    type="primary" 
                    size="large" 
                    block
                    disabled={!customerName || !customerPhone}
                    onClick={() => setCurrentStep(1)}
                  >
                    下一步：选择瓷砖
                  </Button>
                </Space>
              </Card>
            )}

            {/* 步骤2：选砖 */}
            {currentStep === 1 && (
              <Card title="选择瓷砖产品" style={{ borderRadius: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {TILE_PRODUCTS.map(tile => (
                    <Card
                      key={tile.id}
                      hoverable
                      onClick={() => setSelectedTile(tile)}
                      style={{
                        borderRadius: 12,
                        border: selectedTile?.id === tile.id ? '2px solid #667eea' : '1px solid #eee',
                        background: selectedTile?.id === tile.id ? '#f0f0ff' : '#fff',
                      }}
                      cover={
                        <div style={{
                          height: 120,
                          background: `linear-gradient(135deg, ${tile.texture} 0%, ${tile.texture}dd 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>
                            {tile.spec}
                          </Text>
                        </div>
                      }
                    >
                      <Card.Meta
                        title={tile.name}
                        description={
                          <div>
                            <Tag color="blue">{tile.spec}</Tag>
                            <div style={{ marginTop: 8 }}>
                              <Text strong style={{ fontSize: 20, color: '#f5222d' }}>
                                ¥{tile.price}
                              </Text>
                              <Text type="secondary"> / {tile.unit}</Text>
                            </div>
                          </div>
                        }
                      />
                    </Card>
                  ))}
                </div>
                
                <Divider />
                
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button size="large" onClick={() => setCurrentStep(0)}>
                    上一步
                  </Button>
                  <Button 
                    type="primary" 
                    size="large"
                    disabled={!selectedTile}
                    onClick={generateSchemes}
                  >
                    生成方案对比
                  </Button>
                </Space>
              </Card>
            )}

            {/* 步骤3：方案对比 */}
            {currentStep === 2 && (
              <Card title="推荐方案对比" style={{ borderRadius: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {schemes.map(scheme => (
                    <Card
                      key={scheme.id}
                      hoverable
                      onClick={() => setSelectedScheme(scheme)}
                      style={{
                        borderRadius: 12,
                        border: selectedScheme?.id === scheme.id ? '2px solid #52c41a' : '1px solid #eee',
                        position: 'relative',
                      }}
                    >
                      {scheme.recommended && (
                        <Tag 
                          color="gold" 
                          style={{ position: 'absolute', top: 12, right: 12 }}
                        >
                          推荐
                        </Tag>
                      )}
                      
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <Text strong style={{ fontSize: 18 }}>{scheme.name}</Text>
                        <br />
                        <Text type="secondary">{scheme.description}</Text>
                      </div>
                      
                      <Divider style={{ margin: '12px 0' }} />
                      
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>瓷砖规格</Text>
                          <Text>{scheme.tile.spec}</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>瓷砖数量</Text>
                          <Text>{scheme.tileCount} 片</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>损耗率</Text>
                          <Tag color={scheme.waste <= 5 ? 'green' : scheme.waste <= 8 ? 'orange' : 'red'}>
                            {scheme.waste}%
                          </Tag>
                        </div>
                      </Space>
                      
                      <Divider style={{ margin: '12px 0' }} />
                      
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary">预估总价</Text>
                        <br />
                        <Text strong style={{ fontSize: 24, color: '#f5222d' }}>
                          ¥{scheme.totalCost.toLocaleString()}
                        </Text>
                      </div>
                    </Card>
                  ))}
                </div>
                
                {/* 详细报价单 */}
                {selectedScheme && (
                  <Card 
                    title="详细报价单" 
                    style={{ marginTop: 24, borderRadius: 12 }}
                  >
                    <Table
                      dataSource={[
                        { key: '1', item: selectedScheme.tile.name, spec: selectedScheme.tile.spec, qty: selectedScheme.tileCount, unit: '片', price: selectedScheme.tile.price, amount: selectedScheme.tileCost },
                        { key: '2', item: '瓷砖胶', spec: '20kg/袋', qty: Math.ceil(selectedScheme.auxiliaryCost / 45), unit: '袋', price: 45, amount: Math.ceil(selectedScheme.auxiliaryCost / 45) * 45 },
                        { key: '3', item: '美缝剂', spec: '400ml', qty: Math.ceil(roomArea * 0.8), unit: '支', price: 35, amount: Math.ceil(roomArea * 0.8) * 35 },
                        { key: '4', item: '铺贴人工费', spec: '包工包料', qty: roomArea, unit: '㎡', price: selectedScheme.laborCost / roomArea, amount: selectedScheme.laborCost },
                      ]}
                      columns={[
                        { title: '项目', dataIndex: 'item' },
                        { title: '规格', dataIndex: 'spec' },
                        { title: '数量', dataIndex: 'qty' },
                        { title: '单位', dataIndex: 'unit' },
                        { title: '单价', dataIndex: 'price', render: v => `¥${v}` },
                        { title: '金额', dataIndex: 'amount', render: v => `¥${v}` },
                      ]}
                      pagination={false}
                      summary={() => (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={5}>
                            <Text strong>合计</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1}>
                            <Text strong style={{ color: '#f5222d', fontSize: 18 }}>
                              ¥{selectedScheme.totalCost.toLocaleString()}
                            </Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                    />
                  </Card>
                )}
                
                <Divider />
                
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button size="large" onClick={() => setCurrentStep(1)}>
                    重新选砖
                  </Button>
                  <Button 
                    type="primary" 
                    size="large"
                    disabled={!selectedScheme}
                    onClick={() => setCurrentStep(3)}
                  >
                    确认报价方案
                  </Button>
                </Space>
              </Card>
            )}

            {/* 步骤4：签单 */}
            {currentStep === 3 && selectedScheme && (
              <Card 
                title="确认签单" 
                style={{ borderRadius: 12 }}
                extra={
                  <QRCode value="https://tile.shop/order/123456" size={80} />
                }
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                  <div>
                    <Title level={4}>客户信息</Title>
                    <Card style={{ background: '#fafafa' }}>
                      <Space direction="vertical" size="middle">
                        <div>
                          <Text type="secondary">客户姓名</Text>
                          <br />
                          <Text strong style={{ fontSize: 18 }}>{customerName}</Text>
                        </div>
                        <div>
                          <Text type="secondary">联系电话</Text>
                          <br />
                          <Text strong>{customerPhone}</Text>
                        </div>
                        <div>
                          <Text type="secondary">房间类型</Text>
                          <br />
                          <Text strong>{roomType}</Text>
                        </div>
                      </Space>
                    </Card>
                  </div>
                  
                  <div>
                    <Title level={4}>订单摘要</Title>
                    <Card style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
                      <Space direction="vertical" size="middle">
                        <div>
                          <Text type="secondary">瓷砖产品</Text>
                          <br />
                          <Text strong>{selectedScheme.tile.name}</Text>
                        </div>
                        <div>
                          <Text type="secondary">瓷砖规格</Text>
                          <br />
                          <Text strong>{selectedScheme.tile.spec}</Text>
                        </div>
                        <div>
                          <Text type="secondary">瓷砖数量</Text>
                          <br />
                          <Text strong>{selectedScheme.tileCount} 片</Text>
                        </div>
                        <Divider />
                        <div>
                          <Text type="secondary">订单总额</Text>
                          <br />
                          <Text strong style={{ fontSize: 28, color: '#f5222d' }}>
                            ¥{selectedScheme.totalCost.toLocaleString()}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </div>
                </div>
                
                <Divider />
                
                <Button 
                  type="primary" 
                  size="large" 
                  block
                  icon={<CheckCircleOutlined />}
                  onClick={() => setShowConfirm(true)}
                  style={{ height: 56, fontSize: 18 }}
                >
                  确认并生成订单
                </Button>
              </Card>
            )}

            {/* 订单确认成功 */}
            {orderConfirmed && (
              <Result
                status="success"
                title="订单已确认！"
                subTitle={`订单号：ORD-${Date.now().toString().slice(-8)}`}
                extra={[
                  <Button key="new" type="primary" onClick={resetFlow}>
                    接待新客户
                  </Button>,
                  <Button key="print">打印订单</Button>,
                ]}
              />
            )}
          </div>

          {/* 右侧：进度提示 */}
          <Sider width={280} style={{ background: '#fff', padding: 20, borderRadius: 12 }}>
            <Title level={5}>成交流程</Title>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              引导式操作，10分钟完成一单
            </Paragraph>
            
            <Divider />
            
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card size="small" style={{ background: currentStep >= 0 ? '#e6f7ff' : '#f5f5f5' }}>
                <Space>
                  <CheckCircleOutlined style={{ color: currentStep >= 0 ? '#1890ff' : '#999' }} />
                  <div>
                    <Text strong>录入客户信息</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      姓名 + 面积 + 拍照
                    </Text>
                  </div>
                </Space>
              </Card>
              
              <Card size="small" style={{ background: currentStep >= 1 ? '#e6f7ff' : '#f5f5f5' }}>
                <Space>
                  <CheckCircleOutlined style={{ color: currentStep >= 1 ? '#1890ff' : '#999' }} />
                  <div>
                    <Text strong>选择瓷砖</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      从产品库挑选
                    </Text>
                  </div>
                </Space>
              </Card>
              
              <Card size="small" style={{ background: currentStep >= 2 ? '#e6f7ff' : '#f5f5f5' }}>
                <Space>
                  <CheckCircleOutlined style={{ color: currentStep >= 2 ? '#1890ff' : '#999' }} />
                  <div>
                    <Text strong>对比方案</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      选择最合适的
                    </Text>
                  </div>
                </Space>
              </Card>
              
              <Card size="small" style={{ background: currentStep >= 3 ? '#e6f7ff' : '#f5f5f5' }}>
                <Space>
                  <CheckCircleOutlined style={{ color: currentStep >= 3 ? '#1890ff' : '#999' }} />
                  <div>
                    <Text strong>签单成交</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      扫码确认，快速下单
                    </Text>
                  </div>
                </Space>
              </Card>
            </Space>
            
            <Divider />
            
            <Card size="small" style={{ background: '#fff7e6' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>小提示：</strong><br />
                • 不同规格的砖损耗不同<br />
                • 大砖损耗更低但铺贴费高<br />
                • 推荐方案综合性价比最优
              </Text>
            </Card>
          </Sider>
        </div>
      </Content>

      {/* 确认弹窗 */}
      <Modal
        title="确认订单"
        open={showConfirm}
        onOk={confirmOrder}
        onCancel={() => setShowConfirm(false)}
        okText="确认签单"
        cancelText="取消"
      >
        <Paragraph>
          客户 <Text strong>{customerName}</Text> 确认订购：
        </Paragraph>
        <Card style={{ background: '#fafafa' }}>
          <Space direction="vertical">
            <Text>{selectedScheme?.tile.name} × {selectedScheme?.tileCount} 片</Text>
            <Text>规格：{selectedScheme?.tile.spec}</Text>
            <Text strong style={{ fontSize: 20, color: '#f5222d' }}>
              总价：¥{selectedScheme?.totalCost.toLocaleString()}
            </Text>
          </Space>
        </Card>
      </Modal>
    </Layout>
  );
};

export default TileShopFlow;
