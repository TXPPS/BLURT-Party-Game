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
- [Deployment](#deployment) · [DEPLOY.md](DEPLOY.md)
- [The multiplayer model](#the-multiplayer-model)
- [Testing](#testing)
- [Performance](#performance)
- [Accessibility](#accessibility)
- [Security](#security)
- [Observability](#observability)
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

Requires **Node ≥ 20**. `pnpm` is the package manager of record.

This is a pnpm workspace: `vite` belongs to `web`, so the root delegates to it
(`pnpm --filter @blurt/web build`) rather than relying on hoisting. CI runs a clean
install with **no dependency cache** on every push for exactly that reason — a script
that only resolves on an incrementally-built `node_modules` passes locally and fails on
a fresh clone.

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
5. **The drawing finale.** Prompts are pulled out of the whole story the room just
   built — every slot in it, not only the ones a round was spent on — so people are
   drawing each other's words rather than house filler. **Everybody** draws,
   at the same time, in one window. Three pictures are then shown in turn — everyone
   else writes a fake prompt and the room votes on which was real — and the artists
   there was no time for are paid the median of what the shown artists earned. Every
   drawing turns up in the end-of-match gallery.
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
             views.ts (the redaction boundary) · viewParts · privateView
             roomUpkeep (grace + host migration) · roomWire · roomHttp
/web         React client: screens, components, avatars, audio, net, styles
/scripts     simulate.ts (runner) · botHarness · invariants · faults
             screenshots · shotDriver · shotScenes · contentLint
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
- **No file over ~350 lines**, no god component, no god manager class — with one
  stated exception. `server/src/RoomDO.ts` is 638. Three concerns were lifted out of
  it (`roomUpkeep`, `roomWire`, `roomHttp`); what remains is the Durable Object's own
  capability surface, which does not decompose without passing the whole class back
  in as an interface. A room is one unit of consistency, and every mutation path being
  visible in one file is worth more to a reviewer than the line count. Reasoning and
  the rejected alternative are in BUILD_LOG → Phase 13.
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
in `wrangler.toml` uses `new_sqlite_classes`, which is available on the free plan. The
first deploy applies migration tag `v1` and creates the `RoomDO` class; wrangler prints
the migration and the resulting `*.workers.dev` URL.

**Continuous deployment is set up.** Pushing to the development branch runs
`pnpm verify` as a gate, builds, deploys, and then hits the live URL to prove it
actually answers — see **[DEPLOY.md](DEPLOY.md)** for the pipeline, the two repository
secrets, manual redeploys, rollback, and `wrangler tail`. The deployed URL is printed
into each run's job summary.

See [PLAYTEST.md](PLAYTEST.md) for the session kit — how to run a playtest and what to
watch.

---

## Observability

The server writes one line per phase entry and exit, to `console` and nowhere else.
No storage, no state field, and no player content — counts and phase names only, so
it is safe to leave on and safe to paste into a bug report.

```bash
npx wrangler tail --config server/wrangler.toml --format pretty --search '[blurt]'
```

```
[blurt] PARK enter ROUND_PROMPT round=2/3 eligible=4 connected=4 seated=4 budget=75.0s
[blurt] PARK exit  ROUND_PROMPT reason=all-submitted after=18.3s round=2/3 eligible=4 …
```

Every exit names why the phase ended — `all-submitted`, `timeout`, `host`, `presence`,
`auto` or `reset` — threaded from the call site rather than inferred, because a guessed
exit reason reads exactly as authoritative as a real one. Grepping `reason=timeout` is
the fastest way to find the phases where real people did not do the thing the screen
asked for.

The three counts differ deliberately: `eligible` can act now, `connected` has a socket
attached (including somebody still on the name screen), `seated` holds a seat and a
score (including somebody who has gone). `connected` below `seated` means a player is
away, not that anything broke.

For latency and pacing from the client side, `pnpm simulate --timings` reports
round-trip time and real duration per phase, and runs against a deployed URL unchanged.

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

During the drawing phase that shortening waits until *every* artist still owing a
picture has gone. Artists draw simultaneously, so one person dropping must not take
time off the people still mid-picture — an artist who leaves simply stops being
counted, and the phase ends as soon as the remaining artists are done.

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

**Unit tests** (`pnpm test`) — 281 specs over the pure modules: room-code generation
and uniqueness, name generation and the adversarial blocklist filter, matchmaking
fairness over 100-round runs at every player count, scoring maths, tie handling, story
assembly and progressive unlock, content schema validation, the two disguise lints,
the sanitizer (XSS / Zalgo / length / emoji fixtures), the FSM's legal and illegal
transitions, awards at every player count, and **33 WCAG AA contrast assertions across
both palettes** — so re-theming the game by editing `brand.ts` tells you immediately
whether the new palette is still legible.

Including **`tests/scoring.balance.test.ts`**, which Monte-Carlo simulates 1,000
matches at 4, 6 and 8 players through the *real* scoring and matchmaking functions and
holds the drawing finale to 22–38% of all points awarded (measured: 26.0–34.7%). It is what the finale
constants were tuned against — see GAME_DESIGN.md §5.

And **`tests/roomUpkeep.test.ts`**, which covers the two rules that decide whether an
abandoned room recovers or hangs: the disconnect-grace sweep and host migration. Both
used to be private methods on the Durable Object, so the only way to exercise them was
to run a real match and wait ninety seconds — which is how both of their bugs were
originally found. The tests were mutation-tested (a past-deadline host migration, a
removed lobby fallback, an off-by-one on the grace boundary); all three mutants fail
them, so they are load-bearing rather than decorative.

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

`--faults` runs the full fault-injection list — a competitor who never submits, nobody
voting, a tie, players leaving mid-round / mid-vote / mid-drawing, reconnects, the host
leaving temporarily and permanently, an artist who never draws, nobody writing a decoy,
oversized payloads, message floods, 1 round, 15 rounds, and a full house.

`--matrix` runs the player-count grid: 2 / 4 / 10 across both modes with and without
the finale, plus 3, 6 and 8. **16/16 passing.**

**Visual audit** (`pnpm screenshots`, needs `npx playwright install chromium` once) — drives the running app with one real browser
context per player and captures every screen at 320 / 390 / 768 / 1280 / 1920 px. It
also asserts against the live DOM at every breakpoint: no horizontal overflow, every
control at least 44×44, every control with an accessible name, every image with an
`alt`, and no player text overflowing its container. A screenshot cannot prove the
absence of overflow; this can.

It plays complete matches through the real UI — create, join from several contexts,
name, avatar, settings, rounds, voting, story updates, the final story, the drawing
finale, results, PLAY AGAIN and RETURN TO LOBBY — which is also the functional audit.

---

## Performance

Measured on the production build, not estimated:

| | |
|---|---|
| **Initial payload** | **90.6 KB gzipped** — HTML + CSS + app + React |
| Budget | 250 KB gzipped — **36% used** |
| app chunk | 27.7 KB gz (94 KB raw) |
| React | 57.5 KB gz (190 KB raw) |
| CSS | 4.7 KB gz (19 KB raw) |
| Code-split, not in the initial load | drawing canvas 1.9 KB · crude avatar pack 1.7 KB · crude name pool 1.0 KB |
| Fonts | 76 KB, two latin-subset variable woff2, self-hosted, cached after first load |
| Images | **zero** — every avatar is an inline SVG component |
| Audio files | **zero shipped** — every sound effect is synthesised at runtime. Music is two optional files you drop in `web/public/music`; absent, the game is simply quieter |

Server side, the message rate is bounded by how fast people can tap: broadcasts fire
on state change only, coalesced into a 50ms window, and never on a timer tick. The
view is built **once** per broadcast and shared across sockets; only the small
per-socket `private` payload is rebuilt. Drawings are served over HTTP rather than
pushed through the socket, which is what keeps a ten-player finale in kilobytes
instead of megabytes.

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
| **Two-player finale share** | At exactly 2 players the drawing finale is 34.7% of all points — the highest of any player count, though now inside the band. With two people a finale *should* weigh more, so this is accepted rather than tuned away. |
| **No persistence** | Room state lives in the Durable Object for the session. Close every tab for 30 minutes and the room is gone, by design. |
| **Content volume** | 4 classic and 3 crude stories, 70 slots. Enough to play repeat matches without repeating a story, not enough for a long night. Engine quality was prioritised over content volume; adding a story is two steps (CONTENT_GUIDE §1). |
| **Music is bring-your-own** | The mixer's music channel plays two loops — a lobby track and a game track — read from `web/public/music` at runtime. The repo ships none, so out of the box those screens are silent; see `web/public/music/README.md` for the filenames. Licensing the music is the operator's call, which is why it is not baked in. |
| **Drawing transport** | A rasterised PNG, not a stroke list, so a drawing cannot be replayed or re-scaled after submission. Undo works client-side only, before submitting. |
| **Blocklist false positive** | The place name "Niger" cannot appear in generated content, a consequence of collapsing repeated letters to defeat elongation. It only gates content we author ourselves. |
| **Single region per room** | A room lives wherever its Durable Object was created. A group spread across continents will have one player with worse latency. |
| **Perfect-bonus denominator drift** | The finale counts eligible voters at *resolution* time and at *guess* time separately. If somebody's 90-second grace window lapses between the two, the "everyone got it" bonus is measured against a slightly different denominator. Worst case is a missed 140-point bonus, never a crash. |
| **Ten decoys is a long list** | At ten players the drawing vote shows the real prompt plus nine decoys. Playable on a 320px screen — it is asserted not to overflow — but it is the screen most likely to feel cramped and to invite a mis-tap. |
| **The settings panel is the plain one** | Every other screen carries the printed-card identity. The host's settings panel is a stack of button groups that would not look out of place in any app. It works; it just does not have a voice. |
| **UI coverage is narrower than protocol coverage** | The bot harness exercises the protocol exhaustively — 22 fault cases, every player count, both modes. The browser sweep covers every screen and the full match arc, but not every interaction on every screen. Two of this build's three worst bugs were UI-only, so that gap is the one worth closing next. |
| **Room codes are guessable** | Four letters from a 923-word list. Somebody determined will find live rooms. The blast radius is small on purpose — they can join a lobby and be a nuisance, the host can remove them, a started game refuses joins, and rooms expire — but it is a real trade, made in exchange for a code you can shout across a room. |

---

## Future

Deliberately **not** built, and out of scope for this MVP:

accounts · persistent profiles · cross-room matchmaking · a store or DLC · a community
content marketplace · AI-generated stories · voice chat · achievements · global
leaderboards · spectators · native apps · a moderation portal · internationalisation ·
analytics

Wanted, and the first things worth doing next:

- **Widen UI interaction coverage.** The bot harness exercises the protocol
  exhaustively; the browser sweep covers every screen and the full match arc but not
  every interaction on every screen. Two of this build's three worst bugs were UI-only,
  so this is the highest-value gap.
- **A `SocketHub` inside the room.** Socket bookkeeping — who is bound, who to send
  to, who to sweep — is about 150 lines of `RoomDO` that would read better with its
  own name and owner. Deliberately not attempted at the end of this build, since it
  touches every send and close path.

---

## Licence and originality

Everything here is original: the game, the stories, the prompts, the name pools, the
avatar art, the sound design, and the code. No copyrighted art, fonts, sounds,
characters or scraped assets. The music folder ships empty for the same reason:
anything dropped in there is the operator's to license.

The only third-party assets are two typefaces — **Fredoka** and **Inter** — both under
the SIL Open Font License 1.1, vendored as latin-subset woff2 files and served from
this origin. Attribution and licence terms: `web/public/fonts/LICENSE.md`.
