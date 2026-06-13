# Roles

Roles use a bitmask stored in the `rolemask` column on `{prefix}accounts`.

## Custom Roles

Define your own roles with `defineRoles`. It assigns sequential powers of 2 and returns a frozen object.

```typescript
import { defineRoles } from "@eaccess/auth";

const Roles = defineRoles("admin", "owner", "editor", "viewer", "billing");
// { admin: 1, owner: 2, editor: 4, viewer: 8, billing: 16 }
```

Pass it into your auth config:

```typescript
const authConfig = {
  db: pool,
  roles: Roles,
};
```

This does two things:

- `getRoleNames()` returns your custom names instead of the built-in defaults
- The admin UI reads roles from the backend, so your custom roles show up automatically

Names are preserved exactly as provided - no transformation. Maximum 31 roles (PostgreSQL `INTEGER` is 32-bit signed). The order matters: don't reorder or remove roles from the middle, or existing users' rolemasks will map to the wrong names.

## Built-in Roles

If you don't set `config.roles`, the built-in `AuthRole` enum is used. It has 21 predefined roles (Admin, Author, Collaborator, etc.).

```typescript
import { AuthRole } from "@eaccess/auth";

await req.auth.addRoleForUserBy({ email: "user@example.com" }, AuthRole.Admin | AuthRole.Editor);
```

## Assign and Check

```typescript
await req.auth.addRoleForUserBy({ email: "user@example.com" }, Roles.editor);
await req.auth.removeRoleForUserBy({ email: "user@example.com" }, Roles.editor);

const canEdit = await req.auth.hasRole(Roles.editor);
const isAdmin = await req.auth.isAdmin();
const names = req.auth.getRoleNames();
```

## Standalone Role Functions

For use outside of Express routes:

```typescript
import { addRoleToUser, removeRoleFromUser, setUserRoles, getUserRoles } from "@eaccess/auth";

await addRoleToUser(authConfig, { email: "user@example.com" }, Roles.editor);
await removeRoleFromUser(authConfig, { email: "user@example.com" }, Roles.editor);
await setUserRoles(authConfig, { email: "user@example.com" }, Roles.admin | Roles.owner);
const mask = await getUserRoles(authConfig, { email: "user@example.com" });
```

## Why Bitmasks

- Single integer column, no join tables
- Fast bitwise checks
- Easy to combine: `Roles.admin | Roles.editor` gives a user both roles
- Easy to check: `(rolemask & Roles.admin) === Roles.admin`
