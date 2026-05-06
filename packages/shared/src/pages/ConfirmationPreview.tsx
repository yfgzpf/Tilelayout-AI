import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Space,
  Divider,
  Table,
  Tag,
  message,
  Spin,
  Alert,
} from 'antd';
import {
  DownloadOutlined,
  ShareAltOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface StoreInfo {
  store_name?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
}

interface TileConfig {
  tileWidth?: number;
  tileHeight?: number;
  gapWidth?: number;
  direction?: string;
  startPoint?: { x: number; y: number };
}

interface MaterialItem {
  name: string;
  spec?: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  amount?: number;
}

interface ConfirmationData {
  project_name: string;
  project_status: string;
  show_price: boolean;
  is_member: boolean;
  tile_config?: TileConfig;
  statistics?: {
    whole_tiles?: number;
    cut_tiles?: number;
    total_tiles?: number;
    area_sq_m?: number;
    auxiliary_materials?: MaterialItem[];
  };
  store_info?: StoreInfo | null;
  generated_at: string;
}

const ConfirmationPreview: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConfirmationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfirmation = async () => {
      if (!token) {
        setError('确认单令牌缺失');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/v1/confirmations/${token}`);
        const result = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.detail || '确认单加载失败');
        }
      } catch (err) {
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchConfirmation();
  }, [token]);

  const handleDownloadPDF = () => {
    message.info('PDF 下载功能开发中');
  };

  const handleDownloadPPT = () => {
    message.info('PPT 下载功能开发中');
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/confirmation/${token}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: '排砖宝 - 方案确认单',
          text: `查看 ${data?.project_name} 的瓷砖排版方案`,
          url: shareUrl,
        });
        message.success('分享成功');
      } catch (err) {
        console.error('分享失败:', err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      message.success('链接已复制到剪贴板');
    }
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '未设置';
    if (phone.length === 11) {
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    return phone;
  };

  const renderCoverPage = () => (
    <Card
      className="mb-6"
      style={{
        background: 'linear-gradient(135deg, #1a365d 0%, #2c5282 100%)',
        color: 'white',
      }}
      bodyStyle={{ padding: '48px' }}
    >
      <div className="text-center">
        {data?.is_member && data?.store_info?.logo_url ? (
          <img
            src={data.store_info.logo_url}
            alt="Logo"
            className="mx-auto mb-6"
            style={{ height: '80px' }}
          />
        ) : (
          <div className="mb-6 text-gray-300">
            <WarningOutlined className="text-6xl" />
            <p className="mt-2 text-sm">
              {data?.is_member
                ? '请先上传商家 Logo'
                : '升级会员，展示您的品牌'}
            </p>
          </div>
        )}

        <Title level={1} style={{ color: 'white', marginBottom: 16 }}>
          {data?.project_name || '瓷砖排版方案'}
        </Title>

        <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 18 }}>
          方案确认单
        </Paragraph>

        <Divider style={{ borderColor: 'rgba(255,255,255,0.3)' }} />

        <div className="text-left mt-6">
          <p style={{ color: 'rgba(255,255,255,0.8)' }}>
            <strong>方案编号：</strong>
            {token?.substring(0, 8) || 'N/A'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.8)' }}>
            <strong>生成日期：</strong>
            {data?.generated_at
              ? new Date(data.generated_at).toLocaleDateString('zh-CN')
              : 'N/A'}
          </p>
          {data?.is_member && data?.store_info && (
            <>
              <p style={{ color: 'rgba(255,255,255,0.8)' }}>
                <strong>商家名称：</strong>
                {data.store_info.store_name || '未设置'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.8)' }}>
                <strong>联系电话：</strong>
                {formatPhone(data.store_info.phone)}
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );

  const renderEffectPage = () => (
    <Card className="mb-6" title="铺贴效果图">
      <div className="text-center" style={{ padding: '60px 0' }}>
        <div
          style={{
            backgroundColor: '#f0f0f0',
            borderRadius: 8,
            padding: '40px',
          }}
        >
          <EyeOutlined className="text-6xl text-gray-400" />
          <p className="mt-4 text-gray-500">
            {data?.tile_config
              ? `瓷砖规格：${data.tile_config.tileWidth}×${data.tile_config.tileHeight}mm | 留缝：${data.tile_config.gapWidth}mm | 方向：${data.tile_config.direction}`
              : '暂无排版配置信息'}
          </p>
          <p className="mt-2 text-sm text-gray-400">
            起铺点：
            {data?.tile_config?.startPoint
              ? `(${data.tile_config.startPoint.x}, ${data.tile_config.startPoint.y})`
              : '未设置'}
          </p>
        </div>
      </div>
    </Card>
  );

  const renderMaterialsPage = () => {
    const columns = [
      {
        title: '材料名称',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: '规格',
        dataIndex: 'spec',
        key: 'spec',
        width: 120,
      },
      {
        title: '数量',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 100,
        render: (qty: number) => `${qty}`,
      },
      {
        title: '单位',
        dataIndex: 'unit',
        key: 'unit',
        width: 80,
      },
    ];

    if (data?.show_price && data?.is_member) {
      columns.push(
        {
          title: '单价 (元)',
          dataIndex: 'unit_price',
          key: 'unit_price',
          width: 100,
          render: (price?: number) =>
            price ? `¥${price.toFixed(2)}` : '商议',
        },
        {
          title: '金额 (元)',
          dataIndex: 'amount',
          key: 'amount',
          width: 100,
          render: (amount?: number) =>
            amount ? `¥${amount.toFixed(2)}` : '-',
        }
      );
    } else {
      columns.push({
        title: '价格',
        key: 'price_placeholder',
        width: 100,
        render: () => (
          <Tag color="orange">
            {data?.is_member ? '隐藏' : '会员功能'}
          </Tag>
        ),
      });
    }

    const materials: MaterialItem[] = [];

    if (data?.statistics?.whole_tiles) {
      materials.push({
        name: '主砖 (整砖)',
        quantity: data.statistics.whole_tiles,
        unit: '片',
      });
    }

    if (data?.statistics?.cut_tiles) {
      materials.push({
        name: '主砖 (切割砖)',
        quantity: data.statistics.cut_tiles,
        unit: '片',
      });
    }

    if (data?.statistics?.auxiliary_materials) {
      materials.push(...data.statistics.auxiliary_materials);
    }

    return (
      <Card className="mb-6" title="材料明细与报价">
        <Table
          columns={columns}
          dataSource={materials}
          rowKey="name"
          pagination={false}
          footer={() => {
            const total = materials.reduce(
              (sum, item) => sum + (item.amount || 0),
              0
            );
            return (
              <div className="text-right font-bold">
                总计：{' '}
                {data?.show_price && data?.is_member
                  ? `¥${total.toFixed(2)}`
                  : '商议'}
              </div>
            );
          }}
        />

        {!data?.show_price && (
          <Alert
            className="mt-4"
            message="价格已隐藏"
            description="向业主展示时不显示价格信息"
            type="info"
            showIcon
          />
        )}
      </Card>
    );
  };

  const renderStorePage = () => {
    if (!data?.is_member || !data?.store_info) {
      return (
        <Card className="mb-6" title="商家联系信息">
          <div
            className="text-center"
            style={{ padding: '60px 0', backgroundColor: '#fafafa' }}
          >
            <WarningOutlined className="text-6xl text-gray-300" />
            <Title level={4} className="mt-4 text-gray-400">
              升级会员，展示您的品牌与联系方式
            </Title>
            <Paragraph className="text-gray-500">
              成为会员后，此处将展示您的门店 Logo、名称、地址、电话等信息
            </Paragraph>
            <Button type="primary" className="mt-4">
              立即升级
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <Card className="mb-6" title="商家联系信息">
        <div className="space-y-4">
          {data.store_info.logo_url && (
            <div className="text-center">
              <img
                src={data.store_info.logo_url}
                alt="Logo"
                style={{ height: '100px' }}
              />
            </div>
          )}
          <div>
            <Text strong>门店名称：</Text>
            {data.store_info.store_name || '未设置'}
          </div>
          <div>
            <Text strong>联系电话：</Text>
            {data.store_info.phone || '未设置'}
          </div>
          <div>
            <Text strong>门店地址：</Text>
            {data.store_info.address || '未设置'}
          </div>
        </div>
      </Card>
    );
  };

  const renderSignPage = () => (
    <Card className="mb-6" title="客户确认签字">
      <div style={{ padding: '40px 0' }}>
        <div className="mb-8">
          <Text strong className="mr-4">客户签字：</Text>
          <div
            style={{
              borderBottom: '2px solid #333',
              display: 'inline-block',
              width: '300px',
              height: '60px',
            }}
          />
        </div>

        <div className="mb-8">
          <Text strong className="mr-4">确认日期：</Text>
          <div
            style={{
              borderBottom: '2px solid #333',
              display: 'inline-block',
              width: '200px',
              height: '60px',
            }}
          />
        </div>

        <div>
          <Text strong className="mr-4">备注：</Text>
          <div
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              width: '100%',
              height: '100px',
              padding: '12px',
            }}
          />
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" tip="加载确认单中..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <Alert
            type="error"
            message="加载失败"
            description={error || '确认单不存在'}
            showIcon
          />
          <Button
            type="primary"
            className="mt-4"
            onClick={() => navigate('/')}
          >
            返回首页
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <Space>
            <Button onClick={() => navigate('/')}>返回首页</Button>
            <Title level={3} className="mb-0">
              {data.project_name} - 方案确认单
            </Title>
          </Space>
          <Space>
            <Button
              icon={<ShareAltOutlined />}
              onClick={handleShare}
            >
              分享
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadPDF}
            >
              下载 PDF
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => message.success('确认功能开发中')}
            >
              确认方案
            </Button>
          </Space>
        </div>

        {renderCoverPage()}
        {renderEffectPage()}
        {renderMaterialsPage()}
        {renderStorePage()}
        {renderSignPage()}

        <div className="text-center text-gray-400 text-sm mt-8">
          <Divider>
            本方案由 <strong>排砖宝 TileLayout AI</strong> 生成
          </Divider>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPreview;
