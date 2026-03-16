# OAuth Providers

GitHub, Google, and Azure OAuth providers are built in. Each provider exposes `getAuthUrl()`, `handleCallback()`, and `getUserData()`.

## Configuration

```typescript
const authConfig = {
  db: pool,
  providers: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: "http://localhost:3000/auth/github/callback",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: "http://localhost:3000/auth/google/callback",
    },
    azure: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      tenantId: process.env.AZURE_TENANT_ID!,
      redirectUri: "http://localhost:3000/auth/azure/callback",
    },
  },
};
```

## createUser Hook

Optional. Runs only when a new OAuth user signs in and no matching account exists. Use it to create a record in your own users table and return the ID:

```typescript
const authConfig = {
  db: pool,
  createUser: async (userData) => {
    // userData: { id, email, username?, name?, avatar? }
    const user = await db.insert(users).values({
      name: userData.name,
      email: userData.email,
    }).returning();
    return user.id;
  },
};
```

If you don't provide `createUser`, a UUID is generated automatically.

## Routes

```typescript
app.get("/auth/github", (req, res) => {
  res.redirect(req.auth.providers.github!.getAuthUrl());
});

app.get("/auth/github/callback", async (req, res) => {
  try {
    await req.auth.providers.github!.handleCallback(req);
    res.redirect("/dashboard");
  } catch (error) {
    if (error.message.includes("already have an account")) {
      res.redirect("/login?error=email_taken");
    } else {
      res.redirect("/login?error=oauth_failed");
    }
  }
});
```

`handleCallback` exchanges the OAuth code for an access token, fetches the user profile, links or creates the account, and logs the user in. If the email already exists with a different login method, it throws an error.

The same pattern applies to Google and Azure - just swap `github` for the provider name.

## Provider Data

Provider records are stored in `{prefix}providers` and include the provider name, provider-side user ID, email, username, display name, and avatar URL.
