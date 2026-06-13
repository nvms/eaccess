# Standalone Auth

For operations outside of Express routes - scripts, workers, cron jobs, WebSocket servers - eaccess provides two tools.

## createAuthContext

Creates a context object with all admin/standalone functions, bound to your auth config. No `req`/`res` needed.

```typescript
import { createAuthContext } from "@eaccess/auth";

const auth = createAuthContext(authConfig);

const account = await auth.createUser({ email: "user@example.com", password: "password123" });
await auth.addRoleForUserBy({ email: "user@example.com" }, Roles.editor);
await auth.setStatusForUserBy({ accountId: account.id }, AuthStatus.Banned);
await auth.deleteUserBy({ email: "user@example.com" });
```

Available methods:

- `createUser`, `register`
- `deleteUserBy`, `forceLogoutForUserBy`
- `addRoleForUserBy`, `removeRoleForUserBy`, `hasRoleForUserBy`
- `changePasswordForUserBy`, `setStatusForUserBy`
- `resetPassword`, `confirmResetPassword`, `initiatePasswordResetForUserBy`
- `userExistsByEmail`

## authenticateRequest

For WebSocket upgrades or raw HTTP authentication outside of Express middleware. Takes an `IncomingMessage` and checks session data or remember-me cookies.

```typescript
import { authenticateRequest } from "@eaccess/auth";

const result = await authenticateRequest(authConfig, req, sessionMiddleware);
```

Returns `{ account, source }` where:

- `account` is the `AuthAccount` or `null`
- `source` is `"session"`, `"remember"`, or `null`

Checks session first, then falls back to the remember-me cookie. Validates that the account exists and has `Normal` status.

```typescript
wss.on("connection", async (ws, req) => {
  const { account } = await authenticateRequest(authConfig, req, sessionMiddleware);
  if (!account) {
    ws.close(4001, "unauthorized");
    return;
  }
  // authenticated - account.id, account.email, etc.
});
```
