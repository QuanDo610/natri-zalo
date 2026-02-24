// ===== Dealer Dashboard: Stats + Recent Activations =====

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Input, Text, Page, Spinner } from 'zmp-ui';
import { useAtomValue } from 'jotai';
import { authUserAtom, accessTokenAtom } from '@/store/app-store';
import { api } from '@/services/api-client';
import type { DealerStats, ActivationHistoryItem, ApiError } from '@/types';

function DealerDashboardPage() {
  const navigate = useNavigate();
  const authUser = useAtomValue(authUserAtom);
  const token = useAtomValue(accessTokenAtom);

  const [stats, setStats] = useState<DealerStats | null>(null);
  const [activations, setActivations] = useState<ActivationHistoryItem[]>([]);
  const [activationsTotal, setActivationsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Redirect if not logged in as dealer
  useEffect(() => {
    if (!authUser || authUser.role !== 'DEALER') {
      navigate('/login');
    }
  }, [authUser, navigate]);

  // Fetch stats
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await api.getDealerStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load dealer stats:', err);
      }
    })();
  }, [token]);

  // Fetch activations
  const fetchActivations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await api.getDealerActivations({
        skip: page * pageSize,
        take: pageSize,
        search: search.trim() || undefined,
      });
      setActivations(result.data);
      setActivationsTotal(result.total);
    } catch (err) {
      console.error('Failed to load activations:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, search]);

  useEffect(() => {
    fetchActivations();
  }, [fetchActivations]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()} ${d
      .getHours()
      .toString()
      .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const totalPages = Math.ceil(activationsTotal / pageSize);

  if (!authUser) return null;

  return (
    <Page className="p-4 bg-white min-h-screen">
      <Box className="space-y-5">
        {/* Header */}
        <Box textAlign="center" className="pt-4 pb-2">
          <Text.Title size="large" className="text-blue-600">
            Dashboard Đại lý
          </Text.Title>
          {stats?.dealer && (
            <Text size="small" className="text-gray-500 mt-1">
              {stats.dealer.shopName} ({stats.dealer.code})
            </Text>
          )}
        </Box>

        {/* Stats cards */}
        {stats && (
          <Box className="space-y-3">
            {/* Points */}
            <Box className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
              <Text size="xSmall" className="text-blue-100">Tổng điểm tích lũy</Text>
              <Text.Title size="large" className="text-white">
                {stats.totalPoints} điểm
              </Text.Title>
            </Box>

            {/* Grid stats */}
            <Box className="grid grid-cols-2 gap-3">
              <Box className="bg-green-50 rounded-lg p-3 border border-green-200">
                <Text size="xSmall" className="text-green-600">Hôm nay</Text>
                <Text size="large" bold className="text-green-700">{stats.activationsToday}</Text>
              </Box>
              <Box className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <Text size="xSmall" className="text-orange-600">7 ngày</Text>
                <Text size="large" bold className="text-orange-700">{stats.activationsWeek}</Text>
              </Box>
              <Box className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <Text size="xSmall" className="text-purple-600">30 ngày</Text>
                <Text size="large" bold className="text-purple-700">{stats.activationsMonth}</Text>
              </Box>
              <Box className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <Text size="xSmall" className="text-blue-600">KH duy nhất</Text>
                <Text size="large" bold className="text-blue-700">{stats.uniqueCustomers}</Text>
              </Box>
            </Box>

            <Box className="bg-gray-50 rounded-lg p-3 border text-center">
              <Text size="xSmall" className="text-gray-500">Tổng kích hoạt</Text>
              <Text size="large" bold>{stats.totalActivations}</Text>
            </Box>
          </Box>
        )}

        {/* Recent activations */}
        <Box className="space-y-3">
          <Text size="small" bold className="text-gray-700">
            Danh sách kích hoạt
          </Text>

          <Input
            placeholder="Tìm khách hàng, barcode..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          {loading && (
            <Box className="flex justify-center py-4">
              <Spinner />
            </Box>
          )}

          {!loading && activations.length === 0 && (
            <Box className="text-center py-4">
              <Text size="small" className="text-gray-400">
                Chưa có kích hoạt nào
              </Text>
            </Box>
          )}

          {!loading &&
            activations.map((item) => (
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
                      {item.barcodeItem.barcode}
                    </Text>
                  </Box>
                  <Text size="small" bold className="text-green-600">
                    +{item.pointsAwarded} điểm
                  </Text>
                </Box>
                <Box className="flex justify-between">
                  <Text size="xSmall" className="text-gray-500">
                    KH: {item.customer?.name} ({item.customer?.phone})
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

        {/* Actions */}
        <Box className="space-y-2 pt-2">
          <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
            ← Về trang chủ
          </Button>
        </Box>
      </Box>
    </Page>
  );
}

export default DealerDashboardPage;
