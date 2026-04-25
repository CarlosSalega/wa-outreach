'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type Template = { id: string; name: string };
type Campaign = {
  id: string;
  name: string;
  status: string;
  pauseReason: string | null;
  delayMinSec: number;
  delayMaxSec: number;
  template: Template;
  _count: { queue: number };
};

const statusConfig: Record<string, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  ACTIVE: { label: 'Activa',     variant: 'default'   },
  PAUSED: { label: 'Pausada',    variant: 'secondary' },
  DONE:   { label: 'Finalizada', variant: 'outline'   },
};

export default function CampaignsPage() {
  const [campaign, setCampaign]     = useState<Campaign | null>(null);
  const [templates, setTemplates]   = useState<Template[]>([]);
  const [name, setName]             = useState('');
  const [templateId, setTemplateId] = useState('');
  const [delayMin, setDelayMin]     = useState(30);
  const [delayMax, setDelayMax]     = useState(45);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [feedback, setFeedback]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [campRes, tplRes] = await Promise.all([
      fetch('/api/campaigns'),
      fetch('/api/templates'),
    ]);
    const campData = await campRes.json();
    const tplData  = await tplRes.json();
    setCampaign(campData);
    setTemplates(tplData);
    if (tplData.length) setTemplateId(tplData[0].id);
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

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, templateId, delayMinSec: delayMin, delayMaxSec: delayMax }),
    });

    const data = await res.json();

    if (res.ok) {
      setFeedback(
        `Campaña creada. ${data.contactsEnqueued} contactos encolados, ` +
        `${data.messagesScheduled} mensajes programados.`
      );
      await fetchData();
    } else {
      setFeedback(data.error ?? 'Error al crear la campaña.');
    }

    setSaving(false);
  }

  async function handleToggle() {
    if (!campaign) return;
    const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaign.id, status: newStatus }),
    });

    await fetchData();
  }

  async function handleDelete() {
    if (!campaign) return;
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

  const s = campaign ? (statusConfig[campaign.status] ?? statusConfig.PAUSED) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-medium">Campaña</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Una campaña activa a la vez — 50 mensajes diarios
        </p>
      </div>

      {campaign && s && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{campaign.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Template: {campaign.template.name}
                </p>
                {campaign.pauseReason && (
                  <p className="text-xs text-destructive mt-1">{campaign.pauseReason}</p>
                )}
              </div>
              <Badge variant={s.variant}>{s.label}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">Delay entre mensajes</p>
                <p className="font-medium mt-0.5">{campaign.delayMinSec}s – {campaign.delayMaxSec}s</p>
              </div>
              <div className="rounded-xl bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">Delay entre contactos</p>
                <p className="font-medium mt-0.5">3–7 min</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={campaign.status === 'ACTIVE' ? 'secondary' : 'default'}
                size="sm"
                onClick={handleToggle}
              >
                {campaign.status === 'ACTIVE' ? 'Pausar campaña' : 'Reanudar campaña'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!campaign && (
        <p className="text-sm text-muted-foreground">No hay ninguna campaña creada todavía.</p>
      )}

      <Separator />

      <div className="space-y-5">
        <h2 className="text-sm font-medium">Nueva campaña</h2>

        <div className="space-y-1.5">
          <Label htmlFor="camp-name">Nombre</Label>
          <Input
            id="camp-name"
            placeholder="Ej: Agencias CABA — Abril"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="camp-template">Template</Label>
          <select
            id="camp-template"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="delay-min">Delay entre msgs (mín seg)</Label>
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
            <Label htmlFor="delay-max">Delay entre msgs (máx seg)</Label>
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
        <p className="text-xs text-muted-foreground -mt-2">
          Entre contactos: 3–7 minutos automático
        </p>

        {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}

        <Button size="sm" onClick={handleCreate} disabled={saving || templates.length === 0}>
          {saving ? 'Creando...' : 'Crear campaña'}
        </Button>
      </div>
    </div>
  );
}
