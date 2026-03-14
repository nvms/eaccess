# Registration & Confirmation

Accounts live in `{prefix}accounts`. Registration can auto-verify or require email confirmation.

## Register

```typescript
app.post("/register", async (req, res) => {
  const account = await req.auth.register(req.body.email, req.body.password);
  res.json({ account });
});
```

- Validates email format and password length (configurable min/max)
- `user_id` is optional; if omitted, a UUID is generated automatically
- Throws `EmailTakenError` if the email already exists
- Throws `InvalidEmailError` or `InvalidPasswordError` on validation failure

## With Email Confirmation

Pass a callback as the fourth argument. The account is created unverified, and the callback receives a confirmation token.

```typescript
app.post("/register", async (req, res) => {
  const account = await req.auth.register(
    req.body.email,
    req.body.password,
    undefined,
    (token) => sendEmail(req.body.email, `/confirm/${token}`),
  );
  res.json({ pending: true });
});

app.get("/confirm/:token", async (req, res) => {
  await req.auth.confirmEmail(req.params.token);
  res.redirect("/login?confirmed=1");
});
```

Confirmations are stored in `{prefix}confirmations` with a 7-day expiry. The account cannot log in until confirmed.

## Confirm and Auto-Login

```typescript
await req.auth.confirmEmailAndLogin(token, remember);
```

Confirms the email and logs the user in immediately. Useful for "click to verify" flows.

## Email Change

Logged-in users can request an email change. It follows the same confirmation pattern:

```typescript
app.post("/change-email", async (req, res) => {
  await req.auth.changeEmail(req.body.newEmail, (token) => {
    sendEmail(req.body.newEmail, `/confirm/${token}`);
  });
  res.json({ pending: true });
});
```

The new email is applied when the confirmation token is used. Throws `EmailTakenError` if the new email is already registered.
