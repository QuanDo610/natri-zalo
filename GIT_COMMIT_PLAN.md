# Git Commit Plan - Natri Loyalty System Optimization

> Hướng dẫn chia nhỏ code thành các commit logic, dễ review

---

## 📦 Commit Structure

### Phase 1: Backend Analytics Foundation

#### Commit 1.1: Create analytics module structure
```bash
git add backend/src/analytics/


git commit -m "feat(analytics): scaffolding analytics module with service layer

- Create analytics module and controller
- Define analytics service interface
- Setup dependency injection"
```

**Files:**
- `backend/src/analytics/analytics.module.ts` (NEW)
- `backend/src/analytics/analytics.controller.ts` (NEW)

#### Commit 1.2: Add analytics endpoints
```bash
git add backend/src/analytics/

git commit -m "feat(analytics): implement dashboard KPI endpoints

Analytics endpoints:
- GET /analytics/dashboard/kpis - Summary metrics
- GET /analytics/top-dealers - Top 10 dealers ranking
- GET /analytics/top-customers - Top 10 customers ranking

Features:
- Date range filtering (dateFrom, dateTo)
- Trend calculation (comparing to previous period)
- Response type validation"
```

#### Commit 1.3: Add revenue reporting endpoints
```bash
git add backend/src/analytics/

git commit -m "feat(analytics): add revenue reporting endpoints

New endpoints:
- GET /analytics/revenue/timeline - Revenue trends by period
- GET /analytics/revenue/by-dealer - Revenue breakdown
- GET /analytics/revenue/by-product - Product performance

Granularity options:
- daily / weekly / monthly reporting"
```

#### Commit 1.4: Add staff activity & health check
```bash
git add backend/src/analytics/

git commit -m "feat(analytics): add staff activity tracking and health endpoint

New endpoints:
- GET /analytics/staff-activity - Staff performance metrics
- GET /analytics/performance/avg-response-time - System metrics
- GET /analytics/health - System health check

Features:
- Staff-level activation tracking
- Performance statistics
- Database connectivity validation"
```

#### Commit 1.5: Update app module to include analytics
```bash
git add backend/src/app.module.ts

git commit -m "feat(app): register analytics module

- Import AnalyticsModule
- Available at /api/analytics/* endpoints"
```

---

### Phase 2: Admin Dashboard

#### Commit 2.1: Create enhanced dashboard page
```bash
git add admin/src/pages/DashboardPage.tsx

git commit -m "feat(admin): create enhanced dashboard with KPIs

Components:
- KPI cards with trend indicators
- Activity trend chart (30 days)
- Top 10 dealers table
- Top 10 customers table
- Activation details table

Features:
- Time range selector (1d/7d/30d/90d/custom)
- Auto-refresh capability
- Responsive design"
```

#### Commit 2.2: Create revenue report page
```bash
git add admin/src/pages/RevenueReportPage.tsx

git commit -m "feat(admin): add revenue reporting dashboard

Three reporting views:
- Time-series reporting (daily/weekly/monthly)
- Dealer performance breakdown
- Product sales analysis

Features:
- Advanced filtering (date, dealer, product)
- Export to CSV/Excel
- Responsive tables with pagination"
```

#### Commit 2.3: Update admin routing
```bash
git add admin/src/App.tsx admin/src/components/AdminLayout.tsx

git commit -m "feat(admin): add new page routes and navigation

Routes:
- /admin/dashboard - Enhanced dashboard
- /admin/revenue - Revenue report

UI:
- Add navigation links in sidebar
- Update layout routing"
```

---

### Phase 3: Documentation

#### Commit 3.1: VPS Deployment Documentation
```bash
git add VPS_DEPLOYMENT_GUIDE.md

git commit -m "docs(vps): add comprehensive deployment guide

Contents:
- Hardware requirements & cost estimation
- VPS provider recommendations
- Step-by-step installation (Node, PostgreSQL, Redis, Nginx)
- SSL certificate setup (Let's Encrypt)
- PM2 cluster configuration
- Database tuning for production
- Performance monitoring setup"
```

