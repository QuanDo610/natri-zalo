import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography } from 'antd';
import {
  DashboardOutlined,
  ShopOutlined,
  BarcodeOutlined,
  UserOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  LogoutOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

interface Props {
  children: React.ReactNode;
  role: string;
  onLogout: () => void;
}

const AdminLayout: React.FC<Props> = ({ children, role, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
    { key: '/dealers', icon: <ShopOutlined />, label: 'Đại lý' },
    { key: '/products', icon: <BarcodeOutlined />, label: 'Sản phẩm & Barcode' },
    { key: '/customers', icon: <UserOutlined />, label: 'Khách hàng' },
    { key: '/activations', icon: <ThunderboltOutlined />, label: 'Giao dịch' },
    ...(role === 'ADMIN'
      ? [{ key: '/users', icon: <TeamOutlined />, label: 'Quản lý Users' }]
      : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={240} theme="dark">
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            Natri Admin
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Typography.Text style={{ marginRight: 16 }}>
            Role: {role}
          </Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={onLogout}>
            Đăng xuất
          </Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
