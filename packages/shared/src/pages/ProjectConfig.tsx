import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Space,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Divider,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { Stage } from 'konva';

const { Title } = Typography;
const { Option } = Select;

interface Point {
  x: number;
  y: number;
}

interface ProjectConfigData {
  name: string;
  tileWidth: number;
  tileHeight: number;
  gapWidth: number;
  direction: 'horizontal' | 'vertical' | 'diagonal';
  startPoint: Point;
  minCutRatio?: number;
  cutPriority?: 'door' | 'hidden';
}

const SNAP_THRESHOLD = 20;

const ProjectConfig: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [roomPolygon, setRoomPolygon] = useState<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const stageRef = useRef<Stage | null>(null);

  const getCorners = useCallback((polygon: Point[]): Point[] => {
    if (polygon.length === 0) return [];
    
    const xs = polygon.map((p) => p.x);
    const ys = polygon.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
  }, []);

  const getCenter = useCallback((polygon: Point[]): Point => {
    if (polygon.length === 0) return { x: 0, y: 0 };
    
    const xs = polygon.map((p) => p.x);
    const ys = polygon.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
  }, []);

  const snapToPoint = useCallback((point: Point, target: Point): Point => {
    const dx = point.x - target.x;
    const dy = point.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < SNAP_THRESHOLD) {
      return { x: target.x, y: target.y };
    }
    return point;
  }, []);

  const handleStartPointDrag = useCallback(
    (newPoint: Point) => {
      const polygon = roomPolygon;
      if (polygon.length === 0) return;

      let snappedPoint = { ...newPoint };

      const corners = getCorners(polygon);
      corners.forEach((corner) => {
        snappedPoint = snapToPoint(snappedPoint, corner);
      });

      const center = getCenter(polygon);
      snappedPoint = snapToPoint(snappedPoint, center);

      snappedPoint.x = Math.round(snappedPoint.x / 10) * 10;
      snappedPoint.y = Math.round(snappedPoint.y / 10) * 10;

      setStartPoint(snappedPoint);
    },
    [roomPolygon, getCorners, getCenter, snapToPoint]
  );

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      const config: ProjectConfigData = {
        ...values,
        startPoint,
      };

      console.log('保存项目配置:', config);
      message.success('配置保存成功');
      navigate(`/project/${id}/edit`);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败，请检查输入');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/project/${id}/edit`)}>
              返回编辑
            </Button>
            <Title level={3} className="mb-0">
              项目配置
            </Title>
          </Space>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              保存配置
            </Button>
          </Space>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Card title="瓷砖配置" className="mb-4">
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  name: '',
                  tileWidth: 800,
                  tileHeight: 800,
                  gapWidth: 3,
                  direction: 'horizontal',
                  minCutRatio: 0.3,
                  cutPriority: 'hidden',
                }}
              >
                <Form.Item
                  label="项目名称"
                  name="name"
                  rules={[{ required: true, message: '请输入项目名称' }]}
                >
                  <Input placeholder="例如：客厅地砖" />
                </Form.Item>

                <Form.Item label="瓷砖规格（毫米）">
                  <Space>
                    <Form.Item
                      name="tileWidth"
                      noStyle
                      rules={[{ required: true, message: '请输入宽度' }]}
                    >
                      <InputNumber
                        placeholder="宽度"
                        min={100}
                        max={2000}
                        style={{ width: 120 }}
                      />
                    </Form.Item>
                    <span>×</span>
                    <Form.Item
                      name="tileHeight"
                      noStyle
                      rules={[{ required: true, message: '请输入高度' }]}
                    >
                      <InputNumber
                        placeholder="高度"
                        min={100}
                        max={2000}
                        style={{ width: 120 }}
                      />
                    </Form.Item>
                  </Space>
                </Form.Item>

                <Form.Item
                  label="留缝宽度（毫米）"
                  name="gapWidth"
                  rules={[{ required: true, message: '请输入留缝宽度' }]}
                >
                  <InputNumber min={0} max={20} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  label="铺贴方向"
                  name="direction"
                  rules={[{ required: true, message: '请选择铺贴方向' }]}
                >
                  <Select>
                    <Option value="horizontal">横向</Option>
                    <Option value="vertical">纵向</Option>
                    <Option value="diagonal">斜向</Option>
                  </Select>
                </Form.Item>

                <Divider />

                <Form.Item label="切割规则">
                  <Form.Item
                    label="最小砖比例"
                    name="minCutRatio"
                    rules={[{ min: 0.1, max: 1, type: 'number' }]}
                  >
                    <InputNumber
                      min={0.1}
                      max={1}
                      step={0.1}
                      style={{ width: '100%' }}
                      addonAfter="（0.1-1.0）"
                    />
                  </Form.Item>
                  <div className="text-sm text-gray-500 mt-2">
                    小于此比例的切割砖将调整为整砖
                  </div>
                </Form.Item>

                <Form.Item
                  label="非整砖优先放置位置"
                  name="cutPriority"
                >
                  <Select>
                    <Option value="door">门口对侧</Option>
                    <Option value="hidden">隐蔽处</Option>
                    <Option value="center">中心对称</Option>
                  </Select>
                </Form.Item>
              </Form>
            </Card>
          </div>

          <div>
            <Card title="起铺点设置" className="mb-4">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  拖拽十字准星设置起铺点，自动吸附墙角或中心
                </div>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center">
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        border: '2px solid #1890ff',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: '#1890ff',
                          transform: 'translateX(-50%)',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: 0,
                          right: 0,
                          height: 2,
                          background: '#1890ff',
                          transform: 'translateY(-50%)',
                        }}
                      />
                    </div>
                    <span className="ml-2">起铺点</span>
                  </div>
                  <div className="flex items-center">
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        border: '2px dashed #52c41a',
                      }}
                    />
                    <span className="ml-2">墙角（自动吸附）</span>
                  </div>
                  <div className="flex items-center">
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: '2px dotted #faad14',
                      }}
                    />
                    <span className="ml-2">中心点（自动吸附）</span>
                  </div>
                </div>
              </div>

              <div
                className="border border-gray-300 rounded-lg bg-gray-50 relative"
                style={{ height: 400 }}
              >
                <div className="absolute top-2 left-2 text-xs text-gray-500">
                  当前起铺点：({startPoint.x.toFixed(0)}, {startPoint.y.toFixed(0)})
                </div>

                <div
                  className="absolute w-full h-full"
                  style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={(e) => {
                    setIsDragging(true);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    handleStartPointDrag({ x, y });
                  }}
                  onMouseMove={(e) => {
                    if (!isDragging) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    handleStartPointDrag({ x, y });
                  }}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: startPoint.x - 10,
                      top: startPoint.y - 10,
                      width: 20,
                      height: 20,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: '#1890ff',
                        transform: 'translateX(-50%)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        right: 0,
                        height: 2,
                        background: '#1890ff',
                        transform: 'translateY(-50%)',
                      }}
                    />
                  </div>
                </div>

                {roomPolygon.length > 0 && (
                  <svg
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    }}
                  >
                    <polygon
                      points={roomPolygon.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(24, 144, 255, 0.1)"
                      stroke="#1890ff"
                      strokeWidth={2}
                    />
                    {(() => {
                      const corners = getCorners(roomPolygon);
                      const center = getCenter(roomPolygon);
                      return (
                        <>
                          {corners.map((corner, i) => (
                            <circle
                              key={i}
                              cx={corner.x}
                              cy={corner.y}
                              r={5}
                              fill="#52c41a"
                              stroke="white"
                              strokeWidth={2}
                            />
                          ))}
                          <circle
                            cx={center.x}
                            cy={center.y}
                            r={5}
                            fill="#faad14"
                            stroke="white"
                            strokeWidth={2}
                            strokeDasharray="2,2"
                          />
                        </>
                      );
                    })()}
                  </svg>
                )}

                {roomPolygon.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                    请先在编辑页面绘制户型轮廓
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div>• 起铺点会自动吸附到墙角（绿色点）或中心（黄色点）</div>
                <div>• 吸附阈值：{SNAP_THRESHOLD}px</div>
                <div>• 坐标会自动对齐到 10px 网格</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectConfig;
