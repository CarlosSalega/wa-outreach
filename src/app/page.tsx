'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatsCards } from '@/components/StatsCards';
import { LogsTable } from '@/components/LogsTable';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

type Stats = {
  sentToday: number;
  failedToday: number;
  pendingTotal: number;
  campaign: { id: string; name: string; status: string } | null;
};

type LogsResponse = {
  logs: any[];
  total: number;
  page: number;
  pages: number;
};

export default function DashboardPage() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [logs, setLogs]       = useState<LogsResponse | null>(null);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/stats');
    const data = await res.json();
    setStats(data);
  }, []);

  const fetchLogs = useCallback(async (p: number) => {
    const res = await fetch(`/api/logs?page=${p}&limit=50`);
    const data = await res.json();
    setLogs(data);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchStats(), fetchLogs(1)]);
      setLoading(false);
    }
    init();

    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchLogs]);

  async function handlePageChange(p: number) {
    setPage(p);
    await fetchLogs(p);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Actividad de hoy</p>
        </div>
        <Button size="sm" onClick={() => { fetchStats(); fetchLogs(page); }}>
          Actualizar
        </Button>
      </div>

      {stats && (
        <StatsCards
          sentToday={stats.sentToday}
          failedToday={stats.failedToday}
          pendingTotal={stats.pendingTotal}
          campaignName={stats.campaign?.name ?? null}
        />
      )}

      <Separator />

      <div>
        <h2 className="text-base font-medium mb-4">Mensajes de hoy</h2>
        {logs && (
          <LogsTable
            logs={logs.logs}
            page={page}
            pages={logs.pages}
            total={logs.total}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
