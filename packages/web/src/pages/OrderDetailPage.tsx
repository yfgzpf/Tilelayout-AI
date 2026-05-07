import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Tag, Table, Space, Typography, message, Spin, Alert } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, ShareAltOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';

const { Title, Text } = Typography;

const API_BASE = '/api/v1';

interface OrderItem {
  id: string;
  sku_id: string;
  texture_id: string;
  quantity_whole: number;
  quantity_cut: number;
  price_per_piece: number;
}

interface Order {
  id: string;
  project_id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  show_total_price: boolean;
  confirm_token: string | null;
  confirmed_at: string | null;
  items: OrderItem[];
  created_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; text: string; icon: any }> = {
  draft: { color: 'default', text: '草稿', icon: <ClockCircleOutlined /> },
  pending: { color: 'orange', text: '待确认', icon: <ClockCircleOutlined /> },
  confirmed: { color: 'green', text: '已确认', icon: <CheckCircleOutlined /> },
  processing: { color: 'blue', text: '生产中', icon: <SyncOutlined spin /> },
  completed: { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
  cancelled: { color: 'error', text: '已取消', icon: <ClockCircleOutlined /> },
};

const OrderDetailPage: React.FC = () => {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        message.warning('请先登录');
        nav('/login');
        return;
      }

      const resp = await fetch(`${API_BASE}/orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (resp.ok) {
        const data = await resp.json();
        setOrder(data.data);
      } else {
        message.error('获取订单详情失败');
      }
    } catch (error) {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const resp = await fetch(`${API_BASE}/orders/${id}/status?status=${newStatus}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (resp.ok) {
        message.success('状态更新成功');
        fetchOrder();
      } else {
        message.error('状态更新失败');
      }
    } catch (error) {
      message.error('网络错误');
    }
  };

  const shareOrder = () => {
    if (!order?.confirm_token) {
      message.warning('该订单无分享链接');
      return;
    }
    const url = `${window.location.origin}/confirm/${order.confirm_token}`;
    navigator.clipboard.writeText(url);
    message.success('分享链接已复制到剪贴板');
  };

  const columns = [
    {
      title: 'SKU ID',
      dataIndex: 'sku_id',
      key: 'sku_id',
      render: (id: string) => <Text code>{id.slice(0, 8)}...</Text>,
    },
    {
      title: '整砖数量',
      dataIndex: 'quantity_whole',
      key: 'quantity_whole',
    },
    {
      title: '切割砖数量',
      dataIndex: 'quantity_cut',
      key: 'quantity_cut',
    },
    {
      title: '单价',
      dataIndex: 'price_per_piece',
      key: 'price_per_piece',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '小计',
      key: 'subtotal',
      render: (_: any, record: OrderItem) => {
        const total = (record.quantity_whole + record.quantity_cut) * record.price_per_piece;
        return `¥${total.toFixed(2)}`;
      },
    },
  ];

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page" style={{ padding: '24px 0' }}>
        <div className="page-inner">
          <Alert message="订单不存在" type="error" />
          <Button onClick={() => nav('/orders')} style={{ marginTop: 16 }}>返回订单列表</Button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/orders')}>返回</Button>
            <Logo />
          </Space>
          <Space>
            <Button icon={<ShareAltOutlined />} onClick={shareOrder}>分享订单</Button>
          </Space>
        </div>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Title level={3} style={{ color: '#1a365d', marginBottom: 0 }}>
            订单详情
          </Title>
        </Card>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="订单编号">
              <Text code>{order.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="订单状态">
              <Tag color={statusConfig.color} icon={statusConfig.icon}>
                {statusConfig.text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="客户姓名">{order.customer_name}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{order.customer_phone}</Descriptions.Item>
            <Descriptions.Item label="订单金额">
              {order.show_total_price ? `¥${order.total_amount.toFixed(2)}` : '商议'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(order.created_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {order.confirmed_at && (
              <Descriptions.Item label="确认时间">
                {new Date(order.confirmed_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Title level={4}>订单状态管理</Title>
          <Space wrap>
            <Button onClick={() => updateStatus('pending')}>标记为待确认</Button>
            <Button type="primary" onClick={() => updateStatus('confirmed')}>确认订单</Button>
            <Button onClick={() => updateStatus('processing')}>开始生产</Button>
            <Button type="primary" ghost onClick={() => updateStatus('completed')}>完成订单</Button>
            <Button danger onClick={() => updateStatus('cancelled')}>取消订单</Button>
          </Space>
        </Card>

        <Card style={{ borderRadius: 12 }}>
          <Title level={4}>材料明细</Title>
          <Table
            columns={columns}
            dataSource={order.items}
            rowKey="id"
            pagination={false}
          />
        </Card>

        <div className="footer" style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><Logo /></div>
          <div>© 2026 排砖宝 TileLayout AI · 瓷砖行业数字化解决方案</div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
