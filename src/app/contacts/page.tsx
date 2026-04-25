'use client';

import { useEffect, useState, useCallback } from 'react';
import { ContactsTable } from '@/components/ContactsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import Papa from 'papaparse';

type Contact = {
  id: string;
  phone: string;
  agencyName: string;
  status: string;
  createdAt: string;
};

export default function ContactsPage() {
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [loading, setLoading]     = useState(true);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback]   = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    setContacts(data);
  }, []);

  useEffect(() => {
    fetchContacts().finally(() => setLoading(false));
  }, [fetchContacts]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setFeedback(null);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      let items: { phone: string; agencyName: string }[] = [];

      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse<any>(text, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          transformHeader: (h: string) => h.trim().toLowerCase(),
        });

        items = result.data.map((row: any) => ({
          phone: (row.phone ?? row.telefono ?? '').toString().replace(/\D/g, ''),
          agencyName: (row.agencyname ?? row.nombre ?? row.agency ?? '').toString().trim(),
        }));

      } else if (ext === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : parsed.contacts ?? [];
        items = arr.map((row: any) => ({
          phone: (row.phone ?? row.telefono ?? '').toString().replace(/\D/g, ''),
          agencyName: (row.agencyName ?? row.nombre ?? row.agency ?? '').toString().trim(),
        }));

      } else {
        setFeedback('Formato no soportado. Usá CSV o JSON.');
        setImporting(false);
        return;
      }

      const valid = items.filter(i => i.phone);
      const skipped = items.length - valid.length;

      if (!valid.length) {
        setFeedback('No se encontraron contactos válidos en el archivo.');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      });

      const data = await res.json();

      setFeedback(
        `${data.imported} contactos importados.` +
        (skipped ? ` ${skipped} filas ignoradas por datos incompletos.` : '')
      );

      await fetchContacts();

    } catch {
      setFeedback('Error al procesar el archivo. Revisá el formato.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function handleDelete(ids: string[]) {
    await fetch('/api/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    await fetchContacts();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-medium">Contactos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {contacts.length} contactos cargados
        </p>
      </div>

      <div className="rounded-xl border p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium">Importar contactos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            CSV o JSON. Columna{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">phone</code> obligatoria.{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">agencyName</code> opcional.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Label
            htmlFor="file-upload"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {importing ? 'Importando...' : 'Seleccionar archivo'}
          </Label>
          <Input
            id="file-upload"
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={handleFileUpload}
            disabled={importing}
          />
        </div>

        {feedback && (
          <p className="text-sm text-muted-foreground">{feedback}</p>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Formato esperado (CSV):</p>
          <pre className="bg-muted rounded-xl px-3 py-2 font-mono">{`phone,agencyName\n5491112345678,Carpoint\n5491198765432,\n5491122334455,AutoMax`}</pre>
        </div>
      </div>

      <Separator />

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <ContactsTable contacts={contacts} onDelete={handleDelete} />
      )}
    </div>
  );
}
