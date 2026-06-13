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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type Template = { id: string; name: string };
type WhatsAppAccount = { id: string; name: string };
type ContactList = { id: string; name: string };
type Campaign = {
  id: string;
  name: string;
  status: string;
  pauseReason: string | null;
  delayMinSec: number;
  delayMaxSec: number;
  order: number;
  template: Template;
  whatsappAccount: WhatsAppAccount | null;
  contactList: ContactList | null;
  _count: { queue: number };
};

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  ACTIVE: { label: 'Activa',     variant: 'default'   },
  PAUSED: { label: 'Pausada',    variant: 'secondary' },
  DONE:   { label: 'Finalizada', variant: 'outline'   },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [templates, setTemplates]   = useState<Template[]>([]);
  const [accounts, setAccounts]     = useState<WhatsAppAccount[]>([]);
  const [name, setName]             = useState('');
  const [templateId, setTemplateId] = useState('');
  const [accountId, setAccountId]   = useState('');
  const [order, setOrder]           = useState(0);
  const [delayMin, setDelayMin]     = useState(30);
  const [delayMax, setDelayMax]     = useState(45);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [feedback, setFeedback]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [campRes, tplRes, accRes] = await Promise.all([
      fetch('/api/campaigns'),
      fetch('/api/templates'),
      fetch('/api/accounts'),
    ]);
    const campData = await campRes.json();
    const tplData  = await tplRes.json();
    const accData  = await accRes.json();
    setCampaigns(Array.isArray(campData) ? campData : []);
    setTemplates(Array.isArray(tplData) ? tplData : []);
    setAccounts(Array.isArray(accData) ? accData : []);
    if (Array.isArray(tplData) && tplData.length) setTemplateId(tplData[0].id);
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  async function handleCreate() {
    if (!name.trim() || !templateId) {
      setFeedback('Completá el nombre y seleccioná un template.');
      return;
    }
    if (delayMin >= delayMax) {
      setFeedback('El delay mínimo debe ser menor al máximo.');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const body: Record<string, unknown> = {
      name,
      templateId,
      delayMinSec: delayMin,
      delayMaxSec: delayMax,
      order,
    };
    if (accountId) body.whatsappAccountId = accountId;

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      setFeedback(
        `Campaña creada. ${data.contactsEnqueued} contactos encolados, ` +
        `${data.messagesScheduled} mensajes programados.`
      );
      setName('');
      setOrder(0);
      await fetchData();
    } else {
      setFeedback(data.error ?? 'Error al crear la campaña.');
    }

    setSaving(false);
  }

  async function handleToggle(campaign: Campaign) {
    const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaign.id, status: newStatus }),
    });

    await fetchData();
  }

  async function handleDelete(campaign: Campaign) {
    if (!confirm(`¿Eliminar la campaña "${campaign.name}"? Los contactos volverán a estar pendientes.`)) return;

    const res = await fetch('/api/campaigns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaign.id }),
    });

    const data = await res.json();
    if (!res.ok) {
      setFeedback(data.error ?? 'Error al eliminar la campaña.');
      return;
    }

    setFeedback('Campaña eliminada. Contactos restaurados.');
    await fetchData();
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
      <div>
        <h1 className="text-xl font-medium">Campañas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Múltiples campañas por cuenta — ordenadas por prioridad
        </p>
      </div>

      {campaigns.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pendientes</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(campaign => {
                const s = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.PAUSED;
                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="text-muted-foreground">{campaign.order}</TableCell>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign.whatsappAccount?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign.template.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign._count.queue}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(campaign)}
                        >
                          {campaign.status === 'ACTIVE' ? 'Pausar' : 'Reanudar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(campaign)}
                          className="text-destructive"
                        >
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

      {campaigns.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay campañas creadas todavía.</p>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva campaña</CardTitle>
          <CardDescription>
            Asigná una cuenta y un orden de prioridad
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="camp-name">Nombre</Label>
            <Input
              id="camp-name"
              placeholder="Ej: Agencias CABA — Abril"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="camp-template">Template</Label>
              <select
                id="camp-template"
                className="w-full h-8 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-3 focus:ring-ring/50"
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
              >
                {templates.length === 0 && (
                  <option value="">Sin templates — creá uno primero</option>
                )}
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Cuenta WhatsApp</Label>
              <Select value={accountId} onValueChange={(v) => setAccountId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin cuenta (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cuenta (default)</SelectItem>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="camp-order">Orden</Label>
              <Input
                id="camp-order"
                type="number"
                min={0}
                max={99}
                value={order}
                onChange={e => setOrder(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Prioridad dentro de la cuenta</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delay-min">Delay min (seg)</Label>
              <Input
                id="delay-min"
                type="number"
                min={10}
                max={120}
                value={delayMin}
                onChange={e => setDelayMin(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delay-max">Delay max (seg)</Label>
              <Input
                id="delay-max"
                type="number"
                min={20}
                max={300}
                value={delayMax}
                onChange={e => setDelayMax(Number(e.target.value))}
              />
            </div>
          </div>

          {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}

          <Button size="sm" onClick={handleCreate} disabled={saving || templates.length === 0}>
            {saving ? 'Creando...' : 'Crear campaña'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
