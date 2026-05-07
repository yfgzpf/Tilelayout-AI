import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Table, Tag, Space, Typography, message, Empty, Statistic, Row, Col } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons';
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

const OrderListPage: React.FC = () => {
  const nav = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        message.warning('请先登录');
        nav('/login');
        return;
      }

      const resp = await fetch(`${API_BASE}/orders/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (resp.ok) {
        const data = await resp.json();
        setOrders(data.data || []);
      } else {
        message.error('获取订单列表失败');
      }
    } catch (error) {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '订单编号',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code>{id.slice(0, 8)}...</Text>,
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: '联系电话',
      dataIndex: 'customer_phone',
      key: 'customer_phone',
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number, record: Order) => (
        record.show_total_price ? `¥${amount.toFixed(2)}` : '商议'
      ),
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Order) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => nav(`/orders/${record.id}`)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button>
            <Logo />
          </Space>
          <Button type="primary" onClick={fetchOrders} loading={loading}>
            刷新订单
          </Button>
        </div>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Title level={3} style={{ color: '#1a365d', marginBottom: 0 }}>订单管理</Title>
        </Card>

        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={6}>
            <Card>
              <Statistic title="总订单数" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="待确认" value={stats.pending} valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已确认" value={stats.confirmed} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
        </Row>

        <Card style={{ borderRadius: 12 }}>
          {orders.length === 0 && !loading ? (
            <Empty description="暂无订单" />
          ) : (
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          )}
        </Card>

        <div className="footer" style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><Logo /></div>
          <div>© 2026 排砖宝 TileLayout AI · 瓷砖行业数字化解决方案</div>
        </div>
      </div>
    </div>
  );
};

export default OrderListPage;
