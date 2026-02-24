import React from 'react';
import { Card, Col, Row, Statistic, Table, Typography } from 'antd';
import { ThunderboltOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { mockDealers, mockCustomers, mockActivations, mockDailyActivations } from '@/mock/mockData';

const OverviewPage: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = mockActivations.filter(a => a.createdAt.startsWith(today)).length || 3;
  const weekCount = mockActivations.length;

  const topDealers = [...mockDealers].sort((a, b) => b.points - a.points).slice(0, 5);
  const topCustomers = [...mockCustomers].sort((a, b) => b.points - a.points).slice(0, 5);

  return (
    <div>
      <Typography.Title level={4}>Tổng quan</Typography.Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="Kích hoạt hôm nay" value={todayCount} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Kích hoạt 7 ngày" value={weekCount} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Tổng đại lý" value={mockDealers.length} prefix={<ShopOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Daily chart placeholder */}
        <Col span={24}>
          <Card title="Activations 30 ngày qua">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
              {mockDailyActivations.map((d, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: '#1890ff',
                    height: `${(d.count / 12) * 100}%`,
                    borderRadius: '2px 2px 0 0',
                    minHeight: 4,
                  }}
                  title={`${d.date}: ${d.count}`}
                />
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Top đại lý">
            <Table
              dataSource={topDealers}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Mã', dataIndex: 'code', width: 80 },
                { title: 'Tên', dataIndex: 'shopName' },
                { title: 'Điểm', dataIndex: 'points', width: 80, sorter: (a: any, b: any) => a.points - b.points },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Top khách hàng">
            <Table
              dataSource={topCustomers}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Tên', dataIndex: 'name' },
                { title: 'SĐT', dataIndex: 'phone' },
                { title: 'Điểm', dataIndex: 'points', width: 80, sorter: (a: any, b: any) => a.points - b.points },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OverviewPage;
