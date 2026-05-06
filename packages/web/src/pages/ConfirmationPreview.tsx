import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Spin, message, Table, Descriptions, Tag, Divider } from 'antd';
import { ArrowLeftOutlined, FilePdfOutlined, FilePptOutlined, ShareAltOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Logo, LogoIcon } from '../components/Logo';

const { Title, Text } = Typography;

interface MaterialItem {
  name: string;
  qty: number;
  unit: string;
  unit_price?: number;
  amount?: number;
}

const DEMO_DATA = {
  project_name: '示例方案 - 客厅800×800亮光砖',
  project_status: 'draft',
  show_price: true,
  is_member: true,
  store_info: {
    store_name: '星辰瓷砖旗舰店',
    phone: '138-****-0000',
    address: '北京市朝阳区建材城A座301',
  },
  generated_at: new Date().toISOString(),
};

const DEMO_MATERIALS: MaterialItem[] = [
  { name: '亮光釉面砖', qty: 20, unit: '片(800×800mm)', unit_price: 120, amount: 2400 },
  { name: '瓷砖胶(粘结剂)', qty: 5, unit: '包(25kg)', unit_price: 45, amount: 225 },
  { name: '美缝剂(双组份)', qty: 4, unit: '支', unit_price: 38, amount: 152 },
  { name: '十字卡/找平器', qty: 1, unit: '包(200个)', unit_price: 15, amount: 15 },
];

