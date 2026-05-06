import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Space, Typography, Spin, message, Modal, Form, Input, InputNumber, Table, Tag } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';
import { api } from '../services/api';

const { Title, Text } = Typography;

interface SKU { id: string; product_id: string; size_x_mm: number; size_y_mm: number; unit_price?: number; unit: string; stock: number; }
interface ProductItem { id: string; name: string; image_url?: string; skus: SKU[]; created_at: string; }

const ProductManager: React.FC = () => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [skuOpen, setSkuOpen] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [skuForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get<any>('/products/'); setProducts(r?.data || []); }
    catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (v: { name: string }) => {
    setSaving(true);
    try { await api.post('/products/', { name: v.name }); message.success('产品已创建'); setCreateOpen(false); form.resetFields(); load(); }
    catch (e: any) { message.error(e.message); }
    finally { setSaving(false); }
  };

  const handleAddSku = async (productId: string, v: any) => {
    setSaving(true);
    try {
      await api.post(`/products/${productId}/skus`, {
        size_x_mm: v.size_x_mm, size_y_mm: v.size_y_mm, unit_price: v.unit_price || 0, unit: '片', stock: v.stock || 0,
      });
      message.success('SKU已添加'); setSkuOpen(null); skuForm.resetFields(); load();
    } catch (e: any) { message.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteSku = async (productId: string, skuId: string) => {
    try { await api.delete(`/products/${productId}/skus/${skuId}`); message.success('已删除'); load(); }
    catch (e: any) { message.error(e.message); }
  };

  const handleDeleteProduct = async (id: string) => {
    try { await api.delete(`/products/${id}`); message.success('已删除'); load(); }
    catch (e: any) { message.error(e.message); }
  };

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <Space><Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button><span className="logo"><Logo /></span></Space>
          <button className="btn btn-accent" style={{ cursor: 'pointer' }} onClick={() => setCreateOpen(true)}><PlusOutlined /> 添加产品</button>
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: 56 }}><Spin size="large" /></div>
        : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div><Title level={4}>暂无产品</Title><Text type="secondary">添加瓷砖产品并设置规格和价格</Text>
          </div>
        ) : products.map(p => (
          <Card key={p.id} style={{ borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={4} style={{ margin: 0 }}>{p.name}</Title>
              <Space>
                <Button size="small" icon={<PlusOutlined />} onClick={() => { setSkuOpen(p.id); skuForm.resetFields(); }}>添加规格</Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteProduct(p.id)} />
              </Space>
            </div>
            {p.skus.length > 0 ? (
              <Table dataSource={p.skus.map(s => ({ ...s, key: s.id }))} pagination={false} size="small"
                columns={[
                  { title: '规格(mm)', key: 'spec', render: (_: any, r: SKU) => `${r.size_x_mm}×${r.size_y_mm}` },
                  { title: '单价(元)', dataIndex: 'unit_price', render: (v: number) => v != null ? `¥${v.toFixed(2)}` : <Tag>未设置</Tag> },
                  { title: '库存', dataIndex: 'stock' },
                  { title: '操作', key: 'act', render: (_: any, r: SKU) => <Button size="small" danger onClick={() => handleDeleteSku(p.id, r.id)}>删除</Button> },
                ]}
              />
            ) : <Text type="secondary" style={{ fontSize: 13 }}>暂无规格，请添加</Text>}
          </Card>
        ))}
        <Modal title="添加产品" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields(); }} footer={null}>
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item name="name" label="产品名称" rules={[{ required: true }]}><Input placeholder="如：亮光釉面砖" /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={saving} block>创建</Button></Form.Item>
          </Form>
        </Modal>
        <Modal title="添加规格" open={!!skuOpen} onCancel={() => setSkuOpen(null)} footer={null}>
          <Form form={skuForm} layout="vertical" onFinish={(v) => skuOpen && handleAddSku(skuOpen, v)}>
            <Form.Item name="size_x_mm" label="宽度(mm)" rules={[{ required: true }]}><InputNumber min={50} max={3000} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="size_y_mm" label="高度(mm)" rules={[{ required: true }]}><InputNumber min={50} max={3000} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="unit_price" label="单价(元/片)"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="stock" label="库存(片)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={saving} block>添加</Button></Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default ProductManager;
