# Saudi Authentic Product

A full-stack e-commerce platform for premium Saudi & Madinah dates and
heritage products, delivered across Bangladesh — plus internal Admin,
Co-Admin, Super Admin, and Employee portals for running the business.

```
Saudi-Authentic-Product/
├── backend/     Express 5 + TypeScript + Mongoose REST API
├── frontend/    Next.js 16 (App Router) + React 19 + TypeScript
├── .gitignore   Shared by both apps
├── README.md    You are here
└── CLAUDE.md    Architecture, conventions & rules for AI coding agents
```

For a deeper architectural map (layering conventions, auth flow, data
mapping, known framework gotchas) see **[CLAUDE.md](./CLAUDE.md)**.

## Tech stack

**Backend** — Express 5, TypeScript, MongoDB/Mongoose, Zod validation, JWT
(httpOnly cookies), Cloudinary (image uploads), Nodemailer (SMTP), Jest.

**Frontend** — Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4,
lucide-react icons, self-hosted fonts (EB Garamond + Plus Jakarta Sans).

## Features

- Customer storefront: products, categories, cart, wishlist, checkout,
  order history, reviews — all backed by the live API and Cloudinary imagery.
- Secure authentication (JWT via httpOnly cookies), role-based access control
  across five roles: `customer`, `employee`, `co_admin`, `admin`, `super_admin`.
- **Admin / Co-Admin / Super Admin portal**: dashboard, products, categories,
  orders, customers, reviews, employees, attendance, leave, tasks,
  performance, salary & payments, inventory, reports.
- **Employee portal**: check-in/out, tasks, leave requests, performance
  history, salary/payment history.
- SMTP email notifications: order confirmations, staff welcome, leave
  status, task assignment, password reset, and monthly salary/payment
  notices.

## Getting started

Requires Node.js 20+ and a MongoDB connection string.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in MongoDB, JWT secrets, Cloudinary, SMTP
npm run seed            # creates a super admin + sample staff, categories, products
npm run dev              # http://localhost:5000 (API at /api/v1)
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env    # NEXT_PUBLIC_API_URL (defaults to http://localhost:5000/api/v1)
npm run dev              # http://localhost:3000
```

Seeded login (see `backend/src/seed/seed.ts` for the full list): a super
admin from your `.env`, plus sample `admin`, `co_admin`, and two `employee`
accounts, all with password `Employee123!`.

## Scripts

Run from inside `backend/` or `frontend/` respectively:

| Script            | Backend | Frontend |
| ----------------- | ------- | -------- |
| `npm run dev`      | ✅ tsx watch | ✅ Next dev server |
| `npm run build`    | ✅ tsc → `dist/` | ✅ production build |
| `npm run start`    | ✅ run built `dist/` | ✅ run production build |
| `npm run typecheck`| ✅ `tsc --noEmit` | ✅ `tsc --noEmit` |
| `npm run lint`     | ✅ ESLint | ✅ ESLint |
| `npm test`         | ✅ Jest | — |
| `npm run seed`     | ✅ bootstrap DB | — |

## Environment variables

Each app documents its own variables in `backend/.env.example` and
`frontend/.env.example` — copy them to `.env` and fill in real values.
Never commit `.env` files; the root `.gitignore` already excludes them.

## Notes

- `frontend/AGENTS.md` is managed by the Next.js CLI itself (rewritten by
  `next dev` when it detects an AI coding agent) — it flags that this Next.js
  major version may differ from an agent's training data. Leave it in place;
  its presence is also what stops Next.js from re-creating a duplicate
  `frontend/CLAUDE.md`, since this project keeps a single `CLAUDE.md` at the
  repo root.
