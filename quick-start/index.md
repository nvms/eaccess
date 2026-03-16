# Quick Start

## Install

```bash
npm install @eaccess/auth express-session pg
```

## Minimal Setup

```typescript
import express from "express";
import session from "express-session";
import { Pool } from "pg";
import { createAuthMiddleware, createAuthTables } from "@eaccess/auth";

const app = express();
const pool = new Pool({ connectionString: "postgres://user:pass@localhost:5432/db" });

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
}));

const authConfig = { db: pool, tablePrefix: "auth_" };
await createAuthTables(authConfig);
app.use(createAuthMiddleware(authConfig));

app.post("/register", async (req, res) => {
  const account = await req.auth.register(req.body.email, req.body.password);
  res.json({ account });
});

app.post("/login", async (req, res) => {
  await req.auth.login(req.body.email, req.body.password, req.body.remember);
  res.json({ ok: true });
});

app.listen(3000);
```

## Add the Admin UI

```bash
npm install @eaccess/admin
```

```typescript
import { createAdminUI } from "@eaccess/admin";

app.use(createAuthMiddleware(authConfig));
app.use("/admin", createAdminUI(authConfig));
```

The admin panel is served from your Express app. It reads your auth config, so custom roles and all user data show up automatically.

## Custom Roles

```typescript
import { defineRoles } from "@eaccess/auth";

const Roles = defineRoles("admin", "owner", "editor", "viewer");

const authConfig = {
  db: pool,
  tablePrefix: "auth_",
  roles: Roles,
};
```

`defineRoles` assigns sequential powers of 2. The admin UI and `getRoleNames()` use whatever you define here. If you don't set `roles`, the built-in `AuthRole` enum (21 predefined roles) is used.
