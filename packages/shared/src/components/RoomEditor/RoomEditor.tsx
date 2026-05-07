import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Circle, Text, Rect, Group } from 'react-konva';
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
} from '@ant-design/icons';

const { Text: AntText, Title } = Typography;
const { Option } = Select;

interface RoomEditorProps {
  polygon: number[][];
  onChange: (polygon: number[][]) => void;
  width?: number;
  height?: number;
  showDimensions?: boolean;
  onDimensionsChange?: (dimensions: { width: number; height: number } | null) => void;
  tileConfig?: {
    tileWidth: number;
    tileHeight: number;
    gapWidth: number;
    direction: string;
  };
  onComponentsChange?: (components: any[]) => void;
}

export interface RoomComponent {
  id: string;
  type: 'door' | 'window' | 'column' | 'bay_window' | 'pillar';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
  properties?: Record<string, any>;
}

interface Point2D {
  x: number;
  y: number;
}

interface HistoryState {
  points: number[][];
  components: RoomComponent[];
}

const SNAP_ANGLE = 15;
const SNAP_DISTANCE = 12;
const ORTHO_THRESHOLD = 8;
const GRID_SIZE = 50;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

let componentIdCounter = 0;

const PRESET_TEMPLATES = [
  { key: 'rect', label: '矩形房间', icon: '▢', desc: '标准矩形户型' },
  { key: 'lshape', label: 'L型房间', icon: '⌐', desc: 'L形转角户型' },
  { key: 'tshape', label: 'T型房间', icon: '┬', desc: 'T形凸出户型' },
  { key: 'custom', label: '自由绘制', icon: '✏', desc: '手动绘制任意形状' },
];

const COMPONENT_PRESETS: Record<string, { label: string; w: number; h: number; color: string }> = {
  door: { label: '门洞(800)', w: 800, h: 200, color: '#1890ff' },
  window: { label: '窗户(1000)', w: 1000, h: 1200, color: '#52c41a' },
  column: { label: '柱子(400)', w: 400, h: 400, color: '#ff4d4f' },
  bay_window: { label: '飘窗(1800)', w: 1800, h: 600, color: '#722ed1' },
};

