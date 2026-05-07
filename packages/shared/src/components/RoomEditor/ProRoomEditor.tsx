import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Circle, Text, Rect, Group, Arrow, Label, Tag as KonvaTag } from 'react-konva';
import {
  Button,
  Space,
  Tooltip,
  message,
  Select,
  InputNumber,
  Divider,
  Card,
  Typography,
  Tag,
  Upload,
  Modal,
  Spin,
  Progress,
  Dropdown,
  Input,
  Slider,
  Collapse,
  Row,
  Col,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined,
  CameraOutlined,
  EditOutlined,
  ScissorOutlined,
  DragOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Text: AntText, Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

interface Point2D { x: number; y: number; }
interface WallSegment { id: string; startIdx: number; endIdx: number; thickness?: number; broken?: boolean; }
interface HistoryState { points: number[][]; components: any[]; wallThickness: number; }

const GRID_SIZE = 50;
const SNAP_ANGLE = 15;
const ORTHO_THRESHOLD = 8;

const TILE_PRESETS = [
  { label: '300×300 小地砖', w: 300, h: 300 },
  { label: '400×400 地砖', w: 400, h: 400 },
  { label: '600×600 抛光砖', w: 600, h: 600 },
  { label: '800×800 通体砖 ★', w: 800, h: 800 },
  { label: '600×1200 大板', w: 600, h: 1200 },
  { label: '750×1500 岩板', w: 750, h: 1500 },
];

const PRESET_TEMPLATES = [
  { key: 'rect', label: '矩形房间 (5m×4m)', icon: '▢' },
  { key: 'lshape', label: 'L型转角房间', icon: '⌐' },
  { key: 'tshape', label: 'T型凸出房间', icon: '┬' },
];

const COMPONENT_PRESETS: Record<string, { label: string; defaultW: number; defaultH: number; color: string; minW?: number; maxW?: number; minH?: number; maxH?: number }> = {
  door: { label: '门洞', defaultW: 800, defaultH: 200, color: '#1890ff', minW: 600, maxW: 1500, minH: 180, maxH: 240 },
  window: { label: '窗户', defaultW: 1000, defaultH: 1200, color: '#52c41a', minW: 600, maxW: 2400, minH: 600, maxH: 2000 },
  column: { label: '柱子', defaultW: 400, defaultH: 400, color: '#ff4d4f', minW: 200, maxW: 800, minH: 200, maxH: 800 },
  bay_window: { label: '飘窗', defaultW: 1800, defaultH: 600, color: '#722ed1', minW: 1200, maxW: 3000, minH: 400, maxH: 1000 },
};

let compIdCounter = 0;

const ProRoomEditor: React.FC<{
  polygon: number[][];
  onChange: (polygon: number[][]) => void;
  onComponentsChange?: (comps: any[]) => void;
  width?: number;
  height?: number;
}> = ({ polygon, onChange, onComponentsChange, width = 900, height = 580 }) => {

  const stageRef = useRef<Konva.Stage>(null);
  
  const [points, setPoints] = useState<number[][]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [wallThickness, setWallThickness] = useState<number>(120);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState<Point2D>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToOrtho, setSnapToOrtho] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [activeTool, setActiveTool] = useState<string>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [lastPointerPos, setLastPointerPos] = useState<Point2D>({ x: 0, y: 0 });
  const [tempPoint, setTempPoint] = useState<Point2D | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const [tileWidth, setTileWidth] = useState(800);
  const [tileHeight, setTileHeight] = useState(800);
  const [gapWidth, setGapWidth] = useState(3);
  const [direction, setDirection] = useState('horizontal');

  const [editingCompProps, setEditingCompProps] = useState<any | null>(null);

  useEffect(() => {
    if (polygon && polygon.length > 0) {
      setPoints(polygon);
      saveToHistory(polygon, [], wallThickness);
    }
  }, []);

  const saveToHistory = useCallback((pts: number[][], comps: any[], wt: number) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), { points: JSON.parse(JSON.stringify(pts)), components: JSON.parse(JSON.stringify(comps)), wallThickness: wt }]);
    setHistoryIndex(hi => hi + 1);
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setPoints(prev.points); setComponents(prev.components); setWallThickness(prev.wallThickness);
      setHistoryIndex(hi => hi - 1);
      onChange(prev.points); onComponentsChange?.(prev.components);
    }
  };
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setPoints(next.points); setComponents(next.components); setWallThickness(next.wallThickness);
      setHistoryIndex(hi => hi + 1);
      onChange(next.points); onComponentsChange?.(next.components);
    }
  };

  const getPointerPosition = (): Point2D | null => {
    const stage = stageRef.current; if (!stage) return null;
    const pos = stage.getPointerPosition(); if (!pos) return null;
    let px = (pos.x - stagePos.x) / scale, py = (pos.y - stagePos.y) / scale;
    if (snapToGrid) { px = Math.round(px / GRID_SIZE) * GRID_SIZE; py = Math.round(py / GRID_SIZE) * GRID_SIZE; }
    return { x: px, y: py };
  };

  const snapAngle = (current: Point2D, ref: Point2D): Point2D => {
    if (!snapToOrtho || !ref) return current;
    const dx = current.x - ref.x, dy = current.y - ref.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const snapped = Math.round(angle / SNAP_ANGLE) * SNAP_ANGLE;
    const rad = snapped * Math.PI / 180;
    return { x: ref.x + Math.cos(rad) * dist, y: ref.y + Math.sin(rad) * dist };
  };

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2 || isDraggingStage) return;
    
    if (activeTool === 'draw') {
      const rawPos = getPointerPosition(); if (!rawPos) return;
      let finalPos = rawPos;
      if (points.length >= 1 && snapToOrtho) {
        const lastPt = points[points.length - 1];
        finalPos = snapAngle(rawPos, lastPt);
        if (Math.abs(finalPos.x - lastPt.x) < ORTHO_THRESHOLD / scale) finalPos.x = lastPt.x;
        if (Math.abs(finalPos.y - lastPt.y) < ORTHO_THRESHOLD / scale) finalPos.y = lastPt.y;
      }
      setPoints(prev => {
        const newPts = [...prev, [finalPos.x, finalPos.y]];
        onChange(newPts);
        return newPts;
      });
      setTempPoint(null);
    } else if (['door','window','column','bay_window'].includes(activeTool)) {
      const pos = getPointerPosition(); if (!pos) return;
      addComponent(activeTool, pos.x, pos.y);
    } else if (activeTool === 'select') {
      setSelectedPointIndex(null); setSelectedComponentId(null); setSelectedEdgeIndex(null);
    }
  };

  const handleMouseMove = (e: any) => {
    if (isDrawing && activeTool === 'draw') {
      const rawPos = getPointerPosition(); if (!rawPos) return;
      let finalPos = rawPos;
      if (points.length >= 1 && snapToOrtho) {
        const lastPt = points[points.length - 1];
        finalPos = snapAngle(rawPos, lastPt);
        if (Math.abs(finalPos.x - lastPt.x) < ORTHO_THRESHOLD / scale) finalPos.x = lastPt.x;
        if (Math.abs(finalPos.y - lastPt.y) < ORTHO_THRESHOLD / scale) finalPos.y = lastPt.y;
      }
      setTempPoint(finalPos);
    }
    if (isDraggingStage) {
      const dx = e.evt.clientX - lastPointerPos.x, dy = e.evt.clientY - lastPointerPos.y;
      setStagePos(p => ({ x: p.x + dx, y: p.y + dy }));
      setLastPointerPos({ x: e.evt.clientX, y: e.evt.clientY });
    }
  };

  const handleRightClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    if ((isDrawing || activeTool === 'draw') && points.length >= 3) {
      completePolygon();
    } else if (isDrawing || activeTool === 'draw') {
      setIsDrawing(false); setActiveTool('select'); message.info('已退出绘制模式');
    }
    setTempPoint(null);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 0 && activeTool === 'select') {
      const clickedOnEmpty = !e.target || e.target.name() === 'stage-bg';
      if (clickedOnEmpty) { setIsDraggingStage(true); setLastPointerPos({ x: e.evt.clientX, y: e.evt.clientY }); }
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current; if (!stage) return;
    const oldScale = scale, pointer = stage.getPointerPosition(); if (!pointer) return;
    const mousePointTo = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale };
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.05, Math.min(20, oldScale * (1 + dir * 0.12)));
    setScale(newScale);
    setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  };

  const completePolygon = () => {
    if (points.length < 3) { message.warning('至少需要3个顶点'); return; }
    setIsDrawing(false); setActiveTool('select');
    setTempPoint(null);
    saveToHistory(points, components, wallThickness);
    message.success(`绘制完成！${points.length}边形`);
  };

  const applyTemplate = (key: string) => {
    const cx = width / 2 / scale, cy = height / 2 / scale;
    let pts: number[][] = [];
    switch (key) {
      case 'rect': pts = [[cx-2500,cy-2000],[cx+2500,cy-2000],[cx+2500,cy+2000],[cx-2500,cy+2000]]; break;
      case 'lshape': pts = [[cx-2000,cy-2500],[cx+1500,cy-2500],[cx+1500,cy+500],[cx+3500,cy+500],[cx+3500,cy+2500],[cx-2000,cy+2500]]; break;
      case 'tshape': pts = [[cx-1500,cy-2500],[cx+1500,cy-2500],[cx+1500,cy],[cx+3000,cy],[cx+3000,cy+2500],[cx-1500,cy+2500]]; break;
      default: setActiveTool('draw'); setIsDrawing(true); return;
    }
    setPoints(pts); onChange(pts); saveToHistory(pts, components, wallThickness);
    setActiveTool('select'); setIsDrawing(false);
    message.success(`已应用「${PRESET_TEMPLATES.find(t=>t.key===key)?.label}」模板`);
  };

  const addComponent = (type: string, x: number, y: number) => {
    const preset = COMPONENT_PRESETS[type]; if (!preset) return;
    const comp = {
      id: `comp_${Date.now()}_${++compIdCounter}`, type,
      x: x - preset.defaultW / 2, y: y - preset.defaultH / 2,
      width: preset.defaultW, height: preset.defaultH, rotation: 0,
      label: `${preset.label}${components.filter(c=>c.type===type).length + 1}`,
    };
    setComponents(prev => {
      const newComps = [...prev, comp];
      saveToHistory(points, newComps, wallThickness);
      onComponentsChange?.(newComps);
      return newComps;
    });
    setSelectedComponentId(comp.id);
    setEditingCompProps(comp);
  };

  const deleteSelected = () => {
    if (selectedComponentId) {
      setComponents(prev => {
        const nc = prev.filter(c => c.id !== selectedComponentId);
        saveToHistory(points, nc, wallThickness);
        onComponentsChange?.(nc);
        return nc;
      });
      setSelectedComponentId(null); setEditingCompProps(null);
    } else if (selectedPointIndex !== null && points.length > 3) {
      setPoints(prev => {
        const np = prev.filter((_, i) => i !== selectedPointIndex);
        onChange(np); saveToHistory(np, components, wallThickness);
        return np;
      });
      setSelectedPointIndex(null);
    }
  };

  const clearAll = () => {
    setPoints([]); setComponents([]); setTempPoint(null); onChange([]); onComponentsChange?.([]);
    setIsDrawing(false); setActiveTool('select'); setHistory([]); setHistoryIndex(-1);
    message.success('已清空');
  };

  const updateCompSize = (id: string, newW: number, newH: number) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, width: newW, height: newH } : c));
    if (editingCompProps?.id === id) setEditingCompProps(p => ({ ...p, width: newW, height: newH }));
  };

  const updateCompPos = (id: string, newX: number, newY: number) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, x: newX, y: newY } : c));
  };

  const handleOCRUpload = async (file: UploadFile) => {
    setOcrModalVisible(true); setOcrLoading(true); setOcrProgress(10);
    try {
      const fd = new FormData(); fd.append('file', file as File);
      setTimeout(() => setOcrProgress(40), 500);
      const resp = await fetch('/api/v1/sketch/recognize', { method: 'POST', body: fd });
      setOcrProgress(80);
      if (resp.ok) {
        const result = await resp.json();
        if (result.data?.polygon) {
          setPoints(result.data.polygon); onChange(result.data.polygon);
          saveToHistory(result.data.polygon, components, wallThickness);
          setOcrProgress(100); message.success(`OCR识别成功！检测到 ${result.data.polygon.length} 个顶点`);
          setTimeout(() => { setOcrModalVisible(false); setOcrLoading(false); }, 1500);
        } else throw new Error('未检测到有效轮廓');
      } else throw new Error('请求失败');
    } catch (err: any) {
      setOcrLoading(false); setOcrProgress(0);
      message.warning('OCR服务未连接，使用模拟数据演示');
      const mock: number[][] = [[200,100],[700,80],[720,420],[150,440]];
      setPoints(mock); onChange(mock); saveToHistory(mock, components, wallThickness);
      setOcrModalVisible(false);
    }
    return false;
  };

  const vertexCount = points.length;
  const roomStats = useMemo(() => {
    if (vertexCount < 3) return null;
    const xs = points.map(p=>p[0]), ys = points.map(p=>p[1]);
    const w = Math.max(...xs)-Math.min(...xs), h = Math.max(...ys)-Math.min(...ys);
    let area = 0, perimeter = 0;
    for (let i=0;i<vertexCount;i++) {
      const j=(i+1)%vertexCount;
      area += points[i][0]*points[j][1]-points[j][0]*points[i][1];
      const dx=points[j][0]-points[i][0], dy=points[j][1]-points[i][1];
      perimeter += Math.sqrt(dx*dx+dy*dy);
    }
    area = Math.abs(area)/2;
    return { width: w, height: h, area: area/1000000, perimeter: Math.round(perimeter), edgeLengths: Array.from({length: vertexCount}, (_, i) => {
      const j=(i+1)%vertexCount; const dx=points[j][0]-points[i][0], dy=points[j][1]-points[i][1]; return Math.round(Math.sqrt(dx*dx+dy*dy));
    })};
  }, [points]);

  const renderGrid = () => {
    if (!showGrid) return null;
    const lines: JSX.Element[] = [];
    const sx = Math.floor(-stagePos.x/scale/GRID_SIZE)*GRID_SIZE-GRID_SIZE, sy = Math.floor(-stagePos.y/scale/GRID_SIZE)*GRID_SIZE-GRID_SIZE;
    const ex=sx+width/scale+GRID_SIZE*3, ey=sy+height/scale+GRID_SIZE*3;
    for (let x=sx;x<=ex;x+=GRID_SIZE) lines.push(<Line key={`gv-${x}`} points={[x,sy,x,ey]} stroke="#e8e8e8" strokeWidth={0.5/scale} listening={false}/>);
    for (let y=sy;y<=ey;y+=GRID_SIZE) lines.push(<Line key={`gh-${y}`} points={[sx,y,ex,y]} stroke="#e8e8e8" strokeWidth={0.5/scale} listening={false}/>);
    return <>{lines}</>;
  };

  const renderPreviewLine = () => {
    if (!isDrawing || !tempPoint || points.length===0) return null;
    const lastPt = points[points.length-1];
    const dx=tempPoint.x-lastPt.x, dy=tempPoint.y-lastPt.y, len=Math.sqrt(dx*dx+dy*dy);
    
    let snappedText = '';
    if (snapToOrtho && Math.abs(tempPoint.x - lastPt.x) < ORTHO_THRESHOLD / scale) {
      snappedText = ' (垂直)';
    } else if (snapToOrtho && Math.abs(tempPoint.y - lastPt.y) < ORTHO_THRESHOLD / scale) {
      snappedText = ' (水平)';
    }
    
    return (
      <>
        <Line points={[lastPt.x,lastPt.y,tempPoint.x,tempPoint.y]} stroke="#ff7a45" strokeWidth={2.5/scale} dash={[8/scale,4/scale]} listening={false}/>
        
        {snapToOrtho && (
          <>
            <Line points={[lastPt.x, lastPt.y-5000/scale, lastPt.x, lastPt.y+5000/scale]} stroke="#1890ff" strokeWidth={0.8/scale} dash={[4/scale,3/scale]} opacity={0.5} listening={false}/>
            <Line points={[lastPt.x-5000/scale, lastPt.y, lastPt.x+5000/scale, lastPt.y]} stroke="#1890ff" strokeWidth={0.8/scale} dash={[4/scale,3/scale]} opacity={0.5} listening={false}/>
          </>
        )}
        
        <Circle x={tempPoint.x} y={tempPoint.y} radius={7/scale} fill="#ff7a45" stroke="#fff" strokeWidth={2/scale} listening={false}/>
        <Group>
          <Rect x={(lastPt.x+tempPoint.x)/2-42} y={(lastPt.y+tempPoint.y)/2-14} width={84} height={28} fill="rgba(255,122,69,0.95)" cornerRadius={6} listening={false}
            shadowColor="#000" shadowBlur={4} shadowOpacity={0.15}/>
          <Text x={(lastPt.x+tempPoint.x)/2} y={(lastPt.y+tempPoint.y)/2} text={`${Math.round(len)}mm${snappedText}`} fontSize={12/scale} fill="#fff" fontWeight="bold" align="center" verticalAlign="middle" listening={false}/>
        </Group>
      </>
    );
  };

  const renderGuideLines = () => {
    if (!isDrawing || !tempPoint || points.length === 0 || !snapToGrid) return null;
    const lines: JSX.Element[] = [];
    
    points.forEach((pt, i) => {
      if (Math.abs(tempPoint.x - pt[0]) < SNAP_DISTANCE * 3 / scale) {
        lines.push(<Line key={`gv-${i}`} points={[pt[0], -20000, pt[0], 20000]} stroke="#52c41a" strokeWidth={1/scale} dash={[6/scale,3/scale]} opacity={0.6} listening={false}/>);
      }
      if (Math.abs(tempPoint.y - pt[1]) < SNAP_DISTANCE * 3 / scale) {
        lines.push(<Line key={`gh-${i}`} points={[-20000, pt[1], 20000, pt[1]]} stroke="#52c41a" strokeWidth={1/scale} dash={[6/scale,3/scale]} opacity={0.6} listening={false}/>);
      }
    });
    
    return <>{lines}</>;
  };

  const renderWallPolyline = () => {
    if (points.length < 2) return null;
    const closed = !isDrawing && points.length >= 3;
    const linePoints = closed ? [...points.flat(), points[0][0], points[0][1]] : points.flat();
    
    return (
      <>
        <Line
          points={linePoints}
          fill={closed ? 'rgba(26,54,93,0.06)' : undefined}
          stroke="#1a365d"
          strokeWidth={wallThickness / scale}
          lineCap="round"
          lineJoin="round"
        />
        {closed && points.map((_, i) => {
          const j = (i+1) % points.length;
          const mx = (points[i][0]+points[j][0])/2, my = (points[i][1]+points[j][1])/2;
          const dx=points[j][0]-points[i][0], dy=points[j][1]-points[i][1], len=Math.round(Math.sqrt(dx*dx+dy*dy));
          const angle=Math.atan2(dy,dx)*180/Math.PI;
          
          return (
            <Group key={`elbl-${i}`}>
              <Rect
                x={mx-38} y={my-14} width={76} height={28}
                fill="white" cornerRadius={6}
                shadowColor="#000" shadowBlur={6} shadowOpacity={0.12}
                listening={false}
                onClick={() => { setSelectedEdgeIndex(i); }}
              />
              <Text x={mx} y={my} text={`${len}mm`} fontSize={12/scale} fill="#1890ff"
                fontStyle="bold" align="center" verticalAlign="middle" listening={false}
              />
              {selectedEdgeIndex === i && (
                <Rect x={mx-42} y={my-18} width={84} height={36}
                  fill="transparent" stroke="#1890ff" strokeWidth={1.5} dash={[4,3]} listening={false}
                />
              )}
            </Group>
          );
        })}
      </>
    );
  };

  const renderVertices = () => {
    return points.map((pt, i) => (
      <Group key={`pt-${i}`}>
        <Circle
          x={pt[0]} y={pt[1]}
          radius={selectedPointIndex===i ? 10/scale : 7/scale}
          fill={selectedPointIndex===i ? '#52c41a' : '#fff'}
          stroke="#1a365d"
          strokeWidth={2.5/scale}
          draggable
          onDragStart={() => setSelectedPointIndex(i)}
          onDragMove={(e:any) => {
            let x=e.target.x(), y=e.target.y();
            if (snapToGrid) { x=Math.round(x/GRID_SIZE)*GRID_SIZE; y=Math.round(y/GRID_SIZE)*GRID_SIZE; }
            e.target.position({x,y});
            setPoints(prev=>{
              const np=[...prev]; np[i]=[x,y]; onChange(np); return np;
            });
          }}
          onDragEnd={() => { setSelectedPointIndex(null); saveToHistory(points, components, wallThickness); }}
          onDblClick={() => {
            if (points.length > 3) {
              const newPoints = points.filter((_, idx) => idx !== i);
              setPoints(newPoints);
              onChange(newPoints);
              saveToHistory(newPoints, components, wallThickness);
            }
          }}
        />
        <Text x={pt[0]+12/scale} y={pt[1]-10/scale} text={`${i+1}`} fontSize={11/scale} fill="#666" fontWeight="bold" listening={false}/>
        {i===0&&points.length>=3 && <Text x={pt[0]+12/scale} y={pt[1]+6/scale} text="(起点)" fontSize={9/scale} fill="#999" fontStyle="italic" listening={false}/>}
      </Group>
    ));
  };

  const renderComponents = () => components.map(comp => {
    const isSelected = comp.id === selectedComponentId;
    const preset = COMPONENT_PRESETS[comp.type] || { color: '#999' };
    
    return (
      <Group
        key={comp.id}
        id={comp.id}
        draggable
        x={comp.x} y={comp.y}
        onClick={(e:Konva.KonvaEventObject)=>{e.cancelBubble=true;setSelectedComponentId(comp.id);setEditingCompProps(comp);}}
        onTap={(e:Konva.KonvaEventObject)=>{e.cancelBubble=true;setSelectedComponentId(comp.id);setEditingCompProps(comp);}}
        onDragEnd={(e:Konva.KonvaEventObject)=>{
          updateCompPos(comp.id, e.target.x(), e.target.y());
        }}
      >
        <Rect
          width={comp.width} height={comp.height}
          fill={isSelected ? preset.color+'30' : preset.color+'18'}
          stroke={isSelected ? preset.color : preset.color+'88'}
          strokeWidth={isSelected ? 2.5 : 1.5}
          dash={comp.type==='door'?[8,4]:undefined}
          cornerRadius={comp.type==='column'?4:0}
        />
        
        <Text
          text={comp.label}
          fontSize={Math.max(10, Math.min(comp.width,comp.height)*0.28)}
          fill={preset.color} align="center" verticalAlign="middle"
          x={comp.width/2} y={comp.height/2} listening={false}
        />
        
        {isSelected && (
          <>
            <Rect x={-6} y={-6} width={comp.width+12} height={comp.height+12} fill="transparent" stroke={preset.color} strokeWidth={1.5} dash={[5,3]} listening={false}/>
            
            <Circle x={0} y={comp.height/2} r={8/scale} fill={preset.color} stroke="#fff" strokeWidth={1.5/scale}
              onMouseEnter={()=>document.body.style.cursor='ew-resize'}
              onMouseLeave={()=>document.body.style.cursor='default'}
              onDragMove={(e:any)=>{
                const newW = Math.max((preset?.minW||100), Math.min(preset?.maxW||5000, comp.width + e.evt.movementX / scale));
                updateCompSize(comp.id, newW, comp.height);
                e.target.x(newW);
              }}
              dragBoundFunc={(pos)=>({x: Math.max((preset?.minW||100)/2, pos.x), y: pos.y})}
            />
            <Circle x={comp.width} y={comp.height/2} r={8/scale} fill={preset.color} stroke="#fff" strokeWidth={1.5/scale}
              onMouseEnter={()=>document.body.style.cursor='ew-resize'}
              onMouseLeave={()=>document.body.style.cursor='default'}
              onDragMove={(e:any)=>{
                const newW = Math.max((preset?.minW||100), Math.min(preset?.maxW||5000, comp.width + e.evt.movementX / scale));
                updateCompSize(comp.id, newW, comp.height);
              }}
              dragBoundFunc={(pos)=>({x: Math.min(pos.x, (preset?.maxW||5000)/2), y: pos.y})}
            />
            
            <Circle x={comp.width/2} y={0} r={8/scale} fill={preset.color} stroke="#fff" strokeWidth={1.5/scale}
              onMouseEnter={()=>document.body.style.cursor='ns-resize'}
              onMouseLeave={()=>document.body.style.cursor='default'}
              onDragMove={(e:any)=>{
                const newH = Math.max((preset?.minH||100), Math.min(preset?.maxH||5000, comp.height + e.evt.movementY / scale));
                updateCompSize(comp.id, comp.width, newH);
                e.target.y(newH);
              }}
              dragBoundFunc={(pos)=>({x: pos.x, y: Math.max((preset?.minH||100)/2, pos.y)})}
            />
            <Circle x={comp.width/2} y={comp.height} r={8/scale} fill={preset.color} stroke="#fff" strokeWidth={1.5/scale}
              onMouseEnter={()=>document.body.style.cursor='ns-resize'}
              onMouseLeave={()=>document.body.style.cursor='default'}
              onDragMove={(e:any)=>{
                const newH = Math.max((preset?.minH||100), Math.min(preset?.maxH||5000, comp.height + e.evt.movementY / scale));
                updateCompSize(comp.id, comp.width, newH);
              }}
              dragBoundFunc={(pos)=>({x: pos.x, y: Math.min(pos.y, (preset?.maxH||5000)/2)})}
            />
          </>
        )}
      </Group>
    );
  });

  return (
    <div style={{ userSelect: 'none', display: 'flex', gap: 16, height: '100%' }}>
      
      {/* 左侧工具栏 */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* 快速操作 */}
        <Card size="small" title="快速操作">
          <Space direction="vertical" style={{width:'100%'}} size="small">
            <Dropdown menu={{items: PRESET_TEMPLATES.map(t=>({
              key:t.key, label:<span>{t.icon} {t.label}</span>, onClick:()=>applyTemplate(t.key)
            }))}}>
              <Button block type="primary"><PlusOutlined /> 快速模板</Button>
            </Dropdown>
            
            <Space wrap style={{justifyContent:'center'}}>
              <Tooltip title="撤销"><Button icon={<UndoOutlined/>} size="small" onClick={undo} disabled={historyIndex<=0}/></Tooltip>
              <Tooltip title="重做"><Button icon={<RedoOutlined/>} size="small" onClick={redo} disabled={historyIndex>=history.length-1}/></Tooltip>
              <Divider type="vertical"/>
              <Tooltip title="放大"><Button icon={<ZoomInOutlined/>} size="small" onClick={()=>setScale(s=>Math.min(20,s*1.25))}/></Tooltip>
              <Tooltip title="缩小"><Button icon={<ZoomOutOutlined/>} size="small" onClick={()=>setScale(s=>Math.max(0.05,s/1.25))}/></Tooltip>
              <Tooltip title="适应屏幕"><Button icon={<ExpandOutlined/>} size="small" onClick={()=>{
                if(vertexCount>=3){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
                  const cw=Math.max(...xs)-Math.min(...xs),ch=Math.max(...ys)-Math.min(...ys);
                  const ns=Math.min(width*0.75/cw,height*0.75/ch);setScale(ns);
                  setStagePos({x:(width-cw*ns)/2-Math.min(...xs)*ns,y:(height-ch*ns)/2-Math.min(...ys)*ns});
                }
              }}/></Tooltip>
            </Space>

            <Space wrap style={{justifyContent:'center'}}>
              <Button size="small" type={showGrid?'primary':'default'} icon={showGrid?<EyeOutlined/>:<EyeInvisibleOutlined/>} onClick={()=>setShowGrid(!showGrid)}>网格</Button>
              <Button size="small" type={snapToOrtho?'primary':'default'} onClick={()=>setSnapToOrtho(!snapToOrtho)}>正交</Button>
              <Button size="small" danger icon={<DeleteOutlined/>} onClick={deleteSelected} disabled={!selectedComponentId && selectedPointIndex===null}>删除</Button>
              <Button size="small" danger onClick={clearAll}>清空</Button>
            </Space>
          </Space>
        </Card>

        {/* 绘制工具 */}
        <Card size="small" title="绘制工具">
          <Space direction="vertical" style={{width:'100%'}} size="small">
            <Space wrap style={{justifyContent:'center'}}>
              <Button size={activeTool==='select'?'small':'small'} type={activeTool==='select'?'primary':'default'} icon={<DragOutlined/>} onClick={()=>{setActiveTool('select');setIsDrawing(false);}}>选择</Button>
              <Button size={activeTool==='draw'?'small':'small'} type={activeTool==='draw'?'primary':'default'} onClick={()=>{setActiveTool('draw');setIsDrawing(true);message.info('点击添加顶点，右键完成');}}>✏️ 画墙</Button>
            </Space>
            <Divider style={{margin:'4px 0'}}/>
            <Space wrap style={{justifyContent:'center'}}>
              <Button size="small" type={activeTool==='door'?'primary':'default'} onClick={()=>{setActiveTool('door');setIsDrawing(false);}}>🚪 门洞</Button>
              <Button size="small" type={activeTool==='window'?'primary':'default'} onClick={()=>{setActiveTool('window');setIsDrawing(false);}}>🪟 窗户</Button>
              <Button size="small" type={activeTool==='column'?'primary':'default'} onClick={()=>{setActiveTool('column');setIsDrawing(false);}}>▮ 柱子</Button>
              <Button size="small" type={activeTool==='bay_window'?'primary':'default'} onClick={()=>{setActiveTool('bay_window');setIsDrawing(false);}}>⬡ 飘窗</Button>
            </Space>
            <Divider style={{margin:'4px 0'}}/>
            <Upload accept="image/*" showUploadList={false} beforeUpload={handleOCRUpload}>
              <Button block size="small" icon={<CameraOutlined />} type="dashed">🤖 AI识别手绘图</Button>
            </Upload>
          </Space>
        </Card>

        {/* 墙体参数 */}
        <Card size="small" title="墙体参数">
          <Space direction="vertical" style={{width:'100%'}} size="small">
            <div><AntText type="secondary">墙厚：</AntText></div>
            <Slider min={60} max={300} step={10} value={wallThickness} onChange={(v: number) => { setWallThickness(v); saveToHistory(points, components, v); }}
              marks={{60:'60',120:'120★',200:'200',300:'300'}}
            />
            <div style={{textAlign:'center',fontSize:12,color:'#888'}}>{wallThickness} mm</div>
          </Space>
        </Card>

        {/* 瓷砖规格 */}
        <Card size="small" title="瓷砖规格">
          <Space direction="vertical" style={{width:'100%'}} size="small">
            <Select value={`${tileWidth}×${tileHeight}`} style={{width:'100%'}} onChange={(v: string) => {
              const p = TILE_PRESETS.find(t => `${t.w}×${t.h}` === v);
              if (p) { setTileWidth(p.w); setTileHeight(p.h); }
            }}>
              {TILE_PRESETS.map(t => <Option key={`${t.w}×${t.h}`} value={`${t.w}×${t.h}`}>{t.label}</Option>)}
              <Option value="custom">自定义</Option>
            </Select>
            <Row gutter={8}>
              <Col span={12}>
                <InputNumber addonBefore="长" value={tileWidth} min={50} max={3000} step={50} style={{width:'100%'}} onChange={(v: number | null) => setTileWidth(v || 800)} size="small"/>
              </Col>
              <Col span={12}>
                <InputNumber addonBefore="宽" value={tileHeight} min={50} max={3000} step={50} style={{width:'100%'}} onChange={(v: number | null) => setTileHeight(v || 800)} size="small"/>
              </Col>
            </Row>
            <div><AntText type="secondary">留缝：</AntText>
              <Select value={gapWidth} size="small" style={{width:90}} onChange={(v: number) => setGapWidth(v || 3)}>
                <Option value={1}>1mm</Option><Option value={2}>2mm</Option><Option value={3}>3mm★</Option><Option value={5}>5mm</Option>
              </Select>
              <AntText type="secondary" style={{marginLeft:8}}>方向：</AntText>
              <Select value={direction} size="small" style={{width:90}} onChange={(v: string) => setDirection(v || 'horizontal')}>
                <Option value="horizontal">横</Option><Option value="vertical">纵</Option><Option value="diagonal">斜</Option>
              </Select>
            </div>
          </Space>
        </Card>

        {/* 构件属性编辑 */}
        {editingCompProps && (
          <Card size="small" title={`编辑：${editingCompProps.label}`} size="small" extra={<Button size="small" type="link" danger onClick={()=>{setEditingCompProps(null);setSelectedComponentId(null);}}>关闭</Button>}>
            <Space direction="vertical" style={{width:'100%'}} size="small">
              <Row gutter={8}>
                <Col span={12}>
                  <div><AntText type="secondary">宽度(mm)</AntText></div>
                  <InputNumber value={editingCompProps.width} min={COMPONENT_PRESETS[editingCompProps.type]?.minW||100} max={COMPONENT_PRESETS[editingCompProps.type]?.maxW||5000} step={10} style={{width:'100%'}} size="small"
                    onChange={(v: any) => { if (v) updateCompSize(editingCompProps.id, v, editingCompProps.height); }}/>
                </Col>
                <Col span={12}>
                  <div><AntText type="secondary">高度(mm)</AntText></div>
                  <InputNumber value={editingCompProps.height} min={COMPONENT_PRESETS[editingCompProps.type]?.minH||100} max={COMPONENT_PRESETS[editingCompProps.type]?.maxH||5000} step={10} style={{width:'100%'}} size="small"
                    onChange={(v: any) => { if (v) updateCompSize(editingCompProps.id, editingCompProps.width, v); }}/>
                </Col>
              </Row>
              <div><AntText type="secondary" style={{fontSize:11}}>提示：选中构件后可拖拽边缘调整大小</AntText></div>
              
              {editingCompProps.type==='door' && (
                <div style={{marginTop:8,padding:8,background:'#f0f5ff',borderRadius:6,fontSize:12}}>
                  <AntText strong>🚪 门洞说明</AntText><br/>
                  • 标准门宽：800-900mm<br/>
                  • 标准门高：2000mm（此处显示的是门洞开口高度）
                </div>
              )}
              {editingCompProps.type==='window' && (
                <div style={{marginTop:8,padding:8,background:'#f6ffed',borderRadius:6,fontSize:12}}>
                  <AntText strong>🪟 窗户说明</AntText><br/>
                  • 常见窗宽：900-1800mm<br/>
                  • 常见窗高：1200-1500mm
                </div>
              )}
            </Space>
          </Card>
        )}

        {/* 房间信息 */}
        {roomStats && (
          <Card size="small" title="📊 房间信息">
            <Space direction="vertical" style={{width:'100%'}} size={2}>
              <Row>
                <Col span={12}><AntText type="secondary">面积：</AntText><strong>{roomStats.area.toFixed(2)} m²</strong></Col>
                <Col span={12}><AntText type="secondary">周长：</AntText><strong>{roomStats.perimeter} mm</strong></Col>
              </Row>
              <Row>
                <Col span={12}><AntText type="secondary">宽度：</AntText><strong>{roomStats.width.toFixed(0)} mm</strong></Col>
                <Col span={12}><AntText type="secondary">高度：</AntText><strong>{roomStats.height.toFixed(0)} mm</strong></Col>
              </Row>
              <Divider style={{margin:'4px 0'}}/>
              <div><AntText type="secondary">各边长度：</AntText></div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {roomStats.edgeLengths.map((len,i)=><Tag key={i} color="blue">{len}mm</Tag>)}
              </div>
              <div style={{marginTop:4}}>
                <AntText type="secondary">顶点数：</AntText><Tag color={vertexCount>=3?'success':'default'}>{vertexCount}</Tag>
                <AntText type="secondary" style={{marginLeft:8}}>构件：</AntText><Tag color={components.length>0?'processing':'default'}>{components.length}</Tag>
              </div>
            </Space>
          </Card>
        )}
      </div>

      {/* 右侧画布区域 */}
      <div style={{flex:1, display:'flex',flexDirection:'column',gap:8,minWidth:0}}>
        
        {(isDrawing||activeTool==='draw') && (
          <div style={{
            background:'#fff7e6',border:'1px solid #ffd591',borderRadius:6,padding:'6px 12px',
            display:'flex',gap:16,alignItems:'center',fontSize:13,color:'#d46b08'
          }}>
            <span>✏️ <strong>绘制中</strong></span>
            <span>| 点击添加顶点，线条自动正交吸附</span>
            <span>| 右键完成绘制</span>
            <span>| 已有 {vertexCount} 个顶点</span>
            {vertexCount>=3 && <span style={{color:'#52c41a'}}>✓ 可右键闭合</span>}
          </div>
        )}

        <div
          style={{
            border:'2px solid #d9d9d9',borderRadius:10,backgroundColor:'#fafbfc',
            overflow:'hidden',position:'relative',flex:1,minHeight:480,
            cursor: isDrawing?'crosshair':activeTool==='select'?(isDraggingStage?'grabbing':'grab'):'crosshair'
          }}
          onContextMenu={(e:React.MouseEvent)=>e.preventDefault()}
        >
          <Stage
            ref={stageRef} width={width} height={height}
            onClick={handleStageClick as any} onContextMenu={handleRightClick as any}
            onMouseDown={handleMouseDown as any} onMouseUp={()=>setIsDraggingStage(false)}
            onMouseMove={handleMouseMove as any} onWheel={handleWheel as any}
            scaleX={scale} scaleY={scale} x={stagePos.x} y={stagePos.y}
          >
            <Layer name="grid">{renderGrid()}</Layer>
            <Layer name="main">
              <Rect name="stage-bg" x={-20000} y={-20000} width={40000} height={40000} fill="transparent" listening/>
              {renderGuideLines()}
              {renderPreviewLine()}
              {renderWallPolyline()}
              {renderComponents()}
              {renderVertices()}
              {!isDrawing && activeTool!=='draw' && vertexCount===0 && (
                <Group>
                  <Rect x={width/2/scale-180} y={height/2/scale-35} width={360} height={70} fill="rgba(0,0,0,0.03)" cornerRadius={12} listening={false}/>
                  <Text x={width/2/scale-160} y={height/2/scale-12} text="选择「快速模板」或点击「画墙」开始" fontSize={14/scale} fill="#bbb" listening={false}/>
                </Group>
              )}
            </Layer>
          </Stage>

          <div style={{
            position:'absolute',bottom:12,right:12,
            background:'rgba(255,255,255,0.95)',padding:'6px 14px',borderRadius:8,
            fontSize:12,color:'#555',boxShadow:'0 2px 12px rgba(0,0,0,0.1)',
            display:'flex',gap:12,fontFamily:'monospace'
          }}>
            <span>{(scale*100).toFixed(0)}%</span>
            <span style={{color:'#ddd'}}>|</span>
            <span>{isDrawing?'✏️绘制中':activeTool==='select'?'👆选择':`🔧${activeTool}`}</span>
            {snapToOrtho && <span style={{color:'#1890ff'}}>正交</span>}
            {snapToGrid && <span style={{color:'#52c41a'}}>网格</span>}
            <span style={{color:'#ddd'}}>|</span>
            <span>墙厚:{wallThickness}</span>
          </div>
        </div>

        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
          <Button type="primary" icon={<SaveOutlined/>} disabled={vertexCount<3}>保存方案</Button>
          <Button icon={<EyeOutlined/>} disabled={vertexCount<3}>预览排版</Button>
          {vertexCount>=3 && <Tag color="green">{roomStats?.area.toFixed(2)} m² · {roomStats?.perimeter}mm</Tag>}
        </div>
      </div>

      <Modal title="AI OCR 手绘识别" open={ocrModalVisible} footer={null} closable={!ocrLoading} maskClosable={!ocrLoading}>
        <div style={{textAlign:'center',padding:'30px 0'}}>
          <Spin spinning={ocrLoading} size="large"/>
          <Progress percent={ocrProgress} status={ocrLoading?'active':'success'} style={{marginTop:20}}/>
          <p style={{marginTop:16,color:'#666'}}>{ocrLoading?'正在识别手绘户型图...':'识别完成！'}</p>
        </div>
      </Modal>
    </div>
  );
};

export default ProRoomEditor;
