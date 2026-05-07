import React, { useState, useEffect } from 'react';
import { Button, Card, Space, Typography, Spin, message, Table, Descriptions, Tag, Divider, Alert } from 'antd';
import { ArrowLeftOutlined, FilePdfOutlined, FilePptOutlined, ShareAltOutlined, EyeOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Logo, LogoIcon } from '../components/Logo';
import { api } from '../services/api';

const { Title, Text } = Typography;

interface MaterialItem {
  name: string;
  spec: string;
  qty: number;
  unit: string;
  unit_price?: number;
  amount?: number;
  remark?: string;
}

interface QuoteData {
  project_name: string;
  area_sq_m: number;
  items: MaterialItem[];
  total_amount: number;
  main_tile_cost: number;
  auxiliary_cost: number;
  threshold_cost: number;
  skirting_cost: number;
  waterproof_cost: number;
}

interface ProjectData {
  id: string;
  name: string;
  roomPolygon: number[][];
  tileConfig: {
    tileWidth?: number;
    tileHeight?: number;
    gapWidth?: number;
    direction?: string;
    startPoint?: number[];
  } | null;
  components: Array<{
    id: string;
    type: string;
    width: number;
    height: number;
    label: string;
  }>;
  showPrice: boolean;
  status: string;
}

interface StoreInfo {
  store_name: string;
  phone: string;
  address: string;
  logo_url?: string;
}

function calcPolygonArea(polygon: number[][]): number {
  if (!polygon || polygon.length < 3) return 0;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  return Math.abs(area) / 2.0;
}