const ConfirmationPreview: React.FC = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [loading, setLoading] = useState(!!token);
  const [data, setData] = useState<any>(token ? null : DEMO_DATA);
  const [materials, setMaterials] = useState<MaterialItem[]>(token ? [] : DEMO_MATERIALS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/v1/confirmations/${token}`);
        if (resp.ok) {
          const j = await resp.json();
          setData(j.data?.data || j.data || DEMO_DATA);
        } else {
          setData(DEMO_DATA);
          setMaterials(DEMO_MATERIALS);
        }
      } catch (e: any) {
        setData(DEMO_DATA);
        setMaterials(DEMO_MATERIALS);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载确认单..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Card><Title level={4}>加载失败</Title><Text type="secondary">{error}</Text></Card>
      </div>
    );
  }

  const isMember = data?.is_member ?? false;
  const showPrice = data?.show_price ?? false;
  const store = data?.store_info;
  const totalAmount = materials.reduce((sum, m) => sum + (m.amount || 0), 0);

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner" style={{ maxWidth: 800 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button>
            <span className="logo"><Logo /></span>
          </Space>
          <Space>
            <Button icon={<ShareAltOutlined />} onClick={() => {
              if (token) { navigator.clipboard.writeText(window.location.href); message.success('链接已复制'); }
            }}>分享链接</Button>
            <button className="btn btn-outline" style={{ cursor: 'pointer' }} onClick={() => {
              const a = document.createElement('a'); a.href = '/api/v1/projects/demo/export/ppt'; a.download = 'confirmation.pptx'; a.click();
            }}><FilePptOutlined /> PPT</button>
            <button className="btn btn-accent" style={{ cursor: 'pointer' }} onClick={() => {
              const a = document.createElement('a'); a.href = '/api/v1/projects/demo/export/pdf'; a.download = 'confirmation.pdf'; a.click();
            }}><FilePdfOutlined /> PDF</button>
          </Space>
        </div>

        <div className="confirmation-card cover-card">
          <div className="cover-inner">
            <div style={{ textAlign: 'center', marginBottom: 20 }}><Logo large /></div>
            <div className="cover-title">瓷砖铺贴方案确认单</div>
            <div className="cover-project-name">{data?.project_name || '未命名方案'}</div>
            <Divider style={{ borderColor: '#d4a574', margin: '16px 0' }} />
            {isMember && store?.store_name ? (
              <div className="cover-store-info">
                <div className="cover-store-name">{store.store_name}</div>
                {store.phone && <div className="cover-store-phone">📞 {store.phone}</div>}
                {store.address && <div className="cover-store-address">📍 {store.address}</div>}
              </div>
            ) : (
              <div className="cover-upgrade-hint">
                <EyeOutlined style={{ fontSize: 28, color: '#d4a574', marginBottom: 8 }} />
                <div>升级会员，展示您的品牌与联系方式</div>
              </div>
            )}
            <Divider style={{ borderColor: '#d4a574', margin: '16px 0' }} />
            <div className="cover-meta">
              <span>日期: {new Date(data?.generated_at || '').toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
        </div>

        <div className="confirmation-card">
          <Title level={4} style={{ color: '#1a365d', marginTop: 0 }}>📐 铺贴效果图</Title>
          <div className="preview-placeholder">
            <LogoIcon size={48} />
            <Text type="secondary">铺贴效果图（完整版从项目导出）</Text>
          </div>
        </div>

        <div className="confirmation-card">
          <Title level={4} style={{ color: '#1a365d', marginTop: 0 }}>📋 材料明细清单</Title>
          {materials.length > 0 ? (
            <Table
              dataSource={materials.map((m, i) => ({ ...m, key: i }))}
              pagination={false} size="small"
              columns={[
                { title: '品名', dataIndex: 'name', key: 'name' },
                { title: '规格/单位', dataIndex: 'unit', key: 'unit' },
                { title: '数量', dataIndex: 'qty', key: 'qty', align: 'center' as const },
                ...(showPrice ? [
                  { title: '单价(元)', dataIndex: 'unit_price', key: 'up', align: 'center' as const, render: (v: number) => v != null ? `¥${v.toFixed(2)}` : '-' },
                  { title: '金额(元)', dataIndex: 'amount', key: 'am', align: 'center' as const, render: (v: number) => v != null ? `¥${v.toFixed(2)}` : '-' },
                ] : []),
              ]}
              summary={showPrice ? () => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={showPrice ? 4 : 3} align="right"><Text strong>合计</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center"><Text strong style={{ color: '#1a365d', fontSize: 16 }}>¥{totalAmount.toFixed(2)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              ) : undefined}
            />
          ) : <Text type="secondary">暂无材料数据</Text>}
        </div>

        <div className="confirmation-card">
          <Title level={4} style={{ color: '#1a365d', marginTop: 0 }}>🏪 商家信息</Title>
          {isMember && store?.store_name ? (
            <Descriptions column={1} size="small" bordered>
              {store.store_name && <Descriptions.Item label="门店名称">{store.store_name}</Descriptions.Item>}
              {store.phone && <Descriptions.Item label="联系电话">{store.phone}</Descriptions.Item>}
              {store.address && <Descriptions.Item label="门店地址">{store.address}</Descriptions.Item>}
            </Descriptions>
          ) : (
            <div className="cover-upgrade-hint">
              <div style={{ fontSize: 18 }}>🔓</div>
              <div style={{ fontSize: 15, color: '#d4a574', fontWeight: 600 }}>升级会员展示品牌信息</div>
            </div>
          )}
        </div>

        <div className="confirmation-card">
          <Title level={4} style={{ color: '#1a365d', marginTop: 0 }}>✍️ 客户确认签字</Title>
          <div style={{ fontSize: 14, color: '#475569', lineHeight: 2.2 }}>
            <p>本人已确认上述铺贴方案、材料清单及费用明细（如有），同意按此方案进行施工。</p>
            <p style={{ marginTop: 20 }}>备注说明：________________________________________</p>
            <div style={{ display: 'flex', gap: 40, marginTop: 20 }}><div>客户签字：________________</div><div>日期：____年____月____日</div></div>
            <div style={{ display: 'flex', gap: 40, marginTop: 16 }}><div>设计师签字：________________</div><div>日期：____年____月____日</div></div>
          </div>
          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>本方案由排砖宝 TileLayout AI 生成 | www.tilelayout.ai</div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPreview;
