import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Circle, Text, Rect } from 'react-konva';
import type Konva from 'konva';
import { Button, Space, Tooltip, message, Select, InputNumber, Divider, Card, Typography, Popover, Switch } from 'antd';
import {
  EditOutlined,
  CheckOutlined,
  DeleteOutlined,
  UndoOutlined,
  AimOutlined,
  DragOutlined,
  RightSquareOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';

const { Text: AntText } = Typography;
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
    direction: 'horizontal' | 'vertical' | 'diagonal';
  };
  showTilePreview?: boolean;
}

interface TilePreset {
  label: string;
  width: number;
  height: number;
}

const TILE_PRESETS: TilePreset[] = [
  { label: '300×300', width: 300, height: 300 },
  { label: '400×400', width: 400, height: 400 },
  { label: '600×600', width: 600, height: 600 },
  { label: '800×800', width: 800, height: 800 },
  { label: '600×1200', width: 600, height: 1200 },
  { label: '750×1500', width: 750, height: 1500 },
  { label: '900×1800', width: 900, height: 1800 },
];

const SCALE_STEP = 0.1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const GRID_SIZE = 50;

interface TilePreview {
  x: number;
  y: number;
  width: number;
  height: number;
  isCut: boolean;
}

const RoomEditor: React.FC<RoomEditorProps> = ({
  polygon,
  onChange,
  width = 800,
  height = 600,
  showDimensions = true,
  onDimensionsChange,
  tileConfig,
  showTilePreview = true,
}) => {
  const [points, setPoints] = useState<number[]>([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [tilePreset, setTilePreset] = useState<string>('800×800');
  const [customTileWidth, setCustomTileWidth] = useState<number>(800);
  const [customTileHeight, setCustomTileHeight] = useState<number>(800);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [history, setHistory] = useState<number[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [roomDimensions, setRoomDimensions] = useState<{ width: number; height: number } | null>(null);
  const [edgeLabels, setEdgeLabels] = useState<{ index: number; length: number }[]>([]);
  const [tilePreviews, setTilePreviews] = useState<TilePreview[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [gapWidth, setGapWidth] = useState<number>(3);
  const [direction, setDirection] = useState<'horizontal' | 'vertical' | 'diagonal'>('horizontal');
  
  const stageRef = useRef<Konva.Stage>(null);

  const currentTileWidth = tileConfig?.tileWidth || customTileWidth;
  const currentTileHeight = tileConfig?.tileHeight || customTileHeight;
  const currentGapWidth = tileConfig?.gapWidth || gapWidth;
  const currentDirection = tileConfig?.direction || direction;

  useEffect(() => {
    if (polygon.length > 0) {
      const flatPoints: number[] = [];
      polygon.forEach((point) => {
        flatPoints.push(point[0], point[1]);
      });
      setPoints(flatPoints);
      saveToHistory(flatPoints);
    }
  }, [polygon]);

  useEffect(() => {
    // 当户型绘制完成后（至少 3 个顶点），自动计算房间尺寸和瓷砖预览
    if (points.length >= 6 && !isDrawing) {
      calculateRoomDimensions();
      // 只有在明确需要预览时才计算
      if (showTilePreview && showPreview) {
        calculateTilePreview();
      }
    } else {
      setRoomDimensions(null);
      setEdgeLabels([]);
      setTilePreviews([]);
      onDimensionsChange?.(null);
    }
  }, [points, currentTileWidth, currentTileHeight, currentGapWidth, currentDirection, showTilePreview, showPreview, isDrawing]);

  const saveToHistory = useCallback((pts: number[]) => {
    const polygonPts = pointsToPolygon(pts);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), polygonPts]);
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevHistory = history[historyIndex - 1];
      const flatPoints: number[] = [];
      prevHistory.forEach((p) => flatPoints.push(p[0], p[1]));
      setPoints(flatPoints);
      setHistoryIndex((prev) => prev - 1);
      onChange(prevHistory);
    }
  }, [history, historyIndex, onChange]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextHistory = history[historyIndex + 1];
      const flatPoints: number[] = [];
      nextHistory.forEach((p) => flatPoints.push(p[0], p[1]));
      setPoints(flatPoints);
      setHistoryIndex((prev) => prev + 1);
      onChange(nextHistory);
    }
  }, [history, historyIndex, onChange]);

  const calculateRoomDimensions = useCallback(() => {
    if (points.length < 6) return;
    
    const polygonPts = pointsToPolygon(points);
    const xs = polygonPts.map(p => p[0]);
    const ys = polygonPts.map(p => p[1]);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const roomWidth = maxX - minX;
    const roomHeight = maxY - minY;
    
    const dims = { width: roomWidth, height: roomHeight };
    setRoomDimensions(dims);
    onDimensionsChange?.(dims);
    
    const labels: { index: number; length: number }[] = [];
    for (let i = 0; i < polygonPts.length; i++) {
      const p1 = polygonPts[i];
      const p2 = polygonPts[(i + 1) % polygonPts.length];
      const length = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
      labels.push({ index: i, length: Math.round(length) });
    }
    setEdgeLabels(labels);
  }, [points, onDimensionsChange]);

  const calculateTilePreview = useCallback(() => {
    if (points.length < 6) return;
    
    const polygonPts = pointsToPolygon(points);
    const xs = polygonPts.map(p => p[0]);
    const ys = polygonPts.map(p => p[1]);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const previews: TilePreview[] = [];
    const tileW = currentTileWidth;
    const tileH = currentTileHeight;
    const gap = currentGapWidth;
    
    let atw = tileW + gap;
    let ath = tileH + gap;
    
    if (currentDirection === 'vertical') {
      [atw, ath] = [ath, atw];
    }
    
    const cols = Math.ceil((maxX - minX) / atw) + 1;
    const rows = Math.ceil((maxY - minY) / ath) + 1;
    
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const x = minX + col * atw;
        const y = minY + row * ath;
        
        const inRoom = isPointInPolygon(x + atw/2, y + ath/2, polygonPts);
        
        if (inRoom) {
          previews.push({
            x,
            y,
            width: tileW,
            height: tileH,
            isCut: x < minX || x + tileW > maxX || y < minY || y + tileH > maxY,
          });
        }
      }
    }
    
    setTilePreviews(previews);
  }, [points, currentTileWidth, currentTileHeight, currentGapWidth, currentDirection]);

  const isPointInPolygon = (x: number, y: number, polygon: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  };

  const pointsToPolygon = useCallback((pts: number[]): number[][] => {
    const poly: number[][] = [];
    for (let i = 0; i < pts.length; i += 2) {
      poly.push([pts[i], pts[i + 1]]);
    }
    return poly;
  }, []);

  const snapPointToGrid = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(y / GRID_SIZE) * GRID_SIZE,
    };
  }, [snapToGrid]);

  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    const snapped = snapPointToGrid(
      (pos.x - stagePos.x) / scale,
      (pos.y - stagePos.y) / scale
    );
    return snapped;
  }, [scale, stagePos, snapPointToGrid]);

  const handleStageClick = useCallback((e: any) => {
    if (e.evt.button === 2) {
      return;
    }
    
    const pos = getPointerPosition();
    if (!pos) return;

    if (isDrawing) {
      setPoints((prev) => {
        const newPoints = [...prev, pos.x, pos.y];
        onChange(pointsToPolygon(newPoints));
        saveToHistory(newPoints);
        return newPoints;
      });
    }
  }, [isDrawing, onChange, getPointerPosition, pointsToPolygon, saveToHistory]);

  const handleStageRightClick = useCallback((e: any) => {
    e.evt.preventDefault();
    
    // 右键总是退出绘制模式
    if (isDrawing) {
      setIsDrawing(false);
      message.success('已退出绘制模式');
    } else if (points.length > 0) {
      // 如果已经有户型，右键可以重新进入绘制模式添加顶点
      setIsDrawing(true);
      message.info('绘制模式：点击添加顶点，再次右键退出');
    }
  }, [isDrawing, points.length]);

  const handlePointDrag = useCallback(
    (index: number, x: number, y: number) => {
      const snapped = snapPointToGrid(x, y);
      setPoints((prev) => {
        const newPoints = [...prev];
        newPoints[index * 2] = snapped.x;
        newPoints[index * 2 + 1] = snapped.y;
        onChange(pointsToPolygon(newPoints));
        return newPoints;
      });
    },
    [onChange, pointsToPolygon, snapPointToGrid]
  );

  const handlePointDblClick = useCallback(
    (index: number) => {
      if (points.length <= 6) {
        message.warning('多边形至少需要3个顶点');
        return;
      }

      setPoints((prev) => {
        const newPoints = [...prev];
        newPoints.splice(index * 2, 2);
        onChange(pointsToPolygon(newPoints));
        saveToHistory(newPoints);
        return newPoints;
      });
    },
    [points.length, onChange, pointsToPolygon, saveToHistory]
  );

  const toggleDrawingMode = useCallback(() => {
    if (!isDrawing && points.length === 0) {
      setIsDrawing(true);
      message.info('绘制模式：点击添加顶点，右键退出');
    } else if (isDrawing) {
      setIsDrawing(false);
      message.success('已退出绘制模式');
    } else {
      setIsDrawing(true);
      message.info('绘制模式：点击添加顶点，右键退出');
    }
  }, [isDrawing, points.length]);

  const clearPolygon = useCallback(() => {
    setPoints([]);
    onChange([]);
    setIsDrawing(false);
    setHistory([]);
    setHistoryIndex(-1);
    setTilePreviews([]);
    message.success('已清空画布');
  }, [onChange]);

  const completePolygon = useCallback(() => {
    if (points.length < 6) {
      message.warning('至少需要3个顶点才能完成绘制');
      return;
    }
    setIsDrawing(false);
    saveToHistory(points);
    message.success('绘制完成');
  }, [points, saveToHistory]);

  const handleWheel = useCallback((e: any) => {
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
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale + direction * SCALE_STEP));

    setScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [scale, stagePos]);

  const handleDragEnd = useCallback((e: any) => {
    setStagePos({
      x: e.target.x(),
      y: e.target.y(),
    });
  }, []);

  const handlePresetChange = useCallback((value: string) => {
    setTilePreset(value);
    const preset = TILE_PRESETS.find(p => p.label === value);
    if (preset) {
      setCustomTileWidth(preset.width);
      setCustomTileHeight(preset.height);
    }
  }, []);

  const vertexCount = useMemo(() => points.length / 2, [points.length]);

  const renderGrid = useMemo(() => {
    if (!showGrid) return null;
    
    const gridLines: React.ReactNode[] = [];
    const startX = Math.floor(-stagePos.x / scale / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(-stagePos.y / scale / GRID_SIZE) * GRID_SIZE;
    const endX = startX + width / scale + GRID_SIZE * 2;
    const endY = startY + height / scale + GRID_SIZE * 2;

    for (let x = startX; x < endX; x += GRID_SIZE) {
      gridLines.push(
        <Line
          key={`v-${x}`}
          points={[x, startY, x, endY]}
          stroke="#e0e0e0"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    for (let y = startY; y < endY; y += GRID_SIZE) {
      gridLines.push(
        <Line
          key={`h-${y}`}
          points={[startX, y, endX, y]}
          stroke="#e0e0e0"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    return gridLines;
  }, [showGrid, stagePos, scale, width, height]);

  const renderTilePreviews = useMemo(() => {
    if (!showPreview || tilePreviews.length === 0) return null;
    
    return tilePreviews.map((tile, idx) => (
      <Rect
        key={`tile-${idx}`}
        x={tile.x}
        y={tile.y}
        width={tile.width}
        height={tile.height}
        fill={tile.isCut ? 'rgba(250, 173, 20, 0.3)' : 'rgba(24, 144, 255, 0.2)'}
        stroke={tile.isCut ? '#faad14' : '#1890ff'}
        strokeWidth={1 / scale}
        listening={false}
      />
    ));
  }, [showPreview, tilePreviews, scale]);

  const renderEdgeLabels = useMemo(() => {
    if (edgeLabels.length === 0 || points.length < 6) return null;
    
    const polygonPts = pointsToPolygon(points);
    
    return edgeLabels.map((label, idx) => {
      const p1 = polygonPts[label.index];
      const p2 = polygonPts[(label.index + 1) % polygonPts.length];
      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;
      
      const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
      
      return (
        <Text
          key={`edge-${idx}`}
          x={midX}
          y={midY - 15}
          text={`${label.length}mm`}
          fontSize={12}
          fill="#1890ff"
          rotation={angle > 90 || angle < -90 ? angle + 180 : angle}
          listening={false}
        />
      );
    });
  }, [edgeLabels, points, pointsToPolygon]);

  return (
    <div className="room-editor">
      <Card 
        size="small" 
        className="mb-3"
        title={
          <Space>
            <span>户型编辑器</span>
            {roomDimensions && (
              <AntText type="secondary" style={{ fontSize: 12 }}>
                ({roomDimensions.width.toFixed(0)} × {roomDimensions.height.toFixed(0)} mm)
              </AntText>
            )}
          </Space>
        }
        extra={
          <Space size="small">
            <Tooltip title="撤销 (Ctrl+Z)">
              <Button 
                size="small" 
                icon={<UndoOutlined />} 
                onClick={undo}
                disabled={historyIndex <= 0}
              />
            </Tooltip>
            <Tooltip title="重做 (Ctrl+Y)">
              <Button 
                size="small" 
                icon={<UndoOutlined style={{ transform: 'scaleX(-1)' }} />} 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              />
            </Tooltip>
            <Divider type="vertical" />
            <Tooltip title="显示网格">
              <Button 
                size="small" 
                type={showGrid ? 'primary' : 'default'}
                onClick={() => setShowGrid(!showGrid)}
              >
                网格
              </Button>
            </Tooltip>
            <Tooltip title="吸附到网格">
              <Button 
                size="small" 
                type={snapToGrid ? 'primary' : 'default'}
                onClick={() => setSnapToGrid(!snapToGrid)}
              >
                吸附
              </Button>
            </Tooltip>
            <Tooltip title={showPreview ? "隐藏瓷砖预览" : "显示瓷砖预览"}>
              <Button 
                size="small" 
                type={showPreview ? 'primary' : 'default'}
                icon={showPreview ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => setShowPreview(!showPreview)}
              />
            </Tooltip>
          </Space>
        }
      >
        <Space wrap className="mb-3">
          <Button
            type={isDrawing ? 'primary' : 'default'}
            icon={<EditOutlined />}
            onClick={toggleDrawingMode}
            danger={isDrawing}
          >
            {isDrawing ? '绘制中...' : '开始绘制'}
          </Button>
          <Button
            icon={<CheckOutlined />}
            onClick={completePolygon}
            disabled={points.length < 6 || !isDrawing}
            type="primary"
            ghost
          >
            完成绘制
          </Button>
          <Popover
            content={
              <div style={{ maxWidth: 300 }}>
                <p><strong>右键点击画布</strong>可快速退出绘制模式</p>
                <p><strong>滚轮</strong>缩放画布</p>
                <p><strong>拖拽空白区域</strong>平移画布</p>
                <p><strong>双击顶点</strong>删除</p>
                <p><strong>拖拽顶点</strong>调整位置</p>
                <p><strong>瓷砖预览</strong>自动计算排版</p>
              </div>
            }
            title="操作提示"
          >
            <Button icon={<RightSquareOutlined />}>操作帮助</Button>
          </Popover>
          <Button
            icon={<DeleteOutlined />}
            onClick={clearPolygon}
            danger
          >
            清空
          </Button>
        </Space>

        <div className="flex flex-wrap gap-4 items-center mb-3">
          <Space>
            <AntText>瓷砖规格:</AntText>
            <Select
              value={tilePreset}
              onChange={handlePresetChange}
              style={{ width: 150 }}
              size="small"
            >
              {TILE_PRESETS.map(preset => (
                <Option key={preset.label} value={preset.label}>
                  {preset.label}
                </Option>
              ))}
              <Option value="custom">自定义</Option>
            </Select>
            {tilePreset === 'custom' && (
              <>
                <InputNumber
                  size="small"
                  min={50}
                  max={3000}
                  value={customTileWidth}
                  onChange={(v) => setCustomTileWidth(v || 800)}
                  placeholder="宽"
                  style={{ width: 80 }}
                />
                <AntText>×</AntText>
                <InputNumber
                  size="small"
                  min={50}
                  max={3000}
                  value={customTileHeight}
                  onChange={(v) => setCustomTileHeight(v || 800)}
                  placeholder="高"
                  style={{ width: 80 }}
                />
              </>
            )}
            <AntText type="secondary">mm</AntText>
          </Space>
          
          <Space>
            <AntText>留缝:</AntText>
            <InputNumber
              size="small"
              min={0}
              max={20}
              value={gapWidth}
              onChange={(v) => setGapWidth(v || 0)}
              style={{ width: 60 }}
            />
            <AntText type="secondary">mm</AntText>
          </Space>
          
          <Space>
            <AntText>方向:</AntText>
            <Select
              value={direction}
              onChange={(v) => setDirection(v)}
              style={{ width: 80 }}
              size="small"
            >
              <Option value="horizontal">横向</Option>
              <Option value="vertical">纵向</Option>
            </Select>
          </Space>
        </div>
      </Card>

      <div
        style={{
          border: '2px solid #d9d9d9',
          borderRadius: '8px',
          backgroundColor: '#fafafa',
          overflow: 'hidden',
          position: 'relative',
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onClick={handleStageClick}
          onContextMenu={handleStageRightClick}
          onWheel={handleWheel}
          draggable={!isDrawing}
          onDragEnd={handleDragEnd}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          style={{ cursor: isDrawing ? 'crosshair' : 'grab' }}
        >
          <Layer>
            {renderGrid}
            
            {renderTilePreviews}
            
            {points.length >= 4 && (
              <Line
                points={points}
                closed={!isDrawing}
                fill="rgba(24, 144, 255, 0.1)"
                stroke="#1890ff"
                strokeWidth={2 / scale}
              />
            )}

            {renderEdgeLabels}

            {points.map((_, index) => {
              if (index % 2 !== 0) return null;
              const pointIndex = index / 2;
              const x = points[index];
              const y = points[index + 1];

              return (
                <React.Fragment key={index}>
                  <Circle
                    x={x}
                    y={y}
                    radius={8 / scale}
                    fill={selectedPointIndex === pointIndex ? '#52c41a' : '#1890ff'}
                    stroke="white"
                    strokeWidth={2 / scale}
                    draggable
                    onDragStart={() => setSelectedPointIndex(pointIndex)}
                    onDragMove={(e) => handlePointDrag(pointIndex, e.target.x(), e.target.y())}
                    onDragEnd={() => {
                      setSelectedPointIndex(null);
                      saveToHistory(points);
                    }}
                    onDblClick={() => handlePointDblClick(pointIndex)}
                    onMouseEnter={() => setSelectedPointIndex(pointIndex)}
                    onMouseLeave={() => setSelectedPointIndex(null)}
                  />
                  <Text
                    x={x + 10 / scale}
                    y={y - 10 / scale}
                    text={`P${pointIndex + 1}`}
                    fontSize={12 / scale}
                    fill="#666"
                    listening={false}
                  />
                </React.Fragment>
              );
            })}

            {isDrawing && (
              <Rect
                x={10 / scale}
                y={10 / scale}
                width={200 / scale}
                height={30 / scale}
                fill="rgba(0,0,0,0.7)"
                cornerRadius={4}
              />
            )}
            
            {isDrawing && (
              <Text
                x={20 / scale}
                y={18 / scale}
                text="点击添加顶点 | 右键退出绘制"
                fontSize={12 / scale}
                fill="#fff"
                listening={false}
              />
            )}

            {!isDrawing && points.length === 0 && (
              <>
                <Rect
                  x={width / 2 / scale - 150}
                  y={height / 2 / scale - 30}
                  width={300}
                  height={60}
                  fill="rgba(0,0,0,0.05)"
                  cornerRadius={8}
                />
                <Text
                  x={width / 2 / scale - 140}
                  y={height / 2 / scale - 10}
                  text="点击「开始绘制」或右键进入绘制模式"
                  fontSize={14 / scale}
                  fill="#999"
                  listening={false}
                />
              </>
            )}
          </Layer>
        </Stage>
        
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            background: 'rgba(255,255,255,0.9)',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            color: '#666',
          }}
        >
          缩放: {(scale * 100).toFixed(0)}% | 顶点: {vertexCount} | 
          {isDrawing ? ' 绘制模式' : ' 编辑模式'}
          {tilePreviews.length > 0 && ` | 瓷砖: ${tilePreviews.length}片`}
        </div>
      </div>

      {showDimensions && roomDimensions && (
        <Card size="small" className="mt-3">
          <Space split={<Divider type="vertical" />}>
            <AntText>
              房间宽度: <strong>{roomDimensions.width.toFixed(0)} mm</strong>
            </AntText>
            <AntText>
              房间高度: <strong>{roomDimensions.height.toFixed(0)} mm</strong>
            </AntText>
            <AntText>
              面积: <strong>{(roomDimensions.width * roomDimensions.height / 1000000).toFixed(2)} m²</strong>
            </AntText>
            {tilePreviews.length > 0 && (
              <AntText>
                预估瓷砖: <strong>{tilePreviews.length} 片</strong>
              </AntText>
            )}
          </Space>
        </Card>
      )}
    </div>
  );
};

export default RoomEditor;
