import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Space, Typography, Spin, message, Row, Col, Alert, InputNumber, Select } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';

const { Title, Text } = Typography;
const { Option } = Select;
interface StatData { total_tiles: number; whole_tiles: number; cut_tiles: number; waste_percentage: number; total_area_sq_m: number; }

const COLORS = { whole: '#1a365d', cut: '#d4a574' };
const API_BASE = '/api/v1';

// 模拟房间多边形数据
const ROOM_POLYGON = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]];

async function fetchLayout(projectId: string, config: any) {
  const resp = await fetch(`${API_BASE}/projects/${projectId}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_polygon: ROOM_POLYGON,
      config: { 
        tile_width: config.tileWidth || 800, 
        tile_height: config.tileHeight || 800, 
        gap_width: config.gapWidth || 3, 
        direction: config.direction || 'horizontal', 
        start_point: [config.startX || 0, config.startY || 0] 
      },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    let msg = `请求失败(${resp.status})`;
    try { const j = JSON.parse(errText); msg = j.detail || msg; } catch {}
    throw new Error(msg);
  }
  return resp.json();
}

const LayoutPreview: React.FC = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get('projectId') || 'demo';
  const canvasRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [tiles, setTiles] = useState<any[]>([]);
  const [stats, setStats] = useState<StatData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 配置项状态
  const [tileConfig, setTileConfig] = useState({
    tileWidth: 800,
    tileHeight: 800,
    gapWidth: 3,
    direction: 'horizontal',
    startX: 0,
    startY: 0,
  });

  const [isDragging, setIsDragging] = useState(false);

  // 计算画布尺寸和缩放
  const { scale, offsetX, offsetY, bounds } = useMemo(() => {
    const allPoints = [...ROOM_POLYGON];
    if (tiles.length > 0) {
      tiles.forEach(t => {
        allPoints.push([t.x, t.y]);
        allPoints.push([t.x + t.width, t.y + t.height]);
      });
    }
    const minX = Math.min(...allPoints.map(p => p[0]));
    const minY = Math.min(...allPoints.map(p => p[1]));
    const maxX = Math.max(...allPoints.map(p => p[0]));
    const maxY = Math.max(...allPoints.map(p => p[1]));
    const scale = Math.min(760 / (maxX - minX || 1), 480 / (maxY - minY || 1), 1);
    return { scale, offsetX: 20, offsetY: 20, bounds: { minX, minY, maxX, maxY } };
  }, [tiles]);

  // 加载排版
  const loadLayout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await fetchLayout(projectId, tileConfig);
      const d = (r && r.data) ? r.data : r;
      const tileList = d?.tiles || [];
      const statData = d?.statistics || null;
      setTiles(tileList);
      setStats(statData);
      if (tileList.length === 0 && !statData) {
        setError('排版计算无数据返回，请确认后端服务运行中');
      }
    } catch (e: any) {
      const msg = e?.message || (typeof e === 'string' ? e : '网络错误');
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, [projectId, tileConfig]);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  // 坐标转换
  const toCanvas = (x: number, y: number) => ({
    x: (x - bounds.minX) * scale + offsetX,
    y: (y - bounds.minY) * scale + offsetY,
  });
  const fromCanvas = (cx: number, cy: number) => ({
    x: Math.round((cx - offsetX) / scale + bounds.minX),
    y: Math.round((cy - offsetY) / scale + bounds.minY),
  });

  // 起铺点拖拽
  const startPointCanvas = toCanvas(tileConfig.startX, tileConfig.startY);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dist = Math.sqrt((cx - startPointCanvas.x) ** 2 + (cy - startPointCanvas.y) ** 2);
    if (dist < 20) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { x, y } = fromCanvas(cx, cy);
    // 限制在房间边界内
    const newX = Math.max(0, Math.min(x, ROOM_POLYGON[2][0]));
    const newY = Math.max(0, Math.min(y, ROOM_POLYGON[2][1]));
    setTileConfig(prev => ({ ...prev, startX: newX, startY: newY }));
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      loadLayout();
    }
  };

  const handleExportPdf = () => {
    window.open(`${API_BASE}/projects/${projectId}/export/pdf`, '_blank');
    message.success('PDF下载已开始');
  };

  const handleExportCutting = () => {
    window.open(`${API_BASE}/projects/${projectId}/export/cutting`, '_blank');
    message.success('加工单下载已开始');
  };

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <Spin size="large" tip="计算排版中..." />
    </div>
  );

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>返回</Button>
            <span className="logo"><Logo /></span>
          </Space>
          <Space>
            <Button icon={<PrinterOutlined />} onClick={handleExportCutting}>加工单</Button>
            <button className="btn btn-accent" onClick={handleExportPdf} style={{ cursor: 'pointer' }}><DownloadOutlined /> 导出 PDF</button>
          </Space>
        </div>

        {error && (
          <Alert message="排版计算失败" description={error} type="warning" showIcon style={{ marginBottom: 16 }}
            action={<Button size="small" onClick={loadLayout}>重试</Button>} />
        )}

        <div className="layout-grid-2">
          <Card 
            title={<span>📐 排版效果图</span>} 
            style={{ borderRadius: 8 }}
            extra={
              <Space size="small">
                <Button size="small" type="primary" onClick={loadLayout}>重新计算</Button>
              </Space>
            }
          >
            <div 
              ref={canvasRef}
              className="layout-canvas" 
              style={{ 
                width: 800, height: 520, position: 'relative', 
                cursor: isDragging ? 'grabbing' : 'default',
                overflow: 'hidden',
                userSelect: 'none',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* 房间背景 */}
              <div style={{
                position: 'absolute',
                left: offsetX,
                top: offsetY,
                width: (bounds.maxX - bounds.minX) * scale,
                height: (bounds.maxY - bounds.minY) * scale,
                background: 'rgba(26,54,93,0.05)',
                border: '2px solid #1a365d',
                borderRadius: 4,
              }} />

              {tiles.length > 0 ? tiles.map(t => {
                const pos = toCanvas(t.x, t.y);
                return (
                  <div key={String(t.id || Math.random())} style={{
                    position: 'absolute',
                    left: pos.x,
                    top: pos.y,
                    width: Math.max(t.width * scale - 1, 1),
                    height: Math.max(t.height * scale - 1, 1),
                    background: t.is_cut ? COLORS.cut : COLORS.whole,
                    border: '1px solid rgba(255,255,255,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.max(9, t.width * scale / 10),
                    color: '#fff',
                    fontWeight: 600,
                    opacity: .9,
                    borderRadius: 2,
                  }}>
                    {t.width * scale > 40 ? (t.is_cut ? '切' : '整') : ''}
                  </div>
                );
              }) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  {error ? '计算失败，请确保后端服务运行' : '暂无排版数据'}
                </div>
              )}

              {/* 起铺点 */}
              <div
                style={{
                  position: 'absolute',
                  left: startPointCanvas.x - 12,
                  top: startPointCanvas.y - 12,
                  width: 24,
                  height: 24,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  zIndex: 100,
                }}
              >
                {/* 十字准星 */}
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" fill="none" stroke="#d4a574" strokeWidth="2"/>
                  <line x1="12" y1="2" x2="12" y2="22" stroke="#d4a574" strokeWidth="2"/>
                  <line x1="2" y1="12" x2="22" y2="12" stroke="#d4a574" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="3" fill="#d4a574"/>
                </svg>
              </div>

              {/* 提示 */}
              <div style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                background: 'rgba(212,165,116,0.9)',
                color: '#1a365d',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}>
                📍 拖拽金色十字 → 调整起铺点
              </div>
            </div>
          </Card>

          <div>
            {stats && (
              <Card title={<span>📊 统计信息</span>} style={{ borderRadius: 8, marginBottom: 16 }}>
                <Row gutter={[12, 16]}>
                  <Col span={12}><div className="stat-card"><div className="num">{stats.total_tiles}</div><div className="label">总砖数 (片)</div></div></Col>
                  <Col span={12}><div className="stat-card"><div className="num" style={{ color: COLORS.whole }}>{stats.whole_tiles}</div><div className="label">整砖 (片)</div></div></Col>
                  <Col span={12}><div className="stat-card"><div className="num" style={{ color: COLORS.cut }}>{stats.cut_tiles}</div><div className="label">切割砖 (片)</div></div></Col>
                  <Col span={12}><div className="stat-card"><div className="num">{stats.waste_percentage}%</div><div className="label">损耗率</div></div></Col>
                  <Col span={24}><div className="stat-card"><div className="num">{Math.round(stats.total_area_sq_m * 100) / 100}</div><div className="label">总面积 (m²)</div></div></Col>
                </Row>
              </Card>
            )}

            <Card title={<span>⚙️ 瓷砖设置</span>} style={{ borderRadius: 8, marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, width: 80 }}>瓷砖尺寸:</Text>
                  <InputNumber
                    min={100} max={3000}
                    value={tileConfig.tileWidth}
                    onChange={(v) => setTileConfig(p => ({ ...p, tileWidth: v || 800 }))}
                    style={{ width: 90 }} addonAfter="mm" />
                  <span>×</span>
                  <InputNumber
                    min={100} max={3000}
                    value={tileConfig.tileHeight}
                    onChange={(v) => setTileConfig(p => ({ ...p, tileHeight: v || 800 }))}
                    style={{ width: 90 }} addonAfter="mm" />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, width: 80 }}>留缝宽度:</Text>
                  <Select
                    value={tileConfig.gapWidth}
                    onChange={(v) => setTileConfig(p => ({ ...p, gapWidth: v }))}
                    style={{ width: 120 }}
                  >
                    <Option value={1}>1mm (密缝)</Option>
                    <Option value={2}>2mm (标准)</Option>
                    <Option value={3}>3mm (常用)</Option>
                    <Option value={5}>5mm (宽缝)</Option>
                  </Select>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, width: 80 }}>铺贴方向:</Text>
                  <Select
                    value={tileConfig.direction}
                    onChange={(v) => setTileConfig(p => ({ ...p, direction: v }))}
                    style={{ width: 150 }}
                  >
                    <Option value="horizontal">⬌ 横向</Option>
                    <Option value="vertical">⬍ 纵向</Option>
                    <Option value="diagonal">⤡ 斜45°</Option>
                  </Select>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, width: 80 }}>起铺点:</Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>
                    ({Math.round(tileConfig.startX)}, {Math.round(tileConfig.startY)}) mm
                  </Text>
                </div>
              </Space>
            </Card>

            <Card title={<span>🎨 图例</span>} size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 20, height: 20, background: COLORS.whole, borderRadius: 3 }} /><Text>整砖</Text></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 20, height: 20, background: COLORS.cut, borderRadius: 3 }} /><Text>切割砖</Text></div>
              </div>
            </Card>

            <Card size="small" style={{ borderRadius: 8, background: '#f8fafc' }}>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 2 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 操作说明</div>
                <div>• 📍 拖拽金色十字 → 调整起铺点</div>
                <div>• ⚙️ 修改瓷砖参数 → 点击重新计算</div>
                <div>• 💾 可保存项目→导出确认单</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayoutPreview;
