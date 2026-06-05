"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "connected";

const statusConfig: Record<
  ConnectionStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  disconnected: { label: "Desconectado", variant: "destructive" },
  connecting: { label: "Conectando...", variant: "secondary" },
  qr_ready: { label: "Esperando QR", variant: "outline" },
  connected: { label: "Conectado", variant: "default" },
};

export function WaStatusBadge() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/wa-status");
        const data = await res.json();
        setStatus(data.status);
      } catch {
        setStatus("disconnected");
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  const config = statusConfig[status];

  return (
    <Badge
      variant={status === "connected" ? "default" : config.variant}
      className={
        status === "connected"
          ? "bg-whatsapp text-white hover:bg-whatsapp text-sm"
          : ""
      }
    >
      <span className="size-1.5 rounded-full bg-current" />
      {config.label}
    </Badge>
  );
}
