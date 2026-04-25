# 📱 WA Outreach

🚀 App de **cold outreach por WhatsApp** para agencias y concesionarias de autos.

Automatiza el envío de mensajes en secuencia a contactos importados desde CSV, con un sistema **anti-ban** inteligente y ventana horaria configurable.

---

## ✨ Features

- 📋 **Importar contactos** desde CSV o JSON
- ✏️ **Templates personalizables** con variables (`{{nombre}}`, `{{telefono}}`) y preview en vivo
- 📢 **Campañas** con delays configurables entre mensajes y contactos
- 🛡️ **Anti-ban** con warm-up progresivo y delays aleatorios
- ⏰ **Ventana horaria configurable** (hora:minuto)
- 📊 **Dashboard** con estadísticas en tiempo real
- 🔌 **WhatsApp Web** automatizado via Puppeteer
- 📱 QR de autenticación que se abre automáticamente

---

## 🛠️ Stack

| Layer | Tecnología |
|---|---|
| 🖥️ Framework | **Next.js 16** (App Router + Turbopack) |
| ⚛️ UI | **React 19** |
| 🎨 Styling | **Tailwind CSS v4** + Shadcn UI |
| 🗄️ Database | **SQLite** + **Prisma 6** |
| 📱 WhatsApp | **whatsapp-web.js** + Puppeteer |
| ⏱️ Scheduler | **node-cron** |
| 📦 Package | **pnpm** |

---

## 📋 Requisitos

- **Node.js 20+**
- **pnpm** instalado
- **Google Chrome** instalado (para Puppeteer/whatsapp-web.js)

---

## 🚀 Setup

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

> La base de datos es **SQLite local** — no necesitás PostgreSQL ni Docker.

### 3. Crear tablas

```bash
pnpm db:migrate
pnpm db:generate
```

### 4. Configurar AppConfig (warm-up)

Abrí Prisma Studio y creá un registro en `AppConfig`:
```bash
pnpm db:studio
```

Campos:
- `waAccountStartDate` → fecha en que creaste/activaste el número de WhatsApp
- `dailyLimit` → 50 (o el límite que quieras)
- `sendWindowStart` / `sendWindowStartMin` → hora inicio de envío
- `sendWindowEnd` / `sendWindowEndMin` → hora fin de envío

### 5. Correr la app

```bash
# Levanta Next.js + Worker al mismo tiempo
pnpm run dev:all
```

La primera vez que corra el worker, se genera un **QR** (`wa-qr.png`) y se abre automáticamente. Escanealo con WhatsApp desde tu teléfono.

> La sesión se guarda en `./wa-session/` y no volvés a ver el QR salvo que cierres sesión desde el teléfono.

---

## 📁 Estructura

```
wa-outreach/
├── prisma/
│   └── schema.prisma          # 🗄️ Modelo de datos (6 modelos)
├── src/
│   ├── app/                   # 🖥️ Next.js App Router
│   │   ├── page.tsx           #    Dashboard
│   │   ├── contacts/page.tsx  #    Importar y ver contactos
│   │   ├── templates/page.tsx #    Editor de templates con preview
│   │   ├── campaigns/page.tsx #    Crear y controlar campañas
│   │   ├── settings/page.tsx  #    Configuración (horarios, warm-up)
│   │   └── api/               #    Route handlers
│   ├── components/            # 🎨 Componentes UI
│   │   ├── ui/                #    Shadcn UI (base-ui)
│   │   ├── MainNav.tsx
│   │   ├── WaStatusBadge.tsx
│   │   ├── StatsCards.tsx
│   │   ├── LogsTable.tsx
│   │   └── ContactsTable.tsx
│   ├── lib/
│   │   ├── prisma.ts          #    Singleton Prisma
│   │   ├── whatsapp/
│   │   │   ├── client.ts      #    Conexión WhatsApp + QR
│   │   │   ├── sender.ts      #    Envío de mensajes
│   │   │   └── interpolate.ts #    Variables en templates
│   │   └── scheduler/
│   │       ├── index.ts       #    Cron job
│   │       ├── processContact.ts
│   │       └── warmup.ts      #    Límite diario progresivo
│   └── worker/
│       └── index.ts           # ⚙️ Proceso background (WhatsApp + scheduler)
├── package.json
├── next.config.js
├── postcss.config.mjs
└── tsconfig.json
```

---

## 🔄 Flujo de uso

1. **Templates** → Creá tu template con 3 mensajes y variables `{{nombre}}`
2. **Contactos** → Importá un CSV con columnas `phone` y `agencyName`
3. **Campaña** → Seleccioná template y configurá los delays
4. **Scheduler** → Procesa automáticamente dentro de la ventana horaria
5. **Dashboard** → Monitoreá envíos, fallos y actividad en tiempo real

---

## 📄 Formato CSV de contactos

```csv
phone,agencyName
5491112345678,Carpoint
5491198765432,AutoMax
5491187654321,MotorSur
```

---

## 🛡️ Anti-ban

| Protección | Detalle |
|---|---|
| **Warm-up progresivo** | Días 1–3: 10 msgs/día → Días 4–7: 20 → Días 8–14: 35 → Día 15+: configurable |
| **Delay entre mensajes** | 30–45 segundos aleatorios (configurable) |
| **Delay entre contactos** | 3–7 minutos aleatorios (promedio 5 min) |
| **Ventana horaria** | Solo envía en el rango configurable (default 9:00–19:00) |
| **Auto-pausa** | Si hay 5+ errores consecutivos en la última hora |
| **Reintentos** | Hasta 3 intentos por mensaje con backoff de 10 min |

---

## 📜 Scripts disponibles

```bash
pnpm run dev          # Next.js dev server
pnpm run worker       # WhatsApp worker
pnpm run dev:all      # Dev server + worker (recomendado)
pnpm run build        # Build de producción
pnpm run start        # Start de producción
pnpm db:migrate       # Aplicar migraciones
pnpm db:studio        # Abrir Prisma Studio
pnpm db:generate      # Generar Prisma Client
```

---

## ⚙️ Configuración

Todo configurable desde la página **Config** en la UI:

- 📅 **Fecha de inicio de WhatsApp** → para cálculo de warm-up
- 🔢 **Límite diario máximo** → después del día 15
- ⏰ **Ventana de envío** → hora:minuto inicio y fin
- ⏱️ **Delays** → entre mensajes y entre contactos (por campaña)
