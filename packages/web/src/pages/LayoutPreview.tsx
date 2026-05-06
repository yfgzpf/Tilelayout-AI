import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Space, Typography, Spin, message, Row, Col, Alert } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';

const { Title, Text } = Typography;
interface StatData { total_tiles: number; whole_tiles: number; cut_tiles: number; waste_percentage: number; total_area_sq_m: number; }

const COLORS = { whole: '#1a365d', cut: '#d4a574' };
const API_BASE = '/api/v1';

async function fetchLayout(projectId: string) {
  const resp = await fetch(`${API_BASE}/projects/${projectId}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_polygon: [[0, 0], [3000, 0], [3000, 4000], [0, 4000]],
      config: { tile_width: 800, tile_height: 800, gap_width: 3, direction: 'horizontal', start_point: [0, 0] },
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
  const [loading, setLoading] = useState(true);
  const [tiles, setTiles] = useState<any[]>([]);
  const [stats, setStats] = useState<StatData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetchLayout(projectId);
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
    })();
  }, [projectId]);

  const tileRects = useMemo(() => {
    if (!tiles || tiles.length === 0) return [];
    try {
      const maxX = Math.max(...tiles.map(t => t.x + t.width));
      const maxY = Math.max(...tiles.map(t => t.y + t.height));
      const scale = Math.min(760 / (maxX || 1), 480 / (maxY || 1), 1);
      return tiles.map(t => ({
        ...t,
        left: t.x * scale + 20,
        top: t.y * scale + 20,
        w: Math.max(t.width * scale - 1, 1),
        h: Math.max(t.height * scale - 1, 1),
      }));
    } catch {
      return [];
    }
  }, [tiles]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>返回</Button>
            <span className="logo"><Logo /></span>
          </Space>
          <Space>
            <Button icon={<PrinterOutlined />} onClick={handleExportCutting}>加工单</Button>
            <button className="btn btn-accent" style={{ cursor: 'pointer' }} onClick={handleExportPdf}><DownloadOutlined /> 导出 PDF</button>
          </Space>
        </div>

        {error && (
          <Alert message="排版计算失败" description={error} type="warning" showIcon style={{ marginBottom: 16 }}
            action={<Button size="small" onClick={() => window.location.reload()}>重试</Button>} />
        )}

        <div className="layout-grid-2">
          <Card title={<span>📐 排版效果图</span>} style={{ borderRadius: 8 }}>
            <div className="layout-canvas" style={{ width: 800, height: 520, position: 'relative' }}>
              {tileRects.length > 0 ? tileRects.map(t => (
                <div key={String(t.id || Math.random())} style={{
                  position: 'absolute', left: t.left, top: t.top, width: t.w, height: t.h,
                  background: t.isCut ? COLORS.cut : COLORS.whole, border: '1px solid rgba(0,0,0,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#fff', fontWeight: 600, opacity: .88, borderRadius: 2,
                }}>{t.w > 25 ? (t.isCut ? '切' : '整') : ''}</div>
              )) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  {error ? '计算失败，请确保后端服务运行' : '暂无排版数据'}
                </div>
              )}
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
            <Card title={<span>🎨 图例</span>} size="small" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 20, height: 20, background: COLORS.whole, borderRadius: 3 }} /><Text>整砖</Text></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 20, height: 20, background: COLORS.cut, borderRadius: 3 }} /><Text>切割砖</Text></div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayoutPreview;
