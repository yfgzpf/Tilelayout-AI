import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Upload, message, Space, Typography, Alert } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, SaveOutlined, PhoneOutlined, EnvironmentOutlined, ShopOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';
import type { RcFile } from 'antd/es/upload/interface';

const { Title, Text } = Typography;

const API_BASE = '/api/v1';

const StoreProfilePage: React.FC = () => {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.warning('请先登录');
        nav('/login');
        return;
      }

      const resp = await fetch(`${API_BASE}/store/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (resp.ok) {
        const data = await resp.json();
        if (data.store_name) {
          form.setFieldsValue({
            store_name: data.store_name,
            phone: data.phone,
            address: data.address,
          });
          setLogoUrl(data.logo_url);
        }
      }
    } catch (error) {
      console.error('获取门店信息失败:', error);
    }
  };

  const handleUploadLogo = async (file: RcFile): Promise<false> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('请先登录');
        return false;
      }

      const formData = new FormData();
      formData.append('file', file);

      const resp = await fetch(`${API_BASE}/store/upload-logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (resp.ok) {
        const data = await resp.json();
        setLogoUrl(data.data.logo_url);
        message.success('Logo 上传成功');
      } else {
        const err = await resp.json();
        message.error(err.detail || '上传失败');
      }
    } catch (error) {
      message.error('上传失败');
    }
    return false;
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const token = localStorage.getItem('token');
      
      if (!token) {
        message.error('请先登录');
        nav('/login');
        return;
      }

      const resp = await fetch(`${API_BASE}/store/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (resp.ok) {
        message.success('保存成功');
      } else {
        const err = await resp.json();
        message.error(err.detail || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner" style={{ maxWidth: 800 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button>
          <Logo />
        </div>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Title level={3} style={{ color: '#1a365d' }}>
            <ShopOutlined /> 门店信息管理
          </Title>
          <Text type="secondary">
            设置您的门店信息，将在确认单中展示给客户
          </Text>
        </Card>

        <Alert
          message="会员专属功能"
          description="门店信息管理仅对付费会员开放，升级会员后可在确认单中展示您的品牌Logo、联系方式等信息。"
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <Card style={{ borderRadius: 12 }}>
          <Form form={form} layout="vertical">
            <Form.Item label="门店 Logo">
              <Space direction="vertical" style={{ width: '100%' }}>
                {logoUrl && (
                  <img 
                    src={logoUrl} 
                    alt="Logo" 
                    style={{ maxWidth: 200, maxHeight: 100, objectFit: 'contain', marginBottom: 12 }} 
                  />
                )}
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={handleUploadLogo}
                >
                  <Button icon={<UploadOutlined />}>上传 Logo</Button>
                </Upload>
              </Space>
            </Form.Item>

            <Form.Item
              label="门店名称"
              name="store_name"
              rules={[{ required: true, message: '请输入门店名称' }]}
            >
              <Input 
                placeholder="例如：佛山陶瓷旗舰店" 
                prefix={<ShopOutlined />}
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="联系电话"
              name="phone"
              rules={[{ required: true, message: '请输入联系电话' }]}
            >
              <Input 
                placeholder="例如：400-888-6666" 
                prefix={<PhoneOutlined />}
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="门店地址"
              name="address"
              rules={[{ required: true, message: '请输入门店地址' }]}
            >
              <Input.TextArea 
                placeholder="例如：广东省佛山市禅城区陶瓷产业创新中心B座12层" 
                rows={3}
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={loading}
                onClick={handleSave}
                style={{ width: '100%' }}
              >
                保存门店信息
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div className="footer" style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><Logo /></div>
          <div>© 2026 排砖宝 TileLayout AI · 瓷砖行业数字化解决方案</div>
        </div>
      </div>
    </div>
  );
};

export default StoreProfilePage;
