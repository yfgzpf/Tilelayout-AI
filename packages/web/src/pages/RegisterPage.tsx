import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { PhoneOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';
import { api } from '../services/api';

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleRegister = async (values: { phone: string; password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        phone: values.phone,
        password: values.password,
      });
      message.success('注册成功，请登录');
      nav('/login');
    } catch (e: any) {
      message.error(e.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <Card style={{ width: 400, borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo large />
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>免费注册开始使用</Text>
        </div>
        <Form form={form} onFinish={handleRegister} layout="vertical" size="large">
          <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入11位手机号' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="手机号" maxLength={11} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码(至少6位)" />
          </Form.Item>
          <Form.Item name="confirmPassword" rules={[{ required: true, message: '请确认密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>
          <Form.Item>
            <button type="submit" className="btn btn-accent" style={{ width: '100%', cursor: 'pointer', padding: '12px 0', fontSize: 16 }} disabled={loading}>
              {loading ? '注册中...' : '注册'}
            </button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', fontSize: 13 }}>
          <Text type="secondary">已有账号？</Text>{' '}
          <a href="/login" style={{ color: '#d4a574' }} onClick={e => { e.preventDefault(); nav('/login'); }}>立即登录</a>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回首页</Button>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
