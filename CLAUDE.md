@AGENTS.md

# AutoMax ERP — Claude үшін нұсқаулық

Бұл жобада **екі адам** өз Claude-ы арқылы кезектесіп жұмыс істейді. Чаттар ортақ емес —
ортақ "ми" тек осы репо. Сондықтан төмендегі ережелер **міндетті**.

## Сессия басында (әрқашан, сұратпай-ақ)

1. `git fetch origin main` → соңғы `main`-нан жаңа бранч аш.
2. [`docs/PROGRESS.md`](docs/PROGRESS.md) оқы — әсіресе ең жоғарғы жазбаны (соңғы жұмыс).
3. **Ашық PR-ларды тексер** (`aidnaiagoz-lgtm/Aika`, state=open). Merge болмаған жұмыс `main`-дағы
   журналда көрінбейді — ол PR ішіндегі `docs/PROGRESS.md`-да тұрады. Әр ашық PR үшін: кім, не жасады,
   Vercel Preview/тексерулер өтті ме — соны қысқаша айт және "merge жасайын ба?" деп сұра.
4. Қолданушыға қысқаша айт: "Соңғы жұмыс: … (кім, қашан). Ашық PR: … Келесі қадам: …".

## Сессия соңында (жұмыс аяқталғанда, сұратпай-ақ)

1. `docs/PROGRESS.md` **ең жоғарғы** жағына жаңа жазба қос (үлгі сол файлда).
2. Коммит → push → PR → `main`-ға merge (қолданушы рұқсат берсе).
   Жұмысты ашық PR күйінде қалдырма — merge жасалмаса, келесі адам оны көрмей қалуы мүмкін.
   `main`-ға түскен код https://automax-erp.vercel.app сайтына автоматты шығады.

## Жоба туралы

- **Стек:** Next.js 16 (App Router, Turbopack), React 19, Prisma 6 + PostgreSQL, Tailwind v4, Recharts.
- **Тіл:** интерфейс қазақша/орысша (`src/lib/i18n.ts`). Қолданушымен қазақша сөйлес.
- **Құрылым:**
  - `src/app/(app)/...` — беттер; `src/app/(auth)` — логин
  - `src/lib/domain/<бөлім>` — бизнес-логика (service layer)
  - `src/lib/rbac.ts` — рұқсаттар (resource × action × scope)
  - `src/lib/ui` — ортақ компоненттер (Sidebar, Card, StatCard, ComingSoon…)
  - `prisma/schema.prisma` — DB схемасы; `prisma/seed.ts` — demo деректер
- **Дайын бөлімдер:** Dashboard, Orders, Sales (+ Алматы ledger), CRM, Warehouse, Production, Finance, Training, Org-structure.
- **Әлі бос (`ComingSoon`):** HR, Accounting, Logistics, Marketing, Content, Procurement, IT, Knowledge-base, Branches.

## Deploy

- Vercel жобасы: `automax-erp` → https://automax-erp.vercel.app
- База: Prisma Postgres (`DATABASE_URL` Vercel-де, кодта жоқ).
- `vercel-build` скрипті: `prisma db push` → `prisma/seed-if-empty.ts` → `next build`.
- ⚠️ **База ортақ және нақты.** `schema.prisma` өзгерісі прод базаға бірден әсер етеді.
  Кесте/баған **өшіретін** өзгерістер жасама; жасау керек болса — алдымен қолданушыдан сұра
  және PROGRESS-ке жаз.

## Жергілікті іске қосу

```bash
pnpm install
docker compose up -d        # немесе өз Postgres-ің; DATABASE_URL → .env
pnpm db:push && pnpm db:seed
pnpm dev                    # http://localhost:3000
```

Demo кіру: `sulejmenovedil@gmail.com` / `Automax2026!`

## Екі адам — ережелер

- `main`-ға тікелей жазба — тек бранч → PR → merge.
- Бір уақытта бір бөлімді екеуі өзгертпеу керек — PROGRESS-тегі "Қазір кім не істеп жатыр" бөлімін тексер.
- `.env` файлдарын ешқашан коммит жасама.
