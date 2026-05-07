import React, { useState, useEffect } from 'react';
import { Card, Radio, InputNumber, Button, Descriptions, message, Space, Alert } from 'antd';
import { CalculatorOutlined, CheckOutlined } from '@ant-design/icons';

interface SkirtingCalculatorProps {
  roomPerimeter: number;
  doorWidth: number;
  tileWidth: number;
  tileHeight: number;
  tilePrice: number;
  onAddToQuote: (result: SkirtingResult) => void;
}

interface SkirtingResult {
  actualLength: number;
  skirtingHeight: number;
  tilesNeeded: number;
  piecesPerTile: number;
  cost: number;
  wasteRate: number;
}

const SkirtingCalculator: React.FC<SkirtingCalculatorProps> = ({
  roomPerimeter,
  doorWidth,
  tileWidth,
  tileHeight,
  tilePrice,
  onAddToQuote,
}) => {
  const [skirtingHeight, setSkirtingHeight] = useState(80);
  const [result, setResult] = useState<SkirtingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/sales/skirting/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_perimeter: roomPerimeter,
          door_width: doorWidth,
          tile_width: tileWidth,
          tile_height: tileHeight,
          skirting_height: skirtingHeight,
          tile_price: tilePrice,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data.data);
      } else {
        message.error('计算失败');
      }
    } catch (error) {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roomPerimeter > 0) {
      calculate();
    }
  }, [skirtingHeight, roomPerimeter, doorWidth, tileWidth, tileHeight, tilePrice]);

  return (
    <Card title={<><CalculatorOutlined /> 踢脚线计算</>}>
      <Alert
        message="从主砖切割踢脚线"
        description="使用当前瓷砖切割踢脚线，更经济实惠。踢脚线高度可选择 6cm、8cm 或 10cm。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="房间周长">{roomPerimeter.toFixed(2)} m</Descriptions.Item>
        <Descriptions.Item label="扣除门洞">-{doorWidth.toFixed(2)} m</Descriptions.Item>
        <Descriptions.Item label="实际长度">
          {result?.actual_length.toFixed(2) || 0} m
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 8 }}>踢脚线高度：</label>
        <Radio.Group
          value={skirtingHeight}
          onChange={(e) => setSkirtingHeight(e.target.value)}
          buttonStyle="solid"
        >
          <Radio.Button value={60}>6 cm</Radio.Button>
          <Radio.Button value={80}>8 cm (推荐)</Radio.Button>
          <Radio.Button value={100}>10 cm</Radio.Button>
        </Radio.Group>
      </div>

      {result && (
        <Card style={{ background: '#f5f5f5', marginBottom: 16 }}>
          <Descriptions column={2}>
            <Descriptions.Item label="单片可切">{result.pieces_per_tile} 条</Descriptions.Item>
            <Descriptions.Item label="需要瓷砖">{result.tiles_needed} 片</Descriptions.Item>
            <Descriptions.Item label="损耗率">{(result.waste_rate * 100).toFixed(1)}%</Descriptions.Item>
            <Descriptions.Item label="成本">
              <span style={{ fontSize: 18, fontWeight: 'bold', color: '#f5222d' }}>
                ¥{result.cost.toFixed(2)}
              </span>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Space>
        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={() => result && onAddToQuote(result)}
          disabled={!result}
        >
          添加到报价单
        </Button>
        <Button onClick={calculate} loading={loading}>
          重新计算
        </Button>
      </Space>
    </Card>
  );
};

export default SkirtingCalculator;
