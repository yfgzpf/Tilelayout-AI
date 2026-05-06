import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Space, Typography, Spin, message, Upload, Modal, Input, Row, Col } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, CameraOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';
import { api } from '../services/api';
import type { RcFile } from 'antd/es/upload/interface';

const { Title, Text } = Typography;

interface TextureItem {
  id: string;
  name: string;
  original_image_url: string;
  created_at: string;
}

const TextureLibrary: React.FC = () => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [textures, setTextures] = useState<TextureItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<RcFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<any>('/textures/');
      setTextures(r?.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadName) { message.warning('请填写名称并选择图片'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('name', uploadName);
      const resp = await fetch('/api/v1/textures/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${api['token']}` },
        body: fd,
      });
      const j = await resp.json();
      if (j.success) { message.success('上传成功'); setUploadOpen(false); setUploadName(''); setUploadFile(null); load(); }
      else { message.error(j.detail || '上传失败'); }
    } catch (e: any) { message.error(e.message); }
    finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/textures/${id}`); message.success('已删除'); load(); }
    catch (e: any) { message.error(e.message); }
  };

  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <Space><Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button><span className="logo"><Logo /></span></Space>
          <button className="btn btn-accent" style={{ cursor: 'pointer' }} onClick={() => setUploadOpen(true)}><CameraOutlined /> 上传纹理</button>
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: 56 }}><Spin size="large" /></div>
        : error ? <Text type="danger">{error}</Text>
        : textures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div><Title level={4}>暂无纹理素材</Title><Text type="secondary">上传瓷砖照片，系统自动抠图去背景</Text>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {textures.map(t => (
              <Col xs={12} sm={8} md={6} key={t.id}>
                <Card hoverable cover={<img src={t.original_image_url} alt={t.name} style={{ height: 160, objectFit: 'cover' }} />}
                  actions={[<DeleteOutlined key="del" onClick={() => handleDelete(t.id)} style={{ color: '#ef4444' }} />]}>
                  <Card.Meta title={t.name} description={new Date(t.created_at).toLocaleDateString()} />
                </Card>
              </Col>
            ))}
          </Row>
        )}
        <Modal title="上传纹理" open={uploadOpen} onCancel={() => { setUploadOpen(false); setUploadFile(null); }} onOk={handleUpload} confirmLoading={uploading}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <Input placeholder="纹理名称" value={uploadName} onChange={e => setUploadName(e.target.value)} />
            <Upload accept="image/*" showUploadList={false} beforeUpload={f => { setUploadFile(f); return false; }}>
              <Button icon={<CameraOutlined />}>{uploadFile ? uploadFile.name : '选择图片'}</Button>
            </Upload>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default TextureLibrary;
