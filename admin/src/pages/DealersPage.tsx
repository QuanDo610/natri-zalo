import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Typography, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { mockDealers } from '@/mock/mockData';

const DealersPage: React.FC = () => {
  const [dealers, setDealers] = useState(mockDealers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState<any>(null);
  const [form] = Form.useForm();

  const columns = [
    { title: 'Mã', dataIndex: 'code', width: 80 },
    { title: 'Tên đại lý', dataIndex: 'name' },
    { title: 'Cửa hàng', dataIndex: 'shopName' },
    { title: 'SĐT', dataIndex: 'phone', width: 120 },
    { title: 'Địa chỉ', dataIndex: 'address', ellipsis: true },
    { title: 'Điểm', dataIndex: 'points', width: 80, sorter: (a: any, b: any) => a.points - b.points },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'Hoạt động' : 'Ngưng'}</Tag>
      ),
    },
    {
      title: 'Hành động',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  const handleEdit = (dealer: any) => {
    setEditingDealer(dealer);
    form.setFieldsValue(dealer);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingDealer(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (editingDealer) {
        setDealers((prev) =>
          prev.map((d) => (d.id === editingDealer.id ? { ...d, ...values } : d)),
        );
        message.success('Cập nhật đại lý thành công');
      } else {
        const newDealer = { ...values, id: `d${Date.now()}`, points: 0, active: true };
        setDealers((prev) => [newDealer, ...prev]);
        message.success('Thêm đại lý thành công');
      }
      setModalOpen(false);
    });
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Xác nhận xoá đại lý?',
      onOk: () => {
        setDealers((prev) => prev.map((d) => (d.id === id ? { ...d, active: false } : d)));
        message.success('Đã ngưng hoạt động đại lý');
      },
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4}>Quản lý Đại lý</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Thêm đại lý
        </Button>
      </div>

      <Table dataSource={dealers} columns={columns} rowKey="id" />

      <Modal
        title={editingDealer ? 'Sửa đại lý' : 'Thêm đại lý'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Mã đại lý" rules={[{ required: true }]}>
            <Input placeholder="DL001" disabled={!!editingDealer} />
          </Form.Item>
          <Form.Item name="name" label="Tên đại lý" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="SĐT" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="shopName" label="Tên cửa hàng" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DealersPage;
