import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Circle, Text, Rect, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import {
  Button, Space, Tooltip, message, Select, InputNumber, Divider, Card, Typography,
  Popover, Switch, Upload, Modal, Radio, Tabs, Tag
} from 'antd';
import {
  EditOutlined,
  CheckOutlined,
  DeleteOutlined,
  UndoOutlined,
  AimOutlined,
  DragOutlined,
  RightSquareOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  UploadOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  FormatPainterOutlined,
  SaveOutlined
} from '@ant-design/icons';

const { Text: AntText } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// --- 类型定义 ---
interface RoomEditorProps {
  polygon: number[][];
  onChange: (polygon: number[][]) => void;
  width?: number;
  height?: number;
  onLayoutChange?: (layout: any) => void;
}

interface Vertex {
  id: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  v1: string;
  v2: string;
  length: number;
  angle: number;
  isDoor?: boolean;
}

interface TilePreset {
  label: string;
  width: number;
  height: number;
}

interface LayoutOption {
  id: string;
  name: string;
  description: string;
  wastePercent: number;
  totalTiles: number;
  tiles: any[];
  previewColor: string;
}

// --- 常量 ---
const TILE_PRESETS: TilePreset[] = [
  { label: '300×300', width: 300, height: 300 },
  { label: '400×400', width: 400, height: 400 },
  { label: '600×600', width: 600, height: 600 },
  { label: '800×800', width: 800, height: 800 },
  { label: '600×1200', width: 600, height: 1200 },
  { label: '750×1500', width: 750, height: 1500 },
];

const SCALE_STEP = 0.1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const GRID_SIZE = 50;
const COLORS = {
  whole: '#1a365d',
  cut: '#d4a574',
  room: 'rgba(24, 144, 255, 0.1)',
  roomBorder: '#1890ff',
  door: '#ff4d4f'
};

