// ===== Customer History Page: View activated products =====

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Input, Text, Page, Spinner, Select } from 'zmp-ui';
import { useAtomValue } from 'jotai';
import { authUserAtom, accessTokenAtom } from '@/store/app-store';
import { api } from '@/services/api-client';
import type { ActivationHistoryItem, ApiError } from '@/types';

const { Option } = Select;

type TimeFilter = 'all' | '7d' | '30d' | '90d';

function CustomerHistoryPage() {
  const navigate = useNavigate();
  const authUser = useAtomValue(authUserAtom);
  const token = useAtomValue(accessTokenAtom);

  const [items, setItems] = useState<ActivationHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Redirect if not logged in as customer
  useEffect(() => {
    if (!authUser || authUser.role !== 'CUSTOMER') {
      navigate('/login');
    }
  }, [authUser, navigate]);

  const getDateRange = (filter: TimeFilter) => {
    if (filter === 'all') return {};
    const now = new Date();
    const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    return { dateFrom: from.toISOString() };
  };

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const dateRange = getDateRange(timeFilter);
      const result = await api.getMyActivations({
        skip: page * pageSize,
        take: pageSize,
        search: search.trim() || undefined,
        ...dateRange,
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, timeFilter, search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()} ${d
      .getHours()
      .toString()
      .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const totalPages = Math.ceil(total / pageSize);

  if (!authUser) return null;

  return (
    <Page className="p-4 bg-white min-h-screen">
      <Box className="space-y-4">
        {/* Header */}
        <Box textAlign="center" className="pt-4 pb-2">
          <Text.Title size="large" className="text-blue-600">
            Lịch sử tích điểm
          </Text.Title>
          <Text size="small" className="text-gray-500 mt-1">
            {authUser.customer?.name || authUser.phone} — {authUser.customer?.points ?? 0} điểm
          </Text>
        </Box>

        {/* Filters */}
        <Box className="space-y-2">
          <Box className="flex gap-2">
            <Box className="flex-1">
              <Input
                placeholder="Tìm sản phẩm, barcode..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </Box>
          </Box>
          <Box className="flex gap-2">
            {(['all', '7d', '30d', '90d'] as TimeFilter[]).map((f) => (
              <Button
                key={f}
                variant={timeFilter === f ? 'primary' : 'tertiary'}
                size="small"
                onClick={() => {
                  setTimeFilter(f);
                  setPage(0);
                }}
                className="flex-1 text-xs"
              >
                {f === 'all' ? 'Tất cả' : f === '7d' ? '7 ngày' : f === '30d' ? '30 ngày' : '90 ngày'}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Loading state */}
        {loading && (
          <Box className="flex justify-center py-8">
            <Spinner />
          </Box>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <Box className="text-center py-8">
            <Text size="small" className="text-gray-400">
              Chưa có lịch sử tích điểm
            </Text>
          </Box>
        )}

        {/* Results */}
        {!loading && items.length > 0 && (
          <Box className="space-y-3">
            <Text size="xSmall" className="text-gray-400">
              {total} kết quả
            </Text>
            {items.map((item) => (
              <Box
                key={item.id}
                className="bg-gray-50 rounded-xl p-3 border space-y-1"
              >
                <Box className="flex justify-between items-start">
                  <Box className="flex-1">
                    <Text size="small" bold>
                      {item.product.name}
                    </Text>
                    <Text size="xSmall" className="text-gray-400">
                      {item.product.sku} — {item.barcodeItem.barcode}
                    </Text>
                  </Box>
                  <Text size="small" bold className="text-green-600">
                    +{item.pointsAwarded} điểm
                  </Text>
                </Box>
                <Box className="flex justify-between">
                  <Text size="xSmall" className="text-gray-500">
                    {item.dealer
                      ? `Đại lý: ${item.dealer.shopName} (${item.dealer.code})`
                      : 'Không qua đại lý'}
                  </Text>
                  <Text size="xSmall" className="text-gray-400">
                    {formatDate(item.createdAt)}
                  </Text>
                </Box>
              </Box>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <Box className="flex justify-center gap-2 pt-2">
                <Button
                  variant="tertiary"
                  size="small"
                  disabled={page <= 0}
                  onClick={() => setPage(page - 1)}
                >
                  ← Trước
                </Button>
                <Text size="xSmall" className="text-gray-500 self-center">
                  {page + 1} / {totalPages}
                </Text>
                <Button
                  variant="tertiary"
                  size="small"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  Sau →
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* Actions */}
        <Box className="space-y-2 pt-4">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate('/')}
          >
            ← Về trang chủ
          </Button>
        </Box>
      </Box>
    </Page>
  );
}

export default CustomerHistoryPage;
