import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Descriptions, Alert } from 'antd';
import { ArrowLeftOutlined, WechatOutlined, PhoneOutlined, MailOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';

const { Title, Text, Paragraph } = Typography;

const ContactPage: React.FC = () => {
  const nav = useNavigate();

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner" style={{ maxWidth: 800 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button>
          <span className="logo"><Logo /></span>
        </div>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Title level={3} style={{ color: '#1a365d' }}>联系我们</Title>
          <Paragraph style={{ color: '#64748b', fontSize: 14 }}>
            排砖宝致力于为瓷砖行业提供专业数字化解决方案。如需了解门店专业版功能、API对接或定制需求，请通过以下方式联系我们。
          </Paragraph>
        </Card>

        <Card style={{ borderRadius: 12, marginBottom: 20 }}>
          <Descriptions column={1} size="middle" bordered>
            <Descriptions.Item label={<><PhoneOutlined /> 电话咨询</>}>
              <Text strong style={{ fontSize: 16 }}>400-888-6666</Text>
              <br /><Text type="secondary">工作日 9:00-18:00</Text>
            </Descriptions.Item>
            <Descriptions.Item label={<><WechatOutlined /> 微信咨询</>}>
              <Text>搜索公众号「排砖宝」或扫描客服二维码</Text>
            </Descriptions.Item>
            <Descriptions.Item label={<><MailOutlined /> 邮件联系</>}>
              <Text code>support@tilelayout.ai</Text>
              <br /><Text type="secondary">商务合作: biz@tilelayout.ai</Text>
            </Descriptions.Item>
            <Descriptions.Item label={<><EnvironmentOutlined /> 公司地址</>}>
              <Text>广东省佛山市禅城区陶瓷产业创新中心B座12层</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card style={{ borderRadius: 12, background: '#f0f4ff' }}>
          <Title level={4} style={{ color: '#1a365d' }}>📋 快速咨询</Title>
          <Paragraph style={{ color: '#64748b', marginBottom: 16 }}>
            留下您的联系方式，我们的工作人员将在1个工作日内与您联系。
          </Paragraph>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-accent" style={{ cursor: 'pointer' }} onClick={() => nav('/register')}>免费注册试用</button>
            <button className="btn btn-outline" style={{ cursor: 'pointer' }} onClick={() => nav('/login')}>已有账号登录</button>
          </div>
        </Card>

        <div className="footer" style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Logo /></div>
          <div>© 2026 排砖宝 TileLayout AI · 瓷砖行业数字化解决方案</div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
