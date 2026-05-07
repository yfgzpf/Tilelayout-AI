/**
 * 瓷砖门店成交流程 - 完整版
 * 
 * 核心：排版图 + 销售流程 整合
 * 目标：一套系统，从接待到签单
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Slider,
  Tabs,
  Row,
  Col,
} from 'antd';
import {
  CameraOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  HomeOutlined,
  ShopOutlined,
  PictureOutlined,
  CalculatorOutlined,
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 步骤定义
const STEPS = [
  { title: '户型信息' },
  { title: '选砖排版' },
  { title: '方案对比' },
  { title: '报价签单' },
];

// 瓷砖产品库
const TILE_PRODUCTS = [
  { id: 1, name: '诺贝尔经典灰', spec: '800×800', price: 128, color: '#666' },
  { id: 2, name: '马可波罗爵士白', spec: '600×1200', price: 198, color: '#eee' },
  { id: 3, name: '蒙娜丽莎现代灰', spec: '750×1500', price: 268, color: '#888' },
  { id: 4, name: '冠珠素色砖', spec: '800×800', price: 88, color: '#999' },
  { id: 5, name: '东鹏通体大理石', spec: '900×900', price: 188, color: '#aaa' },
];

// ============ 核心：排版引擎 ============
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 500;

interface Tile {
  x: number;
  y: number;
  w: number;
  h: number;
  isCut: boolean;
}

interface LayoutResult {
  tiles: Tile[];
  stats: { total: number; cut: number; waste: number };
}

function calculateLayout(
  roomW: number,
  roomH: number,
  tileW: number,
  tileH: number,
  gap: number,
  offsetX: number,
  offsetY: number
): LayoutResult {
  const tiles: Tile[] = [];
  const tw = tileW + gap;
  const th = tileH + gap;
  
  const startX = offsetX;
  const startY = offsetY;
  
  for (let y = startY - th; y < roomH + th; y += th) {
    for (let x = startX - tw; x < roomW + tw; x += tw) {
      // 相交检测
      const tileLeft = x;
      const tileRight = x + tileW;
      const tileTop = y;
      const tileBottom = y + tileH;
      
      const intersect = 
        (tileLeft < roomW && tileRight > 0 && tileTop < roomH && tileBottom > 0);
      
      if (intersect) {
        tiles.push({
          x: Math.max(0, tileLeft),
          y: Math.max(0, tileTop),
          w: Math.min(tileW, roomW - Math.max(0, tileLeft)),
          h: Math.min(tileH, roomH - Math.max(0, tileTop)),
          isCut: tileLeft < 0 || tileRight > roomW || tileTop < 0 || tileBottom > roomH,
        });
      }
    }
  }
  
  const cut = tiles.filter(t => t.isCut).length;
  const waste = tiles.length > 0 ? (cut / tiles.length * 100) : 0;
  
  return {
    tiles,
    stats: { total: tiles.length, cut, waste },
  };
}

function drawLayout(
  ctx: CanvasRenderingContext2D,
  result: LayoutResult,
  tileW: number,
  tileH: number,
  roomW: number,
  roomH: number,
  scale: number
) {
  const offsetX = (CANVAS_WIDTH - roomW * scale) / 2;
  const offsetY = (CANVAS_HEIGHT - roomH * scale) / 2;
  
  // 清空
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // 绘制房间
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, roomW * scale, roomH * scale);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // 绘制瓷砖
  result.tiles.forEach(tile => {
    const x = offsetX + tile.x * scale;
    const y = offsetY + tile.y * scale;
    const w = tile.w * scale;
    const h = tile.h * scale;
    
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fillStyle = tile.isCut ? 'rgba(249,115,22,0.15)' : 'rgba(59,130,246,0.1)';
    ctx.strokeStyle = tile.isCut ? '#f97316' : '#3b82f6';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    
    if (tile.isCut) {
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 10px Arial';
      ctx.fillText('切', x + 2, y + 12);
    }
  });
  
  // 尺寸标注
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText(`${roomW}mm`, offsetX + roomW * scale / 2, offsetY - 10);
  
  ctx.save();
  ctx.translate(offsetX - 15, offsetY + roomH * scale / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${roomH}mm`, 0, 0);
  ctx.restore();
}

// ============ 主组件 ============
interface Scheme {
  id: string;
  name: string;
  desc: string;
  tileId: number;
  tileW: number;
  tileH: number;
  gap: number;
  offsetX: number;
  offsetY: number;
  tileCount: number;
  waste: number;
  tileCost: number;
  auxiliary: number;
  labor: number;
  total: number;
  recommended?: boolean;
}

const TileShopComplete: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  
  // 户型信息
  const [roomW, setRoomW] = useState(4000); // mm
  const [roomH, setRoomH] = useState(5000); // mm
  const [roomArea, setRoomArea] = useState(20); // ㎡
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  
  // 选砖配置
  const [selectedTileId, setSelectedTileId] = useState(1);
  const [tileW, setTileW] = useState(800);
  const [tileH, setTileH] = useState(800);
  const [gap, setGap] = useState(2);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  
  // 方案列表
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  
  // 画布
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 计算当前排版
  const currentLayout = calculateLayout(roomW, roomH, tileW, tileH, gap, offsetX, offsetY);

  // 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const scale = Math.min(
      (CANVAS_WIDTH - 40) / roomW,
      (CANVAS_HEIGHT - 40) / roomH
    );
    
    drawLayout(ctx, currentLayout, tileW, tileH, roomW, roomH, scale);
  }, [currentLayout, roomW, roomH, tileW, tileH]);

  // 瓷砖规格变化时更新
  const handleTileChange = (tileId: number) => {
    setSelectedTileId(tileId);
    const tile = TILE_PRODUCTS.find(t => t.id === tileId);
    if (tile) {
      const [w, h] = tile.spec.split('×').map(Number);
      setTileW(w);
      setTileH(h);
    }
  };

  // 生成方案对比
  const generateSchemes = () => {
    if (!customer.name) {
      message.warning('请输入客户姓名');
      return;
    }
    
    const tile = TILE_PRODUCTS.find(t => t.id === selectedTileId)!;
    const tileArea = (tileW * tileH) / 1_000_000;
    const baseCount = Math.ceil(roomArea / tileArea);
    
    const newSchemes: Scheme[] = [
      {
        id: '1',
        name: '经济实惠',
        desc: '标准铺贴，损耗适中',
        tileId: selectedTileId,
        tileW,
        tileH,
        gap: 2,
        offsetX: 0,
        offsetY: 0,
        tileCount: Math.ceil(baseCount * 1.08),
        waste: 8,
        tileCost: Math.ceil(baseCount * 1.08) * tile.price,
        auxiliary: 320,
        labor: roomArea * 35,
        total: 0,
      },
      {
        id: '2',
        name: '推荐方案',
        desc: '优化排版，损耗最低',
        tileId: selectedTileId,
        tileW,
        tileH,
        gap: 2,
        offsetX: 150,
        offsetY: 100,
        tileCount: Math.ceil(baseCount * 1.05),
        waste: 5,
        tileCost: Math.ceil(baseCount * 1.05) * tile.price,
        auxiliary: 280,
        labor: roomArea * 40,
        total: 0,
        recommended: true,
      },
      {
        id: '3',
        name: '品质方案',
        desc: '效果最佳，需好师傅',
        tileId: selectedTileId,
        tileW,
        tileH,
        gap: 3,
        offsetX: 200,
        offsetY: 200,
        tileCount: Math.ceil(baseCount * 1.1),
        waste: 10,
        tileCost: Math.ceil(baseCount * 1.1) * tile.price,
        auxiliary: 380,
        labor: roomArea * 50,
        total: 0,
      },
    ];
    
    newSchemes.forEach(s => {
      s.total = s.tileCost + s.auxiliary + s.labor;
    });
    
    setSchemes(newSchemes);
    setSelectedSchemeId(newSchemes.find(s => s.recommended)?.id || '1');
    setCurrentStep(2);
  };

  // 选择方案时更新排版
  useEffect(() => {
    if (selectedSchemeId) {
      const scheme = schemes.find(s => s.id === selectedSchemeId);
      if (scheme) {
        setOffsetX(scheme.offsetX);
        setOffsetY(scheme.offsetY);
        setGap(scheme.gap);
      }
    }
  }, [selectedSchemeId, schemes]);

  // 确认订单
  const confirmOrder = () => {
    if (!customer.name || !customer.phone) {
      message.warning('请完善客户信息');
      return;
    }
    Modal.success({
      title: '订单已确认',
      content: (
        <div>
          <p>订单号：ORD-{Date.now().toString().slice(-8)}</p>
          <p>客户：{customer.name}</p>
          <p>金额：¥{schemes.find(s => s.id === selectedSchemeId)?.total.toLocaleString()}</p>
        </div>
      ),
      onOk: () => {
        setCurrentStep(0);
        setCustomer({ name: '', phone: '' });
        setSchemes([]);
      },
    });
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* 头部 */}
      <Header style={{ 
        background: 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 44, height: 44, 
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShopOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>排砖宝 · 门店版</Title>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              排版 + 报价 + 成单
            </Text>
          </div>
        </div>
        <Space>
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
            今日成交 <Text strong style={{ color: '#fff' }}>8</Text> 单
          </Text>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        {/* 步骤条 */}
        <Card style={{ marginBottom: 24, borderRadius: 12 }}>
          <Steps current={currentStep} items={STEPS.map(s => ({ title: s.title }))} />
        </Card>

        <Row gutter={24}>
          {/* 左侧：操作区 */}
          <Col span={16}>
            
            {/* Step 1: 户型信息 */}
            {currentStep === 0 && (
              <Card title="录入户型信息" style={{ borderRadius: 12 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ marginBottom: 16 }}>
                      <Text strong>客户姓名</Text>
                      <Input 
                        size="large" 
                        placeholder="请输入客户姓名"
                        value={customer.name}
                        onChange={e => setCustomer({ ...customer, name: e.target.value })}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <Text strong>联系电话</Text>
                      <Input 
                        size="large" 
                        placeholder="请输入手机号"
                        value={customer.phone}
                        onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 16 }}>
                      <Text strong>房间面积 (㎡)</Text>
                      <InputNumber
                        size="large"
                        style={{ width: '100%', marginTop: 8 }}
                        value={roomArea}
                        onChange={v => {
                          setRoomArea(v || 20);
                          // 根据面积估算尺寸
                          setRoomW(Math.sqrt(v! * 1000000 * 0.8));
                          setRoomH(Math.sqrt(v! * 1000000 * 1.2));
                        }}
                        min={5}
                        max={200}
                      />
                    </div>
                    <div>
                      <Text strong>户型尺寸 (mm)</Text>
                      <Space style={{ marginTop: 8 }}>
                        <InputNumber
                          size="large"
                          value={roomW}
                          onChange={v => {
                            setRoomW(v || 4000);
                            setRoomArea((v! * roomH) / 1000000);
                          }}
                          addonAfter="宽"
                        />
                        <InputNumber
                          size="large"
                          value={roomH}
                          onChange={v => {
                            setRoomH(v || 5000);
                            setRoomArea((roomW * v!) / 1000000);
                          }}
                          addonAfter="高"
                        />
                      </Space>
                    </div>
                  </Col>
                </Row>
                
                <Divider />
                
                <Button 
                  type="primary" 
                  size="large" 
                  block
                  disabled={!customer.name}
                  onClick={() => setCurrentStep(1)}
                >
                  下一步：选择瓷砖
                </Button>
              </Card>
            )}

            {/* Step 2: 选砖 + 排版预览 */}
            {currentStep === 1 && (
              <Card 
                title="选择瓷砖并预览排版" 
                style={{ borderRadius: 12 }}
                extra={
                  <Button icon={<CameraOutlined />}>拍照识别户型</Button>
                }
              >
                <Row gutter={24}>
                  {/* 瓷砖选择 */}
                  <Col span={8}>
                    <Card 
                      title="瓷砖产品库" 
                      size="small"
                      style={{ height: '100%' }}
                    >
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {TILE_PRODUCTS.map(tile => (
                          <Card
                            key={tile.id}
                            size="small"
                            hoverable
                            onClick={() => handleTileChange(tile.id)}
                            style={{
                              marginBottom: 8,
                              border: selectedTileId === tile.id ? '2px solid #1890ff' : '1px solid #eee',
                              background: selectedTileId === tile.id ? '#e6f7ff' : '#fff',
                            }}
                            cover={
                              <div style={{ 
                                height: 60, 
                                background: tile.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <Text style={{ color: '#666', fontWeight: 'bold' }}>{tile.spec}</Text>
                              </div>
                            }
                          >
                            <Text strong style={{ fontSize: 12 }}>{tile.name}</Text>
                            <br />
                            <Text type="danger">¥{tile.price}/片</Text>
                          </Card>
                        ))}
                      </div>
                    </Card>
                  </Col>
                  
                  {/* 排版配置 */}
                  <Col span={8}>
                    <Card title="排版设置" size="small" style={{ height: '100%' }}>
                      <div style={{ marginBottom: 16 }}>
                        <Text>瓷砖规格</Text>
                        <Space style={{ marginTop: 8 }}>
                          <InputNumber
                            value={tileW}
                            onChange={v => setTileW(v || 800)}
                            addonAfter="宽"
                            size="small"
                          />
                          <InputNumber
                            value={tileH}
                            onChange={v => setTileH(v || 800)}
                            addonAfter="高"
                            size="small"
                          />
                        </Space>
                      </div>
                      
                      <div style={{ marginBottom: 16 }}>
                        <Text>缝隙宽度 (mm)</Text>
                        <Slider
                          value={gap}
                          onChange={setGap}
                          min={0}
                          max={10}
                          marks={{ 0: '0', 2: '2', 5: '5', 10: '10' }}
                        />
                      </div>
                      
                      <Divider />
                      
                      <div style={{ marginBottom: 16 }}>
                        <Text>横向缝隙位置 (mm)</Text>
                        <Slider
                          value={offsetY}
                          onChange={setOffsetY}
                          min={0}
                          max={tileH}
                          step={10}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>{offsetY}mm</Text>
                      </div>
                      
                      <div>
                        <Text>竖向缝隙位置 (mm)</Text>
                        <Slider
                          value={offsetX}
                          onChange={setOffsetX}
                          min={0}
                          max={tileW}
                          step={10}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>{offsetX}mm</Text>
                      </div>
                    </Card>
                  </Col>
                  
                  {/* 排版预览 */}
                  <Col span={8}>
                    <Card 
                      title="排版预览" 
                      size="small"
                      extra={
                        <Tag color="blue">
                          {currentLayout.stats.total} 片
                        </Tag>
                      }
                      style={{ height: '100%' }}
                    >
                      <canvas
                        ref={canvasRef}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        style={{ 
                          width: '100%', 
                          borderRadius: 8,
                          border: '1px solid #eee',
                        }}
                      />
                      <div style={{ marginTop: 12 }}>
                        <Row gutter={8}>
                          <Col span={12}>
                            <Tag color="green">整砖 {currentLayout.stats.total - currentLayout.stats.cut}</Tag>
                          </Col>
                          <Col span={12}>
                            <Tag color="orange">切割 {currentLayout.stats.cut}</Tag>
                          </Col>
                        </Row>
                      </div>
                    </Card>
                  </Col>
                </Row>
                
                <Divider />
                
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button onClick={() => setCurrentStep(0)}>上一步</Button>
                  <Button type="primary" size="large" onClick={generateSchemes}>
                    生成方案对比
                  </Button>
                </Space>
              </Card>
            )}

            {/* Step 3: 方案对比 */}
            {currentStep === 2 && (
              <Card title="方案对比" style={{ borderRadius: 12 }}>
                <Row gutter={16}>
                  {schemes.map(scheme => {
                    const tile = TILE_PRODUCTS.find(t => t.id === scheme.tileId)!;
                    const layout = calculateLayout(
                      roomW, roomH, scheme.tileW, scheme.tileH, scheme.gap,
                      scheme.offsetX, scheme.offsetY
                    );
                    
                    return (
                      <Col span={8} key={scheme.id}>
                        <Card
                          hoverable
                          onClick={() => setSelectedSchemeId(scheme.id)}
                          style={{
                            border: selectedSchemeId === scheme.id ? '2px solid #52c41a' : '1px solid #eee',
                            borderRadius: 12,
                            position: 'relative',
                          }}
                        >
                          {scheme.recommended && (
                            <Tag color="gold" style={{ position: 'absolute', top: 12, right: 12 }}>
                              推荐
                            </Tag>
                          )}
                          
                          <Title level={5}>{scheme.name}</Title>
                          <Text type="secondary">{scheme.desc}</Text>
                          
                          <Divider />
                          
                          {/* 小排版图 */}
                          <div style={{ 
                            background: '#fafafa', 
                            borderRadius: 8, 
                            padding: 8,
                            marginBottom: 12,
                          }}>
                            <canvas
                              width={200}
                              height={160}
                              ref={el => {
                                if (el) {
                                  const ctx = el.getContext('2d');
                                  if (ctx) {
                                    const scale = Math.min(180 / roomW, 140 / roomH);
                                    const offsetX = (200 - roomW * scale) / 2;
                                    const offsetY = (160 - roomH * scale) / 2;
                                    
                                    ctx.fillStyle = '#fff';
                                    ctx.fillRect(0, 0, 200, 160);
                                    
                                    ctx.fillStyle = '#fff';
                                    ctx.strokeStyle = '#333';
                                    ctx.lineWidth = 2;
                                    ctx.fillRect(offsetX, offsetY, roomW * scale, roomH * scale);
                                    ctx.strokeRect(offsetX, offsetY, roomW * scale, roomH * scale);
                                    
                                    layout.tiles.forEach(tile => {
                                      ctx.fillStyle = tile.isCut ? 'rgba(249,115,22,0.3)' : 'rgba(59,130,246,0.2)';
                                      ctx.fillRect(
                                        offsetX + tile.x * scale,
                                        offsetY + tile.y * scale,
                                        tile.w * scale,
                                        tile.h * scale
                                      );
                                    });
                                  }
                                }
                              }}
                            />
                          </div>
                          
                          <Space direction="vertical" style={{ width: '100%' }} size="small">
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Text>瓷砖</Text>
                              <Text>{tile.name}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Text>用量</Text>
                              <Text strong>{scheme.tileCount} 片</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Text>损耗</Text>
                              <Tag color={scheme.waste <= 5 ? 'green' : scheme.waste <= 8 ? 'orange' : 'red'}>
                                {scheme.waste}%
                              </Tag>
                            </div>
                          </Space>
                          
                          <Divider />
                          
                          <div style={{ textAlign: 'center' }}>
                            <Text type="secondary">预估总价</Text>
                            <br />
                            <Text strong style={{ fontSize: 24, color: '#f5222d' }}>
                              ¥{scheme.total.toLocaleString()}
                            </Text>
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
                
                <Divider />
                
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button onClick={() => setCurrentStep(1)}>重新选砖</Button>
                  <Button 
                    type="primary" 
                    size="large"
                    disabled={!selectedSchemeId}
                    onClick={() => setCurrentStep(3)}
                  >
                    确认方案并报价
                  </Button>
                </Space>
              </Card>
            )}

            {/* Step 4: 报价签单 */}
            {currentStep === 3 && selectedSchemeId && (
              <Card title="确认报价并签单" style={{ borderRadius: 12 }}>
                {(() => {
                  const scheme = schemes.find(s => s.id === selectedSchemeId)!;
                  const tile = TILE_PRODUCTS.find(t => t.id === scheme.tileId)!;
                  
                  return (
                    <>
                      <Row gutter={24}>
                        <Col span={12}>
                          <Card title="客户信息" style={{ background: '#fafafa' }}>
                            <Space direction="vertical" size="middle">
                              <div>
                                <Text type="secondary">客户姓名</Text>
                                <br />
                                <Text strong style={{ fontSize: 18 }}>{customer.name}</Text>
                              </div>
                              <div>
                                <Text type="secondary">联系电话</Text>
                                <br />
                                <Text>{customer.phone}</Text>
                              </div>
                              <div>
                                <Text type="secondary">房间面积</Text>
                                <br />
                                <Text>{roomArea} ㎡</Text>
                              </div>
                            </Space>
                          </Card>
                        </Col>
                        
                        <Col span={12}>
                          <Card title="订单摘要" style={{ background: '#fff7e6' }}>
                            <Space direction="vertical" size="middle">
                              <div>
                                <Text type="secondary">瓷砖产品</Text>
                                <br />
                                <Text strong>{tile.name} {tile.spec}</Text>
                              </div>
                              <div>
                                <Text type="secondary">瓷砖数量</Text>
                                <br />
                                <Text strong>{scheme.tileCount} 片</Text>
                              </div>
                              <Divider />
                              <div>
                                <Text type="secondary">订单总额</Text>
                                <br />
                                <Text strong style={{ fontSize: 32, color: '#f5222d' }}>
                                  ¥{scheme.total.toLocaleString()}
                                </Text>
                              </div>
                            </Space>
                          </Card>
                        </Col>
                      </Row>
                      
                      {/* 详细报价单 */}
                      <Card title="详细报价单" style={{ marginTop: 24 }}>
                        <Table
                          dataSource={[
                            { key: '1', item: tile.name, spec: tile.spec, qty: scheme.tileCount, unit: '片', price: tile.price, amount: scheme.tileCost },
                            { key: '2', item: '瓷砖胶', spec: '20kg/袋', qty: Math.ceil(scheme.auxiliary / 3), unit: '袋', price: 45, amount: Math.ceil(scheme.auxiliary / 3) * 45 },
                            { key: '3', item: '美缝剂', spec: '400ml', qty: Math.ceil(roomArea * 0.8), unit: '支', price: 35, amount: Math.ceil(roomArea * 0.8) * 35 },
                            { key: '4', item: '铺贴人工', spec: '包工', qty: roomArea, unit: '㎡', price: scheme.labor / roomArea, amount: scheme.labor },
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
                                  ¥{scheme.total.toLocaleString()}
                                </Text>
                              </Table.Summary.Cell>
                            </Table.Summary.Row>
                          )}
                        />
                      </Card>
                      
                      <Divider />
                      
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button onClick={() => setCurrentStep(2)}>修改方案</Button>
                        <Button type="primary" size="large" onClick={confirmOrder}>
                          确认签单
                        </Button>
                      </Space>
                    </>
                  );
                })()}
              </Card>
            )}
          </Col>

          {/* 右侧：辅助信息 */}
          <Col span={8}>
            <Card title="操作提示" style={{ borderRadius: 12 }}>
              <Tabs
                items={[
                  {
                    key: '1',
                    label: '户型录入',
                    children: (
                      <div>
                        <Text type="secondary">
                          • 输入客户姓名和电话<br/>
                          • 填写房间面积或直接输入尺寸<br/>
                          • 可拍照上传户型图（AI自动识别）
                        </Text>
                      </div>
                    ),
                  },
                  {
                    key: '2',
                    label: '排版调整',
                    children: (
                      <div>
                        <Text type="secondary">
                          • 从产品库选择瓷砖<br/>
                          • 调整缝隙宽度<br/>
                          • 拖动起铺线位置优化排版<br/>
                          • 观察切割砖数量变化
                        </Text>
                      </div>
                    ),
                  },
                  {
                    key: '3',
                    label: '方案选择',
                    children: (
                      <div>
                        <Text type="secondary">
                          • 系统生成3个方案对比<br/>
                          • 点击方案查看排版效果<br/>
                          • 推荐方案损耗最低<br/>
                          • 可根据客户预算推荐
                        </Text>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
            
            {/* 当前排版状态 */}
            {currentStep >= 1 && (
              <Card title="当前排版" style={{ marginTop: 16, borderRadius: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Row>
                    <Col span={12}><Text type="secondary">总砖数</Text></Col>
                    <Col span={12}><Text strong>{currentLayout.stats.total}</Text></Col>
                  </Row>
                  <Row>
                    <Col span={12}><Text type="secondary">切割砖</Text></Col>
                    <Col span={12}><Text strong style={{ color: '#f97316' }}>{currentLayout.stats.cut}</Text></Col>
                  </Row>
                  <Row>
                    <Col span={12}><Text type="secondary">损耗率</Text></Col>
                    <Col span={12}>
                      <Tag color={currentLayout.stats.waste > 10 ? 'red' : currentLayout.stats.waste > 5 ? 'orange' : 'green'}>
                        {currentLayout.stats.waste.toFixed(1)}%
                      </Tag>
                    </Col>
                  </Row>
                </Space>
              </Card>
            )}
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default TileShopComplete;
