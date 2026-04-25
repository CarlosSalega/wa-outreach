'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type AppConfig = {
  id: string;
  waAccountStartDate: string;
  dailyLimit: number;
  sendWindowStart: number;
  sendWindowStartMin: number;
  sendWindowEnd: number;
  sendWindowEndMin: number;
};

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form state
  const [dailyLimit, setDailyLimit] = useState(50);
  const [sendWindowStart, setSendWindowStart] = useState(9);
  const [sendWindowStartMin, setSendWindowStartMin] = useState(0);
  const [sendWindowEnd, setSendWindowEnd] = useState(19);
  const [sendWindowEndMin, setSendWindowEndMin] = useState(0);
  const [waStartDate, setWaStartDate] = useState('');

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data) {
      setConfig(data);
      setDailyLimit(data.dailyLimit);
      setSendWindowStart(data.sendWindowStart);
      setSendWindowStartMin(data.sendWindowStartMin);
      setSendWindowEnd(data.sendWindowEnd);
      setSendWindowEndMin(data.sendWindowEndMin);
      setWaStartDate(data.waAccountStartDate ? new Date(data.waAccountStartDate).toISOString().split('T')[0] : '');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  async function handleSave() {
    if (!waStartDate) {
      setFeedback('La fecha de inicio de WhatsApp es requerida.');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waAccountStartDate: waStartDate,
        dailyLimit,
        sendWindowStart,
        sendWindowStartMin,
        sendWindowEnd,
        sendWindowEndMin,
      }),
    });

    if (res.ok) {
      setFeedback('Configuración guardada.');
      await fetchConfig();
    } else {
      const data = await res.json();
      setFeedback(data.error ?? 'Error al guardar.');
    }

    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Cargando...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-medium">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ajustes de la cuenta de WhatsApp y ventanas de envío
        </p>
      </div>

      <div className="space-y-6">
        <Card>
        <CardHeader>
          <CardTitle className="text-base">Warm-up y límite diario</CardTitle>
          <CardDescription>
            El límite diario se ajusta automáticamente con warm-up los primeros 14 días
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wa-start-date">Fecha de creación de la cuenta WhatsApp</Label>
            <Input
              id="wa-start-date"
              type="date"
              value={waStartDate}
              onChange={e => setWaStartDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usado para calcular el warm-up progresivo
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="daily-limit">Límite diario (máximo)</Label>
            <Input
              id="daily-limit"
              type="number"
              min={10}
              max={100}
              value={dailyLimit}
              onChange={e => setDailyLimit(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Días 1-3: 10, Días 4-7: 20, Días 8-14: 35, Día 15+: este valor
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventana de envío</CardTitle>
          <CardDescription>
            Los mensajes solo se envían dentro de este horario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Ventana de envío</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="window-start" className="text-xs">Hora inicio</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="window-start-h"
                    type="number"
                    min={0}
                    max={23}
                    value={sendWindowStart}
                    onChange={e => setSendWindowStart(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-lg font-bold">:</span>
                  <Input
                    id="window-start-min"
                    type="number"
                    min={0}
                    max={59}
                    value={sendWindowStartMin}
                    onChange={e => setSendWindowStartMin(Number(e.target.value))}
                    className="w-20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="window-end" className="text-xs">Hora fin</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="window-end-h"
                    type="number"
                    min={0}
                    max={23}
                    value={sendWindowEnd}
                    onChange={e => setSendWindowEnd(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-lg font-bold">:</span>
                  <Input
                    id="window-end-min"
                    type="number"
                    min={0}
                    max={59}
                    value={sendWindowEndMin}
                    onChange={e => setSendWindowEndMin(Number(e.target.value))}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          </div>

          {feedback && (
            <p className={`text-sm ${feedback.startsWith('Error') ? 'text-destructive' : 'text-muted-foreground'}`}>
              {feedback}
            </p>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </CardContent>
      </Card>

      {config && (
        <>
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Config actual:</strong></p>
            <p>Límite diario: {config.dailyLimit} mensajes</p>
            <p>Ventana: {String(config.sendWindowStart).padStart(2, '0')}:{String(config.sendWindowStartMin).padStart(2, '0')} – {String(config.sendWindowEnd).padStart(2, '0')}:{String(config.sendWindowEndMin).padStart(2, '0')}hs</p>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
