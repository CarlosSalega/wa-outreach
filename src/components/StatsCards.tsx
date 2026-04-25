import { Card, CardContent } from '@/components/ui/card';

type Props = {
  sentToday: number;
  failedToday: number;
  pendingTotal: number;
  campaignName: string | null;
};

export function StatsCards({ sentToday, failedToday, pendingTotal, campaignName }: Props) {
  const stats = [
    { label: 'Enviados hoy',  value: sentToday,   color: 'text-emerald-600' },
    { label: 'Fallidos hoy',  value: failedToday, color: 'text-red-500'    },
    { label: 'En cola',       value: pendingTotal, color: 'text-blue-500'  },
  ];

  return (
    <div className="space-y-3">
      {campaignName && (
        <p className="text-sm text-muted-foreground">
          Campaña activa:{' '}
          <span className="font-medium text-foreground">{campaignName}</span>
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="rounded-xl">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-2xl font-medium ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
