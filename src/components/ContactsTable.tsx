'use client';

import { useState } from 'react';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Contact = {
  id: string;
  phone: string;
  agencyName: string;
  status: string;
  createdAt: string;
};

const statusConfig: Record<string, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  pending:   { label: 'Pendiente', variant: 'secondary'   },
  active:    { label: 'Activo',    variant: 'default'     },
  done:      { label: 'Listo',     variant: 'outline'     },
  opted_out: { label: 'Opt-out',   variant: 'destructive' },
};

type Props = {
  contacts: Contact[];
  onDelete: (ids: string[]) => void;
};

export function ContactsTable({ contacts, onDelete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map(c => c.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{selected.size} seleccionados</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { onDelete([...selected]); setSelected(new Set()); }}
          >
            Eliminar
          </Button>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={selected.size === contacts.length && contacts.length > 0}
                  onChange={toggleAll}
                  className="cursor-pointer"
                />
              </TableHead>
              <TableHead>Agencia</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Importado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No hay contactos todavía
                </TableCell>
              </TableRow>
            )}
            {contacts.map(contact => {
              const s = statusConfig[contact.status] ?? statusConfig.pending;
              return (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer"
                  onClick={() => toggleOne(contact.id)}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(contact.id)}
                      onChange={() => toggleOne(contact.id)}
                      onClick={e => e.stopPropagation()}
                      className="cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{contact.agencyName}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.phone}</TableCell>
                  <TableCell>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(contact.createdAt).toLocaleDateString('es-AR')}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
