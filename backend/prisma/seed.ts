import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ---- Users ----
  const adminPassword = await bcrypt.hash('admin123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      fullName: 'Admin Natri',
      role: Role.ADMIN,
    },
  });

  const staff = await prisma.user.upsert({
    where: { username: 'staff01' },
    update: {},
    create: {
      username: 'staff01',
      password: staffPassword,
      fullName: 'Nhân viên 01',
      role: Role.STAFF,
    },
  });

  console.log('✅ Users created:', admin.username, staff.username);

  // ---- Dealers ----
  const dealersData = [
    { code: 'DL001', name: 'Nguyễn Văn An',  phone: '0901234567', shopName: 'Cửa hàng An Khang',      address: '123 Lê Lợi, Q1, HCM' },
    { code: 'DL002', name: 'Trần Thị Bình',   phone: '0912345678', shopName: 'Đại lý Bình Minh',       address: '456 Nguyễn Huệ, Q1, HCM' },
    { code: 'DL003', name: 'Lê Hoàng Cường',  phone: '0923456789', shopName: 'Siêu thị mini Cường',    address: '789 Trần Hưng Đạo, Q5, HCM' },
    { code: 'DL004', name: 'Phạm Minh Đức',   phone: '0934567890', shopName: 'Shop Đức Phát',          address: '321 Hai Bà Trưng, Q3, HCM' },
    { code: 'DL005', name: 'Hoàng Thị Em',    phone: '0945678901', shopName: 'Tạp hóa Em',             address: '654 Võ Văn Tần, Q3, HCM' },
  ];

  for (const d of dealersData) {
    await prisma.dealer.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
  }
  console.log('✅ Dealers created:', dealersData.length);

  // ---- Products ----
  const productsData = [
    { sku: 'P001', name: 'Natri Ion 500ml' },
    { sku: 'P002', name: 'Natri Ion 1.5L' },
    { sku: 'P003', name: 'Natri Ion Thùng 12 chai' },
    { sku: 'P004', name: 'Natri Ion Sport 750ml' },
    { sku: 'P005', name: 'Natri Ion Zero 500ml' },
  ];

  const products: any[] = [];
  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
    products.push(product);
  }
  console.log('✅ Products created:', products.length);

  // ---- Barcode Items (50 barcodes) ----
  const barcodes: string[] = [];
  for (let i = 1; i <= 50; i++) {
    const barcode = `893600${String(i).padStart(4, '0')}`;
    barcodes.push(barcode);
  }

  let barcodeCount = 0;
  for (let i = 0; i < barcodes.length; i++) {
    const productIndex = i % products.length;
    try {
      await prisma.barcodeItem.upsert({
        where: { barcode: barcodes[i] },
        update: {},
        create: {
          barcode: barcodes[i],
          productId: products[productIndex].id,
        },
      });
      barcodeCount++;
    } catch (e) {
      // skip duplicates
    }
  }
  console.log('✅ Barcodes created:', barcodeCount);

  // ---- Customers ----
  const customersData = [
    { name: 'Nguyễn Thị Hồng',   phone: '0351234567' },
    { name: 'Trần Văn Khoa',      phone: '0562345678' },
    { name: 'Lê Minh Tuấn',       phone: '0773456789' },
    { name: 'Phạm Thị Lan',       phone: '0384567890' },
    { name: 'Hoàng Văn Nam',      phone: '0595678901' },
    { name: 'Đỗ Thị Oanh',       phone: '0706789012' },
    { name: 'Bùi Quốc Phong',    phone: '0817890123' },
    { name: 'Vũ Thị Quỳnh',      phone: '0928901234' },
    { name: 'Đinh Văn Sơn',       phone: '0339012345' },
    { name: 'Mai Thị Trang',      phone: '0850123456' },
  ];

  const customers: any[] = [];
  for (const c of customersData) {
    const customer = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: c,
    });
    customers.push(customer);
  }
  console.log('✅ Customers created:', customers.length);

  // ---- Activations (20 sample, within last 14 days) ----
  const dealers = await prisma.dealer.findMany();
  const allBarcodes = await prisma.barcodeItem.findMany({
    where: { activated: false },
    take: 20,
  });

  for (let i = 0; i < Math.min(20, allBarcodes.length); i++) {
    const customer = customers[i % customers.length];
    const dealer = i % 3 === 0 ? null : dealers[i % dealers.length]; // some without dealer
    const daysAgo = Math.floor(Math.random() * 14);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const barcodeItem = allBarcodes[i];

    // Mark barcode as activated
    await prisma.barcodeItem.update({
      where: { id: barcodeItem.id },
      data: { activated: true, activatedAt: createdAt },
    });

    // Increment customer points
    await prisma.customer.update({
      where: { id: customer.id },
      data: { points: { increment: 1 } },
    });

    // Increment dealer points
    if (dealer) {
      await prisma.dealer.update({
        where: { id: dealer.id },
        data: { points: { increment: 1 } },
      });
    }

    // Create activation
    await prisma.activation.create({
      data: {
        barcodeItemId: barcodeItem.id,
        customerId: customer.id,
        dealerId: dealer?.id || null,
        staffId: i % 2 === 0 ? admin.id : staff.id,
        productId: barcodeItem.productId,
        pointsAwarded: 1,
        createdAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'ACTIVATION_CREATED',
        entity: 'Activation',
        entityId: barcodeItem.id,
        userId: i % 2 === 0 ? admin.id : staff.id,
        metadata: {
          barcode: barcodeItem.barcode,
          customerPhone: customer.phone,
          seeded: true,
        },
        createdAt,
      },
    });
  }
  console.log('✅ Activations seeded: 20');

  console.log('\n🎉 Seed complete!');
  console.log('Admin login: admin / admin123');
  console.log('Staff login: staff01 / staff123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
