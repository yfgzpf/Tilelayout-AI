import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layout,
  Typography,
  Button,
  InputNumber,
  Select,
  Card,
  Space,
  Slider,
  Divider,
  message,
  Tooltip,
  Tag,
} from 'antd';
import {
  DragOutlined,
  AimOutlined,
  ColumnWidthOutlined,
  ColumnHeightOutlined,
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

// 常量
const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 600;
const PADDING = 40;

// 默认房间 4m x 5m
const DEFAULT_ROOM = {
  vertices: [
    [0, 0],
    [4000, 0],
    [4000, 5000],
    [0, 5000],
  ],
  doors: [
    { edgeIndex: 1, position: 0.5, width: 900 }, // 下边中间，900mm宽
  ],
};

interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
  isCut: boolean;
  label?: string;
}

interface LayoutResult {
  tiles: Tile[];
  stats: {
    total: number;
    whole: number;
    cut: number;
    waste: number;
    area: number;
  };
}

const ProfessionalTilePlanner: React.FC = () => {
  const [room, setRoom] = useState(DEFAULT_ROOM);
  const [tileWidth, setTileWidth] = useState(800);
  const [tileHeight, setTileHeight] = useState(800);
  const [gapWidth, setGapWidth] = useState(2);
  
  // 核心：两条可拖动的起铺线位置（从房间边缘算起，单位mm）
  const [horizontalGapOffset, setHorizontalGapOffset] = useState(0); // 横向缝位置
  const [verticalGapOffset, setVerticalGapOffset] = useState(0); // 竖向缝位置
  
  const [isDraggingH, setIsDraggingH] = useState(false);
  const [isDraggingV, setIsDraggingV] = useState(false);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 获取房间边界
  const getRoomBounds = useCallback(() => {
    const xs = room.vertices.map(v => v[0]);
    const ys = room.vertices.map(v => v[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [room]);

  // 计算缩放比例
  const getScale = useCallback(() => {
    const bounds = getRoomBounds();
    const roomW = bounds.maxX - bounds.minX;
    const roomH = bounds.maxY - bounds.minY;
    
    const scaleX = (CANVAS_WIDTH - PADDING * 2) / roomW;
    const scaleY = (CANVAS_HEIGHT - PADDING * 2) / roomH;
    
    return Math.min(scaleX, scaleY) * 0.9;
  }, [getRoomBounds]);

  // 世界坐标转画布坐标
  const toCanvas = useCallback((wx: number, wy: number) => {
    const scale = getScale();
    const bounds = getRoomBounds();
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const roomCenterX = (bounds.maxX + bounds.minX) / 2;
    const roomCenterY = (bounds.maxY + bounds.minY) / 2;
    
    return {
      x: centerX + (wx - roomCenterX) * scale,
      y: centerY + (wy - roomCenterY) * scale,
    };
  }, [getScale, getRoomBounds]);

  // 计算排版
  const calculateLayout = useCallback(() => {
    const bounds = getRoomBounds();
    const tiles: Tile[] = [];
    
    const tileW = tileWidth + gapWidth;
    const tileH = tileHeight + gapWidth;
    
    // 起铺点 = 边界 + 偏移量
    const startX = bounds.minX + verticalGapOffset;
    const startY = bounds.minY + horizontalGapOffset;
    
    // 遍历所有可能的砖位置
    for (let y = startY - tileH; y < bounds.maxY + tileH; y += tileH) {
      for (let x = startX - tileW; x < bounds.maxX + tileW; x += tileW) {
        // 检查砖是否与房间相交
        const tileLeft = x;
        const tileRight = x + tileWidth;
        const tileTop = y;
        const tileBottom = y + tileHeight;
        
        // 简单相交检测：砖的任意顶点在房间内 或 房间的任意顶点在砖内
        const roomPts = room.vertices;
        let hasIntersection = false;
        
        // 检查房间顶点在砖内
        for (const pt of roomPts) {
          if (pt[0] >= tileLeft && pt[0] <= tileRight && pt[1] >= tileTop && pt[1] <= tileBottom) {
            hasIntersection = true;
            break;
          }
        }
        
        // 检查砖心在房间内
        if (!hasIntersection) {
          const centerX = (tileLeft + tileRight) / 2;
          const centerY = (tileTop + tileBottom) / 2;
          if (centerX >= bounds.minX && centerX <= bounds.maxX && 
              centerY >= bounds.minY && centerY <= bounds.maxY) {
            hasIntersection = true;
          }
        }
        
        if (hasIntersection) {
          // 判断是否切割
          let isCut = false;
          let drawX = tileLeft;
          let drawY = tileTop;
          let drawW = tileWidth;
          let drawH = tileHeight;
          
          // 检查是否需要裁剪
          if (tileLeft < bounds.minX || tileRight > bounds.maxX || 
              tileTop < bounds.minY || tileBottom > bounds.maxY) {
            isCut = true;
          }
          
          tiles.push({
            x: Math.max(drawX, bounds.minX),
            y: Math.max(drawY, bounds.minY),
            width: Math.min(drawW, bounds.maxX - Math.max(drawX, bounds.minX)),
            height: Math.min(drawH, bounds.maxY - Math.max(drawY, bounds.minY)),
            isCut,
          });
        }
      }
    }
    
    // 统计
    const whole = tiles.filter(t => !t.isCut).length;
    const cut = tiles.filter(t => t.isCut).length;
    const roomArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / 1_000_000;
    
    setLayout({
      tiles,
      stats: {
        total: tiles.length,
        whole,
        cut,
        waste: cut / tiles.length * 100,
        area: roomArea,
      },
    });
  }, [room, tileWidth, tileHeight, gapWidth, horizontalGapOffset, verticalGapOffset, getRoomBounds]);

  // 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清空
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    const bounds = getRoomBounds();
    const scale = getScale();
    
    // 绘制网格背景
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    
    // 绘制房间
    const roomPts = room.vertices.map(v => toCanvas(v[0], v[1]));
    
    ctx.beginPath();
    ctx.moveTo(roomPts[0].x, roomPts[0].y);
    for (let i = 1; i < roomPts.length; i++) {
      ctx.lineTo(roomPts[i].x, roomPts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 绘制门
    room.doors.forEach(door => {
      const p1 = room.vertices[door.edgeIndex];
      const p2 = room.vertices[(door.edgeIndex + 1) % room.vertices.length];
      const doorStart = {
        x: p1[0] + (p2[0] - p1[0]) * (door.position - 0.5) * 0.1,
        y: p1[1] + (p2[1] - p1[1]) * (door.position - 0.5) * 0.1,
      };
      const doorEnd = {
        x: p1[0] + (p2[0] - p1[0]) * (door.position + 0.5) * 0.1,
        y: p1[1] + (p2[1] - p1[1]) * (door.position + 0.5) * 0.1,
      };
      
      const cStart = toCanvas(doorStart.x, doorStart.y);
      const cEnd = toCanvas(doorEnd.x, doorEnd.y);
      
      ctx.beginPath();
      ctx.moveTo(cStart.x, cStart.y);
      ctx.lineTo(cEnd.x, cEnd.y);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    
    // 绘制瓷砖
    if (layout) {
      layout.tiles.forEach((tile, idx) => {
        const tl = toCanvas(tile.x, tile.y);
        const br = toCanvas(tile.x + tile.width, tile.y + tile.height);
        
        ctx.beginPath();
        ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        
        // 切割砖用橙色
        if (tile.isCut) {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
          ctx.strokeStyle = '#f97316';
        } else {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
          ctx.strokeStyle = '#3b82f6';
        }
        
        ctx.fill();
        ctx.stroke();
        
        // 切割砖标记
        if (tile.isCut) {
          ctx.fillStyle = '#f97316';
          ctx.font = 'bold 10px Arial';
          ctx.fillText('切', tl.x + 2, tl.y + 12);
        }
      });
    }
    
    // 绘制起铺线（缝隙）
    const tileW = tileWidth + gapWidth;
    const tileH = tileHeight + gapWidth;
    
    // 竖向起铺线
    const vLineX = bounds.minX + verticalGapOffset;
    const vStart = toCanvas(vLineX, bounds.minY);
    const vEnd = toCanvas(vLineX, bounds.maxY);
    
    ctx.beginPath();
    ctx.moveTo(vStart.x, vStart.y);
    ctx.lineTo(vEnd.x, vEnd.y);
    ctx.strokeStyle = isDraggingV ? '#ef4444' : '#dc2626';
    ctx.lineWidth = isDraggingV ? 3 : 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 竖向拖动手柄
    const vHandle = toCanvas(vLineX, (bounds.minY + bounds.maxY) / 2);
    ctx.beginPath();
    ctx.arc(vHandle.x, vHandle.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↔', vHandle.x, vHandle.y);
    
    // 横向起铺线
    const hLineY = bounds.minY + horizontalGapOffset;
    const hStart = toCanvas(bounds.minX, hLineY);
    const hEnd = toCanvas(bounds.maxX, hLineY);
    
    ctx.beginPath();
    ctx.moveTo(hStart.x, hStart.y);
    ctx.lineTo(hEnd.x, hEnd.y);
    ctx.strokeStyle = isDraggingH ? '#ef4444' : '#dc2626';
    ctx.lineWidth = isDraggingH ? 3 : 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 横向拖动手柄
    const hHandle = toCanvas((bounds.minX + bounds.maxX) / 2, hLineY);
    ctx.beginPath();
    ctx.arc(hHandle.x, hHandle.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('↕', hHandle.x, hHandle.y);
    
    // 显示缝隙数值标注
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#dc2626';
    ctx.textAlign = 'left';
    ctx.fillText(`竖缝: ${verticalGapOffset}mm`, vStart.x, vStart.y - 5);
    ctx.textAlign = 'right';
    ctx.fillText(`横缝: ${horizontalGapOffset}mm`, hEnd.x + 5, hEnd.y);
    
    // 绘制尺寸标注（酷家乐风格）
    ctx.font = '11px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    
    // 宽度标注
    const topMid = toCanvas((bounds.minX + bounds.maxX) / 2, bounds.minY);
    ctx.fillText(`${((bounds.maxX - bounds.minX) / 1000).toFixed(2)}m`, topMid.x, topMid.y - 10);
    
    // 高度标注
    const rightMid = toCanvas(bounds.maxX, (bounds.minY + bounds.maxY) / 2);
    ctx.save();
    ctx.translate(rightMid.x + 15, rightMid.y);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(`${((bounds.maxY - bounds.minY) / 1000).toFixed(2)}m`, 0, 0);
    ctx.restore();
    
  }, [room, layout, tileWidth, tileHeight, gapWidth, horizontalGapOffset, verticalGapOffset, isDraggingH, isDraggingV, getRoomBounds, getScale, toCanvas]);

  // 鼠标拖动处理
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    
    const bounds = getRoomBounds();
    const scale = getScale();
    
    // 检测点击了哪条线
    const vLineX = bounds.minX + verticalGapOffset;
    const hLineY = bounds.minY + horizontalGapOffset;
    
    const vHandle = toCanvas(vLineX, (bounds.minY + bounds.maxY) / 2);
    const hHandle = toCanvas((bounds.minX + bounds.maxX) / 2, hLineY);
    
    // 检测点击竖向线
    if (Math.abs(cx - vHandle.x) < 15 && Math.abs(cy - vHandle.y) < 15) {
      setIsDraggingV(true);
      return;
    }
    
    // 检测点击横向线
    if (Math.abs(cy - hHandle.y) < 15 && Math.abs(cx - hHandle.x) < 15) {
      setIsDraggingH(true);
      return;
    }
    
    // 点击了竖向起铺线附近
    const vCanvasX = toCanvas(vLineX, 0).x;
    if (Math.abs(cx - vCanvasX) < 10 && cy > toCanvas(0, bounds.minY).y && cy < toCanvas(0, bounds.maxY).y) {
      setIsDraggingV(true);
      return;
    }
    
    // 点击了横向起铺线附近
    const hCanvasY = toCanvas(0, hLineY).y;
    if (Math.abs(cy - hCanvasY) < 10 && cx > toCanvas(bounds.minX, 0).x && cx < toCanvas(bounds.maxX, 0).x) {
      setIsDraggingH(true);
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingV && !isDraggingH) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    
    const bounds = getRoomBounds();
    const scale = getScale();
    const roomCenterX = (bounds.maxX + bounds.minX) / 2;
    const roomCenterY = (bounds.maxY + bounds.minY) / 2;
    
    if (isDraggingV) {
      const worldX = roomCenterX + (cx - CANVAS_WIDTH / 2) / scale;
      // 吸附到砖网格
      const tileW = tileWidth + gapWidth;
      const offset = worldX - bounds.minX;
      const snapped = Math.round(offset / 10) * 10; // 10mm吸附
      setVerticalGapOffset(Math.max(0, Math.min(snapped, bounds.maxX - bounds.minX - tileWidth)));
    }
    
    if (isDraggingH) {
      const worldY = roomCenterY + (cy - CANVAS_HEIGHT / 2) / scale;
      const tileH = tileHeight + gapWidth;
      const offset = worldY - bounds.minY;
      const snapped = Math.round(offset / 10) * 10;
      setHorizontalGapOffset(Math.max(0, Math.min(snapped, bounds.maxY - bounds.minY - tileHeight)));
    }
  };

  const handleMouseUp = () => {
    if (isDraggingV || isDraggingH) {
      calculateLayout();
    }
    setIsDraggingV(false);
    setIsDraggingH(false);
  };

  // 初始计算
  useEffect(() => {
    calculateLayout();
  }, [calculateLayout]);

  // 输出标注数据
  const exportAnnotations = () => {
    if (!layout) return;
    
    const annotations = {
      roomSize: {
        width: getRoomBounds().maxX - getRoomBounds().minX,
        height: getRoomBounds().maxY - getRoomBounds().minY,
      },
      tileSize: {
        width: tileWidth,
        height: tileHeight,
        gap: gapWidth,
      },
      gapOffsets: {
        horizontal: horizontalGapOffset,
        vertical: verticalGapOffset,
      },
      tiles: layout.tiles,
      stats: layout.stats,
      instructions: [
        `起铺点从左上角向右偏移 ${verticalGapOffset}mm`,
        `起铺点从左上角向下偏移 ${horizontalGapOffset}mm`,
        `水平缝隙从第1列砖右侧开始`,
        `垂直缝隙从第1行砖下方开始`,
      ],
    };
    
    console.log('施工标注数据:', annotations);
    message.success('已生成施工标注数据，请查看控制台');
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#1a1a2e' }}>
      <Header style={{ background: '#0f0f1a', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>排砖宝 · 专业排版工具</Title>
        <div style={{ flex: 1 }} />
        <Space>
          <Button onClick={exportAnnotations}>导出标注</Button>
          <Button type="primary">保存方案</Button>
        </Space>
      </Header>

      <Layout>
        <Sider width={320} style={{ background: '#16213e', padding: 20 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            
            {/* 瓷砖规格 */}
            <Card 
              title={<><ColumnWidthOutlined /> 瓷砖规格</>}
              size="small"
              style={{ background: '#1a1a2e', border: '1px solid #2d3748' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text style={{ color: '#a0aec0' }}>宽度 (mm)</Text>
                  <InputNumber
                    style={{ width: '100%', marginTop: 4 }}
                    value={tileWidth}
                    onChange={v => setTileWidth(v || 800)}
                    min={100}
                    max={3000}
                  />
                </div>
                <div>
                  <Text style={{ color: '#a0aec0' }}>高度 (mm)</Text>
                  <InputNumber
                    style={{ width: '100%', marginTop: 4 }}
                    value={tileHeight}
                    onChange={v => setTileHeight(v || 800)}
                    min={100}
                    max={3000}
                  />
                </div>
                <div>
                  <Text style={{ color: '#a0aec0' }}>缝隙宽度 (mm)</Text>
                  <InputNumber
                    style={{ width: '100%', marginTop: 4 }}
                    value={gapWidth}
                    onChange={v => setGapWidth(v || 0)}
                    min={0}
                    max={50}
                  />
                </div>
              </Space>
            </Card>

            {/* 核心：缝隙位置精细控制 */}
            <Card
              title={<><DragOutlined /> 起铺线位置（拖动调整）</>}
              size="small"
              style={{ background: '#1a1a2e', border: '1px solid #dc2626' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#ef4444' }}>
                      <ColumnWidthOutlined /> 竖向缝隙
                    </Text>
                    <Tag color="red">{verticalGapOffset}mm</Tag>
                  </div>
                  <Slider
                    value={verticalGapOffset}
                    onChange={v => {
                      setVerticalGapOffset(v);
                      calculateLayout();
                    }}
                    min={0}
                    max={tileWidth}
                    step={1}
                    trackStyle={{ background: '#dc2626' }}
                    handleStyle={{ borderColor: '#dc2626', background: '#dc2626' }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    控制第1列砖左侧缝隙位置
                  </Text>
                </div>
                
                <Divider style={{ margin: '12px 0', borderColor: '#2d3748' }} />
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#ef4444' }}>
                      <ColumnHeightOutlined /> 横向缝隙
                    </Text>
                    <Tag color="red">{horizontalGapOffset}mm</Tag>
                  </div>
                  <Slider
                    value={horizontalGapOffset}
                    onChange={v => {
                      setHorizontalGapOffset(v);
                      calculateLayout();
                    }}
                    min={0}
                    max={tileHeight}
                    step={1}
                    trackStyle={{ background: '#dc2626' }}
                    handleStyle={{ borderColor: '#dc2626', background: '#dc2626' }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    控制第1行砖上方缝隙位置
                  </Text>
                </div>
              </Space>
            </Card>

            {/* 统计 */}
            {layout && (
              <Card
                title={<><AimOutlined /> 排版统计</>}
                size="small"
                style={{ background: '#1a1a2e', border: '1px solid #10b981' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#a0aec0' }}>房间面积</Text>
                    <Text style={{ color: '#fff' }}>{layout.stats.area.toFixed(2)} m²</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#a0aec0' }}>总砖数</Text>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{layout.stats.total}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#a0aec0' }}>整砖</Text>
                    <Text style={{ color: '#10b981' }}>{layout.stats.whole}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#a0aec0' }}>切割砖</Text>
                    <Text style={{ color: '#f97316' }}>{layout.stats.cut}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#a0aec0' }}>损耗率</Text>
                    <Tag color={layout.stats.waste > 10 ? 'orange' : 'green'}>
                      {layout.stats.waste.toFixed(1)}%
                    </Tag>
                  </div>
                </Space>
              </Card>
            )}

            {/* 施工说明 */}
            <Card
              size="small"
              style={{ background: '#1a1a2e', border: '1px solid #4a5568' }}
            >
              <Text style={{ color: '#a0aec0', fontSize: 12 }}>
                <strong>操作提示：</strong><br />
                1. 拖动红色起铺线可实时调整缝隙位置<br />
                2. 使用右侧滑块可精确到毫米<br />
                3. 点击「导出标注」获取施工数据
              </Text>
            </Card>
          </Space>
        </Sider>

        <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{
                background: '#fafafa',
                borderRadius: 8,
                cursor: 'crosshair',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            
            {/* 图例 */}
            <div style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              background: 'rgba(255,255,255,0.95)',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <Space size="middle">
                <span><span style={{ display: 'inline-block', width: 16, height: 16, background: 'rgba(59,130,246,0.3)', border: '1px solid #3b82f6', marginRight: 4 }}></span>整砖</span>
                <span><span style={{ display: 'inline-block', width: 16, height: 16, background: 'rgba(249,115,22,0.3)', border: '1px solid #f97316', marginRight: 4 }}></span>切割砖</span>
                <span><span style={{ display: 'inline-block', width: 20, height: 3, background: '#dc2626', marginRight: 4 }}></span>起铺线</span>
              </Space>
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ProfessionalTilePlanner;
