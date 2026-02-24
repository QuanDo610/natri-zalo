import React from 'react';
import { Table, Typography, Input } from 'antd';
import { mockCustomers } from '@/mock/mockData';

const CustomersPage: React.FC = () => {
  const [search, setSearch] = React.useState('');

  const filtered = mockCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  const columns = [
    { title: 'Tên', dataIndex: 'name' },
    { title: 'SĐT', dataIndex: 'phone', width: 120 },
    {
      title: 'Điểm',
      dataIndex: 'points',
      width: 80,
      sorter: (a: any, b: any) => a.points - b.points,
      defaultSortOrder: 'descend' as const,
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>Khách hàng</Typography.Title>
      <Input.Search
        placeholder="Tìm theo tên hoặc SĐT"
        style={{ width: 300, marginBottom: 16 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
      />
      <Table dataSource={filtered} columns={columns} rowKey="id" />
    </div>
  );
};

export default CustomersPage;
