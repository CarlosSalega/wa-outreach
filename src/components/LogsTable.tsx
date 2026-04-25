'use client';

import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Log = {
  id: string;
  status: string;
  sentAt: string;
  messageQueue: {
    messageOrder: number;
    bodySnapshot: string;
    contact: { agencyName: string; phone: string };
  };
};

type Props = {
  logs: Log[];
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function LogsTable({ logs, page, pages, total, onPageChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} mensajes hoy</p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary" size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {pages || 1}</span>
          <Button
            variant="secondary" size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agencia</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="w-12">Msg</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Enviado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Sin actividad hoy todavía
                </TableCell>
              </TableRow>
            )}
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">
                  {log.messageQueue.contact.agencyName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.messageQueue.contact.phone}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {log.messageQueue.messageOrder}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                  {log.messageQueue.bodySnapshot}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={log.status === 'sent' ? 'outline' : 'destructive'}
                    className={log.status === 'sent' ? '!bg-emerald-500 text-white border-0 hover:!bg-emerald-600' : ''}
                  >
                    {log.status === 'sent' ? 'Enviado' : 'Fallido'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.sentAt
                    ? new Date(log.sentAt).toLocaleTimeString('es-AR', {
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
