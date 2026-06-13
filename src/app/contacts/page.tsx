'use client';

import { useEffect, useState, useCallback } from 'react';
import { ContactsTable } from '@/components/ContactsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import Papa from 'papaparse';

type Contact = {
  id: string;
  phone: string;
  agencyName: string;
  status: string;
  contactListId: string | null;
  createdAt: string;
};

type ContactList = {
  id: string;
  name: string;
};

export default function ContactsPage() {
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [filterListId, setFilterListId] = useState('');
  const [importListId, setImportListId] = useState('');
  const [loading, setLoading]         = useState(true);
  const [importing, setImporting]     = useState(false);
  const [feedback, setFeedback]       = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    const params = filterListId ? `?contactListId=${filterListId}` : '';
    const res = await fetch(`/api/contacts${params}`);
    const data = await res.json();
    setContacts(Array.isArray(data) ? data : []);
  }, [filterListId]);

  const fetchLists = useCallback(async () => {
    const res = await fetch('/api/contact-lists');
    const data = await res.json();
    setContactLists(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    Promise.all([fetchContacts(), fetchLists()]).finally(() => setLoading(false));
  }, [fetchContacts, fetchLists]);

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
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          transformHeader: (h: string) => h.trim().toLowerCase(),
        });

        items = result.data.map((row) => ({
          phone: (row.phone ?? row.telefono ?? '').toString().replace(/\D/g, ''),
          agencyName: (row.agencyname ?? row.nombre ?? row.agency ?? '').toString().trim(),
        }));

      } else if (ext === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : parsed.contacts ?? [];
        items = arr.map((row: Record<string, string>) => ({
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

      const body: Record<string, unknown> = { items: valid };
      if (importListId) body.contactListId = importListId;

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          {contacts.length} contactos{filterListId ? ' en esta lista' : ' cargados'}
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

        <div className="space-y-1.5">
          <Label>Lista de contactos (opcional)</Label>
          <Select value={importListId} onValueChange={(v) => setImportListId(v ?? '')}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Sin lista específica" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sin lista específica</SelectItem>
              {contactLists.map(list => (
                <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm">Filtrar por lista</Label>
          <Select value={filterListId} onValueChange={(v) => setFilterListId(v ?? '')}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Todas las listas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las listas</SelectItem>
              {contactLists.map(list => (
                <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <ContactsTable contacts={contacts} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
