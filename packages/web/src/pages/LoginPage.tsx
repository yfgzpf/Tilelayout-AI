import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { PhoneOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';
import { api } from '../services/api';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { phone: string; password: string }) => {
    setLoading(true);
    try {
      const r = await api.post<any>('/auth/login', {
        phone: values.phone,
        password: values.password,
      });
      if (r?.access_token) {
        api.setToken(r.access_token);
        message.success('登录成功');
        nav('/');
      } else {
        message.success('登录成功');
        nav('/');
      }
    } catch (e: any) {
      message.error(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <Card style={{ width: 400, borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo large />
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>登录后开始排版</Text>
        </div>
        <Form form={form} onFinish={handleLogin} layout="vertical" size="large">
          <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入11位手机号' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="手机号" maxLength={11} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <button type="submit" className="btn btn-accent" style={{ width: '100%', cursor: 'pointer', padding: '12px 0', fontSize: 16 }} disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', fontSize: 13 }}>
          <Text type="secondary">还没有账号？</Text>{' '}
          <a href="/register" style={{ color: '#d4a574' }} onClick={e => { e.preventDefault(); nav('/register'); }}>立即注册</a>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回首页</Button>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
