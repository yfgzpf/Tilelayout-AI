import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, message, Modal, Form, Button, Tag, Spin, Alert, Space } from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined, ExclamationCircleOutlined, PlusOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import { fetchProjects, createProject, deleteProjectApi, api } from '../services/api';
import { Logo, LogoIcon } from '../components/Logo';

const { confirm } = Modal;

/* ========== DATA ========== */
const FEATURES = [
  { icon: '📐', color: 'blue', title: '精确排版', desc: '纯数学几何算法保证100%排版精度，不依赖AI随机性，每一块瓷砖都精确到毫米' },
  { icon: '📱', color: 'amber', title: '三端统一', desc: 'Web / iOS / Android / Windows / Mac 全平台覆盖，代码复用率超过95%' },
  { icon: '📄', color: 'green', title: '一键确认单', desc: '自动生成带产品图、规格、价格、商家信息的PPT/PDF确认单，3分钟搞定' },
  { icon: '🛠️', color: 'red', title: '加工施工图', desc: '自动输出切割加工单与编号施工图，直接交付工厂和施工队使用' },
];

const PRICING = [
  { name: '免费版', price: '¥0', period: '', features: ['核心排版(限3次/月)', '基础PDF导出', '水印保护', '在线预览'], btn: '免费试用', type: 'outline' },
  { name: '设计师版', price: '¥19', period: '/月', features: ['无限排版', '无水印高清PDF', '纹理上传与抠图', '可显示价格', '商家信息展示'], btn: '立即订阅', type: 'accent', featured: true },
  { name: '门店专业版', price: '¥199', period: '/月起', features: ['多子账号管理', '产品库管理', '自定义品牌信息', 'API对接', '专属客服支持'], btn: '联系我们', type: 'outline' },
];