#### Commit 3.2: High Concurrency Architecture Guide
```bash
git add HIGH_CONCURRENCY_GUIDE.md

git commit -m "docs(architecture): add high-concurrency system design

Topics:
- Handle 100+ concurrent barcode scans
- Request flow analysis under load
- Bottleneck analysis & solutions
- Horizontal scaling strategies
- Load testing procedures
- Performance benchmarks"
```

#### Commit 3.3: Admin Dashboard User Guide
```bash
git add ADMIN_DASHBOARD_GUIDE.md

git commit -m "docs(admin): add admin dashboard user guide

Sections:
- Dashboard features & layout
- Revenue reporting tutorials
- Data export & analysis
- API documentation
- Common FAQs
- User permissions matrix"
```

---

### Phase 4: Configuration & Integration

#### Commit 4.1: Add environment variables
```bash
git add backend/.env.example admin/.env.example

git commit -m "config: add example environment files

Backend (.env.example):
- DATABASE_URL for PostgreSQL
- REDIS_URL for Redis
- JWT_SECRET for authentication

Admin (.env.example):
- VITE_API_BASE_URL for backend endpoint"
```

#### Commit 4.2: Add PM2 configuration
```bash
git add ecosystem.config.js package.json

git commit -m "config: add PM2 cluster configuration for production

- 4 worker processes (cluster mode)
- Automatic restart on crash
- Memory limits (1.5GB)
- Log file rotation
- Graceful shutdown (5s timeout)"
```

#### Commit 4.3: Update Nginx configuration docs
```bash
git add nginx.conf.example

git commit -m "config: add production Nginx configuration

Features:
- Reverse proxy to Node.js app
- Rate limiting (100-200 RPS)
- Gzip compression
- HTTP/2 support
- SSL/TLS setup
- Security headers"
```

---

### Phase 5: Backend Optimization

#### Commit 5.1: Add database indexes
```bash
git add backend/prisma/migrations

git commit -m "perf(db): add optimized indexes for activations

Indexes:
- idx_activations_customer
- idx_activations_dealer
- idx_activations_created
- idx_customers_phone
- idx_dealers_active

~30-40% query performance improvement"
```

#### Commit 5.2: Add connection pooling configuration
```bash
git add backend/src/prisma/prisma.service.ts config/pgbouncer.conf

git commit -m "perf(db): implement connection pooling with PgBouncer

Features:
- Transaction pooling mode
- Max 200 connections
- Idle timeout 600s
- Supports 100+ concurrent requests"
```

#### Commit 5.3: Add Redis caching service
```bash
git add backend/src/services/cache.service.ts

git commit -m "perf(cache): add Redis caching layer

Features:
- Cache-aside pattern
- Automatic TTL management
- Pattern-based invalidation
- Fallback on cache miss

Use cases:
- Dealer statistics (5min TTL)
- Product information (1hour TTL)"
```

---

### Phase 6: Frontend Optimization

#### Commit 6.1: Improve barcode scanning
```bash
git add src/services/scanner-enhanced.ts

git commit -m "perf(scanner): optimize barcode detection

Improvements:
- Batch request handling
- Concurrent request limiting
- Error retry logic
- Better timeout management"
```

#### Commit 6.2: Add request queuing
```bash
git add src/services/request-queue.ts

git commit -m "feat(frontend): add intelligent request queuing

Features:
- Max 5 concurrent requests
- Auto-queue overflow requests
- Backoff on failures
- Cancel on unmount"
```

---

### Phase 7: Testing & Verification

#### Commit 7.1: Add load test configuration
```bash
git add load-test/artillery.yml load-test/test-100-concurrent.sh

git commit -m "test(load): add load testing configuration

Scenarios:
- 100 concurrent users
- Sustained 50 RPS for 10 minutes
- Spike test (500 RPS burst)
- Error handling validation

Expected results:
- p95 latency < 200ms
- Error rate < 0.1%
- 0 connection pool exhaustion"
```

#### Commit 7.2: Add health check endpoint
```bash
git add backend/src/health/health.controller.ts

git commit -m "feat(health): add system health check endpoint

GET /health returns:
- Database connectivity
- Redis connectivity
- System uptime
- Active connections
- Memory usage"
```

