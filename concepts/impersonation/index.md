# Impersonation

Impersonation lets an authorized administrator act as another user without knowing that user's password, while preserving the administrator's identity and producing a clean audit trail. The session's effective identity becomes the target, but the original administrator (the *actor*) is recoverable, and every action taken during impersonation is logged with both `account_id` (target) and `actor_account_id` (admin).

This is distinct from `loginAsUserBy()`, which destructively replaces the session and loses the original identity. Use `loginAsUserBy()` for flows like SSO bridge or "create user and auto-login them." Use impersonation for support, debugging, and admin-acting-as-customer workflows.

## Enabling impersonation

Impersonation is off by default. Opt in via `config.impersonation`:

```ts
const authConfig: AuthConfig = {
  db: pool,
  impersonation: {
    enabled: true,
    defaultTtl: "1h",
    maxTtl: "4h",
    canImpersonate: async (actor, target) => {
      // your authorization policy. actor and target are AuthAccount records.
      // return true to allow, false to deny.
      if ((actor.rolemask & AuthRole.SuperAdmin) === AuthRole.SuperAdmin) return true;
      return false;
    },
  },
};
```

eaccess does not know about tenants. If you need cross-tenant rules, look them up inside `canImpersonate` against your own tables.

## Starting and stopping

```ts
app.post("/admin/impersonate/:userId", async (req, res) => {
  try {
    await req.auth.startImpersonation(
      { userId: req.params.userId },
      { reason: req.body.reason, ttl: "30m" },
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/admin/impersonate/stop", async (req, res) => {
  await req.auth.stopImpersonation();
  res.json({ ok: true });
});
```

`ttl` is optional. If omitted, `defaultTtl` from config is used. The effective TTL is always capped by `maxTtl`.

When `expiresAt` passes, the next session resync automatically reverts to the actor and logs an `impersonation_expired` activity entry.

## What the session looks like

While impersonating, every existing getter (`getId`, `getEmail`, `getRoleNames`, `hasRole`, `isAdmin`, etc.) returns the *target's* values. Your application code does not need to special-case impersonation - it simply behaves as the target. The actor is reachable through dedicated getters:

```ts
req.auth.isImpersonating();        // true
req.auth.getId();                  // target account id
req.auth.getEmail();               // target email
req.auth.getActorId();             // admin account id
req.auth.getActorEmail();          // admin email
req.auth.getImpersonationInfo();   // full structured summary
```

## Surfacing impersonation to the client

The most common UI is a banner across the top of every page: "You are viewing this site as Jane Doe. (Stop impersonating)".

Expose `getImpersonationInfo()` on whatever endpoint your frontend already uses to fetch the current user. It returns `null` when not impersonating, and a structured object when active:

```ts
app.get("/me", (req, res) => {
  if (!req.auth.isLoggedIn()) return res.status(401).json({});
  res.json({
    id: req.auth.getId(),
    email: req.auth.getEmail(),
    roles: req.auth.getRoleNames(),
    impersonation: req.auth.getImpersonationInfo(),
  });
});
```

The `impersonation` field shape:

```ts
{
  actor: { accountId, userId, email, rolemask },
  target: { accountId, userId, email, rolemask },
  startedAt: Date,
  expiresAt?: Date,
  reason?: string,
}
```

The client renders the banner whenever this field is present, and posts to your stop endpoint when the user clicks "Stop impersonating."

## Acting on behalf of the target

Because every existing session-scoped method (`changeEmail`, `verifyPassword`, `twoFactor.setup.*`, `twoFactor.disable`, `generateNewBackupCodes`, and so on) reads from the session's effective identity, calling them while impersonating operates on the *target*. This is intentional. The point of impersonation in a support context is to help the user: you can start an email change, enroll TOTP for them, walk them through their backup codes, all from the admin's session.

A few concrete consequences worth knowing:

- `req.auth.changeEmail("new@example.com", callback)` issues a confirmation token for the target's pending new email. The admin can hand that link off to the user, or confirm it directly if the support flow calls for it.
- `req.auth.verifyPassword(plaintext)` verifies against the target's password hash. The admin doesn't know the password, so this is typically only useful when the user types it during a screen-share or support call.
- `req.auth.twoFactor.setup.totp()` enrolls TOTP for the target and returns the QR code. The admin can read the secret out to the user or display the QR.
- `req.auth.twoFactor.disable(mechanism)` disables 2FA on the target. Audit every one of these - they all show up in the activity log with `actor_account_id` set, so it is always recoverable who did what on whose behalf.

If your policy needs to forbid certain on-behalf-of actions, gate them in your route handlers using `req.auth.isImpersonating()`.

The two session-control methods (`logoutEverywhere`, `logoutEverywhereElse`) also act on the effective identity. If an admin calls `logoutEverywhereElse` while impersonating, it terminates the target's other sessions, not the actor's. This is occasionally what you want (force-logout from all devices on behalf of the user); when it isn't, gate it in your handler.

The one exception: `forceLogoutForUserBy(identifier)` always evaluates against the *actor*. If an admin force-logs-out the target while impersonating them, the impersonation session is preserved - the admin continues investigating. Only force-logging-out the actor themselves terminates the impersonation session.

## Session semantics

A few subtleties worth knowing:

- **Session IDs are regenerated on both start and stop.** This prevents session fixation in either direction.
- **Nested impersonation is blocked.** Calling `startImpersonation` while already impersonating throws `AlreadyImpersonatingError`.
- **Self-impersonation is blocked.** An admin cannot impersonate themselves.
- **2FA is not re-prompted on the target.** The actor already passed authentication; that's the whole point.
- **Remember-me is not created or restored for the target.** Any remember token associated with the session belongs to the actor and will only ever restore the actor.
- **Force-logout on the actor terminates the whole session.** This propagates through normal resync.
- **If the target account is deleted mid-session**, the next resync reverts to the actor.
- **If the actor account is deleted mid-session**, the next resync logs out entirely.

## Activity log

The activity log table has two account columns:

- `account_id` - the user the action was performed *as* (the effective identity)
- `actor_account_id` - the original admin when impersonating, otherwise `NULL`

Every existing log call site automatically attaches `actor_account_id` when an impersonation session is active. Three new actions are emitted by the impersonation flow itself:

- `impersonation_started`
- `impersonation_stopped`
- `impersonation_expired`
- `impersonation_rejected` (denied attempts, with `success = false`)

Auditing "everything Jane did while being impersonated" is `SELECT * FROM activity_log WHERE account_id = jane AND actor_account_id IS NOT NULL`. Auditing "everything admin X has done while impersonating" is `WHERE actor_account_id = x`.

## Errors

| Error                          | When                                                        |
| ------------------------------ | ----------------------------------------------------------- |
| `ImpersonationDisabledError`   | `config.impersonation.enabled` is not `true`                |
| `ImpersonationNotAllowedError` | `canImpersonate` returned false, or the target is the actor |
| `AlreadyImpersonatingError`    | Tried to start while already impersonating                  |
| `NotImpersonatingError`        | Called `stopImpersonation` outside an impersonation session |
| `UserNotLoggedInError`         | Called `startImpersonation` without an active session       |
| `UserNotFoundError`            | The target identifier did not match any account             |
