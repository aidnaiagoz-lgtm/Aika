# AutoMax ERP + CRM + AI

Толық архитектура: [AutoMax — ERP архитектурасы v0.1](https://claude.ai/code/artifact/4f0bec24-c02e-4bcd-99e7-f1857c6eb25f)

Бір Next.js қосымшасы (App Router), бөлек package жоқ — барлық код `src/` ішінде:

- `src/app` — беттер мен route-тар (`departments/sales`, `departments/crm`, ...)
- `src/components`, `src/lib/ui` — reusable компоненттер (Sidebar, Header, Card, StatCard...)
- `src/lib/db.ts` — Prisma client
- `src/lib/session` — auth (парольді хэштеу, сессия)
- `src/lib/rbac.ts` — RBAC engine (resource × action × scope)
- `src/lib/events.ts` — automation event bus
- `src/lib/domain/{sales,crm}` — домендік бизнес-логика (service layer)
- `src/lib/i18n.ts` — қазақша/орысша аудармалар
- `prisma/` — DB schema және seed

## Не дайын

- Auth: email/password (Argon2id), httpOnly session cookie, `src/proxy.ts` арқылы route gate
- RBAC: resource × action × scope (own/department/branch/all)
- Design system: §11 токендер (`src/app/globals.css`, Tailwind v4 `@theme`)
- Sidebar: "Бөлімдер" flyout — 14 бөлім, KK/RU тіл ауыстырғышы
- Dashboard: бекітілген макетке сай, demo data-мен
- **Sales**: лидтер, pipeline (QUALIFIED→OFFER→ORDER→PAID→WON/LOST), жеңілдік approval
- **CRM**: клиент 360° (сегмент, VIP, NPS, көліктер, тарих), reactivation queue
- DB: identity/RBAC, tasks, notifications, audit_logs, sales & CRM кестелері

## Іске қосу

```bash
pnpm install

# Локал Postgres (Docker бар болса):
docker compose up -d
# ЕМЕСЕ Docker-сыз:
npx prisma dev -n automax   # DATABASE_URL-ды шыққан URL-мен .env және .env.local-ға қой
# SEED_DEFAULT_PASSWORD="<өз паролің>" деп .env-ге қос — demo қолданушылардың паролі осыдан алынады

pnpm db:push
pnpm db:seed   # demo CEO: sulejmenovedil@gmail.com / SEED_DEFAULT_PASSWORD мәні

pnpm dev       # http://localhost:3000
```

## Келесі қадам (Phase 1, §37)

Orders → Production → Warehouse → Finance basics — толық архитектура §10-да.

## Интернетке шығару (Vercel + Neon Postgres)

1. https://vercel.com сайтына GitHub аккаунтымен кіріңіз.
2. **Add New → Project** басып, `Aika` репосын таңдаңыз (**Import**).
3. **Deploy** басыңыз. Бірінші deploy базасыз құлауы мүмкін — бұл қалыпты.
4. Жобаның **Storage** бөлімінде **Create Database → Neon (Postgres)** таңдап, жобаға қосыңыз.
   Neon `DATABASE_URL` айнымалысын өзі қосады.
5. **Settings → Environment Variables**-ге `SEED_DEFAULT_PASSWORD` қосыңыз (өз таңдаған пароль — бұл база бос болған кезде CEO/demo қолданушыларға қойылады).
6. **Deployments → соңғы deploy → ⋯ → Redeploy** басыңыз.

Әр deploy кезінде `vercel-build` скрипті автоматты түрде:
- `prisma db push` — кестелерді жасайды/жаңартады;
- `prisma/seed-if-empty.ts` — база бос болса ғана demo деректерді жүктейді (`SEED_DEFAULT_PASSWORD` паролімен);
- `next build` — сайтты жинайды.

Дайын болғанда Vercel `https://<жоба>.vercel.app` сілтемесін береді.
Кіру: `sulejmenovedil@gmail.com` / (Vercel-де қойған `SEED_DEFAULT_PASSWORD` мәні) — **бірінші кіргеннен кейін парольді ауыстырыңыз.**
