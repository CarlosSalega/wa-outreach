import { Card, CardContent } from '@/components/ui/card';
import { Send, AlertCircle, Clock } from 'lucide-react';

type Props = {
  sentToday: number;
  failedToday: number;
  pendingTotal: number;
  campaignName: string | null;
};

export function StatsCards({ sentToday, failedToday, pendingTotal, campaignName }: Props) {
  const stats = [
    { label: 'Enviados hoy',  value: sentToday,   color: 'text-emerald-600', Icon: Send        },
    { label: 'Fallidos hoy',  value: failedToday, color: 'text-red-500',    Icon: AlertCircle },
    { label: 'En cola',       value: pendingTotal, color: 'text-blue-500',  Icon: Clock       },
  ];

  return (
    <div className="space-y-3">
      {campaignName && (
        <p className="text-sm text-muted-foreground">
          Campaña activa:{' '}
          <span className="font-medium text-foreground">{campaignName}</span>
        </p>
      )}
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3">
        {stats.map(s => {
          const StatIcon = s.Icon;
          return (
            <Card key={s.label} className="rounded-xl">
              <CardContent className="flex items-center gap-3 py-4 sm:flex-col sm:items-stretch sm:gap-0 sm:pt-4 sm:pb-4">
                <StatIcon className={`h-5 w-5 shrink-0 ${s.color}`} aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-medium ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