/* ========== MAIN COMPONENT ========== */
const Home: React.FC = () => {
  const nav = useNavigate();
  const { projects, setProjects, deleteProject } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await fetchProjects(); setProjects(r?.data || (Array.isArray(r) ? r : [])); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [setProjects]);

  React.useEffect(() => { load(); }, [load]);

  const filtered = search ? projects.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())) : projects;

  const handleDelete = useCallback((id: string) => {
    confirm({
      title: '确认删除', icon: <ExclamationCircleOutlined />, content: '删除后无法恢复', okType: 'danger',
      onOk: async () => { try { await deleteProjectApi(id); deleteProject(id); message.success('已删除'); } catch (e: any) { message.error(e.message); } },
    });
  }, [deleteProject]);

  const handleCreate = useCallback(async (v: { name: string }) => {
    try {
      setLoading(true);
      const r = await createProject({
        name: v.name,
        room_polygon: [[0,0],[3000,0],[3000,4000],[0,4000]],
        edges_annotated: [],
        tile_config: { tileWidth: 800, tileHeight: 800, gapWidth: 3, direction: 'horizontal', startPoint: { x: 0, y: 0 } },
      });
      const pid = r?.data?.id;
      if (pid) {
        nav(`/project/${pid}`);
        message.success('方案已创建，可编辑户型');
      } else {
        nav('/project/new');
      }
      setCreateOpen(false); form.resetFields();
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  }, [nav, form]);

  return (
    <div className="page">
      {/* ===== TOP NAV ===== */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => nav('/')}>
          <LogoIcon size={32} />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1a365d' }}>排砖宝</span>
        </div>
        <Space size={12}>
          <Button size="small" icon={<CrownOutlined />} onClick={() => nav('/upgrade')} style={{ borderColor: '#d4a574', color: '#d4a574' }}>升级会员</Button>
          <Button size="small" icon={<UserOutlined />} onClick={() => nav('/login')}>登录</Button>
          <Button size="small" type="primary" onClick={() => nav('/register')}>注册</Button>
        </Space>
      </div>

      {/* ===== HERO ===== */}
      <div className="hero">
        <div className="hero-inner">
          <Logo large />
          <h1>拍照手绘户型 <span>→</span> 精准排版 <span>→</span> 一键出图</h1>
          <p>为瓷砖门店和设计师打造的全链路数字化工具 — 从量房到确认单只需3分钟</p>
          <div className="hero-badges">
            <span className="hero-badge">🎯 100%数学精度</span>
            <span className="hero-badge">📱 Web / iOS / Android</span>
            <span className="hero-badge">🖥️ Windows / macOS</span>
            <span className="hero-badge">📄 PPT/PDF确认单</span>
          </div>
          <button className="btn btn-accent btn-lg" onClick={() => nav('/project/new')}>
            开始免费试用 →
          </button>
          <div className="hero-stats">
            <div className="hero-stat"><div className="hero-stat-num">100%</div><div className="hero-stat-label">排版精度</div></div>
            <div className="hero-stat"><div className="hero-stat-num">&lt;3min</div><div className="hero-stat-label">完成确认单</div></div>
            <div className="hero-stat"><div className="hero-stat-num">3端</div><div className="hero-stat-label">统一体验</div></div>
          </div>
        </div>
      </div>

      {/* ===== FEATURES ===== */}
      <div className="section">
        <div className="page-inner">
          <div className="section-title"><h2>为什么选择排砖宝？</h2><p>专为瓷砖行业深度定制，每一处细节都来自一线需求</p></div>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className={`feature-icon ${f.color}`}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== PROJECTS ===== */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="page-inner">
          <div className="section-title"><h2>我的排版方案</h2><p>管理您的所有项目，从草稿到交付全程追踪</p></div>
          <div className="project-header">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Input placeholder="搜索项目名称" prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} allowClear style={{ width: 240 }} />
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            </div>
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><PlusOutlined /> 新建方案</button>
          </div>

          {loading ? <div style={{ textAlign: 'center', padding: 56 }}><Spin size="large" /></div>
          : error ? <Alert message="加载失败" description={error} type="error" showIcon action={<Button onClick={load}>重试</Button>} />
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📐</div>
              <h3>{search ? '没有匹配的项目' : '还没有排版方案'}</h3>
              <p>{search ? '换个关键词试试' : '创建您的第一个瓷砖排版方案，即刻体验精准计算'}</p>
              {!search && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><PlusOutlined /> 创建第一个方案</button>}
            </div>
          ) : (
            <div className="project-grid">
              {filtered.map(p => (
                <div className="project-card" key={p.id} onClick={() => nav(`/project/${p.id}`)}>
                  <div className="project-card-header">
                    <div className="project-card-icon"><LogoIcon size={28} /></div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Tag color={p.status === 'completed' ? 'success' : p.status === 'in_progress' ? 'processing' : 'default'}>
                        {p.status === 'completed' ? '已完成' : p.status === 'in_progress' ? '进行中' : '草稿'}
                      </Tag>
                      <DeleteOutlined style={{ color: '#94a3b8', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); handleDelete(p.id); }} />
                    </div>
                  </div>
                  <h4>{p.name}</h4>
                  <div className="meta">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== PRICING ===== */}
      <div className="section" style={{ background: '#fff' }}>
        <div className="page-inner">
          <div className="section-title"><h2>选择适合您的方案</h2><p>从个人设计师到连锁品牌门店，总有一款适合您</p></div>
          <div className="pricing-grid">
            {PRICING.map((p, i) => (
              <div className={`pricing-card ${p.featured ? 'featured' : ''}`} key={i}>
                {p.featured && <div className="pricing-badge">🔥 最受欢迎</div>}
                <h3>{p.name}</h3>
                <div className="pricing-price">{p.price}<small>{p.period}</small></div>
                <div className="pricing-desc">{p.name === '免费版' ? '体验核心功能' : p.name === '设计师版' ? '适合独立设计师' : '适合门店与品牌'}</div>
                <ul className="pricing-features">{p.features.map((f, j) => <li key={j}>{f}</li>)}</ul>
                <button
                  className={`btn ${p.type === 'accent' ? 'btn-accent' : 'btn-outline'}`}
                  style={{ width: '100%', cursor: 'pointer' }}
                  onClick={() => {
                    if (p.name === '免费版') nav('/project/new');
                    else if (p.name === '门店专业版') nav('/contact');
                    else nav('/upgrade');
                  }}
                >
                  {p.btn}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== WORKFLOW ===== */}
      <div className="section" style={{ background: '#fff', paddingTop: 0 }}>
        <div className="page-inner">
          <div className="section-title"><h2>4步完成瓷砖排版</h2><p>无需专业CAD技能，新手3分钟上手</p></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { step: '01', icon: '📸', title: '拍照 / 画户型', desc: '上传手绘草图自动识别, 或选模板一键生成, 也可输入尺寸自动定位墙体', btn: '开始', path: '/project/new' },
              { step: '02', icon: '✏️', title: '调尺寸 / 选瓷砖', desc: '点击墙体输入尺寸, 从市场规格中选瓷砖型号, 尺寸自动填充', btn: '编辑方案', path: '/project/new' },
              { step: '03', icon: '🧮', title: '排版计算', desc: '系统自动计算瓷砖排列, 区分整砖与切割砖, 实时显示损耗率', btn: '预览排版', path: '/project/preview' },
              { step: '04', icon: '📄', title: '出确认单', desc: '一键生成含主砖+辅料明细的PPT/PDF确认单, 发给业主确认', btn: '查看示例', path: '/confirmation' },
            ].map((item, i) => (
              <div key={i} style={{ position: 'relative', padding: '24px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', transition: '.25s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#d4a574'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,165,116,.15)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                onClick={() => nav(item.path)}>
                <div style={{ fontSize: 42, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#d4a574', marginBottom: 4 }}>步骤 {item.step}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a365d', marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 12 }}>{item.desc}</div>
                <div style={{ color: '#d4a574', fontSize: 14, fontWeight: 600 }}>{item.btn} →</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div className="footer">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Logo /></div>
        <div>© 2026 排砖宝 TileLayout AI · 瓷砖行业数字化解决方案</div>
      </div>

      {/* ===== CREATE MODAL ===== */}
      <Modal title="创建排版方案" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields(); }} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate} autoComplete="off">
          <Form.Item label="方案名称" name="name" rules={[{ required: true, message: '请输入方案名称' }, { min: 2, message: '至少2个字符' }, { max: 50 }]}>
            <Input placeholder="例如：客厅800×800亮光砖排版方案" maxLength={50} showCount />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button onClick={() => { setCreateOpen(false); form.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>创建</Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Home;
