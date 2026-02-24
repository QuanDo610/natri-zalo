import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Typography, Space, Tag, Upload, message } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { mockProducts } from '@/mock/mockData';

// Generate sample barcodes for display
const generateBarcodes = () => {
  const items = [];
  for (let i = 1; i <= 50; i++) {
    const product = mockProducts[(i - 1) % mockProducts.length];
    items.push({
      id: `bc_${i}`,
      barcode: `893600${String(i).padStart(4, '0')}`,
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      activated: i <= 20,
      activatedAt: i <= 20 ? new Date(Date.now() - Math.random() * 14 * 86400000).toISOString() : null,
      activatedBy: i <= 20 ? (i % 2 === 0 ? 'Nguyễn Thị Hồng' : 'Trần Văn Khoa') : null,
    });
  }
  return items;
};

const ProductsPage: React.FC = () => {
  const [products] = useState(mockProducts);
  const [barcodes] = useState(generateBarcodes);
  const [activeTab, setActiveTab] = useState<'products' | 'barcodes'>('products');
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const productColumns = [
    { title: 'SKU', dataIndex: 'sku', width: 80 },
    { title: 'Tên sản phẩm', dataIndex: 'name' },
    { title: 'Số barcode', dataIndex: 'barcodeCount', width: 100 },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
  ];

  const barcodeColumns = [
    { title: 'Barcode', dataIndex: 'barcode', width: 140 },
    { title: 'Sản phẩm', dataIndex: 'productName' },
    { title: 'SKU', dataIndex: 'productSku', width: 80 },
    {
      title: 'Trạng thái',
      dataIndex: 'activated',
      width: 100,
      render: (v: boolean) => <Tag color={v ? 'orange' : 'green'}>{v ? 'Đã dùng' : 'Chưa dùng'}</Tag>,
      filters: [
        { text: 'Đã dùng', value: true },
        { text: 'Chưa dùng', value: false },
      ],
      onFilter: (value: any, record: any) => record.activated === value,
    },
    {
      title: 'Kích hoạt bởi',
      dataIndex: 'activatedBy',
      width: 140,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Ngày kích hoạt',
      dataIndex: 'activatedAt',
      width: 160,
      render: (v: string | null) => (v ? new Date(v).toLocaleString('vi-VN') : '—'),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4}>Sản phẩm & Barcode</Typography.Title>
        <Space>
          <Button type={activeTab === 'products' ? 'primary' : 'default'} onClick={() => setActiveTab('products')}>
            Sản phẩm
          </Button>
          <Button type={activeTab === 'barcodes' ? 'primary' : 'default'} onClick={() => setActiveTab('barcodes')}>
            Barcode
          </Button>
          {activeTab === 'products' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Thêm SP
            </Button>
          )}
          {activeTab === 'barcodes' && (
            <Upload accept=".csv" showUploadList={false} beforeUpload={() => { message.info('Import CSV: coming soon'); return false; }}>
              <Button icon={<UploadOutlined />}>Import CSV</Button>
            </Upload>
          )}
        </Space>
      </div>

      {activeTab === 'products' ? (
        <Table dataSource={products} columns={productColumns} rowKey="id" />
      ) : (
        <Table dataSource={barcodes} columns={barcodeColumns} rowKey="id" pagination={{ pageSize: 20 }} />
      )}

      <Modal
        title="Thêm sản phẩm"
        open={modalOpen}
        onOk={() => {
          form.validateFields().then(() => {
            message.success('Thêm sản phẩm thành công (mock)');
            setModalOpen(false);
          });
        }}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductsPage;
