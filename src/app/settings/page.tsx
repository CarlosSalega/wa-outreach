'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

type WhatsAppAccount = {
  id: string;
  name: string;
  waAccountStartDate: string;
  dailyLimit: number;
  sendWindowStart: number;
  sendWindowStartMin: number;
  sendWindowEnd: number;
  sendWindowEndMin: number;
  status: string;
  createdAt: string;
};

const ACCOUNT_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CONFIGURED:   { label: 'Configurada',    variant: 'secondary' },
  CONNECTED:    { label: 'Conectada',      variant: 'default'   },
  DISCONNECTED: { label: 'Desconectada',   variant: 'destructive' },
};

type AccountForm = {
  name: string;
  waAccountStartDate: string;
  dailyLimit: number;
  sendWindowStart: number;
  sendWindowStartMin: number;
  sendWindowEnd: number;
  sendWindowEndMin: number;
};

const EMPTY_FORM: AccountForm = {
  name: '',
  waAccountStartDate: new Date().toISOString().split('T')[0],
  dailyLimit: 50,
  sendWindowStart: 9,
  sendWindowStartMin: 0,
  sendWindowEnd: 19,
  sendWindowEndMin: 0,
};

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts');
    const data = await res.json();
    setAccounts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
    setDialogOpen(true);
  }

  function openEdit(account: WhatsAppAccount) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      waAccountStartDate: new Date(account.waAccountStartDate).toISOString().split('T')[0],
      dailyLimit: account.dailyLimit,
      sendWindowStart: account.sendWindowStart,
      sendWindowStartMin: account.sendWindowStartMin,
      sendWindowEnd: account.sendWindowEnd,
      sendWindowEndMin: account.sendWindowEndMin,
    });
    setFeedback(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFeedback('El nombre es requerido.');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const url = editingId ? `/api/accounts/${editingId}` : '/api/accounts';
    const method = editingId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setDialogOpen(false);
      await fetchAccounts();
    } else {
      const data = await res.json();
      setFeedback(data.error ?? 'Error al guardar.');
    }

    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta cuenta?')) return;

    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchAccounts();
    } else {
      setFeedback('Error al eliminar la cuenta.');
    }
  }

  function formatWindow(start: number, startMin: number, end: number, endMin: number) {
    return `${String(start).padStart(2, '0')}:${String(startMin).padStart(2, '0')} – ${String(end).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Cargando...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-medium">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Administrá las cuentas de WhatsApp y sus límites de envío
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Cuentas de WhatsApp</CardTitle>
              <CardDescription>
                Cada cuenta tiene su propio límite diario y ventana de envío
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>Agregar cuenta</Button>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cuentas configuradas todavía.</p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Límite diario</TableHead>
                    <TableHead>Ventana de envío</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map(account => {
                    const s = ACCOUNT_STATUS[account.status] ?? ACCOUNT_STATUS.CONFIGURED;
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{account.dailyLimit}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatWindow(account.sendWindowStart, account.sendWindowStartMin, account.sendWindowEnd, account.sendWindowEndMin)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>
                              Editar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(account.id)} className="text-destructive">
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Modificá los datos de la cuenta.' : 'Configurá una nueva cuenta de WhatsApp.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">Nombre</Label>
              <Input
                id="acc-name"
                placeholder="Ej: Dental, Reagendamiento"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-start-date">Fecha de creación de la cuenta</Label>
              <Input
                id="acc-start-date"
                type="date"
                value={form.waAccountStartDate}
                onChange={e => setForm(f => ({ ...f, waAccountStartDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Usado para calcular el warm-up progresivo
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-limit">Límite diario (máximo)</Label>
              <Input
                id="acc-limit"
                type="number"
                min={10}
                max={500}
                value={form.dailyLimit}
                onChange={e => setForm(f => ({ ...f, dailyLimit: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">
                Días 1-3: 10, Días 4-7: 20, Días 8-14: 35, Día 15+: este valor
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Ventana de envío</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="acc-win-start-h" className="text-xs">Hora inicio</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="acc-win-start-h"
                      type="number"
                      min={0}
                      max={23}
                      value={form.sendWindowStart}
                      onChange={e => setForm(f => ({ ...f, sendWindowStart: Number(e.target.value) }))}
                      className="w-20"
                    />
                    <span className="text-lg font-bold">:</span>
                    <Input
                      id="acc-win-start-min"
                      type="number"
                      min={0}
                      max={59}
                      value={form.sendWindowStartMin}
                      onChange={e => setForm(f => ({ ...f, sendWindowStartMin: Number(e.target.value) }))}
                      className="w-20"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acc-win-end-h" className="text-xs">Hora fin</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="acc-win-end-h"
                      type="number"
                      min={0}
                      max={23}
                      value={form.sendWindowEnd}
                      onChange={e => setForm(f => ({ ...f, sendWindowEnd: Number(e.target.value) }))}
                      className="w-20"
                    />
                    <span className="text-lg font-bold">:</span>
                    <Input
                      id="acc-win-end-min"
                      type="number"
                      min={0}
                      max={59}
                      value={form.sendWindowEndMin}
                      onChange={e => setForm(f => ({ ...f, sendWindowEndMin: Number(e.target.value) }))}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {feedback && (
              <p className="text-sm text-destructive">{feedback}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
