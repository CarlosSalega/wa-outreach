'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

type TemplateMessage = { order: number; body: string };
type Template = { id: string; name: string; messages: TemplateMessage[] };

const DEFAULT_MESSAGES: TemplateMessage[] = [
  {
    order: 1,
    body: '👋 Hola, soy Carlos.\nDesarrollo páginas y sistemas de gestión para agencias y concesionarias.\n¿Te gustaría tener tu propia página web profesional {{nombre}}.com? 🤔',
  },
  {
    order: 2,
    body: 'Generá más confianza a tus potenciales clientes y diferenciáte de la competencia. 💪',
  },
  {
    order: 3,
    body: 'Acá podés ver una web que estoy terminando para un cliente 👉\nhttps://www.fyfautomotores.com/',
  },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName]           = useState('');
  const [messages, setMessages]   = useState<TemplateMessage[]>(DEFAULT_MESSAGES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [feedback, setFeedback]   = useState<string | null>(null);
  const [previewNombre, setPreviewNombre] = useState('Carpoint');

  const fetchTemplates = useCallback(async () => {
    const res = await fetch('/api/templates');
    const data = await res.json();
    // Parsear el string JSON a objetos
    const parsed = data.map((t: any) => ({
      ...t,
      messages: typeof t.messages === 'string' ? JSON.parse(t.messages) : t.messages,
    }));
    setTemplates(parsed);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function updateMessage(order: number, body: string) {
    setMessages(prev => prev.map(m => m.order === order ? { ...m, body } : m));
  }

  function interpolatePreview(body: string): string {
    return body.replace(/\{\{nombre\}\}/g, previewNombre.toLowerCase());
  }

  async function handleSave() {
    if (!name.trim()) { setFeedback('El nombre es requerido.'); return; }

    setSaving(true);
    setFeedback(null);

    const method = editingId ? 'PUT' : 'POST';
    const body   = editingId ? { id: editingId, name, messages } : { name, messages };

    const res = await fetch('/api/templates', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setFeedback(editingId ? 'Template actualizado.' : 'Template guardado.');
      setEditingId(null);
      setName('');
      setMessages(DEFAULT_MESSAGES);
      await fetchTemplates();
    } else {
      setFeedback('Error al guardar.');
    }

    setSaving(false);
  }

  function handleEdit(t: Template) {
    setEditingId(t.id);
    setName(t.name);
    const msgs = typeof t.messages === 'string' ? JSON.parse(t.messages) : t.messages;
    setMessages(msgs);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este template y sus campañas asociadas?')) return;

    const res = await fetch('/api/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();
    if (!res.ok) {
      setFeedback(data.error ?? 'Error al eliminar el template.');
      return;
    }

    setFeedback('Template eliminado.');
    await fetchTemplates();
    if (editingId === id) {
      setEditingId(null);
      setName('');
      setMessages(DEFAULT_MESSAGES);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-medium">Templates</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cada template tiene 3 mensajes con delay entre sí
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Editor */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium">
            {editingId ? 'Editando template' : 'Nuevo template'}
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nombre</Label>
            <Input
              id="tpl-name"
              placeholder="Ej: Agencias de autos v1"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {messages.map(msg => (
            <div key={msg.order} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label>Mensaje {msg.order}</Label>
                {msg.order === 1
                  ? <Badge variant="secondary" className="text-xs">inmediato</Badge>
                  : <Badge variant="outline" className="text-xs">con delay</Badge>
                }
              </div>
              <textarea
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm resize-none min-h-[90px] focus:outline-none focus:ring-1 focus:ring-ring"
                value={msg.body}
                onChange={e => updateMessage(msg.order, e.target.value)}
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label>Variables disponibles</Label>
            <div className="flex gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">{'{{nombre}}'}</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">{'{{telefono}}'}</code>
            </div>
          </div>

          {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar template'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => {
                setEditingId(null); setName(''); setMessages(DEFAULT_MESSAGES); setFeedback(null);
              }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Preview</h2>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Agencia</Label>
              <Input
                className="h-7 w-32 text-xs"
                value={previewNombre}
                onChange={e => setPreviewNombre(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#e5ddd5] p-3 space-y-2 min-h-[280px]">
            {messages.map((msg, i) => (
              <div key={msg.order}>
                {i > 0 && (
                  <div className="flex items-center gap-2 my-2 px-1">
                    <div className="flex-1 h-px bg-black/10" />
                    <span className="text-[10px] text-black/40">delay aleatorio</span>
                    <div className="flex-1 h-px bg-black/10" />
                  </div>
                )}
                <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 max-w-[88%] shadow-sm">
                  <p className="text-xs text-black whitespace-pre-wrap leading-relaxed">
                    {interpolatePreview(msg.body)}
                  </p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">✓✓</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {templates.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-medium">Templates guardados</h2>
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(t.messages as TemplateMessage[]).length} mensajes
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(t)}>
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
