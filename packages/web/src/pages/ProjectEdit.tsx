import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Card, Form, Input, InputNumber, Select, Space, Typography,
  message, Divider, Row, Col, Tag, Tabs as AntTabs, Modal, Spin, Alert,
  Upload,
} from 'antd';
import {
  SaveOutlined, ArrowLeftOutlined, EyeOutlined, CalculatorOutlined,
  SendOutlined, UndoOutlined, RedoOutlined, ZoomInOutlined, ZoomOutOutlined,
  AimOutlined, UploadOutlined, ScissorOutlined,
} from '@ant-design/icons';
import { api } from '../services/api';

const { Title, Text: AntText } = Typography;
const { Option } = Select;

const TILE_PRESETS = [
  { label: '300×300 小地砖', width: 300, height: 300 },
  { label: '400×400 地砖', width: 400, height: 400 },
  { label: '600×600 抛光砖', width: 600, height: 600 },
  { label: '800×800 通体砖 ★', width: 800, height: 800 },
  { label: '600×1200 大板', width: 600, height: 1200 },
  { label: '750×1500 岩板', width: 750, height: 1500 },
];

interface RoomComponent {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
}

const ProjectEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [form] = Form.useForm();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [roomPolygon, setRoomPolygon] = useState<number[][]>([]);
  const [roomComponents, setRoomComponents] = useState<RoomComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [activeTab, setActiveTab] = useState('draw');
  const [tilePreset, setTilePreset] = useState<string>('800×800 通体砖 ★');
  const [projectId, setProjectId] = useState<string | null>(id || null);
  const [drawMode, setDrawMode] = useState<'polygon' | 'select' | 'door' | 'window'>('polygon');
  const [dragVertex, setDragVertex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoverVertex, setHoverVertex] = useState<number | null>(null);

  const isNewProject = !projectId;

  useEffect(() => {
    if (id) loadProject(id);
  }, [id]);

  useEffect(() => {
    drawCanvas();
  }, [roomPolygon, roomComponents, zoom, panOffset, hoverVertex, drawMode]);

  const loadProject = async (pid: string) => {
    try {
      setLoading(true);
      const resp = await api.get<any>(`/projects/${pid}`);
      const data = resp?.data || resp;
      if (data.roomPolygon || data.room_polygon) {
        setRoomPolygon(data.roomPolygon || data.room_polygon || []);
      }
      if (data.components) {
        setRoomComponents(data.components);
      }
      const tc = data.tileConfig || data.tile_config || {};
      form.setFieldsValue({
        name: data.name || '',
        tileWidth: tc.tileWidth || tc.tile_width || 800,
        tileHeight: tc.tileHeight || tc.tile_height || 800,
        gapWidth: tc.gapWidth || tc.gap_width || 3,
        direction: tc.direction || 'horizontal',
      });
      setProjectId(pid);
    } catch (err: any) {
      message.error('加载项目失败: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    const gridSize = 100;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < 3000; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 3000); ctx.stroke();
    }
    for (let y = 0; y < 3000; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(3000, y); ctx.stroke();
    }

    if (roomPolygon.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(roomPolygon[0][0], roomPolygon[0][1]);
      for (let i = 1; i < roomPolygon.length; i++) {
        ctx.lineTo(roomPolygon[i][0], roomPolygon[i][1]);
      }
      if (roomPolygon.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(26, 54, 93, 0.08)';
        ctx.fill();
      }
      ctx.strokeStyle = '#1a365d';
      ctx.lineWidth = 2;
      ctx.stroke();

      roomPolygon.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], hoverVertex === i ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = hoverVertex === i ? '#d4a574' : '#1a365d';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      if (roomPolygon.length >= 3) {
        for (let i = 0; i < roomPolygon.length; i++) {
          const j = (i + 1) % roomPolygon.length;
          const dx = roomPolygon[j][0] - roomPolygon[i][0];
          const dy = roomPolygon[j][1] - roomPolygon[i][1];
          const len = Math.sqrt(dx * dx + dy * dy);
          const mx = (roomPolygon[i][0] + roomPolygon[j][0]) / 2;
          const my = (roomPolygon[i][1] + roomPolygon[j][1]) / 2;
          ctx.save();
          ctx.translate(mx, my);
          ctx.fillStyle = '#64748b';
          ctx.font = '11px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(len)}mm`, 0, -6);
          ctx.restore();
        }
      }
    }

    roomComponents.forEach(comp => {
      ctx.save();
      ctx.translate(comp.x, comp.y);
      if (comp.type === 'door') {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.fillRect(0, -comp.height / 2, comp.width, comp.height);
        ctx.strokeRect(0, -comp.height / 2, comp.width, comp.height);
        ctx.beginPath();
        ctx.arc(0, comp.height / 2, comp.width, -Math.PI / 2, 0);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (comp.type === 'window') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.fillRect(0, -comp.height / 2, comp.width, comp.height);
        ctx.strokeRect(0, -comp.height / 2, comp.width, comp.height);
      }
      ctx.fillStyle = '#374151';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(comp.label, comp.width / 2, comp.height / 2 + 14);
      ctx.restore();
    });

    ctx.restore();
  }, [roomPolygon, roomComponents, zoom, panOffset, hoverVertex, drawMode]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panOffset.x) / zoom,
      y: (e.clientY - rect.top - panOffset.y) / zoom,
    };
  };

  const findNearestVertex = (x: number, y: number): number | null => {
    const threshold = 15 / zoom;
    for (let i = 0; i < roomPolygon.length; i++) {
      const dx = roomPolygon[i][0] - x;
      const dy = roomPolygon[i][1] - y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) return i;
    }
    return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const pt = getCanvasPoint(e);

    if (drawMode === 'select') {
      const vi = findNearestVertex(pt.x, pt.y);
      if (vi !== null) {
        setDragVertex(vi);
      }
    } else if (drawMode === 'polygon') {
      const vi = findNearestVertex(pt.x, pt.y);
      if (vi !== null && vi === 0 && roomPolygon.length >= 3) {
        return;
      }
      const snapX = Math.round(pt.x / 50) * 50;
      const snapY = Math.round(pt.y / 50) * 50;
      setRoomPolygon(prev => [...prev, [snapX, snapY]]);
    } else if (drawMode === 'door') {
      const comp: RoomComponent = {
        id: `door_${Date.now()}`,
        type: 'door',
        x: Math.round(pt.x / 50) * 50,
        y: Math.round(pt.y / 50) * 50,
        width: 800,
        height: 40,
        rotation: 0,
        label: `门${roomComponents.filter(c => c.type === 'door').length + 1}`,
      };
      setRoomComponents(prev => [...prev, comp]);
      setDrawMode('select');
    } else if (drawMode === 'window') {
      const comp: RoomComponent = {
        id: `window_${Date.now()}`,
        type: 'window',
        x: Math.round(pt.x / 50) * 50,
        y: Math.round(pt.y / 50) * 50,
        width: 1200,
        height: 30,
        rotation: 0,
        label: `窗${roomComponents.filter(c => c.type === 'window').length + 1}`,
      };
      setRoomComponents(prev => [...prev, comp]);
      setDrawMode('select');
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    const pt = getCanvasPoint(e);
    if (dragVertex !== null) {
      const snapX = Math.round(pt.x / 50) * 50;
      const snapY = Math.round(pt.y / 50) * 50;
      setRoomPolygon(prev => {
        const next = [...prev];
        next[dragVertex] = [snapX, snapY];
        return next;
      });
    } else {
      const vi = findNearestVertex(pt.x, pt.y);
      setHoverVertex(vi);
    }
  };

  const handleCanvasMouseUp = () => {
    setDragVertex(null);
    setIsPanning(false);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.2, Math.min(5, prev * delta)));
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    const vi = findNearestVertex(pt.x, pt.y);
    if (vi !== null && roomPolygon.length > 3) {
      setRoomPolygon(prev => prev.filter((_, i) => i !== vi));
    }
  };

  const handleTilePresetChange = (value: string) => {
    setTilePreset(value);
    if (value !== 'custom') {
      const preset = TILE_PRESETS.find(p => p.label === value);
      if (preset) form.setFieldsValue({ tileWidth: preset.width, tileHeight: preset.height });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const projectData = {
        name: values.name || `户型方案_${new Date().toLocaleDateString()}`,
        room_polygon: roomPolygon,
        edges_annotated: [],
        components: roomComponents,
        tile_config: {
          tile_width: values.tileWidth || 800,
          tile_height: values.tileHeight || 800,
          gap_width: values.gapWidth || 3,
          direction: values.direction || 'horizontal',
          start_point: [0, 0],
        },
        status: 'draft' as const,
      };

      if (isNewProject || !projectId) {
        const resp = await api.post<any>('/projects/', projectData);
        const data = resp?.data || resp;
        const pid = data?.id;
        if (pid) {
          setProjectId(pid);
          message.success('项目创建成功');
          Modal.confirm({
            title: '创建成功',
            content: '项目已保存，是否进入排版预览？',
            okText: '进入排版',
            cancelText: '继续编辑',
            onOk: () => navigate(`/project/preview?projectId=${pid}`),
          });
        }
      } else {
        await api.put<any>(`/projects/${projectId}`, projectData);
        message.success('项目已更新');
      }
    } catch (err: any) {
      if (err?.message?.includes('validate')) return;
      message.error(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleGoToLayout = () => {
    if (roomPolygon.length < 3) {
      message.warning('请先完成户型绘制');
      return;
    }
    if (isNewProject || !projectId) {
      Modal.confirm({
        title: '提示',
        content: '需要先保存当前方案才能进行排版计算，是否立即保存？',
        okText: '保存并前往',
        onOk: handleSave,
      });
    } else {
      navigate(`/project/preview?projectId=${projectId}`);
    }
  };

  const handleGoToConfirmation = () => {
    if (!projectId) {
      message.warning('请先保存项目');
      return;
    }
    navigate(`/confirmation?projectId=${projectId}`);
  };

  const handleSketchUpload = async (file: File) => {
    try {
      message.loading({ content: 'AI识别中...', key: 'sketch', duration: 0 });
      const resp = await api.upload<any>('/sketch/recognize', file);
      const data = resp?.data || resp;
      if (data?.polygon && Array.isArray(data.polygon)) {
        setRoomPolygon(data.polygon);
        message.success({ content: '识别成功，已填充户型轮廓', key: 'sketch' });
      } else {
        message.warning({ content: '未能识别户型轮廓，请手动绘制', key: 'sketch' });
      }
    } catch (e: any) {
      message.error({ content: '识别失败: ' + (e.message || ''), key: 'sketch' });
    }
    return false;
  };

  const calcArea = () => {
    if (roomPolygon.length < 3) return 0;
    return Math.abs(roomPolygon.reduce((a, p, i) => {
      const j = (i + 1) % roomPolygon.length;
      return a + p[0] * roomPolygon[j][1] - roomPolygon[j][0] * p[1];
    }, 0)) / 2 / 1_000_000;
  };

  const tabItems = [
    {
      key: 'draw',
      label: (
        <span>
          ✏️ 户型绘制
          {roomPolygon.length > 0 && <Tag color="blue" style={{ marginLeft: 8 }}>{roomPolygon.length}顶点</Tag>}
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="small" type={drawMode === 'polygon' ? 'primary' : 'default'} onClick={() => setDrawMode('polygon')}>画墙</Button>
            <Button size="small" type={drawMode === 'select' ? 'primary' : 'default'} onClick={() => setDrawMode('select')}>选择/拖拽</Button>
            <Button size="small" type={drawMode === 'door' ? 'primary' : 'default'} onClick={() => setDrawMode('door')}>🚪 门洞</Button>
            <Button size="small" type={drawMode === 'window' ? 'primary' : 'default'} onClick={() => setDrawMode('window')}>🪟 窗户</Button>
            <Divider type="vertical" />
            <Button size="small" icon={<UndoOutlined />} onClick={() => setRoomPolygon(prev => prev.slice(0, -1))} disabled={roomPolygon.length === 0}>撤销</Button>
            <Button size="small" danger onClick={() => { setRoomPolygon([]); setRoomComponents([]); }}>清空</Button>
            <Divider type="vertical" />
            <Button size="small" icon={<ZoomInOutlined />} onClick={() => setZoom(z => Math.min(5, z * 1.2))} />
            <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>缩放: {(zoom * 100).toFixed(0)}%</span>
            <Divider type="vertical" />
            <Upload accept="image/*" showUploadList={false} beforeUpload={handleSketchUpload}>
              <Button size="small" icon={<UploadOutlined />}>AI识别</Button>
            </Upload>
            {roomPolygon.length >= 3 && (
              <Tag color="green" style={{ marginLeft: 8 }}>
                面积: {calcArea().toFixed(2)} m²
              </Tag>
            )}
          </div>
          <canvas
            ref={canvasRef}
            width={850}
            height={520}
            style={{ border: '1px solid #e2e8f0', borderRadius: 8, cursor: drawMode === 'select' ? 'move' : 'crosshair', background: '#fff' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
            onDoubleClick={handleCanvasDoubleClick}
            onContextMenu={e => e.preventDefault()}
          />
          {roomComponents.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {roomComponents.map(comp => (
                <Tag
                  key={comp.id}
                  color={comp.type === 'door' ? 'blue' : comp.type === 'window' ? 'green' : 'purple'}
                  closable
                  onClose={() => setRoomComponents(prev => prev.filter(c => c.id !== comp.id))}
                >
                  {comp.type === 'door' ? '🚪' : '🪟'} {comp.label} ({comp.width}mm)
                </Tag>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'config',
      label: <span>⚙️ 排版配置</span>,
      children: (
        <Card size="small">
          <Form form={form} layout="vertical" initialValues={{ name: '', tileWidth: 800, tileHeight: 800, gapWidth: 3, direction: 'horizontal' }}>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item label="方案名称" name="name">
                  <Input placeholder="例如：全屋800×800亮光砖方案" maxLength={100} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="备注说明" name="notes">
                  <Input.TextArea placeholder="可选备注信息" rows={2} maxLength={500} />
                </Form.Item>
              </Col>
            </Row>
            <Divider orientation="left">瓷砖规格设置</Divider>
            <Form.Item label="市场通用规格预设">
              <Select value={tilePreset} onChange={handleTilePresetChange} allowClear>
                {TILE_PRESETS.map(p => (
                  <Option key={p.label} value={p.label}>{p.label}</Option>
                ))}
                <Option value="custom">📐 自定义尺寸</Option>
              </Select>
            </Form.Item>
            <Form.Item label="瓷砖尺寸 (mm)">
              <Space>
                <Form.Item name="tileWidth" noStyle>
                  <InputNumber min={50} max={3000} step={50} style={{ width: 120 }} disabled={tilePreset !== 'custom'} addonBefore="长" />
                </Form.Item>
                <AntText strong>×</AntText>
                <Form.Item name="tileHeight" noStyle>
                  <InputNumber min={50} max={3000} step={50} style={{ width: 120 }} disabled={tilePreset !== 'custom'} addonBefore="宽" />
                </Form.Item>
              </Space>
            </Form.Item>
            <Divider orientation="left">铺贴参数</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="留缝宽度 (mm)" name="gapWidth">
                  <Select>
                    <Option value={1}>1mm 密缝</Option>
                    <Option value={2}>2mm 标准</Option>
                    <Option value={3}>3mm 常用 ★</Option>
                    <Option value={5}>5mm 宽缝</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="铺贴方向" name="direction">
                  <Select options={[
                    { value: 'horizontal', label: '⬌ 横向铺贴' },
                    { value: 'vertical', label: '⬍ 纵向铺贴' },
                    { value: 'diagonal', label: '⤡ 斜45°铺贴' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                {roomPolygon.length >= 3 && (
                  <Form.Item label="估算面积">
                    <Tag color="blue" style={{ fontSize: 14 }}>{calcArea().toFixed(2)} m²</Tag>
                  </Form.Item>
                )}
              </Col>
            </Row>
          </Form>
        </Card>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="page" style={{ padding: '24px 0' }}>
        <div className="page-inner" style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#666' }}>加载项目中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回列表</Button>
            <Title level={4} style={{ margin: 0 }}>
              {isNewProject ? '➕ 新建排版方案' : '✏️ 编辑方案'}
            </Title>
            {projectId && <Tag color="processing">ID: {projectId.slice(0, 8)}</Tag>}
          </Space>
          <Space>
            <Button onClick={() => navigate('/')}>取消</Button>
            <Button icon={<EyeOutlined />} onClick={handleGoToLayout} disabled={roomPolygon.length < 3}>
              预览排版
            </Button>
            <Button icon={<CalculatorOutlined />} onClick={handleGoToConfirmation} disabled={!projectId}>
              生成报价单
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              {isNewProject ? '创建方案' : '保存修改'}
            </Button>
          </Space>
        </div>

        <Card bordered={false} style={{ borderRadius: 10 }}>
          <AntTabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </Card>

        <Card size="small" style={{ marginTop: 16, borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Title level={5} style={{ margin: 0 }}>💡 排砖宝操作指南</Title>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 2.1, fontSize: 13, color: '#555' }}>
            <li><strong>绘制户型</strong>：点击「画墙」→ 在画布上点击添加顶点 → 双击顶点删除</li>
            <li><strong>AI识别</strong>：点击「AI识别」按钮上传手绘草图，自动提取户型轮廓</li>
            <li><strong>放置构件</strong>：选择门洞/窗户工具后点击画布放置</li>
            <li><strong>编辑调整</strong>：切换「选择/拖拽」模式后拖拽顶点调整位置</li>
            <li><strong>缩放平移</strong>：滚轮缩放，Alt+拖拽平移画布</li>
            <li><strong>设置参数</strong>：在「排版配置」标签页选择瓷砖规格和铺贴方向</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default ProjectEdit;
