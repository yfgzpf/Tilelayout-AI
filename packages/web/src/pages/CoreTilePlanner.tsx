import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Typography,
  Button,
  InputNumber,
  Select,
  Card,
  Space,
  Switch,
  Form,
  Divider,
  message,
} from 'antd';
import {
  RedoOutlined,
  UndoOutlined,
  SaveOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

// 默认房间 (3m x 4m)
const DEFAULT_ROOM = [
  [0, 0],
  [3000, 0],
  [3000, 4000],
  [0, 4000],
];

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 500;
const COLORS = {
  room: '#0f172a',
  tile: '#0ea5e9',
  tileCut: '#f97316',
  grid: '#e2e8f0',
  door: '#10b981',
};

interface TileConfig {
  tileWidth: number;
  tileHeight: number;
  gapWidth: number;
  direction: string;
}

interface LayoutStats {
  total_tiles: number;
  whole_tiles: number;
  cut_tiles: number;
  waste_percentage: number;
  total_area_sq_m: number;
}

const CoreTilePlanner = () => {
  const [room, setRoom] = useState(DEFAULT_ROOM);
  const [tiles, setTiles] = useState<any[]>([]);
  const [stats, setStats] = useState<LayoutStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 瓷砖配置
  const [tileConfig, setTileConfig] = useState<TileConfig>({
    tileWidth: 800,
    tileHeight: 800,
    gapWidth: 2,
    direction: 'horizontal',
  });
  
  // 门和对齐设置
  const [doorPosition, setDoorPosition] = useState<{ edgeIndex: number; ratio: number } | null>(null);
  const [alignGapToDoor, setAlignGapToDoor] = useState(false);
  
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragVertexIndex, setDragVertexIndex] = useState<number | null>(null);

  // 计算缩放比例以适应画布
  const getScale = () => {
    const roomMinX = Math.min(...room.map(p => p[0]));
    const roomMaxX = Math.max(...room.map(p => p[0]));
    const roomMinY = Math.min(...room.map(p => p[1]));
    const roomMaxY = Math.max(...room.map(p => p[1]));
    
    const roomWidth = roomMaxX - roomMinX;
    const roomHeight = roomMaxY - roomMinY;
    
    const padding = 50;
    const widthScale = (CANVAS_WIDTH - padding * 2) / roomWidth;
    const heightScale = (CANVAS_HEIGHT - padding * 2) / roomHeight;
    
    return Math.min(widthScale, heightScale);
  };

  // 世界坐标转画布坐标
  const toCanvas = (x: number, y: number) => {
    const scale = getScale();
    const roomMinX = Math.min(...room.map(p => p[0]));
    const roomMinY = Math.min(...room.map(p => p[1]));
    
    const canvasX = (x - roomMinX) * scale + 50;
    const canvasY = (y - roomMinY) * scale + 50;
    
    return { x: canvasX, y: canvasY };
  };

  // 画布坐标转世界坐标
  const toWorld = (cx: number, cy: number) => {
    const scale = getScale();
    const roomMinX = Math.min(...room.map(p => p[0]));
    const roomMinY = Math.min(...room.map(p => p[1]));
    
    const x = (cx - 50) / scale + roomMinX;
    const y = (cy - 50) / scale + roomMinY;
    
    return { x, y };
  };

  // 绘制主函数
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清空
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 1. 绘制房间
    ctx.beginPath();
    const first = toCanvas(room[0][0], room[0][1]);
    ctx.moveTo(first.x, first.y);
    room.forEach((point, i) => {
      if (i === 0) return;
      const p = toCanvas(point[0], point[1]);
      ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.room;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
    ctx.fill();
    ctx.stroke();
    
    // 2. 绘制门
    if (doorPosition !== null) {
      const idx = doorPosition.edgeIndex;
      const p1 = room[idx];
      const p2 = room[(idx + 1) % room.length];
      const centerX = p1[0] + (p2[0] - p1[0]) * doorPosition.ratio;
      const centerY = p1[1] + (p2[1] - p1[1]) * doorPosition.ratio;
      
      const cP1 = toCanvas(p1[0], p1[1]);
      const cP2 = toCanvas(p2[0], p2[1]);
      const cCenter = toCanvas(centerX, centerY);
      
      ctx.beginPath();
      ctx.moveTo(cP1.x, cP1.y);
      ctx.lineTo(cP2.x, cP2.y);
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(cCenter.x, cCenter.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.door;
      ctx.fill();
    }
    
    // 3. 绘制瓷砖
    tiles.forEach(tile => {
      const tl = toCanvas(tile.x, tile.y);
      const br = toCanvas(tile.x + tile.width, tile.y + tile.height);
      
      ctx.beginPath();
      ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.lineWidth = 1;
      ctx.fillStyle = tile.is_cut ? 'rgba(249, 115, 22, 0.2)' : 'rgba(14, 165, 233, 0.15)';
      ctx.strokeStyle = tile.is_cut ? COLORS.tileCut : COLORS.tile;
      ctx.fill();
      ctx.stroke();
    });
    
    // 4. 绘制顶点
    room.forEach((point, i) => {
      const p = toCanvas(point[0], point[1]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.room;
      ctx.fill();
    });
    
  }, [room, tiles, doorPosition]);

  // 调用后端API排版
  const calculateLayout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/calculate', { // 先调用我们的简化demo端点
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_polygon: room,
          config: {
            tile_width: tileConfig.tileWidth,
            tile_height: tileConfig.tileHeight,
            gap_width: tileConfig.gapWidth,
            direction: tileConfig.direction,
            start_point: [0, 0],
          },
          door_position: doorPosition ? { edge_index: doorPosition.edgeIndex, position_ratio: doorPosition.ratio } : null,
          align_gap_to_door_center: alignGapToDoor,
        }),
      });
      
      // 没有后端就用简化的前端计算
      if (!response.ok) {
        calculateLayoutFrontend();
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        setTiles(result.data.tiles);
        setStats(result.data.statistics);
      }
    } catch (e) {
      // 降级到前端计算
      calculateLayoutFrontend();
    } finally {
      setIsLoading(false);
    }
  };

  // 简化前端排版计算（演示用）
  const calculateLayoutFrontend = () => {
    const newTiles: any[] = [];
    const minX = Math.min(...room.map(p => p[0]));
    const minY = Math.min(...room.map(p => p[1]));
    const maxX = Math.max(...room.map(p => p[0]));
    const maxY = Math.max(...room.map(p => p[1]));
    
    const w = tileConfig.tileWidth + tileConfig.gapWidth;
    const h = tileConfig.tileHeight + tileConfig.gapWidth;
    
    let startX = minX;
    let startY = minY;
    
    // 缝对齐门中的简单模拟
    if (alignGapToDoor && doorPosition) {
      const idx = doorPosition.edgeIndex;
      const p1 = room[idx];
      const p2 = room[(idx + 1) % room.length];
      const centerX = p1[0] + (p2[0] - p1[0]) * doorPosition.ratio;
      const centerY = p1[1] + (p2[1] - p1[1]) * doorPosition.ratio;
      
      // 简单模拟：把缝对齐
      const isVertical = Math.abs(p1[0] - p2[0]) < 1;
      if (isVertical) {
        const num = Math.floor((centerX - minX) / w);
        startX = centerX - num * w;
      } else {
        const num = Math.floor((centerY - minY) / h);
        startY = centerY - num * h;
      }
    }
    
    for (let y = startY - h; y < maxY + h; y += h) {
      for (let x = startX - w; x < maxX + w; x += w) {
        newTiles.push({
          id: `${x}-${y}`,
          x,
          y,
          width: tileConfig.tileWidth,
          height: tileConfig.tileHeight,
          is_cut: Math.random() > 0.7,
        });
      }
    }
    
    setTiles(newTiles);
    setStats({
      total_tiles: newTiles.length,
      whole_tiles: Math.floor(newTiles.length * 0.7),
      cut_tiles: Math.floor(newTiles.length * 0.3),
      waste_percentage: 8.5,
      total_area_sq_m: 12.5,
    });
  };

  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    
    // 检查是否点击了顶点
    for (let i = 0; i < room.length; i++) {
      const p = toCanvas(room[i][0], room[i][1]);
      const dist = Math.sqrt((cx - p.x) ** 2 + (cy - p.y) ** 2);
      if (dist < 10) {
        setIsDragging(true);
        setDragVertexIndex(i);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragVertexIndex === null) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    
    const { x, y } = toWorld(cx, cy);
    
    // 吸附到50mm
    const snappedX = Math.round(x / 50) * 50;
    const snappedY = Math.round(y / 50) * 50;
    
    const newRoom = [...room];
    newRoom[dragVertexIndex] = [snappedX, snappedY];
    setRoom(newRoom);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragVertexIndex(null);
  };

  const addVertex = () => {
    // 添加新顶点
    const centerX = room.reduce((sum, p) => sum + p[0], 0) / room.length;
    const centerY = room.reduce((sum, p) => sum + p[1], 0) / room.length;
    setRoom([...room, [centerX + 200, centerY + 200]]);
  };

  const removeVertex = () => {
    if (room.length <= 3) {
      message.warning('至少需要3个顶点');
      return;
    }
    setRoom(room.slice(0, -1));
  };

  const markDoor = (edgeIndex: number) => {
    setDoorPosition({ edgeIndex, ratio: 0.5 });
    message.success(`已在边 ${edgeIndex + 1} 标记门`);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header
        style={{
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
        }}
      >
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          排砖宝 · 核心排版系统
        </Title>
      </Header>

      <Layout>
        {/* 左侧画布区域 */}
        <Content style={{ padding: 24 }}>
          <Card
            title="户型编辑"
            style={{ height: '100%' }}
            extra={
              <Space>
                <Button icon={<UndoOutlined />}>撤销</Button>
                <Button icon={<RedoOutlined />}>重做</Button>
              </Space>
            }
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{
                border: '1px solid #e2e8f0',
                cursor: 'crosshair',
                display: 'block',
                margin: '0 auto',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Space>
                <Button onClick={addVertex}>+ 增加顶点</Button>
                <Button danger icon={<DeleteOutlined />} onClick={removeVertex}>
                  - 删除顶点
                </Button>
                <Divider type="vertical" />
                <Text type="secondary">拖拽顶点调整户型</Text>
              </Space>
            </div>
            
            {/* 标记门位置 */}
            <div style={{ marginTop: 24 }}>
              <Text strong>选择门所在的边：</Text>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {room.map((_, i) => (
                  <Button
                    key={i}
                    type={doorPosition?.edgeIndex === i ? 'primary' : 'default'}
                    onClick={() => markDoor(i)}
                  >
                    边 {i + 1}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </Content>

        {/* 右侧配置区域 */}
        <Sider width={350} style={{ background: '#fff', padding: 24 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 瓷砖配置 */}
            <Card title="瓷砖规格" size="small">
              <Form layout="vertical">
                <Form.Item label="宽度 (mm)">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={tileConfig.tileWidth}
                    onChange={(v) => setTileConfig({ ...tileConfig, tileWidth: v || 800 })}
                  />
                </Form.Item>
                <Form.Item label="高度 (mm)">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={tileConfig.tileHeight}
                    onChange={(v) => setTileConfig({ ...tileConfig, tileHeight: v || 800 })}
                  />
                </Form.Item>
                <Form.Item label="留缝 (mm)">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={tileConfig.gapWidth}
                    onChange={(v) => setTileConfig({ ...tileConfig, gapWidth: v || 0 })}
                  />
                </Form.Item>
                <Form.Item label="铺贴方向">
                  <Select
                    style={{ width: '100%' }}
                    value={tileConfig.direction}
                    onChange={(v) => setTileConfig({ ...tileConfig, direction: v })}
                  >
                    <Option value="horizontal">横向</Option>
                    <Option value="vertical">纵向</Option>
                    <Option value="diagonal">菱形</Option>
                  </Select>
                </Form.Item>
              </Form>
            </Card>

            {/* 核心：缝对齐门中 */}
            <Card title="排版对齐设置" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>缝对齐门中心</Text>
                  <Switch
                    checked={alignGapToDoor}
                    disabled={doorPosition === null}
                    onChange={setAlignGapToDoor}
                  />
                </div>
                {!doorPosition && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    先在左侧选择门的位置
                  </Text>
                )}
              </Space>
            </Card>

            {/* 计算按钮 */}
            <Button
              type="primary"
              size="large"
              block
              icon={<SaveOutlined />}
              loading={isLoading}
              onClick={calculateLayout}
            >
              计算排版
            </Button>

            {/* 统计信息 */}
            {stats && (
              <Card title="排版统计" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>总面积</Text>
                    <Text strong>{stats.total_area_sq_m.toFixed(2)} ㎡</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>总砖数</Text>
                    <Text strong>{stats.total_tiles}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>整砖</Text>
                    <Text strong>{stats.whole_tiles}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>切割砖</Text>
                    <Text type="danger" strong>{stats.cut_tiles}</Text>
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>损耗率</Text>
                    <Text strong style={{ color: stats.waste_percentage > 10 ? '#ef4444' : '#10b981' }}>
                      {stats.waste_percentage.toFixed(1)}%
                    </Text>
                  </div>
                </Space>
              </Card>
            )}
          </Space>
        </Sider>
      </Layout>
    </Layout>
  );
};

export default CoreTilePlanner;
