# Admin UI

The admin panel is a Vue 3 SPA that mounts inside your Express app. It provides user management, role editing, MFA status, and activity logs.

## Install and Mount

```bash
npm install @eaccess/admin
```

```typescript
import { createAdminUI } from "@eaccess/admin";

app.use(createAuthMiddleware(authConfig));
app.use("/admin", createAdminUI(authConfig));
```

The admin UI uses the same `authConfig` as your middleware. If you define custom roles with `defineRoles`, the admin UI picks them up automatically via the `/admin/api/roles` endpoint.

## Access Control

The admin panel requires the user to be logged in and have the `Admin` role (bitmask value `1`). All API routes are protected by the `requireAdmin` middleware. If you're using custom roles, make sure the first role in your `defineRoles` call is your admin role, since `isAdmin()` checks for bitmask value `1`.

## Features

- **User list** with pagination, search, and filters (roles, MFA status, account status, OAuth providers)
- **User detail** with credentials, MFA methods, role management, and moderation actions
- **Activity log** with time, event type, browser, and OS filters
- **Overview dashboard** with user stats, role distribution, and MFA adoption

## API Endpoints

The admin panel exposes these API routes under `/admin/api/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/roles` | GET | Returns configured roles |
| `/users` | GET | Paginated user list with filters |
| `/users/search` | GET | Search users by email, user_id, or account ID |
| `/users/:id` | GET | User detail with tokens and MFA methods |
| `/users` | POST | Create a new user |
| `/users/:id` | DELETE | Delete user and all associated data |
| `/users/:id/status` | PATCH | Update account status |
| `/users/:id/roles` | PATCH | Update role bitmask |
| `/users/:id/password` | PATCH | Change password |
| `/users/:id/logout` | POST | Force logout |
| `/users/:id/mfa-methods/*` | Various | MFA management |
| `/activity` | GET | Paginated activity logs |
| `/overview-stats` | GET | Dashboard statistics |

## Local Development

The admin package includes a dev server that seeds demo data:

```bash
make server   # starts postgres + backend with 500+ fake users
make client   # starts the Vite dev server
```

Open `http://localhost:5173/admin/` and log in with `admin@demo.com` / `Admin123!Demo`.
