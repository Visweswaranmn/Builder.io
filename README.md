# BUILDER.IO — Construction Project Management System

**🔗 Live app: https://cpms-client-production.up.railway.app**

A full-stack management system for construction companies: projects, employees,
tasks, materials, vendors, daily site reports, finance, invoicing, and analytics.

Built as a monorepo with a **React** frontend and an **Express + MongoDB** backend,
deployed on [Railway](https://railway.app).

## Tech stack

| Layer      | Technologies                                                       |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | React 18, Vite, TypeScript, Tailwind CSS, React Router, Axios     |
| Backend    | Node.js, Express, TypeScript, MongoDB (Mongoose)                   |
| Auth       | JWT (access + refresh), role-based access control _(Phase 3)_     |
| Media      | Cloudinary + Multer _(Phase 10)_                                   |
| Charts     | Recharts _(Phase 4)_                                              |
| DevOps     | Docker, GitHub, Render/Railway (API), Vercel (web), MongoDB Atlas |

## Repository layout

```
Builder.io/
├── client/          # React + Vite frontend
│   └── src/
│       ├── components/   # Shared UI (Layout, ...)
│       ├── config/       # Client env access
│       ├── lib/          # Axios instance & helpers
│       └── pages/        # Route-level screens
├── server/          # Express + TypeScript API
│   └── src/
│       ├── config/       # env + db connection
│       ├── middleware/   # errorHandler, notFound, ...
│       ├── routes/       # API routers (mounted at /api/v1)
│       └── utils/        # ApiError, asyncHandler, logger
└── package.json     # npm workspaces + dev scripts
```

## Prerequisites

- Node.js **>= 20**
- A MongoDB instance (local `mongod`, Docker, or MongoDB Atlas)

## Getting started

```bash
# 1. Install all workspace dependencies from the repo root
npm install

# 2. Create env files from the examples
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Set MONGO_URI in server/.env (defaults to mongodb://127.0.0.1:27017/cpms)

# 4. Run both apps together (client on :5173, server on :5000)
npm run dev
```

Then open http://localhost:5173 — the home page performs a live health check
against the API and shows the database connection status.

### Useful scripts (from repo root)

| Command              | Description                                     |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Run client + server concurrently                |
| `npm run dev:client` | Frontend only                                   |
| `npm run dev:server` | Backend only                                    |
| `npm run build`      | Production build of both                        |
| `npm run start`      | Start the built server                          |

## API

Base URL: `http://localhost:5000/api/v1`

| Method | Endpoint  | Description                       |
| ------ | --------- | --------------------------------- |
| GET    | `/`       | API info                          |
| GET    | `/health` | Liveness + DB connection status   |

## Build roadmap

Phase 1 (setup) is complete. Remaining phases: database models, auth & RBAC,
dashboard, and the feature modules (projects, employees, tasks, materials,
vendors, daily reports, finance, invoicing, notifications, reports), followed by
deployment. See the project plan for details.
