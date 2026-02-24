import React from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

interface Props {
  onLogin: (token: string, role: string) => void;
}

const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [loading, setLoading] = React.useState(false);

  const handleFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      // Mock login — replace with real API call
      if (values.username === 'admin' && values.password === 'admin123') {
        onLogin('mock-jwt-token-admin', 'ADMIN');
        message.success('Đăng nhập thành công!');
      } else if (values.username === 'staff01' && values.password === 'staff123') {
        onLogin('mock-jwt-token-staff', 'STAFF');
        message.success('Đăng nhập thành công!');
      } else {
        message.error('Sai tên đăng nhập hoặc mật khẩu');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
          Natri Loyalty Admin
        </Typography.Title>
        <Form onFinish={handleFinish} layout="vertical">
          <Form.Item name="username" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
          Demo: admin / admin123 hoặc staff01 / staff123
        </Typography.Text>
      </Card>
    </div>
  );
};

export default LoginPage;
