import React, { useState } from 'react';
import {
  Card, Table, Button, Space, DatePicker, Select, Row, Col, Statistic,
  Tag, Tabs, Segmented, Progress, Empty, Tooltip
} from 'antd';
import {
  DownloadOutlined, FileExcelOutlined, BarChartOutlined, LineChartOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { mockActivations, mockProducts, mockDealers } from '@/mock/mockData';
import dayjs from 'dayjs';

type TimeRange = 'daily' | 'weekly' | 'monthly';

const RevenueReportPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [filterDealer, setFilterDealer] = useState<string | undefined>(undefined);
  const [filterProduct, setFilterProduct] = useState<string | undefined>(undefined);

  // Filter activations
  const filtered = mockActivations.filter((a) => {
    const actDate = dayjs(a.createdAt);
    if (!actDate.isAfter(dateRange[0]) || !actDate.isBefore(dateRange[1].add(1, 'day'))) return false;
    if (filterDealer && a.dealer?.id !== filterDealer) return false;
    if (filterProduct && a.product.sku !== filterProduct) return false;
    return true;
  });

  // Calculate totals
  const totalRevenue = filtered.reduce((sum, a) => sum + a.pointsAwarded * 1000, 0);
  const totalPoints = filtered.reduce((sum, a) => sum + a.pointsAwarded, 0);
  const totalActivations = filtered.length;
  const avgPerActivation = filtered.length > 0 ? totalRevenue / filtered.length : 0;

  // Group by time period
  const getGroupKey = (date: string): string => {
    const d = dayjs(date);
    if (timeRange === 'daily') return d.format('YYYY-MM-DD');
    if (timeRange === 'weekly') return `Tuần ${d.week()}/${d.year()}`;
    return d.format('YYYY-MM');
  };

  const groupedData = filtered.reduce((acc, activation) => {
    const key = getGroupKey(activation.createdAt);
    if (!acc[key]) {
      acc[key] = {
        period: key,
        activations: 0,
        points: 0,
        revenue: 0,
        uniqueCustomers: new Set() as Set<string>,
        uniqueDealers: new Set() as Set<string>,
      };
    }
    acc[key].activations += 1;
    acc[key].points += activation.pointsAwarded;
    acc[key].revenue += activation.pointsAwarded * 1000;
    acc[key].uniqueCustomers.add(activation.customer.phone);
    if (activation.dealer?.id) acc[key].uniqueDealers.add(activation.dealer.id);
    return acc;
  }, {} as Record<string, any>);

  const reportData = Object.values(groupedData)
    .map((item: any) => ({
      ...item,
      customers: item.uniqueCustomers.size,
      dealers: item.uniqueDealers.size,
    }))
    .sort((a: any, b: any) => b.period.localeCompare(a.period));

  // By dealer
  const dealerReport = mockDealers.map((dealer) => {
    const dealerActivations = filtered.filter(a => a.dealer?.id === dealer.id);
    return {
      id: dealer.id,
      code: dealer.code,
      shopName: dealer.shopName,
      activations: dealerActivations.length,
      points: dealerActivations.reduce((sum, a) => sum + a.pointsAwarded, 0),
      revenue: dealerActivations.reduce((sum, a) => sum + a.pointsAwarded * 1000, 0),
      customers: new Set(dealerActivations.map(a => a.customer.phone)).size,
    };
  }).filter(d => d.activations > 0).sort((a, b) => b.revenue - a.revenue);

  // By product
  const productReport = mockProducts.map((product) => {
    const productActivations = filtered.filter(a => a.product.id === product.id);
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      activations: productActivations.length,
      points: productActivations.reduce((sum, a) => sum + a.pointsAwarded, 0),
      revenue: productActivations.reduce((sum, a) => sum + a.pointsAwarded * 1000, 0),
      dealers: new Set(productActivations.map(a => a.dealer?.id).filter(Boolean)).size,
    };
  }).filter(p => p.activations > 0).sort((a, b) => b.revenue - a.revenue);

  const timeSeriesColumns = [
    {
      title: 'Kỳ báo cáo',
      dataIndex: 'period',
      key: 'period',
      width: 150,
    },
    {
      title: 'Ghi nhận',
      dataIndex: 'activations',
      key: 'activations',
      width: 80,
      sorter: (a: any, b: any) => a.activations - b.activations,
    },
    {
      title: 'Điểm',
      dataIndex: 'points',
      key: 'points',
      width: 80,
      render: (value: number) => <Tag color="green">{value}</Tag>,
      sorter: (a: any, b: any) => a.points - b.points,
    },
    {
      title: 'Doanh thu',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 120,
      render: (value: number) => <strong>{(value / 1_000_000).toFixed(2)}M VND</strong>,
      sorter: (a: any, b: any) => a.revenue - b.revenue,
    },
    {
      title: 'Khách / Đại lý',
      dataIndex: 'customers',
      key: 'customers',
      width: 100,
      render: (_, record: any) => `${record.customers} / ${record.dealers}`,
    },
  ];

  const dealerColumns = [
    {
      title: 'Mã đại lý',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Cửa hàng',
      dataIndex: 'shopName',
      key: 'shopName',
    },
    {
      title: 'Ghi nhận',
      dataIndex: 'activations',
      key: 'activations',
      width: 80,
      sorter: (a: any, b: any) => a.activations - b.activations,
    },
    {
      title: 'Điểm kiếm được',
      dataIndex: 'points',
      key: 'points',
      width: 100,
      render: (value: number) => <Tag color="green">{value}</Tag>,
    },
    {
      title: 'Doanh thu',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 130,
      render: (value: number) => (
        <strong style={{ color: '#1890ff' }}>
          {(value / 1_000_000).toFixed(2)}M VND
        </strong>
      ),
      sorter: (a: any, b: any) => a.revenue - b.revenue,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customers',
      key: 'customers',
      width: 80,
    },
  ];

  const productColumns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
      render: (text: string) => <Tag color="purple">{text}</Tag>,
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Ghi nhận',
      dataIndex: 'activations',
      key: 'activations',
      width: 80,
      sorter: (a: any, b: any) => a.activations - b.activations,
    },
    {
      title: 'Điểm',
      dataIndex: 'points',
      key: 'points',
      width: 80,
      render: (value: number) => <Tag color="green">{value}</Tag>,
    },
    {
      title: 'Doanh thu',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 130,
      render: (value: number) => (
        <strong style={{ color: '#52c41a' }}>
          {(value / 1_000_000).toFixed(2)}M VND
        </strong>
      ),
      sorter: (a: any, b: any) => a.revenue - b.revenue,
    },
    {
      title: 'Đại lý bán',
      dataIndex: 'dealers',
      key: 'dealers',
      width: 80,
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <Typography.Title level={3} style={{ marginBottom: 24 }}>
        <BarChartOutlined /> Báo cáo doanh thu & hiệu suất
      </Typography.Title>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Khoảng thời gian</label>
            </div>
            <DatePicker.RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Thời gian báo cáo</label>
            </div>
            <Segmented
              value={timeRange}
              onChange={(value) => setTimeRange(value as TimeRange)}
              options={[
                { label: 'Ngày', value: 'daily' },
                { label: 'Tuần', value: 'weekly' },
                { label: 'Tháng', value: 'monthly' },
              ]}
              block
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Đại lý</label>
            </div>
            <Select
              placeholder="Tất cả đại lý"
              allowClear
              value={filterDealer}
              onChange={setFilterDealer}
              options={mockDealers.map(d => ({ label: `${d.code} - ${d.shopName}`, value: d.id }))}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Sản phẩm</label>
            </div>
            <Select
              placeholder="Tất cả sản phẩm"
              allowClear
              value={filterProduct}
              onChange={setFilterProduct}
              options={mockProducts.map(p => ({ label: p.sku, value: p.sku }))}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              const csv = 'Báo cáo đã xuất';
              console.log(csv);
            }}
          >
            Xuất CSV
          </Button>
          <Button icon={<FileExcelOutlined />}>Xuất Excel</Button>
        </Space>
      </Card>

      {/* KPIs */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng doanh thu"
              value={totalRevenue / 1_000_000}
              suffix="M VND"
              precision={2}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Ghi nhận"
              value={totalActivations}
              suffix="lần"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Điểm phát sinh"
              value={totalPoints}
              suffix="điểm"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Trung bình/ghi nhận"
              value={avgPerActivation / 1_000}
              suffix="K VND"
              precision={1}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        items={[
          {
            key: 'timeseries',
            label: `📊 theo thời gian (${reportData.length})`,
            children: (
              <Card bordered={false}>
                <Table
                  dataSource={reportData}
                  columns={timeSeriesColumns}
                  rowKey="period"
                  pagination={{ pageSize: 20 }}
                  size="small"
                  scroll={{ x: 600 }}
                />
              </Card>
            ),
          },
          {
            key: 'dealers',
            label: `🏪 Theo đại lý (${dealerReport.length})`,
            children: (
              <Card bordered={false}>
                <Table
                  dataSource={dealerReport}
                  columns={dealerColumns}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  size="small"
                  scroll={{ x: 600 }}
                />
              </Card>
            ),
          },
          {
            key: 'products',
            label: `📦 Theo sản phẩm (${productReport.length})`,
            children: (
              <Card bordered={false}>
                <Table
                  dataSource={productReport}
                  columns={productColumns}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  size="small"
                  scroll={{ x: 600 }}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default RevenueReportPage;

import { Typography } from 'antd';