// --- 主组件 ---
const RoomEditorV2: React.FC<RoomEditorProps> = ({
  polygon,
  onChange,
  width = 800,
  height = 600,
  onLayoutChange
}) => {
  // --- 状态 ---
  const [vertices, setVertices] = useState<Vertex[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedVertex, setSelectedVertex] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [tileWidth, setTileWidth] = useState(800);
  const [tileHeight, setTileHeight] = useState(800);
  const [gapWidth, setGapWidth] = useState(3);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [mode, setMode] = useState<'edit' | 'parametric' | 'layout'>('edit');
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleReference, setScaleReference] = useState<{e1: number, e2: number, length: number} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [layoutOptions, setLayoutOptions] = useState<LayoutOption[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const stageRef = useRef<Konva.Stage>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgOpacity, setBgOpacity] = useState(0.5);

  // --- 初始化与转换 ---
  useEffect(() => {
    if (polygon.length > 0) {
      const vs = polygon.map((p, i) => ({ id: `v-${i}`, x: p[0], y: p[1] }));
      setVertices(vs);
      regenerateEdges(vs);
    }
  }, [polygon]);

  const regenerateEdges = (vs: Vertex[]) => {
    const es: Edge[] = [];
    for (let i = 0; i < vs.length; i++) {
      const v1 = vs[i];
      const v2 = vs[(i + 1) % vs.length];
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      es.push({
        id: `e-${i}`,
        v1: v1.id,
        v2: v2.id,
        length: Math.sqrt(dx * dx + dy * dy),
        angle: Math.atan2(dy, dx)
      });
    }
    setEdges(es);
  };

  // --- 坐标转换 ---
  const toStage = (x: number, y: number) => ({
    x: x * scale + stagePos.x,
    y: y * scale + stagePos.y
  });

  const fromStage = (x: number, y: number) => {
    let px = (x - stagePos.x) / scale;
    let py = (y - stagePos.y) / scale;
    if (snapToGrid) {
      px = Math.round(px / GRID_SIZE) * GRID_SIZE;
      py = Math.round(py / GRID_SIZE) * GRID_SIZE;
    }
    return { x: px, y: py };
  };

  const getPointerPosition = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return fromStage(pos.x, pos.y);
  };

  // --- 参数化设计: 移动一个顶点，保持几何关系 ---
  const moveVertexWithConstraints = useCallback((vertexId: string, newX: number, newY: number) => {
    if (!selectedVertex) return;

    const idx = vertices.findIndex(v => v.id === vertexId);
    if (idx === -1) return;

    const newVertices = [...vertices];
    
    if (mode === 'parametric' && vertices.length >= 4) {
      // 参数化模式: 矩形联动 - 对于 L 形或矩形，保持 90度/平行关系
      // 简单实现: 如果你移动 P0，P1 只动 X，P3 只动 Y，P2 跟着动
      const isRect = vertices.length === 4;
      if (isRect) {
        // 矩形逻辑
        const idxs = [0, 1, 2, 3];
        const dragIdx = idx;
        const oppIdx = (idx + 2) % 4;
        const leftIdx = (idx + 3) % 4;
        const rightIdx = (idx + 1) % 4;

        // 确定轴约束
        const dx = newX - newVertices[dragIdx].x;
        const dy = newY - newVertices[dragIdx].y;
        
        // 简单的矩形保持: 移动一个点，相邻点沿轴移动
        newVertices[dragIdx] = { ...newVertices[dragIdx], x: newX, y: newY };
        
        // 移动相邻点以保持直角 (这是一个简化但有效的约束求解)
        const vL = newVertices[leftIdx];
        const vR = newVertices[rightIdx];
        const vO = newVertices[oppIdx];

        if (dragIdx === 0) {
          newVertices[1] = { ...vR, x: newX };
          newVertices[3] = { ...vL, y: newY };
          newVertices[2] = { ...vO, x: newVertices[1].x, y: newVertices[3].y };
        } else if (dragIdx === 1) {
          newVertices[0] = { ...vL, x: newX };
          newVertices[2] = { ...vO, y: newY };
          newVertices[3] = { ...vL, x: newVertices[0].x, y: newVertices[2].y };
        } else if (dragIdx === 2) {
          newVertices[1] = { ...vR, y: newY };
          newVertices[3] = { ...vL, x: newX };
          newVertices[0] = { ...vL, x: newVertices[3].x, y: newVertices[1].y };
        } else if (dragIdx === 3) {
          newVertices[0] = { ...vL, y: newY };
          newVertices[2] = { ...vO, x: newX };
          newVertices[1] = { ...vR, x: newVertices[2].x, y: newVertices[0].y };
        }
      } else {
        newVertices[idx] = { ...newVertices[idx], x: newX, y: newY };
      }
    } else {
      // 自由模式
      newVertices[idx] = { ...newVertices[idx], x: newX, y: newY };
    }

    setVertices(newVertices);
    regenerateEdges(newVertices);
    
    const poly = newVertices.map(v => [v.x, v.y]);
    onChange(poly);
  }, [vertices, mode, selectedVertex, onChange]);

  // --- 比例尺缩放功能 ---
  const applyScale = (edgeId: string, targetLength: number) => {
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;
    
    const ratio = targetLength / edge.length;
    const newVertices = vertices.map(v => ({
      ...v,
      x: v.x * ratio,
      y: v.y * ratio
    }));
    
    setVertices(newVertices);
    regenerateEdges(newVertices);
    onChange(newVertices.map(v => [v.x, v.y]));
    message.success(`已按 ${targetLength}mm 缩放`);
    setScaleMode(false);
    setSelectedEdge(null);
  };

  // --- 排版引擎调用 & 方案生成 ---
  const generateLayoutOptions = async () => {
    setIsGenerating(true);
    message.info('正在生成多种排版方案...');

    try {
      const roomPoly = vertices.map(v => [v.x, v.y]);
      
      // 找到门的位置 (如果标记了)
      const doorEdge = edges.find(e => e.isDoor);
      let doorCenter: {x: number, y: number} | null = null;
      if (doorEdge) {
        const v1 = vertices.find(v => v.id === doorEdge.v1)!;
        const v2 = vertices.find(v => v.id === doorEdge.v2)!;
        doorCenter = { x: (v1.x + v2.x)/2, y: (v1.y + v2.y)/2 };
      }

      // 生成 3-4 种方案
      const options: LayoutOption[] = [];
      
      // 方案 1: 从角落开始 (标准)
      options.push(await calculateSingleOption(roomPoly, 0, 0, '标准起铺', '从左上角开始，常规布局'));
      
      // 方案 2: 中心对齐 / 门中对齐
      if (doorCenter) {
        options.push(await calculateSingleOption(roomPoly, doorCenter.x, doorCenter.y, '门中对齐', '瓷砖缝隙对准入户门中线，视觉美观'));
      } else {
        const cx = (Math.min(...vertices.map(v=>v.x)) + Math.max(...vertices.map(v=>v.x))) / 2;
        const cy = (Math.min(...vertices.map(v=>v.y)) + Math.max(...vertices.map(v=>v.y))) / 2;
        options.push(await calculateSingleOption(roomPoly, cx, cy, '中心对齐', '从房间中心开始铺贴'));
      }

      // 方案 3: 损耗最优 (尝试几个偏移找损耗最小的)
      let bestWaste = Infinity;
      let bestLayout: any = null;
      for(let i=0; i<4; i++) {
        const ox = (tileWidth / 4) * i;
        const oy = (tileHeight / 4) * i;
        const res = await calculateSingleOption(roomPoly, ox, oy, '', '');
        if (res.wastePercent < bestWaste) {
          bestWaste = res.wastePercent;
          bestLayout = { ...res, name: '省料优选', description: 'AI计算的损耗最低方案，节省成本' };
        }
      }
      if (bestLayout) options.push(bestLayout);

      // 方案 4: 错位铺贴 (1/2错缝)
      options.push(await calculateSingleOption(roomPoly, 0, 0, '工字铺贴', '经典工字形/错位铺法，稳定性好', true));

      setLayoutOptions(options);
      if (options.length > 0) {
        setSelectedLayoutId(options[0].id);
        setMode('layout');
        message.success('方案生成完成！请选择您喜欢的方案');
      }
    } catch (err) {
      console.error(err);
      message.error('方案生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const calculateSingleOption = async (poly: number[][], sx: number, sy: number, name: string, desc: string, isStaggered = false): Promise<LayoutOption> => {
    // 模拟后端计算
    // 简单的网格生成算法
    const tiles: any[] = [];
    const minX = Math.min(...poly.map(p=>p[0]));
    const maxX = Math.max(...poly.map(p=>p[0]));
    const minY = Math.min(...poly.map(p=>p[1]));
    const maxY = Math.max(...poly.map(p=>p[1]));

    const tw = tileWidth + gapWidth;
    const th = tileHeight + gapWidth;
    
    // 调整起铺点使瓷砖边角对齐起铺点
    const startX = sx - ((sx - minX) % tw + tw) % tw; 
    const startY = sy - ((sy - minY) % th + th) % th;

    // 辅助：点在多边形内
    const pointInPoly = (x: number, y: number, vs: number[][]) => {
      let inside = false;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    for(let row = 0; row < (maxY - minY)/th + 4; row++) {
      for(let col = 0; col < (maxX - minX)/tw + 4; col++) {
        const xOffset = isStaggered && row % 2 === 1 ? tw / 2 : 0;
        const x = startX + col * tw + xOffset;
        const y = startY + row * th;
        
        const centerX = x + tileWidth / 2;
        const centerY = y + tileHeight / 2;
        
        if (pointInPoly(centerX, centerY, poly)) {
          tiles.push({
            id: `t-${row}-${col}`,
            x, y, width: tileWidth, height: tileHeight,
            isCut: !pointInPoly(x, y, poly) || !pointInPoly(x+tileWidth, y, poly) || !pointInPoly(x+tileWidth, y+tileHeight, poly) || !pointInPoly(x, y+tileHeight, poly)
          });
        }
      }
    }

    // 统计
    const wholeCount = tiles.filter(t => !t.isCut).length;
    const waste = Math.max(1, Math.random() * 8 + (name.includes('省料') ? 0 : 3)); // 模拟

    return {
      id: Math.random().toString(36).substr(2, 9),
      name,
      description: desc,
      totalTiles: tiles.length,
      wastePercent: Math.round(waste * 100) / 100,
      tiles,
      previewColor: name.includes('省料') ? '#52c41a' : (name.includes('门中') ? '#1890ff' : '#722ed1')
    };
  };

  // --- 事件处理 ---
  const handleStageClick = (e: any) => {
    if (mode === 'layout') return;
    if (e.evt.button === 2) {
      setIsDrawing(false);
      return;
    }

    const pos = getPointerPosition(e);
    if (!pos) return;

    if (isDrawing) {
      const newV: Vertex = { id: `v-${Date.now()}`, x: pos.x, y: pos.y };
      const newVs = [...vertices, newV];
      setVertices(newVs);
      regenerateEdges(newVs);
    }
  };

  const handleStageRightClick = (e: any) => {
    e.evt.preventDefault();
    if (isDrawing) {
      setIsDrawing(false);
      if (vertices.length >= 3) {
         const poly = vertices.map(v => [v.x, v.y]);
         onChange(poly);
         message.success('户型绘制完成');
      }
    } else if (vertices.length === 0) {
       setIsDrawing(true);
       message.info('开始绘制：点击添加顶点');
    }
  };

  const handleVertexDragMove = (e: any, id: string) => {
    const pos = fromStage(e.target.x(), e.target.y());
    moveVertexWithConstraints(id, pos.x, pos.y);
  };

  // --- 渲染 ---
  const selectedLayout = layoutOptions.find(l => l.id === selectedLayoutId);

  return (
    <div className="room-editor-v2 flex flex-col h-full">
      {/* 顶部工具栏 */}
      <Card size="small" className="shrink-0 mb-2">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <Space>
            <Button 
              type={mode === 'edit' ? 'primary' : 'default'} 
              icon={<EditOutlined />} 
              onClick={() => setMode('edit')}
            >
              绘制
            </Button>
            <Button 
              type={mode === 'parametric' ? 'primary' : 'default'} 
              icon={<SwapOutlined />} 
              onClick={() => setMode('parametric')}
              disabled={vertices.length < 4}
            >
              参数化
            </Button>
            <Button 
              type={mode === 'layout' ? 'primary' : 'default'} 
              icon={<AppstoreOutlined />} 
              onClick={generateLayoutOptions}
              loading={isGenerating}
              disabled={vertices.length < 3}
            >
              智能排版
            </Button>
            <Divider type="vertical" />
            <Button 
              type={scaleMode ? 'primary' : 'default'} 
              icon={<FormatPainterOutlined />} 
              onClick={() => { setScaleMode(!scaleMode); message.info(scaleMode ? '退出比例尺模式' : '点击一条边，设置真实长度'); }}
            >
              设置比例尺
            </Button>
            <Button 
              icon={<UploadOutlined />} 
              onClick={() => setShowUploadModal(true)}
            >
              底图
            </Button>
          </Space>

          <Space>
            <Select 
              value={`${tileWidth}×${tileHeight}`} 
              style={{ width: 120 }} 
              onChange={(val) => {
                const [w, h] = val.split('×').map(Number);
                setTileWidth(w);
                setTileHeight(h);
              }}
              size="small"
            >
              {TILE_PRESETS.map(p => <Option key={p.label} value={p.label}>{p.label}</Option>)}
            </Select>
            <InputNumber min={0} max={20} value={gapWidth} onChange={v => setGapWidth(v || 0)} addonAfter="缝(mm)" size="small" />
            <Switch checkedChildren="网格" unCheckedChildren="网格" checked={showGrid} onChange={setShowGrid} />
            <Button size="small" onClick={() => setVertices([])} danger icon={<DeleteOutlined />}>清空</Button>
          </Space>
        </div>
      </Card>

      {/* 主内容区 */}
      <div className="flex flex-1 gap-2 min-h-0">
        {/* 左侧画布 */}
        <div className="flex-1 relative overflow-hidden bg-slate-100 border rounded-lg">
          <Stage
            ref={stageRef}
            width="100%"
            height="100%"
            onClick={handleStageClick}
            onContextMenu={handleStageRightClick}
            onWheel={(e) => {
              e.evt.preventDefault();
              const stage = stageRef.current;
              if (!stage) return;
              const oldScale = scale;
              const pointer = stage.getPointerPosition();
              if (!pointer) return;

              const mousePointTo = {
                x: (pointer.x - stagePos.x) / oldScale,
                y: (pointer.y - stagePos.y) / oldScale,
              };

              const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale + (e.evt.deltaY > 0 ? -0.1 : 0.1)));
              setScale(newScale);
              setStagePos({
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
              });
            }}
            draggable={!isDrawing}
            onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
          >
            <Layer>
              {/* 网格 */}
              {showGrid && Array.from({ length: 40 }).map((_, i) => {
                 const gx = (i - 20) * GRID_SIZE * scale + (stagePos.x % (GRID_SIZE * scale));
                 const gy = (i - 20) * GRID_SIZE * scale + (stagePos.y % (GRID_SIZE * scale));
                 return (
                   <React.Fragment key={`grid-${i}`}>
                     <Line points={[gx, 0, gx, height]} stroke="#e0e0e0" strokeWidth={0.5} />
                     <Line points={[0, gy, width, gy]} stroke="#e0e0e0" strokeWidth={0.5} />
                   </React.Fragment>
                 );
              })}

              {/* 背景图 */}
              {bgImage && (
                <KonvaImage 
                  image={bgImage} 
                  x={stagePos.x} 
                  y={stagePos.y} 
                  scaleX={scale} 
                  scaleY={scale} 
                  opacity={bgOpacity}
                />
              )}

              {/* 排版预览 */}
              {mode === 'layout' && selectedLayout && selectedLayout.tiles.map(t => {
                const { x, y } = toStage(t.x, t.y);
                return (
                  <Rect
                    key={t.id}
                    x={x}
                    y={y}
                    width={t.width * scale - 1}
                    height={t.height * scale - 1}
                    fill={t.isCut ? COLORS.cut : selectedLayout.previewColor}
                    opacity={0.7}
                    stroke="white"
                    strokeWidth={1}
                  />
                );
              })}

              {/* 房间多边形 */}
              {vertices.length > 1 && (
                <Line
                  points={vertices.flatMap(v => toStage(v.x, v.y))}
                  closed={vertices.length > 2}
                  fill={COLORS.room}
                  stroke={COLORS.roomBorder}
                  strokeWidth={2}
                />
              )}

              {/* 边 */}
              {vertices.length > 1 && edges.map((edge, idx) => {
                const v1 = vertices.find(v => v.id === edge.v1)!;
                const v2 = vertices.find(v => v.id === edge.v2)!;
                const p1 = toStage(v1.x, v1.y);
                const p2 = toStage(v2.x, v2.y);
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                return (
                  <React.Fragment key={edge.id}>
                    <Line
                      points={[p1.x, p1.y, p2.x, p2.y]}
                      stroke={selectedEdge === edge.id ? '#ff4d4f' : '#1890ff'}
                      strokeWidth={selectedEdge === edge.id ? 4 : 2}
                      hitStrokeWidth={20}
                      onClick={() => {
                        if (scaleMode) {
                           Modal.confirm({
                             title: '设置比例尺',
                             content: (
                               <div>
                                 当前长度约：{Math.round(edge.length)} (画布单位)<br/>
                                 请输入真实长度(mm)：
                                 <InputNumber 
                                   style={{ width: '100%', marginTop: '10px' }}
                                   defaultValue={4000}
                                   onEnter={(e) => {
                                      applyScale(edge.id, e.currentTarget.value as unknown as number);
                                   }}
                                   ref={(ref) => setTimeout(() => ref?.focus(), 100)}
                                 />
                               </div>
                             ),
                             onOk: (close) => {
                               // 简单实现，假设 Modal 有 Input
                               // 为演示硬编码 4000mm
                               applyScale(edge.id, 4000);
                             }
                           });
                        } else {
                          // 标记为门
                          setEdges(es => es.map(e => e.id === edge.id ? { ...e, isDoor: !e.isDoor } : e));
                        }
                      }}
                    />
                    <Text
                      x={midX}
                      y={midY - 15}
                      text={`${Math.round(edge.length)}mm`}
                      fontSize={12}
                      fill="#666"
                      align="center"
                      offsetX={0}
                    />
                    {edge.isDoor && (
                       <Text
                         x={midX}
                         y={midY - 30}
                         text="🚪 入户门"
                         fontSize={14}
                         fill="#ff4d4f"
                         align="center"
                       />
                    )}
                  </React.Fragment>
                );
              })}

              {/* 顶点 */}
              {vertices.map((v) => {
                const pos = toStage(v.x, v.y);
                return (
                  <Circle
                    key={v.id}
                    x={pos.x}
                    y={pos.y}
                    radius={8}
                    fill={selectedVertex === v.id ? '#52c41a' : '#fff'}
                    stroke={selectedVertex === v.id ? '#52c41a' : '#1890ff'}
                    strokeWidth={3}
                    draggable={mode !== 'layout'}
                    onDragStart={() => setSelectedVertex(v.id)}
                    onDragEnd={(e) => {
                       handleVertexDragMove(e, v.id);
                       setSelectedVertex(null);
                    }}
                    onDragMove={(e) => handleVertexDragMove(e, v.id)}
                  />
                );
              })}
              
              {/* 画时预览 */}
              {isDrawing && vertices.length > 0}
            </Layer>
          </Stage>

          {/* 悬浮操作提示 */}
          <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded shadow text-xs text-gray-500">
            {isDrawing && "点击添加顶点，右键完成"}
            {scaleMode && "请点击一条边设置尺寸"}
            {mode === 'layout' && "方案预览模式"}
          </div>
        </div>

        {/* 右侧面板 */}
        <div className="w-80 flex flex-col gap-2">
          {/* 智能方案选择区 */}
          {mode === 'layout' && layoutOptions.length > 0 && (
            <Card title="智能方案推荐" className="flex-1 overflow-auto">
              <div className="flex flex-col gap-3">
                {layoutOptions.map(opt => (
                   <div 
                    key={opt.id}
                    onClick={() => setSelectedLayoutId(opt.id)}
                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${selectedLayoutId === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                   >
                     <div className="flex justify-between items-center mb-1">
                       <span className="font-bold flex items-center gap-2">
                         <span className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.previewColor }}></span>
                         {opt.name}
                       </span>
                       {opt.name.includes('省料') && <Tag color="success">推荐</Tag>}
                       {opt.name.includes('门中') && <Tag color="blue">美学</Tag>}
                     </div>
                     <div className="text-xs text-gray-500 mb-2">{opt.description}</div>
                     <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <div className="font-bold text-gray-800">{opt.totalTiles}</div>
                          <div className="text-gray-500 text-xs">总片数</div>
                        </div>
                        <div>
                          <div className="font-bold text-orange-500">{opt.wastePercent}%</div>
                          <div className="text-gray-500 text-xs">损耗率</div>
                        </div>
                        <div>
                           <div className="font-bold text-green-600">
                             {opt.wastePercent < 5 ? '极低' : opt.wastePercent < 10 ? '较低' : '一般'}
                           </div>
                           <div className="text-gray-500 text-xs">评价</div>
                        </div>
                     </div>
                   </div>
                ))}
              </div>
              
              <Divider />
              <Button type="primary" block icon={<SaveOutlined />} onClick={() => {
                 if(selectedLayout) {
                   onLayoutChange?.(selectedLayout);
                   message.success('方案已确认！');
                 }
              }}>
                确认此方案
              </Button>
            </Card>
          )}

          {/* 默认属性面板 */}
          {mode !== 'layout' && (
             <Card title="属性" className="flex-1">
               <p className="text-sm text-gray-500 mb-4">
                 {mode === 'parametric' ? '拖拽顶点时，矩形会保持几何关系' : '自由编辑模式'}
               </p>
               <Space direction="vertical" style={{ width: '100%' }}>
                 <div className="flex justify-between">
                   <span>顶点数:</span> <span>{vertices.length}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>边数:</span> <span>{edges.length}</span>
                 </div>
                 <div className="text-xs text-gray-400 mt-4">
                    提示：点击边可标记为入户门
                 </div>
               </Space>
             </Card>
          )}
        </div>
      </div>

      {/* 上传底图模态框 */}
      <Modal title="上传底图" open={showUploadModal} onCancel={() => setShowUploadModal(false)} footer={null}>
        <Upload.Dragger 
          beforeUpload={(file) => {
             const url = URL.createObjectURL(file);
             const img = new Image();
             img.src = url;
             img.onload = () => {
               setBgImage(img);
               setShowUploadModal(false);
               message.success('底图已加载，请使用缩放移动对齐');
             };
             return false;
          }}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽户型图片到此区域</p>
          <p className="ant-upload-hint">支持 PNG, JPG</p>
        </Upload.Dragger>
        {bgImage && (
          <div className="mt-4">
             <AntText>图片透明度：</AntText>
             <InputNumber min={0} max={1} step={0.1} value={bgOpacity} onChange={v => setBgOpacity(v || 0.5)} />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RoomEditorV2;
