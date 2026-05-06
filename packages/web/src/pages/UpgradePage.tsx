import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Tag } from 'antd';
import { ArrowLeftOutlined, CheckCircleFilled, CrownFilled } from '@ant-design/icons';
import { Logo } from '../components/Logo';

const { Title, Text } = Typography;

const PLANS = [
  {
    name: '设计师版', price: '¥19', period: '/月', yearlyPrice: '¥99/年',
    features: ['无限排版次数', '无水印高清PDF', '纹理上传与抠图(无限)', '确认单含商家信息', '可显示材料价格', '手机在线预览确认单', 'PPT/PDF下载'],
    btn: '立即订阅', type: 'accent', featured: true,
  },
  {
    name: '门店专业版', price: '¥199', period: '/月起',
    features: ['包含设计师版全部功能', '多子账号管理(最多10个)', '产品库管理', '自定义品牌信息+Logo', 'API对接', '专属客服支持', '定制开发优先排期'],
    btn: '联系我们', type: 'outline', featured: false,
  },
];

const UpgradePage: React.FC = () => {
  const nav = useNavigate();

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner" style={{ maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button>
          <span className="logo"><Logo /></span>
        </div>

        <div className="section-title" style={{ marginBottom: 32 }}>
          <h2>升级会员，解锁全部功能</h2>
          <p>选择适合您的方案，享受无限制的专业瓷砖排版服务</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {PLANS.map((p, i) => (
            <div className={`pricing-card ${p.featured ? 'featured' : ''}`} key={i}>
              {p.featured && <div className="pricing-badge">🔥 最受欢迎</div>}
              <h3>{p.name}</h3>
              <div className="pricing-price">{p.price}<small>{p.period}</small></div>
              {p.yearlyPrice && <div style={{ fontSize: 13, color: '#d4a574', textAlign: 'center', marginBottom: 8 }}>{p.yearlyPrice} 更划算</div>}
              <ul className="pricing-features">
                {p.features.map((f, j) => <li key={j}>{f}</li>)}
              </ul>
              <button
                className={`btn ${p.type === 'accent' ? 'btn-accent' : 'btn-outline'}`}
                style={{ width: '100%', cursor: 'pointer', marginTop: 8 }}
                onClick={() => {
                  if (p.btn === '联系我们') nav('/contact');
                  else nav('/contact');
                }}
              >
                {p.btn}
              </button>
            </div>
          ))}
        </div>

        <Card style={{ borderRadius: 12, marginTop: 24, textAlign: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 14, color: '#64748b' }}>
            当前使用 <Tag color="default">免费版</Tag> · 
            升级后立即可用 · 
            <a href="/register" style={{ color: '#d4a574' }} onClick={e => { e.preventDefault(); nav('/register'); }}>注册新账号</a>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UpgradePage;
