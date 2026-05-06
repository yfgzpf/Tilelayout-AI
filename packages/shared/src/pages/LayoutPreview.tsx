import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Space, Typography, Spin, message, Statistic, Row, Col } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import LayoutRenderer from '../components/LayoutRenderer/LayoutRenderer';

const { Title, Text } = Typography;

const LayoutPreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [layoutData, setLayoutData] = useState<any>(null);

  useEffect(() => {
    loadLayoutData();
  }, [id]);

  const loadLayoutData = async () => {
    try {
      setLoading(true);
      
      // 模拟数据 - 实际项目中应该从 API 获取
      const mockData = {
        projectId: id,
        tiles: [
          { id: '1', x: 0, y: 0, width: 800, height: 800, rotation: 0, isCut: false },
          { id: '2', x: 803, y: 0, width: 800, height: 800, rotation: 0, isCut: false },
          { id: '3', x: 0, y: 803, width: 800, height: 800, rotation: 0, isCut: false },
          { id: '4', x: 803, y: 803, width: 600, height: 800, rotation: 0, isCut: true },
        ],
        statistics: {
          totalTiles: 4,
          wholeTiles: 3,
          cutTiles: 1,
          wastePercentage: 5.2,
          totalArea: 3.2,
        },
      };
      
      setLayoutData(mockData);
    } catch (error) {
      console.error('加载排版数据失败:', error);
      message.error('加载排版数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      message.info('PDF 导出功能开发中...');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              返回
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              排版预览
            </Title>
          </Space>
          <Space>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              打印
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportPDF}
            >
              导出 PDF
            </Button>
          </Space>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              {layoutData && (
                <LayoutRenderer
                  tiles={layoutData.tiles}
                  width={1200}
                  height={800}
                />
              )}
            </Card>
          </div>

          <div>
            <Card title="统计信息" className="mb-4">
              {layoutData?.statistics && (
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic
                      title="总砖数"
                      value={layoutData.statistics.totalTiles}
                      suffix="片"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="整砖数"
                      value={layoutData.statistics.wholeTiles}
                      suffix="片"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="切割砖"
                      value={layoutData.statistics.cutTiles}
                      suffix="片"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="损耗率"
                      value={layoutData.statistics.wastePercentage}
                      suffix="%"
                      precision={1}
                    />
                  </Col>
                  <Col span={24}>
                    <Statistic
                      title="总面积"
                      value={layoutData.statistics.totalArea}
                      suffix="m²"
                      precision={2}
                    />
                  </Col>
                </Row>
              )}
            </Card>

            <Card title="图例">
              <Space direction="vertical" className="w-full">
                <div className="flex items-center">
                  <div
                    className="w-6 h-6 mr-2"
                    style={{ backgroundColor: '#1890ff', border: '1px solid #ccc' }}
                  />
                  <Text>整砖</Text>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-6 h-6 mr-2"
                    style={{ backgroundColor: '#52c41a', border: '1px solid #ccc' }}
                  />
                  <Text>切割砖</Text>
                </div>
              </Space>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayoutPreview;
