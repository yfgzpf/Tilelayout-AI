import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Descriptions, Statistic, Row, Col, Form, Input, Modal, Typography, message, Tag, Space } from 'antd';
import { ArrowLeftOutlined, EditOutlined, LockOutlined, CrownOutlined, ProjectOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';

const { Title, Text } = Typography;

const API_BASE = '/api/v1';

interface UserInfo {
  id: string;
  phone: string;
  is_member: boolean;
  member_until: string | null;
  created_at: string;
}

interface UserStats {
  total_projects: number;
  total_orders: number;
  member_days_remaining: number | null;
}

const UserProfilePage: React.FC = () => {
  const nav = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchUserInfo();
    fetchUserStats();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.warning('请先登录');
        nav('/login');
        return;
      }

      const resp = await fetch(`${API_BASE}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (resp.ok) {
        const data = await resp.json();
        setUser(data);
      } else {
        message.error('获取用户信息失败');
      }
    } catch (error) {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const resp = await fetch(`${API_BASE}/users/statistics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (resp.ok) {
        const data = await resp.json();
        setStats(data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  const handleChangePassword = async (values: any) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const resp = await fetch(`${API_BASE}/users/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (resp.ok) {
        message.success('密码修改成功');
        setPasswordModalVisible(false);
        passwordForm.resetFields();
      } else {
        const err = await resp.json();
        message.error(err.detail || '密码修改失败');
      }
    } catch (error) {
      message.error('网络错误');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div>加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page" style={{ padding: '24px 0' }}>
        <div className="page-inner">
          <Button onClick={() => nav('/login')}>请先登录</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button>
          <Logo />
        </div>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Title level={3} style={{ color: '#1a365d', marginBottom: 0 }}>
            用户中心
          </Title>
        </Card>

        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="创建项目"
                value={stats?.total_projects || 0}
                prefix={<ProjectOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="订单数量"
                value={stats?.total_orders || 0}
                prefix={<ShoppingOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="会员剩余天数"
                value={stats?.member_days_remaining || 0}
                prefix={<CrownOutlined />}
                suffix="天"
              />
            </Card>
          </Col>
        </Row>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="用户ID">
              <Text code>{user.id.slice(0, 8)}...</Text>
            </Descriptions.Item>
            <Descriptions.Item label="手机号">{user.phone}</Descriptions.Item>
            <Descriptions.Item label="会员状态">
              {user.is_member ? (
                <Tag color="gold" icon={<CrownOutlined />}>会员用户</Tag>
              ) : (
                <Tag color="default">免费用户</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="会员到期">
              {user.member_until ? new Date(user.member_until).toLocaleDateString('zh-CN') : '未开通'}
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {new Date(user.created_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Title level={4}>账户操作</Title>
          <Space>
            <Button
              type="primary"
              icon={<LockOutlined />}
              onClick={() => setPasswordModalVisible(true)}
            >
              修改密码
            </Button>
            <Button
              icon={<CrownOutlined />}
              onClick={() => nav('/upgrade')}
            >
              升级会员
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => nav('/store/profile')}
            >
              门店信息管理
            </Button>
          </Space>
        </Card>

        <Modal
          title="修改密码"
          open={passwordModalVisible}
          onCancel={() => setPasswordModalVisible(false)}
          footer={null}
        >
          <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item
              label="原密码"
              name="old_password"
              rules={[{ required: true, message: '请输入原密码' }]}
            >
              <Input.Password placeholder="请输入原密码" />
            </Form.Item>
            <Form.Item
              label="新密码"
              name="new_password"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6位' },
              ]}
            >
              <Input.Password placeholder="请输入新密码（至少6位）" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">确认修改</Button>
                <Button onClick={() => setPasswordModalVisible(false)}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        <div className="footer" style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><Logo /></div>
          <div>© 2026 排砖宝 TileLayout AI · 瓷砖行业数字化解决方案</div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