---

## 📋 Complete Commit Checklist

```bash
# Phase 1: Backend Analytics
□ Commit 1.1: Analytics module scaffolding
□ Commit 1.2: Dashboard KPI endpoints
□ Commit 1.3: Revenue reporting endpoints
□ Commit 1.4: Staff activity & health check
□ Commit 1.5: Register analytics module

# Phase 2: Admin Dashboard
□ Commit 2.1: Enhanced dashboard page
□ Commit 2.2: Revenue report page
□ Commit 2.3: Update routing

# Phase 3: Documentation
□ Commit 3.1: VPS deployment guide
□ Commit 3.2: High concurrency guide
□ Commit 3.3: Admin dashboard guide

# Phase 4: Configuration
□ Commit 4.1: Environment files
□ Commit 4.2: PM2 configuration
□ Commit 4.3: Nginx configuration

# Phase 5: Backend Optimization
□ Commit 5.1: Database indexes
□ Commit 5.2: Connection pooling
□ Commit 5.3: Redis caching

# Phase 6: Frontend Optimization
□ Commit 6.1: Scanner optimization
□ Commit 6.2: Request queuing

# Phase 7: Testing
□ Commit 7.1: Load test configuration
□ Commit 7.2: Health check endpoint
```

---

## 🎯 Commit Guidelines

### Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:** feat, fix, perf, docs, refactor, test, chore

**Scope:** analytics, admin, vps, database, cache, frontend, etc.

**Subject:**
- Imperative mood ("add" not "added")
- Lowercase
- No period at end
- <50 characters

**Body:**
- Explain WHAT & WHY
- Wrap at 72 characters
- Multiple paragraphs OK

**Footer:**
- References issues/PRs
- Breaking changes

### Examples

```bash
# Good
git commit -m "feat(analytics): add top dealers endpoint

- Sort by revenue
- Include date range filtering
- Cache results for 5 minutes

Closes #42"

# Bad
git commit -m "update analytics stuff"
```

---

## 🔄 Suggested Push Order

```bash
# Day 1: Backend Foundation
git push origin feature/analytics-backend

# Day 2: Admin UI
git push origin feature/admin-dashboard-ui

# Day 3: Documentation
git push origin docs/deployment-and-architecture

# Day 4: Optimization & Testing
git push origin perf/database-and-caching
git push origin test/load-testing

# Day 5: Final Integration
git push origin feature/health-checks
```

---

## 📊 Commit Statistics

| Phase | Commits | Files | Lines Added |
|-------|---------|-------|------------|
| 1. Backend | 5 | 2 | ~1,200 |
| 2. Admin | 3 | 2 | ~800 |
| 3. Docs | 3 | 3 | ~3,500 |
| 4. Config | 3 | 3 | ~200 |
| 5. Optimization | 3 | 3 | ~400 |
| 6. Frontend | 2 | 2 | ~300 |
| 7. Testing | 2 | 2 | ~150 |
| **TOTAL** | **21** | **17** | **~6,550** |

---

## ✅ PR Review Checklist

For each pull request:

- [ ] Commit messages follow convention
- [ ] Code is properly formatted
- [ ] Unit tests included (if applicable)
- [ ] Documentation updated
- [ ] No hardcoded values
- [ ] Error handling included
- [ ] Performance considered
- [ ] Security reviewed
- [ ] Backwards compatible

---

## 🚀 Deployment After Merge

```bash
# After all PRs merged to main:

# 1. Tag release
git tag -a v1.2.0 -m "Admin dashboard & analytics release"

# 2. Verify database migrations
npm run prisma:migrate -- --name deploy

# 3. Build & deploy
npm run build
pm2 reload ecosystem.config.js

# 4. Verify health
curl https://api.your-domain.com/health
curl https://your-domain.com/admin/

# 5. Monitor
pm2 logs
pm2 monit
```

---

**Total effort**: ~21 commits over 5 days of development
**Review time**: ~3-5 hours of code review
**Deployment time**: ~30 minutes with zero-downtime
