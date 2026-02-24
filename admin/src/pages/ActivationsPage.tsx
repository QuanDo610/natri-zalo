import React, { useState } from 'react';
import { Table, Typography, DatePicker, Input, Space } from 'antd';
import dayjs from 'dayjs';
import { mockActivations } from '@/mock/mockData';

const { RangePicker } = DatePicker;

const ActivationsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [search, setSearch] = useState('');

  let filtered = [...mockActivations];

  if (dateRange) {
    filtered = filtered.filter((a) => {
      const d = dayjs(a.createdAt);
      return d.isAfter(dateRange[0].startOf('day')) && d.isBefore(dateRange[1].endOf('day'));
    });
  }

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.barcode.includes(s) ||
        a.customer.name.toLowerCase().includes(s) ||
        a.customer.phone.includes(s) ||
        (a.dealer?.code || '').toLowerCase().includes(s) ||
        a.staff.username.toLowerCase().includes(s),
    );
  }

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
      sorter: (a: any, b: any) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      defaultSortOrder: 'descend' as const,
    },
    { title: 'Barcode', dataIndex: 'barcode', width: 140 },
    {
      title: 'Sản phẩm',
      dataIndex: 'product',
      render: (p: any) => `${p.name} (${p.sku})`,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      render: (c: any) => `${c.name} - ${c.phone}`,
    },
    {
      title: 'Đại lý',
      dataIndex: 'dealer',
      width: 140,
      render: (d: any) => (d ? `${d.code} - ${d.name}` : '—'),
    },
    {
      title: 'Staff',
      dataIndex: 'staff',
      width: 120,
      render: (s: any) => s.fullName,
    },
    {
      title: 'Điểm',
      dataIndex: 'pointsAwarded',
      width: 60,
      render: (v: number) => `+${v}`,
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>Giao dịch kích hoạt</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <RangePicker
          onChange={(dates) => setDateRange(dates as any)}
          format="DD/MM/YYYY"
        />
        <Input.Search
          placeholder="Tìm barcode, khách, đại lý, staff"
          style={{ width: 300 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
      </Space>
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default ActivationsPage;