const RoomEditor: React.FC<RoomEditorProps> = ({
  polygon,
  onChange,
  width = 900,
  height = 550,
  showDimensions = true,
  onDimensionsChange,
  tileConfig,
  onComponentsChange,
}) => {
  const stageRef = useRef<Konva.Stage>(null);

  const [points, setPoints] = useState<number[]>([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState<Point2D>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToOrtho, setSnapToOrtho] = useState(true);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [roomDimensions, setRoomDimensions] = useState<{ width: number; height: number } | null>(null);
  const [edgeLabels, setEdgeLabels] = useState<Array<{ index: number; length: number; midX: number; midY: number; angle: number }>>([]);
  const [components, setComponents] = useState<RoomComponent[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string>('select');
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [lastPointerPos, setLastPointerPos] = useState<Point2D>({ x: 0, y: 0 });
  
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const [guideLines, setGuideLines] = useState<Array<{ type: 'h' | 'v' | 'angle'; pos: number; value: number }>>([]);
  const [tempPoint, setTempPoint] = useState<Point2D | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    if (polygon && polygon.length > 0) {
      const flatPoints: number[] = [];
      polygon.forEach((point) => {
        flatPoints.push(point[0], point[1]);
      });
      setPoints(flatPoints);
      saveToHistory(flatPoints, []);
    }
  }, []);

  useEffect(() => {
    if (points.length >= 6) {
      calculateRoomDimensions();
    } else {
      setRoomDimensions(null);
      setEdgeLabels([]);
      onDimensionsChange?.(null);
    }
  }, [points]);

  const saveToHistory = useCallback((pts: number[], comps: RoomComponent[]) => {
    const polyPts = pointsToPolygon(pts);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), { 
      points: polyPts, 
      components: JSON.parse(JSON.stringify(comps)) 
    }]);
    setHistoryIndex(hi => hi + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      const flatPoints = prev.points.flat();
      setPoints(flatPoints);
      setComponents(JSON.parse(JSON.stringify(prev.components)));
      setHistoryIndex(hi => hi - 1);
      onChange(prev.points);
      onComponentsChange?.(prev.components);
    }
  }, [history, historyIndex, onChange, onComponentsChange]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      const flatPoints = next.points.flat();
      setPoints(flatPoints);
      setComponents(JSON.parse(JSON.stringify(next.components)));
      setHistoryIndex(hi => hi + 1);
      onChange(next.points);
      onComponentsChange?.(next.components);
    }
  }, [history, historyIndex, onChange, onComponentsChange]);

  const calculateRoomDimensions = useCallback(() => {
    if (points.length < 6) return;
    
    const polygonPts = pointsToPolygon(points);
    const xs = polygonPts.map(p => p[0]);
    const ys = polygonPts.map(p => p[1]);
    
    const dims = { 
      width: Math.max(...xs) - Math.min(...xs), 
      height: Math.max(...ys) - Math.min(...ys) 
    };
    setRoomDimensions(dims);
    onDimensionsChange?.(dims);
    
    const labels: Array<{ index: number; length: number; midX: number; midY: number; angle: number }> = [];
    for (let i = 0; i < polygonPts.length; i++) {
      const p1 = polygonPts[i];
      const p2 = polygonPts[(i + 1) % polygonPts.length];
      const len = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
      const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
      labels.push({ 
        index: i, 
        length: Math.round(len),
        midX: (p1[0] + p2[0]) / 2,
        midY: (p1[1] + p2[1]) / 2,
        angle: angle,
      });
    }
    setEdgeLabels(labels);
  }, [points, onDimensionsChange]);

  const pointsToPolygon = useCallback((pts: number[]): Point2D[] => {
    const poly: Point2D[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      poly.push({ x: pts[i], y: pts[i + 1] });
    }
    return poly;
  }, []);

  const snapToAngle = useCallback((currentPoint: Point2D, referencePoint: Point2D): Point2D => {
    if (!snapToOrtho || !referencePoint) return currentPoint;
    
    const dx = currentPoint.x - referencePoint.x;
    const dy = currentPoint.y - referencePoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    const snappedAngle = Math.round(angle / SNAP_ANGLE) * SNAP_ANGLE;
    const snappedRad = snappedAngle * Math.PI / 180;
    
    return {
      x: referencePoint.x + Math.cos(snappedRad) * distance,
      y: referencePoint.y + Math.sin(snappedRad) * distance,
    };
  }, [snapToOrtho]);

  const calculateGuideLines = useCallback((currentPos: Point2D): Array<{ type: 'h' | 'v' | 'angle'; pos: number; value: number }> => {
    const lines: Array<{ type: 'h' | 'v' | 'angle'; pos: number; value: number }> = [];
    const polygonPts = pointsToPolygon(points);
    
    polygonPts.forEach(pt => {
      if (Math.abs(currentPos.x - pt.x) < SNAP_DISTANCE / scale) {
        lines.push({ type: 'v', pos: pt.x, value: pt.x });
      }
      if (Math.abs(currentPos.y - pt.y) < SNAP_DISTANCE / scale) {
        lines.push({ type: 'h', pos: pt.y, value: pt.y });
      }
    });
    
    return lines;
  }, [points, scale]);

  const getPointerPosition = useCallback((): Point2D | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    let px = (pos.x - stagePos.x) / scale;
    let py = (pos.y - stagePos.y) / scale;
    
    if (snapToGrid) {
      px = Math.round(px / GRID_SIZE) * GRID_SIZE;
      py = Math.round(py / GRID_SIZE) * GRID_SIZE;
    }
    
    return { x: px, y: py };
  }, [scale, stagePos, snapToGrid]);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2 || isDraggingStage) return;
    
    if (activeTool === 'draw') {
      const rawPos = getPointerPosition();
      if (!rawPos) return;
      
      let finalPos = rawPos;
      
      if (points.length >= 2 && snapToOrtho) {
        const lastX = points[points.length - 2];
        const lastY = points[points.length - 1];
        const refPoint = { x: lastX, y: lastY };
        finalPos = snapToAngle(rawPos, refPoint);
        
        if (Math.abs(finalPos.x - refPoint.x) < ORTHO_THRESHOLD / scale && 
            Math.abs(finalPos.y - refPoint.y) > ORTHO_THRESHOLD / scale) {
          finalPos.x = refPoint.x;
        } else if (Math.abs(finalPos.y - refPoint.y) < ORTHO_THRESHOLD / scale && 
                   Math.abs(finalPos.x - refPoint.x) > ORTHO_THRESHOLD / scale) {
          finalPos.y = refPoint.y;
        }
      }
      
      setPoints(prev => {
        const newPoints = [...prev, finalPos.x, finalPos.y];
        onChange(pointsToPolygon(newPoints));
        return newPoints;
      });
      
      setGuideLines([]);
      setTempPoint(null);
    } else if (['door', 'window', 'column', 'bay_window'].includes(activeTool)) {
      const pos = getPointerPosition();
      if (!pos) return;
      addComponent(activeTool as RoomComponent['type'], pos.x, pos.y);
    }
  }, [activeTool, isDraggingStage, getPointerPosition, onChange, pointsToPolygon, snapToOrtho, snapToGrid, points, scale]);

  const handleStageMouseMove = useCallback((e: any) => {
    if (isDrawing && activeTool === 'draw') {
      const rawPos = getPointerPosition();
      if (!rawPos) return;
      
      let finalPos = rawPos;
      
      if (points.length >= 2 && snapToOrtho) {
        const lastX = points[points.length - 2];
        const lastY = points[points.length - 1];
        const refPoint = { x: lastX, y: lastY };
        finalPos = snapToAngle(rawPos, refPoint);
        
        if (Math.abs(finalPos.x - refPoint.x) < ORTHO_THRESHOLD / scale && 
            Math.abs(finalPos.y - refPoint.y) > ORTHO_THRESHOLD / scale) {
          finalPos.x = refPoint.x;
        } else if (Math.abs(finalPos.y - refPoint.y) < ORTHO_THRESHOLD / scale && 
                   Math.abs(finalPos.x - refPoint.x) > ORTHO_THRESHOLD / scale) {
          finalPos.y = refPoint.y;
        }
      }
      
      setTempPoint(finalPos);
      setGuideLines(calculateGuideLines(finalPos));
    }

    if (isDraggingStage) {
      const dx = e.evt.clientX - lastPointerPos.x;
      const dy = e.evt.clientY - lastPointerPos.y;
      setStagePos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPointerPos({ x: e.evt.clientX, y: e.evt.clientY });
    }
  }, [isDrawing, activeTool, isDraggingStage, lastPointerPos, getPointerPosition, snapToAngle, snapToOrtho, points, scale, calculateGuideLines]);

  const handleStageRightClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    
    if (isDrawing || activeTool === 'draw') {
      if (points.length >= 6) {
        completePolygon();
      } else {
        setIsDrawing(false);
        setActiveTool('select');
        message.info('已退出绘制模式（至少需要3个顶点）');
      }
      setTempPoint(null);
      setGuideLines([]);
    }
  }, [isDrawing, activeTool, points.length]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 0 && activeTool === 'select') {
      const clickedOnEmpty = !e.target || e.target.name() === 'stage-bg';
      if (clickedOnEmpty) {
        setIsDraggingStage(true);
        setLastPointerPos({ x: e.evt.clientX, y: e.evt.clientY });
        setSelectedComponentId(null);
        setSelectedPointIndex(null);
      }
    }
  }, [activeTool]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingStage(false);
  }, []);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
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

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * (1 + direction * 0.12)));

    setScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [scale, stagePos]);

  const handlePointDrag = useCallback(
    (index: number, x: number, y: number) => {
      if (snapToGrid) {
        x = Math.round(x / GRID_SIZE) * GRID_SIZE;
        y = Math.round(y / GRID_SIZE) * GRID_SIZE;
      }
      setPoints(prev => {
        const newPoints = [...prev];
        newPoints[index * 2] = x;
        newPoints[index * 2 + 1] = y;
        onChange(pointsToPolygon(newPoints));
        return newPoints;
      });
    },
    [onChange, pointsToPolygon, snapToGrid]
  );

  const handlePointDblClick = useCallback(
    (index: number) => {
      if (points.length <= 6) {
        message.warning('多边形至少需要3个顶点');
        return;
      }

      setPoints(prev => {
        const newPoints = [...prev];
        newPoints.splice(index * 2, 2);
        onChange(pointsToPolygon(newPoints));
        saveToHistory(newPoints, components);
        return newPoints;
      });
    },
    [points.length, onChange, pointsToPolygon, saveToHistory, components]
  );

  const toggleDrawMode = useCallback(() => {
    setActiveTool('draw');
    setIsDrawing(true);
    message.info('绘制模式：点击添加顶点，自动正交吸附，右键完成');
  }, []);

  const clearAll = useCallback(() => {
    setPoints([]);
    setComponents([]);
    setTempPoint(null);
    setGuideLines([]);
    onChange([]);
    onComponentsChange?.([]);
    setIsDrawing(false);
    setActiveTool('select');
    setHistory([]);
    setHistoryIndex(-1);
    message.success('已清空画布');
  }, [onChange, onComponentsChange]);

  const completePolygon = useCallback(() => {
    if (points.length < 6) {
      message.warning('至少需要3个顶点才能完成绘制');
      return;
    }
    setIsDrawing(false);
    setActiveTool('select');
    setTempPoint(null);
    setGuideLines([]);
    saveToHistory(points, components);
    message.success('绘制完成！');
  }, [points, components, saveToHistory]);

  const applyTemplate = useCallback((templateKey: string) => {
    setShowTemplateModal(false);
    
    let templatePoints: number[][] = [];
    const centerX = width / 2 / scale;
    const centerY = height / 2 / scale;
    
    switch (templateKey) {
      case 'rect':
        const rw = 5000, rh = 4000;
        templatePoints = [
          [centerX - rw/2, centerY - rh/2],
          [centerX + rw/2, centerY - rh/2],
          [centerX + rw/2, centerY + rh/2],
          [centerX - rw/2, centerY + rh/2],
        ];
        break;
      case 'lshape':
        templatePoints = [
          [centerX - 2000, centerY - 2500],
          [centerX + 1500, centerY - 2500],
          [centerX + 1500, centerY + 500],
          [centerX + 3500, centerY + 500],
          [centerX + 3500, centerY + 2500],
          [centerX - 2000, centerY + 2500],
        ];
        break;
      case 'tshape':
        templatePoints = [
          [centerX - 1500, centerY - 2500],
          [centerX + 1500, centerY - 2500],
          [centerX + 1500, centerY],
          [centerX + 3000, centerY],
          [centerX + 3000, centerY + 2500],
          [centerX - 1500, centerY + 2500],
        ];
        break;
      default:
        setActiveTool('draw');
        setIsDrawing(true);
        return;
    }
    
    const flatPoints = templatePoints.flat();
    setPoints(flatPoints);
    onChange(templatePoints);
    saveToHistory(flatPoints, []);
    setActiveTool('select');
    setIsDrawing(false);
    message.success(`已应用「${PRESET_TEMPLATES.find(t => t.key === templateKey)?.label}」模板`);
  }, [width, height, scale, onChange, saveToHistory]);

  const zoomIn = useCallback(() => setScale(s => Math.min(MAX_SCALE, s * 1.25)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(MIN_SCALE, s / 1.25)), []);
  const resetZoom = useCallback(() => { setScale(1); setStagePos({ x: 0, y: 0 }); }, []);
  
  const fitToScreen = useCallback(() => {
    if (points.length >= 6) {
      const polygonPts = pointsToPolygon(points);
      const xs = polygonPts.map(p => p.x);
      const ys = polygonPts.map(p => p.y);
      const contentW = Math.max(...xs) - Math.min(...xs);
      const contentH = Math.max(...ys) - Math.min(...ys);
      const newScale = Math.min((width * 0.75) / contentW, (height * 0.75) / contentH);
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale)));
      setStagePos({
        x: (width - contentW * newScale) / 2 - Math.min(...xs) * newScale,
        y: (height - contentH * newScale) / 2 - Math.min(...ys) * newScale,
      });
    }
  }, [points, width, height, pointsToPolygon]);

  const addComponent = useCallback((type: RoomComponent['type'], x: number, y: number) => {
    const preset = COMPONENT_PRESETS[type];
    if (!preset) return;

    const newComp: RoomComponent = {
      id: `comp_${Date.now()}_${++componentIdCounter}`,
      type,
      x: x - preset.w / 2,
      y: y - preset.h / 2,
      width: preset.w,
      height: preset.h,
      rotation: 0,
      label: `${type === 'door' ? '门' : type === 'window' ? '窗' : type === 'column' ? '柱' : '飘窗'}${components.filter(c => c.type === type).length + 1}`,
    };

    setComponents(prev => {
      const newComps = [...prev, newComp];
      saveToHistory(points, newComps);
      onComponentsChange?.(newComps);
      return newComps;
    });

    setSelectedComponentId(newComp.id);
    message.success(`已放置 ${newComp.label}`);
  }, [components, points, saveToHistory, onComponentsChange]);

  const deleteSelectedComponent = useCallback(() => {
    if (!selectedComponentId) return;
    
    setComponents(prev => {
      const newComps = prev.filter(c => c.id !== selectedComponentId);
      saveToHistory(points, newComps);
      onComponentsChange?.(newComps);
      return newComps;
    });
    setSelectedComponentId(null);
    message.success('已删除构件');
  }, [selectedComponentId, points, saveToHistory, onComponentsChange]);

  const handleOCRUpload = async (file: UploadFile) => {
    setOcrModalVisible(true);
    setOcrLoading(true);
    setOcrProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file as File);
      setOcrProgress(30);
      
      setTimeout(() => setOcrProgress(50), 500);
      
      const response = await fetch('/api/v1/sketch/recognize', {
        method: 'POST',
        body: formData,
      });

      setOcrProgress(80);

      if (response.ok) {
        const result = await response.json();
        
        if (result.data && result.data.polygon) {
          const flatPoints = result.data.polygon.flat();
          setPoints(flatPoints);
          onChange(result.data.polygon);
          saveToHistory(flatPoints, components);
          setOcrProgress(100);
          message.success(`OCR识别成功！检测到 ${result.data.polygon.length} 个顶点`);
          
          setTimeout(() => {
            setOcrModalVisible(false);
            setOcrLoading(false);
            setOcrProgress(0);
          }, 1500);
        } else {
          throw new Error('未检测到有效轮廓');
        }
      } else {
        throw new Error('OCR服务请求失败');
      }
    } catch (err: any) {
      console.error('OCR识别失败:', err);
      setOcrLoading(false);
      setOcrProgress(0);
      
      if (err.message.includes('fetch') || err.message.includes('network')) {
        message.warning('OCR服务未连接，使用模拟数据演示');
        
        const mockPolygon: number[][] = [
          { x: 200, y: 100 },
          { x: 700, y: 80 },
          { x: 720, y: 420 },
          { x: 150, y: 440 },
        ];
        
        const flatPoints = mockPolygon.flat();
        setPoints(flatPoints);
        onChange(mockPolygon);
        saveToHistory(flatPoints, components);
        message.success('已加载模拟户型数据（4个顶点矩形）');
        setOcrModalVisible(false);
      } else {
        message.error(err.message || 'OCR识别失败');
      }
    }

    return false;
  };

  const vertexCount = useMemo(() => points.length / 2, [points.length]);

  const renderGrid = () => {
    if (!showGrid) return null;
    
    const lines: React.ReactElement[] = [];
    const startX = Math.floor(-stagePos.x / scale / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const startY = Math.floor(-stagePos.y / scale / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const endX = startX + width / scale + GRID_SIZE * 3;
    const endY = startY + height / scale + GRID_SIZE * 3;

    for (let x = startX; x <= endX; x += GRID_SIZE) {
      lines.push(<Line key={`gv-${x}`} points={[x, startY, x, endY]} stroke="#e8e8e8" strokeWidth={0.5 / scale} listening={false} />);
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      lines.push(<Line key={`gh-${y}`} points={[startX, y, endX, y]} stroke="#e8e8e8" strokeWidth={0.5 / scale} listening={false} />);
    }
    return <>{lines}</>;
  };

  const renderGuideLines = () => {
    if (guideLines.length === 0) return null;
    
    return (
      <>
        {guideLines.map((line, idx) => (
          <Line
            key={`guide-${idx}`}
            points={line.type === 'h' 
              ? [-20000, line.pos, 20000, line.pos]
              : [line.pos, -20000, line.pos, 20000]
            }
            stroke="#ff7a45"
            strokeWidth={1 / scale}
            dash={[6 / scale, 4 / scale]}
            listening={false}
          />
        ))}
      </>
    );
  };

  const renderPreviewLine = () => {
    if (!isDrawing || !tempPoint || points.length < 2) return null;
    
    const lastX = points[points.length - 2];
    const lastY = points[points.length - 1];
    
    return (
      <>
        <Line
          points={[lastX, lastY, tempPoint.x, tempPoint.y]}
          stroke="#ff7a45"
          strokeWidth={2 / scale}
          dash={[8 / scale, 4 / scale]}
          listening={false}
        />
        <Circle x={tempPoint.x} y={tempPoint.y} radius={6 / scale} fill="#ff7a45" stroke="#fff" strokeWidth={1.5 / scale} listening={false} />
        
        {(() => {
          const dx = tempPoint.x - lastX;
          const dy = tempPoint.y - lastY;
          const len = Math.sqrt(dx*dx + dy*dy);
          const midX = (lastX + tempPoint.x) / 2;
          const midY = (lastY + tempPoint.y) / 2;
          
          return (
            <Group>
              <Rect x={midX - 35} y={midY - 12} width={70} height={24} fill="rgba(255,122,69,0.9)" cornerRadius={4} listening={false} />
              <Text x={midX} y={midY} text={`${Math.round(len)}mm`} fontSize={11 / scale} fill="#fff" align="center" verticalAlign="middle" listening={false} />
            </Group>
          );
        })()}
      </>
    );
  };

  const renderEdgeLabels = () => {
    if (edgeLabels.length === 0 || points.length < 6) return null;
    
    return (
      <>
        {edgeLabels.map((label, idx) => {
          const offsetX = Math.cos((label.angle + 90) * Math.PI / 180) * 22;
          const offsetY = Math.sin((label.angle + 90) * Math.PI / 180) * 22;
          
          return (
            <Group key={`el-${idx}`}>
              <Rect
                x={label.midX + offsetX - 38}
                y={label.midY + offsetY - 14}
                width={76}
                height={28}
                fill="white"
                cornerRadius={6}
                shadowColor="#000"
                shadowBlur={6}
                shadowOpacity={0.12}
                listening={false}
              />
              <Text
                x={label.midX + offsetX}
                y={label.midY + offsetY}
                text={`${label.length} mm`}
                fontSize={12 / scale}
                fill="#1890ff"
                fontStyle="bold"
                align="center"
                verticalAlign="middle"
                offsetX={-38}
                offsetY={-14}
                listening={false}
              />
            </Group>
          );
        })}
      </>
    );
  };

  const renderComponents = () => {
    return (
      <>
        {components.map(comp => {
          const isSelected = comp.id === selectedComponentId;
          const preset = COMPONENT_PRESETS[comp.type] || { color: '#999' };

          return (
            <Group
              key={comp.id}
              id={comp.id}
              draggable
              x={comp.x}
              y={comp.y}
              onClick={(e: Konva.KonvaEventObject) => { e.cancelBubble = true; setSelectedComponentId(comp.id); }}
              onTap={(e: Konva.KonvaEventObject) => { e.cancelBubble = true; setSelectedComponentId(comp.id); }}
              onDragEnd={(e: Konva.KonvaEventObject) => {
                setComponents(prev => prev.map(c => c.id === comp.id ? { ...c, x: e.target.x(), y: e.target.y() } : c));
              }}
            >
              <Rect
                width={comp.width}
                height={comp.height}
                fill={isSelected ? preset.color + '30' : preset.color + '18'}
                stroke={isSelected ? preset.color : preset.color + '88'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                dash={comp.type === 'door' ? [8, 4] : undefined}
                cornerRadius={comp.type === 'column' ? 4 : 0}
              />
              
              <Text
                text={comp.label}
                fontSize={Math.max(10, Math.min(comp.width, comp.height) * 0.28)}
                fill={preset.color}
                align="center"
                verticalAlign="middle"
                x={comp.width / 2}
                y={comp.height / 2}
                listening={false}
              />
              
              {isSelected && (
                <Rect x={-5} y={-5} width={comp.width + 10} height={comp.height + 10} fill="transparent" stroke={preset.color} strokeWidth={1.5} dash={[5, 3]} listening={false} />
              )}
            </Group>
          );
        })}
      </>
    );
  };

  return (
    <div className="room-editor" style={{ userSelect: 'none' }}>
      <Card size="small" className="mb-3" title={
        <Space size="middle">
          <span style={{ fontWeight: 600 }}>户型编辑器</span>
          {roomDimensions && (
            <>
              <AntText type="secondary" style={{ fontSize: 13 }}>
                {(roomDimensions.width * roomDimensions.height / 1000000).toFixed(2)} m²
              </AntText>
              <Tag color="blue">{roomDimensions.width.toFixed(0)} × {roomDimensions.height.toFixed(0)} mm</Tag>
            </>
          )}
          <Tag color={vertexCount >= 3 ? 'success' : 'default'}>
            {vertexCount}个顶点
          </Tag>
          <Tag color={components.length > 0 ? 'processing' : 'default'}>
            {components.length}个构件
          </Tag>
        </Space>
      } extra={
        <Space size="small">
          <Tooltip title="撤销"><Button size="small" icon={<UndoOutlined />} onClick={undo} disabled={historyIndex <= 0} /></Tooltip>
          <Tooltip title="重做"><Button size="small" icon={<RedoOutlined />} onClick={redo} disabled={historyIndex >= history.length - 1} /></Tooltip>
          <Divider type="vertical" />
          <Tooltip title="放大"><Button size="small" icon={<ZoomInOutlined />} onClick={zoomIn} /></Tooltip>
          <Tooltip title="缩小"><Button size="small" icon={<ZoomOutOutlined />} onClick={zoomOut} /></Tooltip>
          <Tooltip title="适应屏幕"><Button size="small" icon={<ExpandOutlined />} onClick={fitToScreen} /></Tooltip>
          <Divider type="vertical" />
          <Tooltip title={showGrid ? '隐藏网格' : '显示网格'}>
            <Button size="small" type={showGrid ? 'primary' : 'default'} icon={showGrid ? <EyeOutlined /> : <EyeInvisibleOutlined />} onClick={() => setShowGrid(!showGrid)} />
          </Tooltip>
          <Button size="small" type={snapToOrtho ? 'primary' : 'default'} onClick={() => setSnapToOrtho(!snapToOrtho)}>正交</Button>
          <Button size="small" type={snapToGrid ? 'primary' : 'default'} onClick={() => setSnapToGrid(!snapToGrid)}>吸附</Button>
        </Space>
      }>
        <div className="mb-2">
          <Space wrap size="small" style={{ marginBottom: 8 }}>
            
            <Dropdown menu={{
              items: PRESET_TEMPLATES.map(t => ({
                key: t.key,
                label: (
                  <div>
                    <span style={{ marginRight: 8 }}>{t.icon}</span>
                    <span>{t.label}</span>
                    <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>{t.desc}</span>
                  </div>
                ),
                onClick: () => applyTemplate(t.key),
              })),
            }} trigger={['click']}>
              <Button type="primary" size="small"><PlusOutlined /> 快速模板</Button>
            </Dropdown>

            <Divider type="vertical" />

            <Button 
              size="small" 
              type={activeTool === 'draw' ? 'primary' : 'default'} 
              onClick={toggleDrawMode}
            >
              ✏️ 绘制墙体
            </Button>

            <Button 
              size="small" 
              type={activeTool === 'door' ? 'primary' : 'default'}
              onClick={() => { setActiveTool('door'); setIsDrawing(false); }}
            >
              🚪 门洞
            </Button>

            <Button 
              size="small" 
              type={activeTool === 'window' ? 'primary' : 'default'}
              onClick={() => { setActiveTool('window'); setIsDrawing(false); }}
            >
              🪟 窗户
            </Button>

            <Button 
              size="small" 
              type={activeTool === 'column' ? 'primary' : 'default'}
              onClick={() => { setActiveTool('column'); setIsDrawing(false); }}
            >
              ▮ 柱子
            </Button>

            <Button 
              size="small" 
              type={activeTool === 'bay_window' ? 'primary' : 'default'}
              onClick={() => { setActiveTool('bay_window'); setIsDrawing(false); }}
            >
              ⬡ 飘窗
            </Button>

            <Divider type="vertical" />

            <Button size="small" icon={<CheckOutlined />} onClick={completePolygon} disabled={points.length < 6}>
              完成绘制
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={clearAll}>
              清空
            </Button>
            {selectedComponentId && (
              <Button size="small" danger onClick={deleteSelectedComponent}>
                删除构件
              </Button>
            )}

            <Divider type="vertical" />

            <Upload accept="image/*" showUploadList={false} beforeUpload={handleOCRUpload}>
              <Button size="small" icon={<CameraOutlined />} type="dashed">AI识别</Button>
            </Upload>
          </Space>
        </div>

        {(isDrawing || activeTool === 'draw') && (
          <div style={{ 
            background: '#fff7e6', 
            border: '1px solid #ffd591', 
            borderRadius: 6, 
            padding: '6px 12px', 
            marginBottom: 8,
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            fontSize: 13,
            color: '#d46b08'
          }}>
            <span><strong>绘制中</strong> | 点击添加顶点，线条自动吸附水平/垂直方向</span>
            <span>| 右键完成绘制</span>
            <span>| 已有 {vertexCount} 个顶点</span>
            {vertexCount >= 3 && <span style={{ color: '#52c41a' }}>✓ 可点击「完成绘制」闭合多边形</span>}
          </div>
        )}
      </Card>

      <div
        style={{
          border: '2px solid #d9d9d9',
          borderRadius: 10,
          backgroundColor: '#fafbfc',
          overflow: 'hidden',
          position: 'relative',
          cursor: isDrawing ? 'crosshair' : activeTool === 'select' ? (isDraggingStage ? 'grabbing' : 'grab') : 'crosshair',
        }}
        onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
        onMouseMove={handleStageMouseMove as any}
      >
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onClick={handleStageClick as any}
          onContextMenu={handleStageRightClick as any}
          onMouseDown={handleMouseDown as any}
          onMouseUp={handleMouseUp as any}
          onWheel={handleWheel as any}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
        >
          <Layer name="grid-layer">{renderGrid()}</Layer>

          <Layer name="main-layer">
            <Rect
              name="stage-bg"
              x={-20000}
              y={-20000}
              width={40000}
              height={40000}
              fill="transparent"
              listening={true}
            />

            {renderGuideLines()}

            {points.length >= 4 && (
              <Line
                points={points}
                closed={!isDrawing}
                fill="rgba(24, 144, 255, 0.08)"
                stroke="#1a365d"
                strokeWidth={4 / scale}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {renderPreviewLine()}
            {renderComponents()}
            {renderEdgeLabels()}

            {points.map((_, index) => {
              if (index % 2 !== 0) return null;
              const pointIndex = index / 2;
              const x = points[index];
              const y = points[index + 1];

              return (
                <Group key={`pt-${index}`}>
                  <Circle
                    x={x}
                    y={y}
                    radius={selectedPointIndex === pointIndex ? 10 / scale : 7 / scale}
                    fill={selectedPointIndex === pointIndex ? '#52c41a' : '#1890ff'}
                    stroke="#fff"
                    strokeWidth={2 / scale}
                    draggable
                    onDragStart={() => setSelectedPointIndex(pointIndex)}
                    onDragMove={(e: any) => handlePointDrag(pointIndex, e.target.x(), e.target.y())}
                    onDragEnd={() => { setSelectedPointIndex(null); saveToHistory(points, components); }}
                    onDblClick={() => handlePointDblClick(pointIndex)}
                  />
                  <Text
                    x={x + 14 / scale}
                    y={y - 10 / scale}
                    text={`${pointIndex + 1}`}
                    fontSize={11 / scale}
                    fill="#666"
                    fontWeight="bold"
                    listening={false}
                  />
                  
                  {index === 0 && points.length >= 4 && (
                    <Text
                      x={x + 14 / scale}
                      y={y + 6 / scale}
                      text="(起点)"
                      fontSize={9 / scale}
                      fill="#999"
                      fontStyle="italic"
                      listening={false}
                    />
                  )}
                </Group>
              );
            })}

            {!isDrawing && activeTool !== 'draw' && points.length === 0 && (
              <Group>
                <Rect x={width / 2 / scale - 180} y={height / 2 / scale - 40} width={360} height={80} fill="rgba(0,0,0,0.03)" cornerRadius={12} />
                <Text x={width / 2 / scale - 160} y={height / 2 / scale - 15} text="选择模板快速开始 或 点击「绘制墙体」自定义" fontSize={14 / scale} fill="#bbb" listening={false} />
              </Group>
            )}
          </Layer>
        </Stage>

        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          background: 'rgba(255,255,255,0.95)',
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 12,
          color: '#555',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          display: 'flex',
          gap: 12,
          fontFamily: 'monospace',
        }}>
          <span>{(scale * 100).toFixed(0)}%</span>
          <span style={{ color: '#ddd' }}>|</span>
          <span>{isDrawing ? '✏️ 绘制中' : activeTool === 'select' ? '👆 选择' : `🔧 ${activeTool}`}</span>
          {snapToOrtho && <span style={{ color: '#1890ff' }}>正交开</span>}
          {snapToGrid && <span style={{ color: '#52c41a' }}>吸附开</span>}
        </div>
      </div>

      <Modal
        title="AI OCR 手绘识别"
        open={ocrModalVisible}
        footer={null}
        closable={!ocrLoading}
        maskClosable={!ocrLoading}
      >
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <Spin spinning={ocrLoading} size="large" />
          <Progress percent={ocrProgress} status={ocrLoading ? 'active' : 'success'} style={{ marginTop: 20 }} />
          <p style={{ marginTop: 16, color: '#666' }}>
            {ocrLoading ? '正在识别手绘户型图...' : '识别完成！'}
          </p>
        </div>
      </Modal>

      {showDimensions && roomDimensions && (
        <Card size="small" className="mt-3" style={{ background: '#f0f5ff' }}>
          <Space split={<Divider type="vertical" />}>
            <AntText>宽度: <strong>{roomDimensions.width.toFixed(0)} mm</strong></AntText>
            <AntText>高度: <strong>{roomDimensions.height.toFixed(0)} mm</strong></AntText>
            <AntText>面积: <strong>{(roomDimensions.width * roomDimensions.height / 1000000).toFixed(2)} m²</strong></AntText>
            <AntText>周长: <strong>{edgeLabels.reduce((s, e) => s + e.length, 0)} mm</strong></AntText>
          </Space>
        </Card>
      )}

      <Card size="small" className="mt-3" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
        <Title level={5} style={{ margin: 0, marginBottom: 8 }}>操作指南</Title>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, fontSize: 13, color: '#555' }}>
          <div><strong>快速开始：</strong>点击「快速模板」选择矩形/L形/T形户型</div>
          <div><strong>自由绘制：</strong>点击「绘制墙体」，在画布上点击添加顶点，线条自动正交吸附</div>
          <div><strong>正交吸附：</strong>绘制时自动对齐到水平/垂直/15度倍数角度</div>
          <div><strong>编辑调整：</strong>拖拽顶点移动位置，双击删除顶点；滚轮缩放，拖拽平移</div>
          <div><strong>放置构件：</strong>选择工具后点击画布放置门洞/窗户/柱子/飘窗</div>
          <div><strong>AI识别：</strong>上传手绘草图，自动提取户型轮廓</div>
        </div>
      </Card>
    </div>
  );
};

export default RoomEditor;
