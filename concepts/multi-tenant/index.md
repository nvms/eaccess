# Multi-Tenant Mapping

The `user_id` column on `{prefix}accounts` links an auth account to your own user record without forcing you into a new user table.

## Why

- You already have a users or tenants table
- You want auth accounts to reference your existing IDs
- You don't want to migrate to a different schema

## How

Pass your user ID as the third argument to `register`:

```typescript
const user = await db.insert(users).values({ email, tenant_id }).returning();
const account = await req.auth.register(email, password, user.id);
```

If you omit the user ID, a UUID is generated automatically:

```typescript
const account = await req.auth.register(email, password);
// account.user_id is a UUID like "550e8400-e29b-41d4-a716-446655440000"
```

## With OAuth

The `createUser` hook in `AuthConfig` runs when a new OAuth user signs in and no matching account exists. Create your user record and return the ID:

```typescript
const authConfig = {
  db: pool,
  createUser: async (userData) => {
    const user = await db.insert(users).values({
      email: userData.email,
      name: userData.name,
      tenant_id: defaultTenantId,
    }).returning();
    return user.id;
  },
};
```

The returned ID is stored as `user_id` on the auth account. If you don't provide `createUser`, a UUID is generated.

## Example: Tenant-Scoped Users

```sql
-- your schema
CREATE TABLE tenants (id uuid PRIMARY KEY, name text);
CREATE TABLE users (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants(id), email text UNIQUE);
```

```typescript
app.post("/register", async (req, res) => {
  const user = await db.insert(users).values({
    email: req.body.email,
    tenant_id: req.body.tenantId,
  }).returning();

  const account = await req.auth.register(req.body.email, req.body.password, user.id);
  res.json({ account });
});
```

Auth handles sessions, roles, and MFA. Your application handles tenant scoping, permissions, and business logic. The `user_id` is the bridge between the two.
