import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Typography, Tag, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { mockUsers } from '@/mock/mockData';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState(mockUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    { title: 'Username', dataIndex: 'username' },
    { title: 'Họ tên', dataIndex: 'fullName' },
    {
      title: 'Role',
      dataIndex: 'role',
      width: 100,
      render: (r: string) => <Tag color={r === 'ADMIN' ? 'blue' : 'green'}>{r}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Hành động',
      width: 160,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" onClick={() => message.info('Reset password: coming soon')}>
            Reset PW
          </Button>
          <Button size="small" danger onClick={() => {
            setUsers(prev => prev.map(u => u.id === record.id ? { ...u, active: !u.active } : u));
          }}>
            {record.active ? 'Disable' : 'Enable'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4}>Quản lý Users</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          Thêm user
        </Button>
      </div>
      <Table dataSource={users} columns={columns} rowKey="id" />

      <Modal
        title="Thêm user"
        open={modalOpen}
        onOk={() => {
          form.validateFields().then((values) => {
            setUsers(prev => [...prev, { ...values, id: `u${Date.now()}`, active: true }]);
            setModalOpen(false);
            message.success('Thêm user thành công');
          });
        }}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={[{ label: 'Admin', value: 'ADMIN' }, { label: 'Staff', value: 'STAFF' }]} />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 4 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
