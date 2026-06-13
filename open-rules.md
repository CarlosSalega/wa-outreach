# Protocolo de Orquestación y Ejecución de Agentes (SDD)

Este repositorio utiliza una arquitectura de dos roles donde las fases se dividen estrictamente entre un Orquestador (planificación y diseño) y un Ejecutor (implementación y verificación). Todo el desarrollo se rige bajo las siguientes directrices de traspaso:

## 1. Directrices para el Orquestador

_Aplica en fases: gentle-orchestrator, sdd-init, sdd-explore, sdd-propose, sdd-spec, sdd-design, sdd-tasks._

- **Especificación Atómica**: No agrupes múltiples cambios en una sola tarea. Diseña un plan donde cada tarea afecte idealmente a un único archivo o componente.
- **Rutas Explícitas**: Cada instrucción o tarea generada DEBE incluir la ruta exacta al archivo desde la raíz (ej. `src/app/api/accounts/route.ts`, `prisma/schema.prisma`).
- **Definición de Contratos**: Si diseñas un endpoint o componente, define detalladamente los tipos de TypeScript necesarios, payloads esperados y respuestas HTTP. No asumas que el ejecutor adivinará la lógica de negocio.
- **Estrategia de Datos**: Si un cambio altera la base de datos, instruye explícitamente la modificación en `prisma/schema.prisma` y la posterior ejecución de la migración correspondiente.

## 2. Directrices para el Agente Ejecutor

_Aplica en fases: sdd-apply, sdd-verify, jd-fix-agent._

- **Fidelidad al Plano**: Tu rol es puramente técnico y de implementación sintáctica. Ejecuta el plan de OpenSpec tarea por tarea al pie de la letra. No inventes funcionalidades ni lógica de negocio que no estén explícitas.
- **Validación Inmediata (Tool-Calling)**: Tras crear o modificar cualquier archivo, estás obligado a utilizar de inmediato las herramientas de la terminal para validar tu código:
  - Para errores de compilación/tipado: ejecuta comandos de chequeo sintáctico de TypeScript (`pnpm tsc` o equivalente).
  - Para validación lógica: corre de inmediato el suite de pruebas afectado usando Vitest (`pnpm vitest run src/__tests__/...`).
- **Bucle de Corrección (Judgment Day)**: Si la prueba falla en la fase de verificación, analiza exhaustivamente el stack trace del error técnico y corrige únicamente la porción sintáctica afectada hasta que el test devuelva un estado exitoso (pass).

## 3. Contexto Tecnológico del Repositorio

- **Framework**: Next.js (App Router, API Routes en `src/app/api`).
- **Base de Datos**: Prisma ORM (`prisma/schema.prisma`).
- **Testing**: Vitest (`src/__tests__` y `src/lib/scheduler/__tests__`).
- **Gestor de Paquetes**: pnpm.
