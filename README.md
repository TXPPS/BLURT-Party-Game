# BLURT

> **You said it. We decide what it meant.**

A browser-based multiplayer party game for 2–10 people, one device each. Everyone
answers a disguised question. Nobody is told what the game is going to do with their
answer. Behind the scenes a pre-authored story is quietly assembling itself out of
the things people said in a completely different context, and every couple of rounds
it reads itself back to the room.

Then everybody draws something terrible and lies about it.

No accounts. No install. No database. Share four letters and play.

---

## Contents

- [Quick start](#quick-start)
- [How it plays](#how-it-plays)
- [Architecture, and why Durable Objects](#architecture-and-why-durable-objects)
- [Project structure](#project-structure)
- [Local development](#local-development)
- [Deployment](#deployment)
- [The multiplayer model](#the-multiplayer-model)
- [Testing](#testing)
- [Performance](#performance)
- [Accessibility](#accessibility)
- [Security](#security)
- [Known limitations](#known-limitations)
- [Future](#future)

---

## Quick start

```bash
pnpm install
pnpm dev          # worker on :8787, client on :5173
```

Open <http://localhost:5173>, hit **START A ROOM**, and send the four-letter code to
everyone else. That is the whole onboarding.

Requires **Node ≥ 20**. `pnpm` is the package manager of record; `npm` works too.

---

## How it plays

1. **Lobby.** One person starts a room and reads out a four-letter code. Everyone
   joins, picks a name (or hammers **NAME ME** until something unforgivable appears)
   and a face.
2. **Rounds.** Two or three players get the same disguised prompt privately —
   *"What sound does regret make?"* Everyone else waits, then votes on the answers
   anonymously.
3. **The story.** The winning answer is written into a hidden story. Every two rounds
   the room sees how far it has got. The story's **title is withheld** until then —
   it is the punchline, and putting it on the setup screen would give the whole game
   away.
4. **The final story.** The whole thing, read out line by line.
5. **The drawing finale.** Prompts are pulled out of the story the room just built,
   so somebody is always drawing something one of *them* wrote. Everyone else writes
   a fake prompt; then the room votes on which was real.
6. **Results.** Leaderboard, awards derived from real tracked stats, and a highlight
   reel. Then PLAY AGAIN, with a story they have not heard.

Full design notes, scoring tables and matchmaking rules: **[GAME_DESIGN.md](GAME_DESIGN.md)**
Writing stories, prompts, names, avatars and sounds: **[CONTENT_GUIDE.md](CONTENT_GUIDE.md)**
How this was built, and what broke on the way: **[BUILD_LOG.md](BUILD_LOG.md)**

---

## Architecture, and why Durable Objects

```
  phones / laptops                Cloudflare edge
 ┌───────────────┐          ┌──────────────────────────────┐
 │  React client │──── WS ─▶│  Worker (stateless router)   │
 │  renders only │          │    ├── POST /api/rooms       │
 └───────────────┘          │    └── GET  /ws?code=BEEF    │
                            │              │                │
                            │              ▼                │
                            │   ┌────────────────────────┐  │
                            │   │  RoomDO  "room:BEEF"   │  │
                            │   │  • all game state      │  │
                            │   │  • all authority       │  │
                            │   │  • WebSocket fan-out   │  │
                            │   │  • alarm timers        │  │
                            │   └────────────────────────┘  │
                            └──────────────────────────────┘
```

**One room maps to exactly one Durable Object instance**, addressed by deriving the
object id from the room code. That single decision buys, for free, most of what a
realtime multiplayer game normally has to engineer:

- **Single-threaded authoritative state.** A Durable Object handles its messages
  serially. "Two people voted at the same time" is not a race this code has to think
  about — it is two sequential calls into the same object. There is no lock, no
  transaction, and no optimistic-concurrency retry anywhere in the codebase.
- **Per-room isolation, at no cost.** A room that misbehaves cannot affect another.
  There is no shared table to contend on and no noisy-neighbour problem.
- **Fan-out inside the object.** The sockets live in the same place as the state, so
  a broadcast is a loop, not a pub/sub hop.
- **Timers without cron.** Every deadline in the game — phase timers, the 90-second
  disconnect grace, the 60-second host-migration countdown, idle expiry, the 4-hour
  room lifetime — is a Durable Object alarm. There is no scheduler to run, no job
  queue, and nothing to clean up: rooms self-destruct on expiry.
- **No database.** Room state lives in the object for the life of the session. This
  is deliberate and sufficient: a party game has nothing to remember once everybody
  has gone home.
- **Edge-local latency and effectively zero hosting cost** at this scale, with a
  one-command deploy.

The alternative — a stateful Node process — needs sticky sessions or a shared store
the moment you want a second instance. Durable Objects make room authority the
default rather than an add-on.

**WebSocket hibernation** is used, which means the object may be evicted while
sockets stay open. Everything authoritative is therefore persisted to storage on
every mutation, and the socket→player mapping rides along in each socket's
attachment. A room survives eviction mid-match without the players noticing. Drawings
are the one exception to "state is one JSON blob": they exceed the 128 KiB
per-value storage limit, so they are chunked into their own keys.

---

## Project structure

```
/shared      pure logic imported by BOTH client and server
             protocol · views · types (typed FSM) · constants · scoring
             matchmaking · storyEngine · nameGenerator · sanitize
             blocklist · roomCode · awards · rng · sfx
/content     stories, name pools, and the zod schema that validates them
/server      wrangler.toml · worker.ts (routing) · RoomDO.ts (the room)
             dispatch.ts · handlers.ts · validate.ts · phases/*
/web         React client: screens, components, avatars, audio, net, styles
/scripts     simulate.ts (bot harness) · faults.ts · contentLint.ts · screenshots.ts
/tests       unit and integration specs
```

Rules the codebase actually holds to:

- **`/shared` is pure.** No DOM reference, no Workers global, no `any` — enforced by
  eslint. Both halves import it, so scoring, matchmaking, room codes, name generation
  and story assembly are unit-testable in complete isolation, and the client and
  server can never disagree about them.
- **The server owns truth.** The client never computes a score, a winner, a matchup or
  a phase transition. It renders the view the server sent and sends intents back.
  This is structural, not aspirational: the reveal and vote payloads are built from a
  type that *has no author field*, so leaking authorship early is a compile error.
- **No file over ~350 lines**, no god component, no god manager class.
- **Zero magic numbers.** If a number matters it is named in `shared/constants.ts` or
  `shared/scoring.ts` with a comment explaining why it has that value.

---

## Local development

```bash
pnpm dev            # worker (:8787) + client (:5173), concurrently
pnpm dev:server     # just the worker
pnpm dev:web        # just the client (proxies /ws and /api to :8787)

pnpm test           # vitest
pnpm lint           # eslint
pnpm lint:content   # validate every story, name pool and room word
pnpm typecheck      # tsc -b across all three projects
pnpm verify         # all four, in order

pnpm simulate --players 6 --rounds 5 --mode crude --drawing on
pnpm simulate --matrix     # the full player-count / mode / finale grid
pnpm simulate --faults     # every fault-injection case
pnpm screenshots           # visual audit sweep, all breakpoints

pnpm build          # typecheck + client bundle
pnpm deploy         # build + wrangler deploy
```

Vite proxies `/ws` and `/api` to the worker, so **dev routing matches production
exactly** and there is no CORS anywhere in the project.

There are three TypeScript projects (`web`, `server`, `tools`) rather than one,
because `@cloudflare/workers-types` and `lib.dom` both declare `WebSocket`, `Request`
and friends — one project cannot typecheck both halves. `tsc -b` builds all three.

### Configuration

There is none to speak of, which is the point. No environment variables, no secrets,
no API keys, nothing in the client bundle that is not in the repo. `server/wrangler.toml`
holds the Durable Object binding and the static-asset config.

---

## Deployment

```bash
pnpm build
pnpm deploy        # wrangler deploy --config server/wrangler.toml
```

One command, one origin. The same Worker serves the built client from `[assets]` and
handles `/ws` and `/api/*` — `run_worker_first` keeps those away from the
single-page-application fallback, which would otherwise answer a WebSocket upgrade
with `index.html`.

You will need a Cloudflare account with Workers enabled. The Durable Object migration
in `wrangler.toml` uses `new_sqlite_classes`, which is available on the free plan.

---

## The multiplayer model

**Rooms.** Four uppercase letters drawn from a curated list of 923 pronounceable,
memorable, non-offensive words (BEEF, JAZZ, MOON, DUCK). Claiming happens *inside* the
Durable Object, which is single-threaded, so two simultaneous creators asking for the
same word cannot both win — the loser gets a 409 and tries the next candidate. After
eight attempts it falls back to random letters, so the worst case is an uglier code
rather than an error. Rooms live at most 4 hours, or 30 minutes with nobody connected.

**Identity.** A player id and a separate 32-byte secret token, both server-generated.
The client stores `{roomCode, playerId, token}` in **`sessionStorage`, not
`localStorage`** — that is a security decision, not a stylistic one: a second tab
must be a *new player*, not a second window onto the same identity.

**Reconnect** requires the token, compared in constant time. A name alone never grants
identity. A duplicate name gets a numeric suffix; it does not merge sessions. The
newest tab wins — an older socket for the same player is displaced with a
DUPLICATE_SESSION screen.

**Disconnects.** A player keeps their seat, score and stats for 90 seconds. Their
pending submissions auto-fill from the slot's fallback pool if a deadline passes. If
they return they get their identity, avatar, score and the correct current screen
back. If they never return they stay on the scoreboard as away, and are excluded from
future matchups and vote quorum maths.

There is one refinement on top of that: if a disconnect leaves a phase blocked on a
*single* absent person — an artist whose phone died, say — the deadline is shortened
to 22 seconds. The 90-second grace window is about keeping a seat; it is far too long
to make nine other people watch a canvas nobody is drawing on.

**Host disconnect.** The room is preserved. Every screen shows a countdown. After 60
seconds authority migrates to the longest-connected active player and the room is told
whose it is now. **No room can become unrecoverable** — that is the one unforgivable
multiplayer bug, and the FSM test asserts that every phase can reach the lobby.

**Message volume.** Deadlines are sent once, as absolute server timestamps plus a
clock sample. The client counts down locally against a measured offset, so a phone
with a wrong clock still shows the right timer and **no timer traffic exists at all**.
Broadcasts happen on state change only, coalesced into a 50ms window: ten players
submitting at once produce one broadcast, not ten.

---

## Testing

Three layers, and the interesting one is the middle.

**Unit tests** (`pnpm test`) — 174 specs over the pure modules: room-code generation
and uniqueness, name generation and the adversarial blocklist filter, matchmaking
fairness over 100-round runs at every player count, scoring maths, tie handling, story
assembly, content schema validation, the sanitizer (XSS / Zalgo / length / emoji
fixtures), and the FSM's legal and illegal transitions.

Including **`tests/scoring.balance.test.ts`**, which Monte-Carlo simulates 1,000
matches at 4, 6 and 8 players through the *real* scoring and matchmaking functions and
holds the drawing finale to 25–35% of all points awarded. It is what the finale
constants were tuned against — see GAME_DESIGN.md §5.

**Bot harness** (`pnpm simulate`) — real `ws` clients against a real `wrangler dev`,
speaking the real protocol. No mocks, no in-process shortcuts: if the harness can
finish a match, a room of phones can too. Every match asserts:

- total points awarded equals the sum of every broadcast delta, recomputed independently
- no player's appearance count differs from another's by more than 1 (4+ players)
- no player was ever offered their own answer to vote for
- **no authorId was ever broadcast before that round's vote resolved** (asserted
  against the captured message log, not the source)
- the final story contains no unfilled slot and no placeholder text
- every phase transition followed a legal FSM edge

`--faults` runs the full fault-injection list; `--matrix` runs the player-count grid.

**Visual audit** (`pnpm screenshots`) — drives the running app with one real browser
context per player and captures every screen at 320 / 390 / 768 / 1280 / 1920 px.
Phase 9 audits the pixels, not the CSS.

---

## Performance

| | |
|---|---|
| Initial JS | **~88 KB gzipped** (28 KB app + 60 KB React) |
| CSS | 4.7 KB gzipped |
| Fonts | 78 KB, two latin-subset variable woff2, self-hosted |
| Code-split | crude avatar pack · crude name pool · drawing canvas |
| Budget | 250 KB gzipped |
| Images | zero — every avatar is an inline SVG component |
| Audio files | zero — every sound is synthesised at runtime |

No 3D engine, no animation framework, no lodash, no date library. CSS transitions and
a handful of `requestAnimationFrame` loops.

---

## Accessibility

- WCAG AA contrast throughout; the paper grain is capped at 3% opacity so it can never
  move a contrast ratio.
- Visible 3px focus rings, never removed. Full keyboard operability.
- Touch targets ≥ 48×48; primary buttons ≥ 56px tall.
- `prefers-reduced-motion` replaces every transform with an instant state change. No
  information is ever behind an animation — the story read-out shows everything at
  once, the scoreboard shows final numbers immediately.
- **Player identity is never colour alone** — always avatar *and* name.
- `aria-live` on phase changes, timers, vote counts and error messages.
- No horizontal scroll at 320px on any screen; long names and 160-character answers
  wrap rather than overflow.

---

## Security

- All player text renders as React children, so it is escaped. **`dangerouslySetInnerHTML`
  is banned repo-wide** and eslint fails the build on it (along with `innerHTML` and
  `outerHTML` assignment).
- Server-side sanitisation: NFKC normalise, strip control characters and zero-width /
  bidi marks, cap combining marks per grapheme (kills Zalgo without banning legitimate
  accents), collapse whitespace, enforce length by code point so an emoji counts as one.
- Every inbound frame is parsed by zod. Nothing downstream type-asserts on a client
  payload. Binary frames, oversized payloads and malformed JSON are refused before
  anything looks at them, and a rejected message mutates nothing.
- Host-only actions are checked against the **server's** record of who the host is,
  never a flag from the client. Self-votes are refused server-side, not merely hidden.
- Per-socket token bucket: 20-message burst, 5/sec sustained, disconnect after three
  consecutive violations.
- Limits: name 20 · answer 160 (per-slot override to 120) · guess 100 · drawing 200 KB
  · frame 256 KB · 10 players + 2 spare display sockets per room.
- No secrets in the client bundle. No stack trace or internal id in any user-facing
  error — every error code has designed copy in one place that both halves import.

---

## Known limitations

| | |
|---|---|
| **Two-player finale share** | At exactly 2 players the drawing finale is 36% of all points, just outside the 25–35% band the balance test asserts at 4/6/8. With two people a finale *should* weigh more, so this is accepted rather than tuned away. |
| **No persistence** | Room state lives in the Durable Object for the session. Close every tab for 30 minutes and the room is gone, by design. |
| **Content volume** | 4 classic and 3 crude stories, 70 slots. Enough to play repeat matches without repeating a story, not enough for a long night. Engine quality was prioritised over content volume; adding a story is two steps (CONTENT_GUIDE §1). |
| **Music** | The mixer has a music channel and it is silent. Building a procedural soundtrack was out of scope. |
| **Drawing transport** | A rasterised PNG, not a stroke list, so a drawing cannot be replayed or re-scaled after submission. Undo works client-side only, before submitting. |
| **Blocklist false positive** | The place name "Niger" cannot appear in generated content, a consequence of collapsing repeated letters to defeat elongation. It only gates content we author ourselves. |
| **Single region per room** | A room lives wherever its Durable Object was created. A group spread across continents will have one player with worse latency. |

---

## Future

Deliberately **not** built, and out of scope for this MVP:

accounts · persistent profiles · cross-room matchmaking · a store or DLC · a community
content marketplace · AI-generated stories · voice chat · achievements · global
leaderboards · spectators · native apps · a moderation portal · internationalisation ·
analytics

---

## Licence and originality

Everything here is original: the game, the stories, the prompts, the name pools, the
avatar art, the sound design, and the code. No copyrighted art, fonts, sounds,
characters or scraped assets.

The only third-party assets are two typefaces — **Fredoka** and **Inter** — both under
the SIL Open Font License 1.1, vendored as latin-subset woff2 files and served from
this origin. Attribution and licence terms: `web/public/fonts/LICENSE.md`.
