# Tasks: Responsive Header UX

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~55 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All 6 files — responsive breakpoints | Single PR | ~55 lines, pure CSS, zero JS |

## Phase 1: Navigation (R1, R2, R3, R4)

- [x] 1.1 `src/components/MainNav.tsx` — Add Lucide icons (`Home`, `Users`, `MessageSquare`, `Megaphone`, `Settings`), `ICON_MAP` const, render icon before each label, labels `hidden sm:inline`, nav container `overflow-x-auto`. (~15 lines) **[R1, R3, R4]**
- [x] 1.2 `src/app/layout.tsx` — Brand collapse: `|` separator and "Outreach" `hidden md:inline`; header container `overflow-x-auto`. (~5 lines) **[R2, R3, R4]**

## Phase 2: Dashboard (R5)

- [x] 2.1 `src/components/StatsCards.tsx` — Add Lucide icons (`Send`, `AlertCircle`, `Clock`), dual layout: `<sm` = `flex flex-col gap-3` with cards as `flex items-center gap-3`, `≥sm` = `grid grid-cols-3`. (~20 lines) **[R5]**

## Phase 3: Forms (R6, R7)

- [x] 3.1 `src/app/campaigns/page.tsx` — Template/Account grid `grid-cols-1 sm:grid-cols-2`; Order/Delay grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. (~5 lines) **[R6]**
- [x] 3.2 `src/app/settings/page.tsx` — Send-window grid `grid-cols-1 sm:grid-cols-2`; time inputs stack vertically below sm. (~8 lines) **[R7]**

## Phase 4: Edge Cases (R8)

- [x] 4.1 `src/app/contacts/page.tsx` — Verify selects have `sm:w-64` (already present); add `max-w-xs` constraint on mobile select triggers for extreme narrow overflow guard at 280-320px. (~3 lines) **[R8]**
