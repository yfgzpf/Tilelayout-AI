import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, message, Spin } from 'antd';
import { CheckCircleOutlined, StarOutlined } from '@ant-design/icons';

interface LayoutPlan {
  plan_id: string;
  plan_name: string;
  layout_type: string;
  waste_rate: number;
  tiles_needed: number;
  cost: number;
  beauty_score: number;
  description: string;
}

interface LayoutPlanComparisonProps {
  roomArea: number;
  tileWidth: number;
  tileHeight: number;
  tilePrice: number;
  onSelectPlan: (planId: string) => void;
}

const LayoutPlanComparison: React.FC<LayoutPlanComparisonProps> = ({
  roomArea,
  tileWidth,
  tileHeight,
  tilePrice,
  onSelectPlan,
}) => {
  const [plans, setPlans] = useState<LayoutPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, [roomArea, tileWidth, tileHeight, tilePrice]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/sales/layout/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_area: roomArea,
          tile_width: tileWidth,
          tile_height: tileHeight,
          tile_price: tilePrice,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPlans(data.data);
      } else {
        message.error('获取方案失败');
      }
    } catch (error) {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    onSelectPlan(planId);
    message.success('方案已选择');
  };

  const columns = [
    {
      title: '方案',
      dataIndex: 'plan_name',
      key: 'plan_name',
      render: (name: string, record: LayoutPlan) => (
        <Space>
          {name}
          {record.beauty_score >= 9 && (
            <Tag color="gold" icon={<StarOutlined />}>
              推荐
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '铺贴方式',
      dataIndex: 'layout_type',
      key: 'layout_type',
    },
    {
      title: '损耗率',
      dataIndex: 'waste_rate',
      key: 'waste_rate',
      render: (rate: number) => (
        <Tag color={rate <= 0.08 ? 'green' : rate <= 0.12 ? 'orange' : 'red'}>
          {(rate * 100).toFixed(0)}%
        </Tag>
      ),
    },
    {
      title: '用量',
      dataIndex: 'tiles_needed',
      key: 'tiles_needed',
      render: (count: number) => `${count} 片`,
    },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
      render: (cost: number) => (
        <span style={{ fontWeight: 'bold', color: '#f5222d' }}>
          ¥{cost.toFixed(0)}
        </span>
      ),
    },
    {
      title: '美观度',
      dataIndex: 'beauty_score',
      key: 'beauty_score',
      render: (score: number) => (
        <Tag color={score >= 9 ? 'green' : score >= 7 ? 'blue' : 'default'}>
          {score}/10
        </Tag>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 200,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: LayoutPlan) => (
        <Button
          type={selectedPlanId === record.plan_id ? 'primary' : 'default'}
          icon={<CheckCircleOutlined />}
          onClick={() => handleSelectPlan(record.plan_id)}
        >
          {selectedPlanId === record.plan_id ? '已选择' : '选择此方案'}
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <Card title="智能排版方案对比">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="正在生成方案..." />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="智能排版方案对比"
      extra={
        <Button onClick={fetchPlans} loading={loading}>
          刷新方案
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={plans}
        rowKey="plan_id"
        pagination={false}
        rowClassName={(record) => 
          selectedPlanId === record.plan_id ? 'ant-table-row-selected' : ''
        }
      />
    </Card>
  );
};

export default LayoutPlanComparison;
