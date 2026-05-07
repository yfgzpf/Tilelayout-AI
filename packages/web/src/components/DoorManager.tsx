import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, InputNumber, Select, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CalculatorOutlined } from '@ant-design/icons';

const { Option } = Select;

interface DoorGap {
  id: string;
  x: number;
  y: number;
  width: number;
  type: 'entrance' | 'bathroom' | 'kitchen' | 'balcony';
  needsThreshold: boolean;
}

interface DoorManagerProps {
  doors: DoorGap[];
  onChange: (doors: DoorGap[]) => void;
  onCalculateThreshold: () => void;
}

const DOOR_TYPES = {
  entrance: { label: '入户门', color: 'blue' },
  bathroom: { label: '卫生间门', color: 'green' },
  kitchen: { label: '厨房门', color: 'orange' },
  balcony: { label: '阳台门', color: 'purple' },
};

const DoorManager: React.FC<DoorManagerProps> = ({
  doors,
  onChange,
  onCalculateThreshold,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDoor, setEditingDoor] = useState<DoorGap | null>(null);
  const [form] = Form.useForm();

  const handleAddDoor = () => {
    setEditingDoor(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditDoor = (door: DoorGap) => {
    setEditingDoor(door);
    form.setFieldsValue(door);
    setModalVisible(true);
  };

  const handleDeleteDoor = (id: string) => {
    onChange(doors.filter(d => d.id !== id));
    message.success('门洞已删除');
  };

  const handleSaveDoor = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingDoor) {
        onChange(doors.map(d => 
          d.id === editingDoor.id ? { ...d, ...values } : d
        ));
        message.success('门洞已更新');
      } else {
        const newDoor: DoorGap = {
          id: `door_${Date.now()}`,
          ...values,
          needsThreshold: true,
        };
        onChange([...doors, newDoor]);
        message.success('门洞已添加');
      }
      
      setModalVisible(false);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const columns = [
    {
      title: '门洞类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const config = DOOR_TYPES[type as keyof typeof DOOR_TYPES];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '位置 X (mm)',
      dataIndex: 'x',
      key: 'x',
    },
    {
      title: '位置 Y (mm)',
      dataIndex: 'y',
      key: 'y',
    },
    {
      title: '宽度 (mm)',
      dataIndex: 'width',
      key: 'width',
    },
    {
      title: '门头石',
      dataIndex: 'needsThreshold',
      key: 'needsThreshold',
      render: (needs: boolean) => (
        <Tag color={needs ? 'green' : 'default'}>
          {needs ? '需要' : '不需要'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DoorGap) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditDoor(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteDoor(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="门洞管理"
      extra={
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddDoor}
          >
            添加门洞
          </Button>
          <Button
            icon={<CalculatorOutlined />}
            onClick={onCalculateThreshold}
          >
            计算门头石
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={doors}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title={editingDoor ? '编辑门洞' : '添加门洞'}
        open={modalVisible}
        onOk={handleSaveDoor}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="门洞类型"
            name="type"
            rules={[{ required: true, message: '请选择门洞类型' }]}
          >
            <Select placeholder="选择门洞类型">
              {Object.entries(DOOR_TYPES).map(([key, value]) => (
                <Option key={key} value={key}>
                  <Tag color={value.color}>{value.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="位置 X (mm)"
            name="x"
            rules={[{ required: true, message: '请输入 X 坐标' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="位置 Y (mm)"
            name="y"
            rules={[{ required: true, message: '请输入 Y 坐标' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="门洞宽度 (mm)"
            name="width"
            rules={[{ required: true, message: '请输入门洞宽度' }]}
          >
            <InputNumber min={600} max={1500} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DoorManager;
