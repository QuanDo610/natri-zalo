# VPS Deployment Guide: Natri Loyalty System

> Hướng dẫn chi tiết triển khai hệ thống quản lý điểm trên VPS, bao gồm yêu cầu máy chủ, cấu hình, tối ưu hiệu suất, và xử lý 100+ quét barcode đồng thời.

---

## 📋 Mục lục
1. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
2. [Lựa chọn VPS](#lựa-chọn-vps)
3. [Cài đặt và cấu hình](#cài-đặt-và-cấu-hình)
4. [Deploy ứng dụng](#deploy-ứng-dụng)
5. [Tối ưu hiệu suất](#tối-ưu-hiệu-suất)
6. [Xử lý cao tải (100+ concurrent)](#xử-lý-cao-tải)
7. [Giám sát và bảo trì](#giám-sát-và-bảo-trì)

---

## 🖥️ Yêu cầu hệ thống

### Cấu hình tối thiểu (Production)

| Thành phần | Yêu cầu | Ghi chú |
|-----------|---------|---------|
| **CPU** | 4 cores | CPU liên tục 2.5+ GHz |
| **RAM** | 8 GB | Tối thiểu 8GB cho production |
| **SSD** | 60 GB | SSD tốc độ cao (IOPS ≥ 3,000) |
| **Bandwidth** | 2 Mbps | Cho 100+ đồng thời |
| **OS** | Ubuntu 22.04 LTS | Hoặc CentOS 7+ |

### Cấu hình khuyến nghị (High Traffic)

| Thành phần | Yêu cầu | Ghi chú |
|-----------|---------|---------|
| **CPU** | 8 cores | CPU Xeon / AMD EPYC preferred |
| **RAM** | 16-32 GB | Tối ưu caching & database |
| **SSD** | 200+ GB | NVMe SSD preferred |
| **Bandwidth** | 5-10 Mbps | Cho 500+ đồng thời |
| **Database** | Managed PostgreSQL | Hoặc PostgreSQL standalone |

### Ước tính chi phí (VPS providers)

- **Linode / DigitalOcean / Vultr**: 4C/8GB/60GB ≈ $20-40/tháng
- **AWS EC2 t3.large**: 2C/8GB ≈ $60/tháng
- **Google Cloud / Azure**: Similar pricing

**☛ Khuyến nghị**: Chọn VPS có SSD NVMe và CPU ít nhất 4 cores

---

## 🌐 Lựa chọn VPS

### Các nhà cung cấp tốt cho Việt Nam

1. **Linode** (Singapore datacenter - 50-80ms to Vietnam)
   - Unlimited bandwidth
   - Object storage support
   - Giá: $20-200/tháng

2. **DigitalOcean** (Singapore - tương tự)
   - Simple interface
   - Built-in monitoring
   - Giá: $6-480/tháng

3. **Vultr** (Tokyo / Singapore)
   - DDoS protection
   - Instant deployment
   - Giá: $20-500/tháng

4. **AWS EC2** (ap-southeast-1 Singapore)
   - Auto-scaling
   - RDS managed database
   - Pay-as-you-go

5. **Tên miền & SSL**: Cloudflare (Free tier đủ dùng)

### Khuyến nghị cuối cùng
**Linode 8GB + Managed PostgreSQL** hoặc **DigitalOcean App Platform**

---

## 🔧 Cài đặt và cấu hình

### 1. SSH vào VPS

```bash
# Từ máy local
ssh root@<VPS_IP>

# Nếu cần key
ssh -i ~/.ssh/id_rsa root@<VPS_IP>
```

### 2. Update hệ thống

```bash
apt update && apt upgrade -y
apt install -y build-essential git curl wget zip unzip htop
```

### 3. Cài đặt Node.js (v20 LTS)

```bash
# Sử dụng NodeSource repository
curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Kiểm tra
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 4. Cài đặt PostgreSQL 15

```bash
# Add repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

# Cài đặt
apt update && apt install -y postgresql-15 postgresql-contrib-15

# Khởi động
systemctl start postgresql
systemctl enable postgresql

# Kiểm tra
sudo -u postgres psql --version
```

### 5. Tạo database

```bash
# Đăng nhập PostgreSQL
sudo -u postgres psql

-- Trong PostgreSQL shell:
CREATE DATABASE natri_loyalty;
CREATE USER natri_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
ALTER ROLE natri_user SET client_encoding TO 'utf8';
ALTER ROLE natri_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE natri_user SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE natri_loyalty TO natri_user;
\q
```

### 6. Cài đặt Redis (cho session & caching)

```bash
apt install -y redis-server

# Cấu hình performance
cp /etc/redis/redis.conf /etc/redis/redis.conf.bak

# Edit /etc/redis/redis.conf
sudo nano /etc/redis/redis.conf

# Tìm và chỉnh sửa:
# maxmemory 512mb
# maxmemory-policy allkeys-lru
# tcp-backlog 8192

systemctl restart redis-server
systemctl enable redis-server
```

### 7. Cài đặt Nginx (Reverse Proxy)

```bash
apt install -y nginx certbot python3-certbot-nginx

# Enable Nginx
systemctl enable nginx
systemctl start nginx
```

### 8. Cấu hình Nginx

```bash
# Backup config mặc định
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak

# Tạo file config mới
cat > /etc/nginx/sites-available/natri-loyalty << 'EOF'
# Upstream NodeJS app
upstream backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

upstream admin {
    server 127.0.0.1:3002;
    keepalive 64;
}

# Rate limiting (prevent abuse)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=50r/s;

# Gzip compression
gzip on;
gzip_vary on;
gzip_types text/plain text/css text/xml text/javascript 
           application/json application/javascript application/xml+rss;
gzip_min_length 1000;
gzip_comp_level 6;

# Main server block
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL optimization
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root
    root /var/www/natri-loyalty;
    index index.html;

    # API proxy
    location /api/ {
        limit_req zone=api_limit burst=200 nodelay;
        
        proxy_pass http://backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Timeouts cho upload
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Admin app
    location /admin/ {
        limit_req zone=admin_limit burst=50 nodelay;
        
        proxy_pass http://admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files (frontend)
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable config
ln -s /etc/nginx/sites-available/natri-loyalty /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Restart
systemctl restart nginx
```

### 9. SSL Certificate (Let's Encrypt)

```bash
# Tạo certificate
certbot certonly --nginx -d your-domain.com -d www.your-domain.com

# Auto renew
systemctl enable certbot.timer

# Test renewal
certbot renew --dry-run
```

---

## 🚀 Deploy ứng dụng

### 1. Tạo folder deploy

```bash
mkdir -p /var/www/natri-loyalty/backend
mkdir -p /var/www/natri-loyalty/admin
mkdir -p /var/www/natri-loyalty/frontend

# Set permissions
chown -R nobody:nogroup /var/www/natri-loyalty
chmod -R 755 /var/www/natri-loyalty
```

### 2. Clone repository

```bash
cd /var/www/natri-loyalty
git clone https://github.com/your-org/natri-loyalty.git .

# Cấu hình git
git config user.email "deploy@your-domain.com"
git config user.name "Deploy User"
```

### 3. Setup Backend

```bash
cd backend

# Copy .env
cp .env.example .env
nano .env

# File .env content:
DATABASE_URL="postgresql://natri_user:password@localhost:5432/natri_loyalty"
JWT_SECRET="your_very_secure_jwt_secret_here_min_32_chars"
JWT_EXPIRY="24h"
REDIS_URL="redis://localhost:6379"
PORT=3001
NODE_ENV="production"
```

```bash
# Install dependencies
npm ci  # Use ci instead of install for production

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate -- --name init

# Build
npm run build

# Test backend
npm run start:prod &
# Kiểm tra: curl http://localhost:3001/api/health
```

### 4. Setup Admin Dashboard

```bash
cd ../admin

cp .env.example .env.production
# Edit với API endpoint: VITE_API_BASE_URL=https://your-domain.com/api

npm ci
npm run build

# Build output sẽ ở ./dist
```

### 5. Setup Frontend (Zalo Mini)

```bash
cd ../

# Tạo production build
npm run build

# Output: ./dist (dùng cho Zalo Platform)
```

### 6. Khởi động ứng dụng với PM2

```bash
npm install -g pm2

# Tạo ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/main.js',
      cwd: '/var/www/natri-loyalty/backend',
      instances: 4,  // Sử dụng 4 CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'admin',
      script: 'dist/main.js',
      cwd: '/var/www/natri-loyalty/admin',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        VITE_API_BASE_URL: 'https://your-domain.com/api',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
  ],
};
EOF

# Khởi động
pm2 start ecosystem.config.js

# Auto start on reboot
pm2 startup systemd -u nobody --hp /var/www/natri-loyalty
pm2 save

# Kiểm tra status
pm2 status
pm2 logs
```

---

## ⚡ Tối ưu hiệu suất

### 1. PostgreSQL Tuning

```bash
# Edit /etc/postgresql/15/main/postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Tìm và chỉnh sửa:
shared_buffers = 2GB            # 25% of RAM
effective_cache_size = 6GB      # 75% of RAM
maintenance_work_mem = 512MB
work_mem = 128MB
random_page_cost = 1.1
effective_io_concurrency = 200
max_connections = 200
max_wal_size = 4GB

# Restart
systemctl restart postgresql
```

### 2. Database Indexes

```bash
# Tạo indexes quan trọng
psql -U natri_user -d natri_loyalty

-- Indexes để tối ưu queries thường xuyên
CREATE INDEX CONCURRENTLY idx_activations_customer ON activations(customer_id);
CREATE INDEX CONCURRENTLY idx_activations_dealer ON activations(dealer_id);
CREATE INDEX CONCURRENTLY idx_activations_created ON activations(created_at DESC);
CREATE INDEX CONCURRENTLY idx_barcodes_activated ON barcode_items(activated);
CREATE INDEX CONCURRENTLY idx_barcodes_product ON barcode_items(product_id);
CREATE INDEX CONCURRENTLY idx_customers_phone ON customers(phone);
CREATE INDEX CONCURRENTLY idx_dealers_active ON dealers(active);

-- Connection pooling (Primse level)
VACUUM ANALYZE;

\q
```

### 3. Node.js Performance

```bash
# Chỉnh sửa backend package.json scripts:
{
  "scripts": {
    "start:prod": "NODE_ENV=production node --max-old-space-size=2048 dist/main.js"
  }
}

# Chỉnh sửa main.ts NestJS app:
const app = await NestFactory.create(AppModule, {
  logger: new Logger(),
  bufferLogs: true,
});

// Enable compression
app.use(compression());

// Enable CORS with specific origins
app.enableCors({
  origin: ['https://your-domain.com', 'https://zalo.me'],
  credentials: true,
});

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
  }),
);
```

### 4. Redis Caching

```bash
# Tạo cache service (backend)
# File: src/services/cache.service.ts

import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class CacheService {
  private redis = new Redis(process.env.REDIS_URL);

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttl = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

# Sử dụng ở dealers endpoint:
@Get('stats')
async getDealerStats(@Query('dealerId') dealerId: string) {
  const cacheKey = `dealer:stats:${dealerId}`;
  let stats = await this.cacheService.get(cacheKey);
  
  if (!stats) {
    stats = await this.dealersService.getDealerStats(dealerId);
    await this.cacheService.set(cacheKey, stats, 300); // Cache 5 min
  }
  
  return stats;
}
```

---

## 🚄 Xử lý cao tải (100+ concurrent)

### 1. Kiến trúc cho cao tải

```
┌──────────────────────────────────────┐
│     Cloudflare / CDN (caching)       │
└──────────────────────────────────────┘
              │
┌──────────────────────────────────────┐
│     Nginx Load Balancer              │
│  (Rate limiting, request queuing)    │
└──────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌──────┐ ┌──────┐ ┌──────┐
│ App  │ │ App  │ │ App  │  (Cluster mode x4)
│ 3001 │ │ 3001 │ │ 3001 │
└──────┘ └──────┘ └──────┘
    │         │         │
    └─────────┼─────────┘
              │
┌──────────────────────────────────────┐
│  Connection Pool (pgBouncer)         │
│  Max connections: 200                │
└──────────────────────────────────────┘
              │
┌──────────────────────────────────────┐
│  PostgreSQL Database                 │
│  (Optimized indexes & tuning)        │
└──────────────────────────────────────┘
              │
┌──────────────────────────────────────┐
│  Redis Cache Layer                   │
│  (Session & data cache)              │
└──────────────────────────────────────┘
```

### 2. Cài đặt PgBouncer (Connection Pooling)

```bash
apt install -y pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
cat > /etc/pgbouncer/pgbouncer.ini << 'EOF'
[databases]
natri_loyalty = host=localhost port=5432 user=natri_user password=your_password dbname=natri_loyalty

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3
max_db_connections = 100
max_user_connections = 50
server_lifetime = 3600
server_idle_timeout = 600

listen_port = 6432
listen_addr = 127.0.0.1
EOF

# Enable pgBouncer
systemctl enable pgbouncer
systemctl start pgbouncer

# Database URL (chỉnh sửa .env):
DATABASE_URL="postgresql://natri_user:password@localhost:6432/natri_loyalty"
```

### 3. Load Testing để xác nhận

```bash
# Cài đặt Apache Bench hoặc Artillery
npm install -g artillery

# Test configuration - artillery.yml
config:
  target: 'https://your-domain.com'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"

scenarios:
  - name: "Activation flow"
    flow:
      - post:
          url: "/api/activations"
          json:
            barcode: "YTX5AN12020N2507302790"
            customer:
              name: "Customer"
              phone: "0901234567"
      - think: 5

# Run test
artillery run artillery.yml

# Kết quả sẽ show RPS, latency, error rate
```

### 4. Horizontal Scaling (nếu cần thêm)

```bash
# Deploy second backend instance trên port 3011
# Cấu hình second Nginx upstream

upstream backend {
    server 127.0.0.1:3001 weight=5;
    server 127.0.0.1:3011 weight=5;
    keepalive 64;
}

# Reload Nginx
systemctl reload nginx
```

### 5. Database Query Optimization

```javascript
// Tối ưu activation creation (xem: backend service)
// Sử dụng batch operations khi có thể

// activation.service.ts
async createActivation(dto: CreateActivationDto) {
  return this.prisma.$transaction(
    async (tx) => {
      // Tất cả queries trong 1 transaction
      // PostgreSQL sẽ execute nhanh hơn
    },
    {
      timeout: 10000, // 10 sec timeout
    }
  );
}

// Sử dụng Prisma select() để chỉ lấy cần thiết
const activation = await tx.activation.findFirst({
  where: { barcodeItem: { barcode } },
  select: { id: true }, // Không lấy tất cả fields
});
```

---

## 📊 Giám sát và bảo trì

### 1. Monitoring Setup (với Prometheus + Grafana)

```bash
# Cài đặt Prometheus
apt install -y prometheus

# Edit /etc/prometheus/prometheus.yml
cat >> /etc/prometheus/prometheus.yml << 'EOF'
scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
  
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
  
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
EOF

# Install Node Exporter
apt install -y prometheus-node-exporter

# Khởi động
systemctl enable prometheus prometheus-node-exporter
systemctl start prometheus prometheus-node-exporter

# Cài đặt Grafana
apt install -y grafana-server
systemctl enable grafana-server
systemctl start grafana-server

# Truy cập: http://your-domain.com:3000 (admin/admin)
```

### 2. Logging & Log Rotation

```bash
# PM2 logs
pm2 logs backend
pm2 logs admin

# Logrotate
cat > /etc/logrotate.d/natri-loyalty << 'EOF'
/var/www/natri-loyalty/*/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 nobody nogroup
    sharedscripts
}
EOF
```

### 3. Health Check & Alerting

```bash
# Cài đặt Healthchecks / Uptime Robot
# Endpoint health check:
curl https://your-domain.com/api/health

# Email alerts nếu down
```

### 4. Backup Strategy

```bash
# Daily backup script
cat > /usr/local/bin/backup-natri.sh << 'EOF'
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/natri-loyalty"
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U natri_user -d natri_loyalty | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Application backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/natri-loyalty/

# Keep last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# Sync to S3 (optional)
# aws s3 sync $BACKUP_DIR s3://your-bucket/backups/

echo "Backup completed: $DATE"
EOF

chmod +x /usr/local/bin/backup-natri.sh

# Cron job (Daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-natri.sh" | crontab -
```

### 5. Troubleshooting Commands

```bash
# Check system resources
free -h
df -h
htop

# Check backend logs
pm2 logs backend

# Check database connections
psql -U natri_user -d natri_loyalty -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
redis-cli
> INFO stats
> KEYS *

# Nginx errors
tail -f /var/log/nginx/error.log

# Test API
curl https://your-domain.com/api/health -v
```

---

## 📝 Checklist triển khai cuối cùng

- [ ] VPS provisioned (4C/8GB/60GB+)
- [ ] PostgreSQL setup & tuned
- [ ] Redis installed & configured
- [ ] Nginx reverse proxy setup
- [ ] SSL certificate active
- [ ] Backend deployed & running (PM2 cluster mode)
- [ ] Admin dashboard deployed
- [ ] Frontend built & serving
- [ ] Database migrations completed
- [ ] Load testing passed (100+ concurrent)
- [ ] Monitoring (Prometheus/Grafana) active
- [ ] Backups configured
- [ ] CDN / Cloudflare enabled
- [ ] DNS pointing correctly
- [ ] Security scanning passed (SSL Labs A+)

---

## 🎯 Kết quả dự kiến

| Metric | Giá trị |
|--------|---------|
| **Latency** | <100ms (p99) |
| **Throughput** | 500+ RPS |
| **Concurrent users** | 200+  |
| **Database queries/sec** | 1000+ |
| **Uptime** | 99.9% |
| **Cost/month** | $50-100 |

---

**Liên hệ hỗ trợ**: Nếu gặp vấn đề, dump logs & specs gửi cho team DevOps.
