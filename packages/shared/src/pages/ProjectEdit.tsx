import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  message,
  Spin,
  Divider,
  Row,
  Col,
  Alert,
  Tabs,
  Collapse,
  Switch,
  Tooltip,
  Tag,
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  EyeOutlined,
  CalculatorOutlined,
  SettingOutlined,
  AimOutlined,
  DoorOutlined,
  ScissorOutlined,
  ColumnHeightOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import RoomEditor, { RoomComponent } from '../components/RoomEditor/RoomEditor';
import { projectsApi } from '../services';
import { useAppStore } from '../store';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

interface TileConfig {
  tileWidth: number;
  tileHeight: number;
  gapWidth: number;
  direction: 'horizontal' | 'vertical' | 'diagonal';
  startPoint: { x: number; y: number };
}

interface ProjectFormData {
  name: string;
  tileWidth: number;
  tileHeight: number;
  gapWidth: number;
  direction: 'horizontal' | 'vertical' | 'diagonal';
}

const TILE_PRESETS = [
  { label: '300×300mm', width: 300, height: 300 },
  { label: '400×400mm', width: 400, height: 400 },
  { label: '600×600mm', width: 600, height: 600 },
  { label: '800×800mm', width: 800, height: 800 },
  { label: '600×1200mm', width: 600, height: 1200 },
  { label: '750×1500mm', width: 750, height: 1500 },
  { label: '900×1800mm', width: 900, height: 1800 },
  { label: '1200×2400mm', width: 1200, height: 2400 },
];

const ProjectEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { currentProject, setCurrentProject, setLoading, setError } = useAppStore();
  
  const [roomPolygon, setRoomPolygon] = useState<number[][]>([]);
  const [loading, setLoadingState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roomDimensions, setRoomDimensions] = useState<{ width: number; height: number } | null>(null);
  const [tilePreset, setTilePreset] = useState<string>('800×800mm');
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [layoutResult, setLayoutResult] = useState<any>(null);
  const [components, setComponents] = useState<RoomComponent[]>([]);
  const [activeTab, setActiveTab] = useState('edit');

  const isNew = !id || id === 'new';

  useEffect(() => {
    if (!isNew && id) {
      loadProject(id);
    }
  }, [id, isNew]);

  const loadProject = async (projectId: string) => {
    try {
      setLoadingState(true);
      const project = await projectsApi.get(projectId);
      
      form.setFieldsValue({
        name: project.name,
        tileWidth: project.tileConfig?.tileWidth || 800,
        tileHeight: project.tileConfig?.tileHeight || 800,
        gapWidth: project.tileConfig?.gapWidth || 3,
        direction: project.tileConfig?.direction || 'horizontal',
      });
      
      setRoomPolygon(project.roomPolygon || []);
      if (project.components) {
        setComponents(project.components as RoomComponent[]);
      }
      
      setCurrentProject(project);
      
      const preset = TILE_PRESETS.find(
        p => p.width === project.tileConfig?.tileWidth && p.height === project.tileConfig?.tileHeight
      );
      if (preset) {
        setTilePreset(preset.label);
      } else {
        setTilePreset('custom');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载项目失败';
      message.error(errorMessage);
      setError(errorMessage);
    } finally {
      setLoadingState(false);
    }
  };

  const handleTilePresetChange = useCallback((value: string) => {
    setTilePreset(value);
    if (value !== 'custom') {
      const preset = TILE_PRESETS.find(p => p.label === value);
      if (preset) {
        form.setFieldsValue({
          tileWidth: preset.width,
          tileHeight: preset.height,
        });
      }
    }
  }, [form]);

  const handleRoomDimensionsChange = useCallback((dims: { width: number; height: number } | null) => {
    setRoomDimensions(dims);
  }, []);

  const handleComponentsChange = useCallback((newComponents: RoomComponent[]) => {
    setComponents(newComponents);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      
      if (roomPolygon.length < 3) {
        message.warning('请先绘制户型轮廓（至少3个顶点）');
        return;
      }
      
      const tileConfig: TileConfig = {
        tileWidth: values.tileWidth,
        tileHeight: values.tileHeight,
        gapWidth: values.gapWidth,
        direction: values.direction,
        startPoint: { x: 0, y: 0 },
      };

      const projectData = {
        name: values.name,
        roomPolygon,
        edgesAnnotated: [],
        tileConfig,
        components,
      };

      if (isNew) {
        const newProject = await projectsApi.create(projectData);
        message.success('项目创建成功');
        setCurrentProject(newProject);
        navigate(`/project/${newProject.id}`);
      } else {
        const updatedProject = await projectsApi.update(id!, projectData);
        message.success('项目保存成功');
        setCurrentProject(updatedProject);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存失败';
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!id || isNew) {
      message.warning('请先保存项目后再预览');
      return;
    }
    
    try {
      setLoadingState(true);
      const values = await form.validateFields();
      
      const result = await projectsApi.calculateLayout(id, {
        textureId: undefined,
        config: {
          tileWidth: values.tileWidth,
          tileHeight: values.tileHeight,
          gapWidth: values.gapWidth,
          direction: values.direction,
          startPoint: { x: 0, y: 0 },
        },
      });
      
      setLayoutResult(result);
      message.success('排版计算完成');
      setActiveTab('preview');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '排版计算失败';
      message.error(errorMessage);
    } finally {
      setLoadingState(false);
    }
  };

  const handleQuickLayout = async () => {
    if (roomPolygon.length < 3) {
      message.warning('请先绘制户型轮廓');
      return;
    }
    
    try {
      setLoadingState(true);
      const values = form.getFieldsValue();
      
      const tempProjectData = {
        name: values.name || '临时项目',
        roomPolygon,
        edgesAnnotated: [],
        tileConfig: {
          tileWidth: values.tileWidth,
          tileHeight: values.tileHeight,
          gapWidth: values.gapWidth,
          direction: values.direction,
          startPoint: { x: 0, y: 0 },
        },
        components,
      };
      
      let projectId = id;
      if (!projectId || isNew) {
        const newProject = await projectsApi.create(tempProjectData);
        projectId = newProject.id;
        navigate(`/project/${projectId}`, { replace: true });
      }
      
      const result = await projectsApi.calculateLayout(projectId!, {
        textureId: undefined,
        config: {
          tileWidth: values.tileWidth,
          tileHeight: values.tileHeight,
          gapWidth: values.gapWidth,
          direction: values.direction,
          startPoint: { x: 0, y: 0 },
        },
      });
      
      setLayoutResult(result);
      message.success('快速排版完成');
      setActiveTab('preview');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '排版计算失败';
      message.error(errorMessage);
    } finally {
      setLoadingState(false);
    }
  };

  const componentStats = useMemo(() => ({
    doors: components.filter(c => c.type === 'door').length,
    windows: components.filter(c => c.type === 'window').length,
    columns: components.filter(c => c.type === 'column').length,
    bayWindows: components.filter(c => c.type === 'bay_window').length,
  }), [components]);

  if (loading && !isNew) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
              返回
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              {isNew ? '新建项目' : '编辑项目'}
            </Title>
          </Space>
          <Space>
            <Button
              icon={<CalculatorOutlined />}
              onClick={handleQuickLayout}
              loading={loading}
              disabled={roomPolygon.length < 3}
            >
              快速排版
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              disabled={isNew || roomPolygon.length < 3}
            >
              预览排版
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              保存
            </Button>
          </Space>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="户型编辑" key="edit">
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <Card 
                  title={
                    <Space>
                      <span>户型编辑</span>
                      {roomDimensions && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          房间: {roomDimensions.width.toFixed(0)} × {roomDimensions.height.toFixed(0)} mm
                          ({(roomDimensions.width * roomDimensions.height / 1000000).toFixed(2)} m²)
                        </Text>
                      )}
                    </Space>
                  }
                  extra={
                    <Space size={2}>
                      {componentStats.doors > 0 && <Tag color="blue" icon={<DoorOutlined />}>门{componentStats.doors}</Tag>}
                      {componentStats.windows > 0 && <Tag color="green" icon={<ScissorOutlined />}>窗{componentStats.windows}</Tag>}
                      {componentStats.columns > 0 && <Tag color="red" icon={<ColumnHeightOutlined />}>柱{componentStats.columns}</Tag>}
                      {componentStats.bayWindows > 0 && <Tag color="purple" icon={<ApartmentOutlined />}>飘窗{componentStats.bayWindows}</Tag>}
                    </Space>
                  }
                >
                  <RoomEditor
                    polygon={roomPolygon}
                    onChange={setRoomPolygon}
                    width={900}
                    height={550}
                    showDimensions={false}
                    onDimensionsChange={handleRoomDimensionsChange}
                    onComponentsChange={handleComponentsChange}
                    tileConfig={{
                      tileWidth: form.getFieldValue('tileWidth') || 800,
                      tileHeight: form.getFieldValue('tileHeight') || 800,
                      gapWidth: form.getFieldValue('gapWidth') || 3,
                      direction: form.getFieldValue('direction') || 'horizontal',
                    }}
                  />
                </Card>
              </Col>

              <Col xs={24} lg={8}>
                <Card title="项目配置" className="mb-4">
                  <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                      name: '',
                      tileWidth: 800,
                      tileHeight: 800,
                      gapWidth: 3,
                      direction: 'horizontal',
                    }}
                  >
                    <Form.Item
                      label="方案名称"
                      name="name"
                      rules={[
                        { required: true, message: '请输入方案名称' },
                        { min: 2, message: '名称至少2个字符' },
                      ]}
                    >
                      <Input placeholder="例如：客厅800×800亮光砖" maxLength={100} showCount />
                    </Form.Item>

                    <Divider orientation="left">瓷砖规格</Divider>

                    <Form.Item label="快速选择">
                      <Select value={tilePreset} onChange={handleTilePresetChange} style={{ width: '100%' }}>
                        {TILE_PRESETS.map(preset => (
                          <Option key={preset.label} value={preset.label}>{preset.label}</Option>
                        ))}
                        <Option value="custom">自定义尺寸</Option>
                      </Select>
                    </Form.Item>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="宽度(mm)" name="tileWidth" rules={[{ required: true, message: '必填' }]}>
                          <InputNumber style={{ width: '100%' }} min={50} max={3000} step={50} disabled={tilePreset !== 'custom'} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="高度(mm)" name="tileHeight" rules={[{ required: true, message: '必填' }]}>
                          <InputNumber style={{ width: '100%' }} min={50} max={3000} step={50} disabled={tilePreset !== 'custom'} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider orientation="left">铺贴设置</Divider>

                    <Form.Item label="留缝宽度(mm)" name="gapWidth" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0} max={20} step={0.5} />
                    </Form.Item>

                    <Form.Item label="铺贴方向" name="direction" rules={[{ required: true }]}>
                      <Select placeholder="选择方向">
                        <Option value="horizontal">横向铺贴</Option>
                        <Option value="vertical">纵向铺贴</Option>
                        <Option value="diagonal">斜向铺贴 (45°)</Option>
                      </Select>
                    </Form.Item>
                  </Form>
                </Card>

                {layoutResult && (
                  <Card title="排版结果" size="small" className="mb-4">
                    <Row gutter={[8, 8]}>
                      <Col span={12}><Text type="secondary">总砖数:</Text><Text strong>{layoutResult.statistics?.totalTiles || 0} 片</Text></Col>
                      <Col span={12}><Text type="secondary">整砖:</Text><Text strong>{layoutResult.statistics?.wholeTiles || 0} 片</Text></Col>
                      <Col span={12}><Text type="secondary">切割:</Text><Text strong>{layoutResult.statistics?.cutTiles || 0} 片</Text></Col>
                      <Col span={12}><Text type="secondary">损耗:</Text><Text strong>{layoutResult.statistics?.wastePercentage?.toFixed(1) || 0}%</Text></Col>
                    </Row>
                    <Button type="primary" block onClick={() => setActiveTab('preview')} className="mt-2">
                      查看详细排版
                    </Button>
                  </Card>
                )}

                <Card title="操作提示" size="small">
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    <li><strong>选择模式</strong>: 拖拽画布平移，滚轮缩放</li>
                    <li><strong>画墙模式</strong>: 点击添加顶点绘制轮廓</li>
                    <li><strong>门/窗/柱</strong>: 点击放置参数化构件</li>
                    <li><strong>右键</strong>: 退出当前工具/绘制模式</li>
                    <li><strong>双击顶点</strong>: 删除该顶点</li>
                    <li><strong>Delete</strong>: 删除选中构件</li>
                  </ul>
                </Card>
              </Col>
            </Row>
          </Tabs.TabPane>

          <Tabs.TabPane tab="排版预览" key="preview" disabled={!layoutResult}>
            {!layoutResult ? (
              <Card>
                <Alert 
                  message="暂无排版数据" 
                  description="请先绘制户型并点击「快速排版」或「预览排版」按钮" 
                  type="info" 
                  showIcon 
                />
              </Card>
            ) : (
              <Card title="排版结果详情">
                <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                  {JSON.stringify(layoutResult, null, 2)}
                </pre>
              </Card>
            )}
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectEdit;
