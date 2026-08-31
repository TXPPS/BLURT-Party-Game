# BLURT — deployment

Pushing to `claude/blurt-party-game-mvp-vmeqo7` publishes the game. There is nothing
to run by hand.

```
push ──▶ install ──▶ pnpm verify ──▶ pnpm build ──▶ wrangler deploy ──▶ smoke check
                          │                                                  │
                     red stops here                              red means it uploaded
                   (nothing is uploaded)                          but does not work
```

---

## The URL

```
https://blurt.<your-workers.dev-subdomain>.workers.dev
```

The worker is named `blurt` in `server/wrangler.toml`, and that name is what fixes the
URL — **it must not change between deploys**, or the address everybody has bookmarked
stops working and a second, orphaned worker appears alongside the first.

The subdomain half is a property of your Cloudflare account, set once, the same for
every worker you own. This repository cannot read it (see below), so the exact URL is
printed into the **workflow run's job summary** on every deploy: open the run in the
Actions tab and it is the first thing on the page. It is also on the Cloudflare
dashboard under **Workers & Pages → blurt**.

---

## The two secrets

Both live in **Settings → Secrets and variables → Actions** on this repository.

| Secret | Where it comes from |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token. The **Edit Cloudflare Workers** template covers it. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Overview, in the right-hand sidebar. Also the hex string in the dashboard URL. |

**Permissions the token needs.** The *Edit Cloudflare Workers* template is enough to
deploy. If you built the token by hand, it needs at least `Account → Workers Scripts →
Edit`. Adding `Workers Scripts → Read` is worth it: the workflow falls back to asking
the API for your workers.dev subdomain when the deploy action does not report a URL,
and without read access that lookup fails and takes the smoke check with it.

The token is a credential for your whole Workers account. It is never printed by the
workflow, and GitHub masks it in logs — but if it leaks, revoke it in the same place
you created it and add the new one here.

---

## Triggering a deploy by hand

Actions → **deploy** → *Run workflow* → pick the branch → *Run workflow*.

Useful when a deploy failed for a reason outside the code (an expired token, a
Cloudflare incident) and you want to retry without an empty commit.

---

## Rolling back

`wrangler rollback` repoints the live worker at a previous version. It does **not**
revert your code — the next push will deploy whatever is on the branch again, so treat
a rollback as a way to stop the bleeding while you fix the commit.

```bash
# What versions exist, newest first
npx wrangler versions list --config server/wrangler.toml

# Back to the previous version
npx wrangler rollback --config server/wrangler.toml

# Or to a specific one
npx wrangler rollback <version-id> --config server/wrangler.toml
```

You will need `wrangler login` (or the same API token in `CLOUDFLARE_API_TOKEN`) on the
machine you run it from.

**A rollback will not undo a Durable Object migration.** Migrations are one-way. In
practice this does not bite you here — the only migration is the one that creates
`RoomDO` — but it is the reason to be careful about ever adding a `renamed_classes` or
`deleted_classes` entry.

---

## Watching the live worker

```bash
npx wrangler tail --config server/wrangler.toml --format pretty --search '[blurt]'
```

That filters to the pacing log, which writes one line per phase entry and exit with no
player content in it. See README → Observability for what the fields mean.

Drop the `--search` to see everything, including errors:

```bash
npx wrangler tail --config server/wrangler.toml --format pretty --status error
```

---

## What the smoke check proves

A green tick on **deploy** alone would only mean "the upload finished". The separate
**smoke** job is what makes green mean *live*:

- `GET /` returns 200 and the HTML contains the app root, so the assets binding is
  serving the built client and not a 404 page.
- `POST /api/rooms` returns a four-letter room code. This is the more interesting one:
  allocating a code goes through the Durable Object, so it fails if the `ROOMS` binding
  or the migration is wrong — exactly the things a dry run cannot check.

It retries the first request a few times, because a fresh deploy takes a moment to
propagate. Every attempt asserts in full; it never lowers the bar to get to green.

---

## If the first deploy fails

The migration in `server/wrangler.toml` creates the Durable Object class on a fresh
account:

```toml
[[migrations]]
tag = "v1"
new_sqlite_classes = ["RoomDO"]
```

That is the correct declaration, `RoomDO` is exported from `server/src/worker.ts`, and
the `ROOMS` binding points at it — so the first deploy is expected to succeed. The
realistic failure modes are all account-level rather than code:

| Symptom | Cause |
|---|---|
| `Authentication error [10000]` | Token is wrong, expired, or lacks Workers Scripts:Edit |
| `workers.dev subdomain not registered` | The account has never had one; register it once in the dashboard under Workers & Pages |
| `Durable Objects require a paid plan` | SQLite-backed Durable Objects are on the free plan, but an account with an unusual entitlement can still refuse |
| A worker named `blurt` already exists | Something else claimed the name; rename in `server/wrangler.toml`, and note the URL changes with it |

If it does fail, the error is in the **Deploy** step of the workflow run, verbatim from
wrangler.
