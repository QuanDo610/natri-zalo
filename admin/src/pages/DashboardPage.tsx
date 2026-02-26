import React, { useState, useEffect } from 'react';
import {
  Card, Col, Row, Statistic, Table, DatePicker, Select, Button,
  Space, Tabs, Typography, Tag, Progress, Tooltip, Spin, Empty,
  Segmented
} from 'antd';
import {
  ThunderboltOutlined, ShopOutlined, UserOutlined, DollarOutlined,
  ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined, BarChartOutlined,
  CalendarOutlined, FilterOutlined
} from '@ant-design/icons';
import { mockDealers, mockCustomers, mockActivations } from '@/mock/mockData';
import dayjs from 'dayjs';

type DateRangeType = [dayjs.Dayjs, dayjs.Dayjs] | null;
type TimeRange = '1d' | '7d' | '30d' | '90d' | 'custom';

const DashboardPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [dateRange, setDateRange] = useState<DateRangeType>(null);
  const [loading, setLoading] = useState(false);

  // Calculate date range
  const getDateRange = () => {
    const today = dayjs();
    switch (timeRange) {
      case '1d':
        return [today.subtract(1, 'day'), today];
      case '7d':
        return [today.subtract(7, 'day'), today];
      case '30d':
        return [today.subtract(30, 'day'), today];
      case '90d':
        return [today.subtract(90, 'day'), today];
      case 'custom':
        return dateRange || [today.subtract(7, 'day'), today];
      default:
        return [today.subtract(7, 'day'), today];
    }
  };

  const [startDate, endDate] = getDateRange();

  // Filter activations by date range
  const filteredActivations = mockActivations.filter((a) => {
    const actDate = dayjs(a.createdAt);
    return actDate.isAfter(startDate) && actDate.isBefore(endDate.add(1, 'day'));
  });

  // Calculate KPIs
  const totalActivations = filteredActivations.length;
  const totalPoints = filteredActivations.reduce((sum, a) => sum + a.pointsAwarded, 0);
  const uniqueCustomers = new Set(filteredActivations.map(a => a.customer.phone)).size;
  const uniqueDealers = new Set(filteredActivations.map(a => a.dealer?.code).filter(Boolean)).size;

  // Revenue (assuming 1 point = 1000 VND)
  const totalRevenue = totalPoints * 1000;
  const avgPerActivation = filteredActivations.length > 0 ? totalRevenue / filteredActivations.length : 0;

  // Trends
  const previousRange = [startDate.subtract(endDate.diff(startDate, 'day'), 'day'), startDate];
  const previousActivations = mockActivations.filter((a) => {
    const actDate = dayjs(a.createdAt);
    return actDate.isAfter(previousRange[0]) && actDate.isBefore(previousRange[1].add(1, 'day'));
  });
  const activationTrend = ((filteredActivations.length - previousActivations.length) / (previousActivations.length || 1)) * 100;

  // Top Dealers
  const dealerStats = mockDealers.map((dealer) => {
    const dealerActivations = filteredActivations.filter(a => a.dealer?.code === dealer.code);
    return {
      ...dealer,
      activations: dealerActivations.length,
      points: dealerActivations.reduce((sum, a) => sum + a.pointsAwarded, 0),
      customers: new Set(dealerActivations.map(a => a.customer.phone)).size,
      revenue: dealerActivations.reduce((sum, a) => sum + a.pointsAwarded * 1000, 0),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Top Customers
  const customerStats = mockCustomers
    .map((customer) => {
      const customerActivations = filteredActivations.filter(a => a.customer.phone === customer.phone);
      return {
        ...customer,
        activations: customerActivations.length,
        points: customerActivations.reduce((sum, a) => sum + a.pointsAwarded, 0),
        dealers: new Set(customerActivations.map(a => a.dealer?.code).filter(Boolean)).size,
        lastActivation: customerActivations[0]?.createdAt,
      };
    })
    .sort((a, b) => b.points - a.points);

  // Daily chart data
  const dailyData = [];
  for (let i = 0; i <= endDate.diff(startDate, 'day'); i++) {
    const date = startDate.add(i, 'day');
    const count = filteredActivations.filter(a => 
      dayjs(a.createdAt).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
    ).length;
    dailyData.push({ date: date.format('DD/MM'), count });
  }

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
      ellipsis: true,
    },
    {
      title: 'Lần quét',
      dataIndex: 'activations',
      key: 'activations',
      width: 80,
      sorter: (a: any, b: any) => a.activations - b.activations,
    },
    {
      title: 'Kiếm điểm',
      dataIndex: 'points',
      key: 'points',
      width: 80,
      sorter: (a: any, b: any) => a.points - b.points,
    },
    {
      title: 'Doanh thu',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 120,
      render: (value: number) => <strong>{(value / 1000).toLocaleString()} K</strong>,
      sorter: (a: any, b: any) => a.revenue - b.revenue,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customers',
      key: 'customers',
      width: 80,
      sorter: (a: any, b: any) => a.customers - b.customers,
    },
  ];

  const customerColumns = [
    {
      title: 'Tên khách hàng',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: 'Lần mua',
      dataIndex: 'activations',
      key: 'activations',
      width: 80,
      sorter: (a: any, b: any) => a.activations - b.activations,
    },
    {
      title: 'Điểm tích lũy',
      dataIndex: 'points',
      key: 'points',
      width: 100,
      render: (value: number) => <Tag color="green">{value} điểm</Tag>,
      sorter: (a: any, b: any) => a.points - b.points,
    },
    {
      title: 'Đại lý',
      dataIndex: 'dealers',
      key: 'dealers',
      width: 80,
    },
    {
      title: 'Ghi nhận cuối',
      dataIndex: 'lastActivation',
      key: 'lastActivation',
      width: 130,
      render: (value: string) => value ? dayjs(value).format('DD/MM HH:mm') : '-',
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <LineChartOutlined /> Bảng điều khiển & Phân tích
        </Typography.Title>
        <Space>
          <Segmented
            value={timeRange}
            onChange={(value) => setTimeRange(value as TimeRange)}
            options={[
              { label: '1 ngày', value: '1d' },
              { label: '7 ngày', value: '7d' },
              { label: '30 ngày', value: '30d' },
              { label: '90 ngày', value: '90d' },
              { label: 'Tùy chỉnh', value: 'custom' },
            ]}
          />
          {timeRange === 'custom' && (
            <DatePicker.RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
            />
          )}
          <Button
            type="primary"
            icon={<FilterOutlined />}
            loading={loading}
            onClick={() => setLoading(true) || setTimeout(() => setLoading(false), 600)}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <Statistic
              title="Tổng quét barcode"
              value={totalActivations}
              prefix={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
              suffix={
                <Tooltip title={activationTrend > 0 ? 'Tăng' : 'Giảm'}>
                  <span style={{ marginLeft: 8, color: activationTrend > 0 ? '#52c41a' : '#ff4d4f' }}>
                    {activationTrend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {Math.abs(activationTrend).toFixed(1)}%
                  </span>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <Statistic
              title="Điểm cấp phát"
              value={totalPoints}
              prefix={<BarChartOutlined style={{ color: '#faad14' }} />}
              suffix="điểm"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <Statistic
              title="Doanh thu ước tính"
              value={totalRevenue / 1_000_000}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              suffix="M VND"
              precision={2}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              Trung bình: {(avgPerActivation / 1_000).toFixed(0)}K/ghi nhận
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <Statistic
              title="Khách hàng & Đại lý"
              value={uniqueCustomers}
              suffix={`/ ${uniqueDealers}`}
              prefix={<UserOutlined style={{ color: '#722ed1' }} />}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              Khách / Đại lý
            </div>
          </Card>
        </Col>
      </Row>

      {/* Trend Chart */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title={`📊 Xu hướng quét barcode (${startDate.format('DD/MM')} - ${endDate.format('DD/MM')})`} bordered={false}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, overflowX: 'auto' }}>
              {dailyData.map((d, i) => (
                <Tooltip key={i} title={`${d.date}: ${d.count} quét`}>
                  <div
                    style={{
                      flex: '0 0 30px',
                      background: `linear-gradient(to top, #1890ff${Math.min(d.count * 20, 255).toString(16).padStart(2, '0')}, #1890ff)`,
                      height: `${Math.max((d.count / Math.max(...dailyData.map(x => x.count))) * 100, 5)}%`,
                      borderRadius: '2px 2px 0 0',
                      minHeight: 4,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = '0.8';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = '1';
                    }}
                  />
                </Tooltip>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Top Dealers & Customers */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title="🏆 Top 10 đại lý"
            extra={<Tag color="blue">{dealerStats.length}</Tag>}
            bordered={false}
          >
            <Table
              dataSource={dealerStats.slice(0, 10)}
              columns={dealerColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="⭐ Top 10 khách hàng"
            extra={<Tag color="green">{customerStats.length}</Tag>}
            bordered={false}
          >
            <Table
              dataSource={customerStats.slice(0, 10)}
              columns={customerColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Details */}
      <Row gutter={16}>
        <Col span={24}>
          <Card title="📋 Chi tiết quét barcode" bordered={false}>
            <Table
              dataSource={filteredActivations.sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )}
              pagination={{ pageSize: 20 }}
              size="small"
              scroll={{ x: 800 }}
              columns={[
                {
                  title: 'Thời gian',
                  dataIndex: 'createdAt',
                  width: 150,
                  render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
                  sorter: (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                },
                {
                  title: 'Barcode',
                  dataIndex: ['barcodeItem', 'barcode'],
                  width: 150,
                  render: (barcode: string) => <code style={{ color: '#1890ff' }}>{barcode}</code>,
                },
                {
                  title: 'Sản phẩm',
                  dataIndex: ['product', 'name'],
                  ellipsis: true,
                },
                {
                  title: 'Khách hàng',
                  dataIndex: ['customer', 'name'],
                  width: 130,
                },
                {
                  title: 'Đại lý',
                  dataIndex: ['dealer', 'code'],
                  width: 100,
                  render: (code: string | undefined) => code ? <Tag color="blue">{code}</Tag> : <Tag>–</Tag>,
                },
                {
                  title: 'Điểm',
                  dataIndex: 'pointsAwarded',
                  width: 80,
                  render: (value: number) => <Tag color="green">{value}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