function calcPolygonPerimeter(polygon: number[][]): number {
  if (!polygon || polygon.length < 2) return 0;
  let perimeter = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = polygon[j][0] - polygon[i][0];
    const dy = polygon[j][1] - polygon[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

const ConfirmationPreview: React.FC = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const projectId = params.get('projectId');
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        setError('缺少项目ID，请从项目编辑页进入');
        return;
      }
      setLoading(true);
      try {
        const resp = await api.get<any>(`/projects/${projectId}`);
        const data = resp?.data || resp;
        setProjectData({
          id: data.id || projectId,
          name: data.name || '未命名方案',
          roomPolygon: data.roomPolygon || data.room_polygon || [],
          tileConfig: data.tileConfig || data.tile_config || null,
          components: data.components || [],
          showPrice: data.showPrice ?? data.show_price ?? true,
          status: data.status || 'draft',
        });

        const userResp = await api.get<any>('/users/me').catch(() => null);
        const userData = userResp?.data || userResp;
        if (userData) {
          setIsMember(userData.is_member ?? userData.isMember ?? false);
          if (userData.is_member || userData.isMember) {
            const storeResp = await api.get<any>('/store/profile').catch(() => null);
            const storeData = storeResp?.data || storeResp;
            if (storeData && storeData.store_name) {
              setStoreInfo({
                store_name: storeData.store_name,
                phone: storeData.phone || '',
                address: storeData.address || '',
                logo_url: storeData.logo_url,
              });
            }
          }
        }
      } catch (e: any) {
        setError(e.message || '加载项目失败');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      setLoading(true);
      fetch(`/api/v1/confirmations/${token}`)
        .then(r => r.ok ? r.json() : Promise.reject('链接无效'))
        .then(j => {
          const d = j.data || j;
          setProjectData(d.project || null);
          setQuoteData(d.quote || null);
          setIsMember(d.is_member ?? false);
          setStoreInfo(d.store_info || null);
        })
        .catch(() => setError('确认单链接无效或已过期'))
        .finally(() => setLoading(false));
    } else {
      loadProject();
    }
  }, [projectId, token]);

  const calculateQuote = async () => {
    if (!projectData && !projectId) {
      message.warning('缺少项目数据');
      return;
    }
    setCalculating(true);
    try {
      let currentProject = projectData;
      if (!currentProject && projectId) {
        const resp = await api.get<any>(`/projects/${projectId}`);
        const data = resp?.data || resp;
        currentProject = {
          id: data.id || projectId,
          name: data.name || '未命名方案',
          roomPolygon: data.roomPolygon || data.room_polygon || [],
          tileConfig: data.tileConfig || data.tile_config || null,
          components: data.components || [],
          showPrice: data.showPrice ?? data.show_price ?? true,
          status: data.status || 'draft',
        };
        setProjectData(currentProject);
      }
      if (!currentProject) {
        message.error('无法获取项目数据');
        return;
      }

      const polygon = currentProject.roomPolygon || [];
      const areaSqMm = calcPolygonArea(polygon);
      const areaSqM = areaSqMm / 1_000_000.0;
      const perimeterMm = calcPolygonPerimeter(polygon);

      const tc = currentProject.tileConfig || {};
      const tileWidth = tc.tileWidth || tc.tile_width || 800;
      const tileHeight = tc.tileHeight || tc.tile_height || 800;
      const gapWidth = tc.gapWidth || tc.gap_width || 3;

      const doorComponents = (currentProject.components || []).filter(
        (c: any) => c.type === 'door'
      );
      const doorGaps = doorComponents.map((d: any, i: number) => ({
        width: d.width || 800,
        position: d.label || `door_${i}`,
      }));

      const hasWetArea = (currentProject.components || []).some(
        (c: any) => c.type === 'door' && (c.label?.includes('卫') || c.label?.includes('厨') || c.label?.includes('阳台'))
      );

      const resp = await api.post<any>('/sales/quote/complete', {
        project_name: currentProject.name || '瓷砖排版方案',
        area_sq_m: areaSqM || 1,
        tile_width_mm: tileWidth,
        tile_height_mm: tileHeight,
        gap_width_mm: gapWidth,
        tile_price: 50.0,
        room_perimeter_mm: perimeterMm,
        door_gaps: doorGaps.length > 0 ? doorGaps : undefined,
        include_waterproof: hasWetArea,
        waterproof_area_sq_m: hasWetArea ? areaSqM * 0.5 : 0,
        threshold_material: 'marble',
      });

      const result = resp?.data || resp;
      setQuoteData(result);
      message.success('报价单计算完成');
    } catch (e: any) {
      message.error('计算失败: ' + (e.message || '未知错误'));
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (projectData && !quoteData && !token) {
      calculateQuote();
    }
  }, [projectData]);

  const downloadFile = async (type: 'pdf' | 'ppt') => {
    const pid = projectData?.id || projectId;
    if (!pid) {
      message.warning('缺少项目ID');
      return;
    }
    setDownloading(true);
    try {
      const authToken = localStorage.getItem('token');
      const resp = await fetch(`/api/v1/projects/${pid}/export/${type}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
      });
      if (!resp.ok) throw new Error(`导出失败(${resp.status})`);
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectData?.name || 'confirmation'}.${type === 'pdf' ? 'pdf' : 'pptx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success(`${type.toUpperCase()}下载成功`);
    } catch (e: any) {
      message.error(e.message || '下载失败');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载确认单..." />
      </div>
    );
  }

  const showPrice = projectData?.showPrice ?? true;
  const materials = quoteData?.items || [];
  const totalAmount = quoteData?.total_amount || 0;
  const polygon = projectData?.roomPolygon || [];
  const areaSqM = calcPolygonArea(polygon) / 1_000_000.0;

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner" style={{ maxWidth: 800 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>返回</Button>
            <span className="logo"><Logo /></span>
          </Space>
          <Space>
            <Button icon={<CalculatorOutlined />} onClick={calculateQuote} loading={calculating}>重新计算</Button>
            <Button icon={<ShareAltOutlined />} onClick={() => {
              if (token || projectId) {
                navigator.clipboard.writeText(window.location.href);
                message.success('链接已复制');
              }
            }}>分享链接</Button>
            <Button icon={<FilePptOutlined />} onClick={() => downloadFile('ppt')} loading={downloading}>PPT</Button>
            <Button icon={<FilePdfOutlined />} type="primary" onClick={() => downloadFile('pdf')} loading={downloading}>PDF</Button>
          </Space>
        </div>

        {error && (
          <Alert message="错误" description={error} type="error" showIcon style={{ marginBottom: 16 }} />
        )}

        <div className="confirmation-card cover-card">
          <div className="cover-inner">
            <div style={{ textAlign: 'center', marginBottom: 20 }}><Logo large /></div>
            <div className="cover-title">瓷砖铺贴方案确认单</div>
            <div className="cover-project-name">{quoteData?.project_name || projectData?.name || '未命名方案'}</div>
            <Divider style={{ borderColor: '#d4a574', margin: '16px 0' }} />
            {isMember && storeInfo?.store_name ? (
              <div className="cover-store-info">
                <div className="cover-store-name">{storeInfo.store_name}</div>
                {storeInfo.phone && <div className="cover-store-phone">📞 {storeInfo.phone}</div>}
                {storeInfo.address && <div className="cover-store-address">📍 {storeInfo.address}</div>}
              </div>
            ) : (
              <div className="cover-upgrade-hint">
                <EyeOutlined style={{ fontSize: 28, color: '#d4a574', marginBottom: 8 }} />
                <div>升级会员，展示您的品牌与联系方式</div>
              </div>
            )}
            <Divider style={{ borderColor: '#d4a574', margin: '16px 0' }} />
            <div className="cover-meta">
              <span>面积: {(quoteData?.area_sq_m || areaSqM).toFixed(2)} m²</span>
              <span style={{ marginLeft: 20 }}>日期: {new Date().toLocaleDateString('zh-CN')}</span>
              {projectData?.status && (
                <Tag color={projectData.status === 'completed' ? 'success' : 'processing'} style={{ marginLeft: 12 }}>
                  {projectData.status === 'completed' ? '已完成' : projectData.status === 'in_progress' ? '进行中' : '草稿'}
                </Tag>
              )}
            </div>
          </div>
        </div>

        <div className="confirmation-card">
          <Title level={4} style={{ color: '#1a365d', marginTop: 0 }}>📐 铺贴效果图</Title>
          {polygon.length >= 3 ? (
            <div style={{ position: 'relative', width: '100%', height: 320, background: '#f8fafc', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              {(() => {
                const xs = polygon.map((p: number[]) => p[0]);
                const ys = polygon.map((p: number[]) => p[1]);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const rangeX = maxX - minX || 1;
                const rangeY = maxY - minY || 1;
                const scale = Math.min(700 / rangeX, 280 / rangeY);
                const offsetX = (760 - rangeX * scale) / 2;
                const offsetY = (300 - rangeY * scale) / 2;
                const points = polygon.map((p: number[]) => `${(p[0] - minX) * scale + offsetX},${(p[1] - minY) * scale + offsetY}`).join(' ');
                return (
                  <svg width="100%" height="100%" viewBox="0 0 760 300">
                    <polygon points={points} fill="#e8f0fe" stroke="#1a365d" strokeWidth="2" />
                    {polygon.map((p: number[], i: number) => (
                      <circle key={i} cx={(p[0] - minX) * scale + offsetX} cy={(p[1] - minY) * scale + offsetY} r="4" fill="#1a365d" />
                    ))}
                    <text x="380" y="290" textAnchor="middle" fill="#94a3b8" fontSize="12">
                      {projectData?.tileConfig ? `${projectData.tileConfig.tileWidth || projectData.tileConfig.tile_width || 800}×${projectData.tileConfig.tileHeight || projectData.tileConfig.tile_height || 800}mm` : '800×800mm'} 铺贴方案预览
                    </text>
                  </svg>
                );
              })()}
            </div>
          ) : (
            <div className="preview-placeholder">
              <LogoIcon size={48} />
              <Text type="secondary">请先在项目编辑页绘制户型轮廓</Text>
            </div>
          )}
        </div>

        <div className="confirmation-card">
          <Title level={4} style={{ color: '#1a365d', marginTop: 0 }}>📋 材料明细清单</Title>
          {materials.length > 0 ? (
            <>
              <Table
                dataSource={materials.map((m, i) => ({ ...m, key: i }))}
                pagination={false} size="small"
                columns={[
                  { title: '品名', dataIndex: 'name', key: 'name', width: 150 },
                  { title: '规格', dataIndex: 'spec', key: 'spec', width: 120 },
                  { title: '数量', dataIndex: 'qty', key: 'qty', align: 'center' as const, width: 80, render: (v: number) => typeof v === 'number' ? Math.ceil(v) : v },
                  { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
                  ...(showPrice && isMember ? [
                    { title: '单价(元)', dataIndex: 'unit_price', key: 'up', align: 'center' as const, width: 100, render: (v: number) => v != null ? `¥${Number(v).toFixed(2)}` : '-' },
                    { title: '金额(元)', dataIndex: 'amount', key: 'am', align: 'center' as const, width: 100, render: (v: number) => v != null ? `¥${Number(v).toFixed(2)}` : '-' },
                  ] : []),
                ]}
                summary={showPrice && isMember ? () => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right"><Text strong>合计</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center"><Text strong style={{ color: '#1a365d', fontSize: 16 }}>¥{totalAmount.toFixed(2)}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : undefined}
              />
              {quoteData && showPrice && isMember && (
                <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div><Text type="secondary">主砖费用:</Text> <Text strong>¥{quoteData.main_tile_cost.toFixed(2)}</Text></div>
                    <div><Text type="secondary">辅料费用:</Text> <Text strong>¥{quoteData.auxiliary_cost.toFixed(2)}</Text></div>
                    <div><Text type="secondary">门头石:</Text> <Text strong>¥{quoteData.threshold_cost.toFixed(2)}</Text></div>
                    <div><Text type="secondary">踢脚线:</Text> <Text strong>¥{quoteData.skirting_cost.toFixed(2)}</Text></div>
                    <div><Text type="secondary">防水涂料:</Text> <Text strong>¥{quoteData.waterproof_cost.toFixed(2)}</Text></div>
                    <div><Text type="secondary">总计:</Text> <Text strong style={{ color: '#1a365d', fontSize: 16 }}>¥{quoteData.total_amount.toFixed(2)}</Text></div>
                  </div>
                </div>
              )}
              {!isMember && showPrice && (
                <Alert message="价格信息仅会员可见" description="升级会员后可查看完整报价明细" type="info" showIcon style={{ marginTop: 12 }} />
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">暂无材料数据，请点击"重新计算"生成报价单</Text>
              <div style={{ marginTop: 16 }}>
                <Button type="primary" icon={<CalculatorOutlined />} onClick={calculateQuote} loading={calculating}>
                  生成报价单
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="confirmation-card">
          <Title level={4} style={{ color: '#1a365d', marginTop: 0 }}>🏪 商家信息</Title>
          {isMember && storeInfo?.store_name ? (
            <Descriptions column={1} size="small" bordered>
              {storeInfo.store_name && <Descriptions.Item label="门店名称">{storeInfo.store_name}</Descriptions.Item>}
              {storeInfo.phone && <Descriptions.Item label="联系电话">{storeInfo.phone}</Descriptions.Item>}
              {storeInfo.address && <Descriptions.Item label="门店地址">{storeInfo.address}</Descriptions.Item>}
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
