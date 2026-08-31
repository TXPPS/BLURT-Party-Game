# BLURT — BUILD LOG

> "You said it. We decide what it meant."

This log is maintained by the studio for the duration of the build. Every phase is
gated: the owning role builds, the named auditor reviews the *running result*, and
findings are **fixed**, not merely recorded.

---

## PHASE STATUS TABLE

| # | Phase | Owner role | Status | Auditor | Audit result |
|---|-------|-----------|--------|---------|--------------|
| 0 | Preflight | Executive Producer / Technical Director | ✅ complete | DevOps / Deployment Engineer | PASS — toolchain verified, registry reachable, Chromium present |
| 1 | Architecture lock-in + `/shared` + `/content` | Executive Producer / Technical Director | ✅ complete | Final Integration Reviewer | PASS — 174 unit tests green, contentLint clean, eslint clean |
| 2 | Core multiplayer | Multiplayer / Network Engineer | ✅ complete | QA Engineer | PASS — two contexts join, kill one, refresh, identity + score + phase restored |
| 3 | Identity (names + avatars) | Content System Designer + Visual/Brand Designer | ✅ complete | Security / Abuse Prevention | PASS — 17,293 classic combos, adversarial pair filter green, 18 + 12 avatars |
| 4 | Standard gameplay | Gameplay Systems Engineer | ✅ complete | QA Engineer | PASS — full matches complete via harness at 2/4/10, both modes |
| 5 | Drawing finale | Gameplay Systems Engineer + Frontend | ✅ complete | QA Engineer | PASS — finale completes at 3 and 8 players; degrades cleanly on every skip |
| 6 | Results / awards | Gameplay Systems Engineer | ✅ complete | Game UX Designer | PASS — every award has a qualifier or a documented fallback at 2–10 players |
| 7 | Audio + polish | Audio/SFX Designer + Visual/Brand Designer | ✅ complete | Accessibility Reviewer | PASS — 35 synthesised events, zero audio files; touch targets and reduced-motion fixed |
| 8 | QA (bot harness + matrix) | QA Engineer | ⏳ pending | Executive Producer | — |
| 9 | Visual audit | Visual/Brand Designer + Accessibility Reviewer | ⏳ pending | Game UX Designer | — |
| 10 | Functional audit | Game UX Designer | ⏳ pending | Executive Producer | — |
| 11 | Adversarial review | All roles | ⏳ pending | Final Integration Reviewer | — |
| 12 | Docs, git, deploy readiness | DevOps / Deployment Engineer | ⏳ pending | Final Integration Reviewer | — |

Legend: ⏳ pending · 🔨 in progress · 🔍 in audit · ✅ complete · ⛔ blocked

---

## PREFLIGHT (Phase 0)

**Driving role:** Executive Producer / Technical Director
**Auditor:** DevOps / Deployment Engineer

### Working directory inventory

`/home/user/BLURT-Party-Game` contained **only** a `.git` directory — no source files,
no `package.json`, no `wrangler` config, no `tsconfig`. **Nothing to clobber.** No
integration with pre-existing files was required.

```
/home/user/BLURT-Party-Game
└── .git/          (initialised, zero commits)
```

### Toolchain

| Check | Result | Verdict |
|---|---|---|
| `node --version` | `v22.22.2` | ✅ ≥ 20 required |
| `npm --version` | `10.9.7` | ✅ |
| `pnpm --version` | `10.33.0` | ✅ **preferred package manager — using pnpm** |
| `yarn --version` | `1.22.22` | present, unused |
| `wrangler` (global) | not found | expected — installed as a local devDependency |
| `tsx` (global) | not found | expected — installed as a local devDependency |

### Git

- Repo **already exists** with remote `origin → https://github.com/TXPPS/BLURT-Party-Game`.
- Current branch: **`claude/blurt-party-game-mvp-vmeqo7`** (the designated development branch).
- **Zero commits** — history begins with this build. Nothing to preserve, nothing rewritten.
- No force-pushes, no branch deletions, no history rewrites will be performed.

### Network / registry

- `npm ping` succeeded through the agent HTTPS proxy.
- Registry metadata resolves: `react@19.2.8`, `vite@8.2.2`, `wrangler@4.127.1`.
- **Conclusion: installs are viable. No dependency-set reduction required.**

### Browser automation (visual QA capability)

- `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is pre-set and populated:
  `chromium-1194`, `chromium_headless_shell-1194`, `ffmpeg-1011`.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — we must **not** run `playwright install`.
- **Verdict: headless visual QA is available.** Phase 9 will capture real screenshots of the
  running app at 320 / 390 / 768 / 1280 / 1920 px. Visual QA is *not* being skipped.
- Fallback if the browser fails to launch at Phase 9: the bot harness + DOM-level tests carry
  functional coverage, and this log will say so explicitly rather than claiming a silent pass.

### Disk

`/` — 252 G total, 30 G available. Ample for `node_modules` + browser binaries.

### Preflight verdict

**PASS.** Green light to Phase 1.

---

## PHASE 1 — ARCHITECTURE, `/shared`, `/content`

**Driving role:** Executive Producer / Technical Director → Gameplay Systems Engineer → Content System Designer
**Auditor:** Final Integration Reviewer

Locked stack implemented as specified: TypeScript `strict` + `noUncheckedIndexedAccess` +
`exactOptionalPropertyTypes`, React 19 + Vite (no Tailwind, no component library, no
CSS-in-JS), Cloudflare Workers + Durable Objects, zod on the server boundary, vitest.

`/shared` is pure — no DOM reference, no Workers global, no `any`. Both the client and
the server import it, and every scoring / matchmaking / room-code / name / story
decision is unit-testable in isolation, which is what made the audits below possible
before a single line of server code existed.

### Balance finding — finale scoring constants (S2, FIXED)

The brief fixes the standard-round constants (100 / 250 / 200) **and** asks that the
drawing finale land at 25–35% of all points. Those two constraints are in direct
tension: a finale paying 300 per correct guess mints a payout for every voter on every
drawing, and at 5 rounds it dominates the match at roughly 64% of all points.

Resolution: keep the standard-round constants exactly as specified — they are the
numbers players see every round — and tune the finale constants, which is precisely
what `tests/scoring.balance.test.ts` exists to govern. A second lever was added with
an independent design justification: **three drawings in rooms of 6+, four below that**,
because a drawing round costs the same wall-clock time at any player count while
earning more per drawing as guessers are added. Both are documented in GAME_DESIGN.md.

Measured over 1,000 simulated matches per player count, using the real
`resolveMatchup` / `resolveDrawing` / matchmaking code:

| Players | Drawings | Standard pts/match | Finale pts/match | Finale share |
|--------:|---------:|-------------------:|-----------------:|-------------:|
| 2 | 2 | 1135 | 640 | 36.1% |
| 3 | 3 | 1750 | 843 | 32.5% |
| 4 | 4 | 2741 | 1260 | **31.5%** |
| 5 | 4 | 3007 | 1500 | 33.3% |
| 6 | 3 | 3179 | 1317 | **29.3%** |
| 7 | 3 | 3602 | 1515 | 29.6% |
| 8 | 3 | 4070 | 1717 | **29.7%** |
| 9 | 3 | 4255 | 1898 | 30.9% |
| 10 | 3 | 4751 | 2111 | 30.8% |

The three counts the brief names (4 / 6 / 8) all sit near the middle of the band. Two
players reads 36.1%, outside the band — that configuration is not one the brief asks
the test to assert, and with only two players a finale *should* weigh more. Recorded
under KNOWN LIMITATIONS rather than papered over.

### Content audit — disguised prompts (S2, 8 findings, ALL FIXED)

`content/validate.test.ts` grew two lints that check the actual hook rather than the
schema: a disguised prompt may not share a distinctive (7+ character) word with its own
story's prose, and may not contain any word from its own story's **title**. Both fired
on real content, and every hit was a genuine failure of the disguise:

| Story | Slot | Leak | Fix |
|---|---|---|---|
| `parents_evening` | `wall_object` | prompt said "laminated", prose laminates it | reprompted to a lost-property box |
| `the_house_sitter` | `drawer_thing` | prompt "kitchen drawer", prose "kitchen table" | prose moved to the hall table |
| `the_house_sitter` | `house_rule` | prompt echoed the title word "house" | "Write a rule that sounds reasonable…" |
| `the_routine_checkup` | `the_diet` | prompt "lifestyle", form header LIFESTYLE | reprompted to self-control over a week |
| `the_family_group_chat` | `chat_name` | prompt named a group chat outright | "a club that nobody wants to be in" |
| `the_family_group_chat` | `the_message` | prompt said "message"; prose is all messages | "six words that would end a friendship" |
| `the_family_group_chat` | `the_signoff` | prompt said "message" | "the last thing somebody says before leaving a room forever" |
| `the_family_group_chat` | `the_animal` / `the_venue` / `the_threat` | echoed the title word "family" | household / birthday party / "somebody who raised you" |

**Consequence for the server (logged, implemented in Phase 4):** the story *title* must
not be broadcast in LOBBY or GAME_SETUP either. `PublicRoom.storyTitle` stays `null`
until the first STORY_UPDATE, or the whole hook is given away on the setup screen.

### Blocklist audit (S2, FIXED)

The first blocklist folded repeated letters before matching, which is correct for
catching `niiiigger` and catastrophic for everything else: `coon` folds to `con` and
`speed` folds to `sped`, so ordinary words would have been rejected. Reworked to two
folded forms — long roots match as substrings of the squashed text, short roots (≤ 4
chars) match whole *unsquashed* words. `tests/nameGenerator.test.ts` pins both halves:
`Nig` + `Ger` is refused as a pair, and `speed`, `con`, `raccoon`, `flag` and
`Scunthorpe` all pass clean.

### Phase 1 verification

```
pnpm lint:content   ✓ 4 classic + 3 crude stories, 70 slots, 923 room words,
                      17,293 usable classic name combinations, 32,853 in crude
pnpm test           ✓ 174 tests across 10 files
npx eslint          ✓ clean
```

---

## PHASES 2–7 — SERVER AUTHORITY, GAMEPLAY, CLIENT

**Driving roles:** Multiplayer / Network Engineer → Gameplay Systems Engineer →
Frontend / UI Engineer → Visual / Brand Designer → Audio / SFX Designer
**Auditors:** QA Engineer, Security / Abuse Prevention Engineer, Accessibility Reviewer

The order here was deliberate: the bot harness was built *immediately* after the
first playable server, before any UI existed. Every defect below was found by
running the thing, not by reading it.

### Defects found and fixed

| ID | Sev | What | How it was found | Fix |
|----|-----|------|------------------|-----|
| **I5** | **S1** | **Voters never received the `roundId`.** `submit_vote` requires it, but only *competitors* got one, in their private payload. No client could vote. Every vote phase resolved on its 20-second timeout instead. | Bot harness: a 3-round match took 75s and phase tracing showed `ROUND_VOTE` burning exactly 20.00s every round. | `roundId` moved onto the public view for every phase that accepts a submission. A 3-round match went 75s → 15s. |
| **I6** | **S1** | **No answer or guess could be submitted from the UI at all.** `ActionButton` disables itself inside its click handler; the browser dispatches the form's `submit` event *after* the click, and a disabled submitter cancels that submission outright. The message never left the client. | Playwright: competitors' devices sat on "TYPING…" with the timer running down. The server log showed *no rejection*, which proved the frame never arrived. | `ActionButton` now forces `type="button"` and the prop is `Omit`ed from its type, so the misuse cannot compile. Forms call one explicit `send()` from both the button and the Enter key. |
| **I7** | **S1** | **React batched the `state` and `private` frames**, so the phase-change effect that cleared the private payload ran *after* the payload arrived and wiped the live prompt. | Playwright: competitors intermittently had no answer box. | Staleness is a comparison, not a timing question: the payload is stamped with the phase it arrived during and simply not surfaced if the room has moved on. |
| **I8** | **S2** | A grace sweep changed who was eligible **without re-checking whether the current phase had become complete**, so a room could sit out a 112-second drawing timer for somebody who had already been swept out. | Fault case "player leaves during drawing" took 186s and failed. | `settlePhase()` re-asks the current phase after any presence change, and a new `onPresenceChange` hook lets a phase shorten its own deadline to 22s when it is blocked on a single absent person. Also fires on phase *entry*, since a phase can begin already blocked. |
| **I9** | **S2** | **The host could never satisfy the ready check.** The lobby shows READY only to non-hosts, but `startBlock` required every player ready — so START was permanently disabled. | Playwright: `START THE GAME` resolved to `<button disabled>`. | The host is implicitly ready; pressing START *is* their readiness. |
| **I10** | **S2** | The warm cream paper rendered **grey**. `background-blend-mode: multiply` on `body` *plus* a `::before` grain overlay applied the noise twice. | Visual audit at 390px — the page background was visibly a different colour from the cards. | Grain applied once, by the overlay, at 3% opacity. |
| **I11** | **S2** | Icon-only controls (⚙, ✕) were 40px — under the 48×48 minimum. | Accessibility review of the captured lobby. | `.btn--icon` at the full `--tap-min`; `.btn--small` raised to 44px. |
| **I12** | **S3** | Player names truncated to 11 characters (`Suspicious …`) even where there was room, and the 10-player roster rendered as ten full-width rows. | Visual audit of the 10-player lobby. | Chips get the full 21ch; only the tight header slot opts into a short clamp. Roster items size to content and wrap. |
| **I13** | **S3** | The room code overflowed its panel in the condensed group view — `--t-code` is viewport-relative, but the panel is narrow there. | Visual audit at 390px. | The code sizes against its *container* (`21cqw` inside a `container-type: inline-size` panel), with the viewport clamp as the `@supports` fallback. |
| **I14** | **S3** | A burst of joins stacked four toasts and buried the settings panel. | Visual audit of the 10-player lobby. | Toast stack capped at three. |
| **I15** | **S3** | The self-vote fault case could never fire: above two players a competitor is not in the voter list, so the server correctly answers `NOT_YOUR_TURN` before the self-vote check is reached. The *test* was wrong, not the server. | Fault suite. | Split into two cases — `SELF_VOTE` at 2 players (the only configuration where a competitor is also a voter) and `NOT_YOUR_TURN` at 4. |
| **I16** | **S3** | ESLint was linting `web/dist`, reporting 3,270 errors in bundled React. | `pnpm lint`. | Ignore globs made recursive (`**/dist/**`). |

Note on **I5** and **I6**: either one alone made the game unplayable, and neither is
visible in the source. Both were only discoverable by driving the real thing — which
is the entire argument for building the harness before the UI.

### Architecture notes worth recording

- **Hibernation is safe** because every mutation is persisted and the socket→player
  mapping lives in the socket's own attachment. Drawings are the one thing that
  cannot fit in the state blob (128 KiB per-value limit vs a 200 KB protocol cap), so
  they are chunked into their own keys.
- **The redaction boundary is a type.** `RevealAnswer` has no author field at all, so
  leaking authorship during a reveal or a vote is a compile error rather than a
  code-review question. The harness independently asserts it against captured frames.
- **The phase registry has no special cases.** `PHASE_HANDLERS` plus a legal-edge
  table; the dispatcher looks a handler up and calls it. Adding a phase means adding a
  handler and an edge.

### Phase 2–7 verification

```
pnpm typecheck   ✓ three projects (web / server / tools)
pnpm lint        ✓ clean
pnpm test        ✓ 174 tests
pnpm lint:content ✓
vite build       ✓ 92 KB gzipped initial, against a 250 KB budget
```

---

## PHASE 11 — ADVERSARIAL REVIEW

Every role, answering the same nine questions with specific evidence. Findings are
marked **FIXED** (addressed in this session) or **DOCUMENTED** (recorded in README →
KNOWN LIMITATIONS with a one-line reason).

### What could still be broken?

- **Multiplayer Engineer.** An attacker who knows a room code could open all twelve
  connection slots and never handshake, locking real players out — the cap counts
  sockets, and an unbound socket costs nothing to hold. **FIXED:** the DO sweeps
  sockets that have not bound to a player within 10 seconds, and does so *before* the
  cap check, so a squatter cannot hold a slot.
- **Gameplay Engineer.** `resolveCurrentDrawing` counts eligible voters at resolution
  time while `guessersFor` counted them at guess time. If somebody's grace window
  lapses in between, `perfect` is measured against a slightly different denominator.
  The failure mode is a missed 140-point bonus, not a crash. **DOCUMENTED.**
- **QA.** The harness proves the *protocol*; the only thing proving the UI is the
  Playwright pass, which covers the main flow rather than every screen. Two of this
  session's three S1 bugs were UI-only, which is exactly the gap. **DOCUMENTED.**

### What feels unfinished?

- **Audio Designer.** The mixer has a music channel and it is silent. Building a
  procedural soundtrack was explicitly out of scope, but the slider implies something
  that does not exist. **DOCUMENTED.**
- **Content Designer.** Seven stories, 70 slots. Enough to play several matches
  without a repeat, not enough for a long night. Engine quality was prioritised over
  volume, and adding a story is genuinely two steps. **DOCUMENTED.**
- **UX Designer.** The settings panel is the least characterful screen in the
  game — a stack of button groups that could belong to any app. It works, it is
  legible, and it is the one place the brand goes quiet. **DOCUMENTED.**

### What would embarrass a professional studio?

- **Performance Engineer.** Shipping a game that pushes a 200 KB PNG through the
  WebSocket to every player on every broadcast. At ten players voting one at a time
  that is several megabytes for one picture. **FIXED** — drawings moved to a
  cacheable HTTP route.
- **Frontend Engineer.** A submit button that silently does nothing because it
  disabled itself before the form could fire. It shipped past a type-checker, a
  linter and 174 tests, and was only visible by watching a real browser. **FIXED**,
  and the type now makes the misuse impossible to write.
- **Technical Director.** Twenty unused exports. Small, but it is the difference
  between a codebase somebody maintains and one somebody inherits. **FIXED.**

### What is likely to fail at 10 players?

- **Performance Engineer.** Nothing structural. The view is built **once** per
  broadcast and shared across sockets; only the small per-socket `private` payload is
  rebuilt. Broadcasts are coalesced into a 50ms window and never fire on a timer, so
  the ten-player message rate is bounded by how fast ten people can tap.
- **UX Designer.** `DRAWING_VOTE` at ten players shows ten options — the real prompt
  plus nine decoys. On a 320px screen that is a long scroll and an easy mis-tap.
  Playable, but it is the screen most likely to feel cramped. **DOCUMENTED.**
- **Multiplayer Engineer.** Ten players plus two display sockets is exactly the cap,
  so a group of ten who all open a second tab will see the twelfth refused. That is
  the intended behaviour, and the refusal is a designed screen rather than a hang.

### What is likely to fail on a mid-range Android phone?

- **Performance Engineer.** Two things, both **FIXED**. The countdown called
  `setState` on every animation frame — sixty full re-renders a second for a number
  that changes once a second. And the paper grain was a fixed, full-viewport element
  with `mix-blend-mode: multiply`, which forces the whole page into a blended
  stacking context and makes scrolling jank on a weak GPU; it is now a plain
  low-opacity overlay that looks the same and composites for free.
- **Frontend Engineer.** `canvas.toDataURL` on an 800×600 buffer at 2× takes on the
  order of 100ms on a slow device. It happens once, on submit, behind a button that
  is already locked. Acceptable.

### What looks generic?

- **Brand Designer.** The settings panel (above), and the waiting screens, which are
  text plus an animated ellipsis. They have voice — "Bracing", "One of these is about
  to ruin somebody" — but no illustration. Everything else earns the printed-card
  identity: hard offset shadows, ink outlines, hand-placed rotations, the room code as
  the single largest object on screen.

### What is confusing to a first-time player who joined 30 seconds ago?

- **UX Designer.** The honest answer: for the first two rounds they do not know a
  story exists. That is the entire hook, so the fix is not to explain it — it is to
  make the *withholding* feel deliberate. GAME_SETUP says "A story has been chosen /
  You will not be told which one", and the first STORY_UPDATE lands at round two. A
  player who has not been told anything by round three would be a real problem; a
  player kept in the dark for ninety seconds is the game working.
- Non-competitors never see a dead screen. Every waiting state names what the group
  is doing, shows the same timer, and (by default) shows a condensed version of the
  shared screen underneath, so a fully remote group never needs a TV.

### What security assumptions are we making, and what happens if they're wrong?

- **Security Engineer.** *Assumption: a four-letter room code is not a secret.* It is
  not — 923 words means a determined attacker finds live rooms by guessing. The blast
  radius is deliberately small: they can join a lobby and be a nuisance, the host can
  remove them, a started game refuses joins, and rooms expire. Every party game with a
  shoutable code makes this trade. **DOCUMENTED.**
- *Assumption: the reconnect token is the only proof of identity.* It is 32 bytes from
  `crypto.getRandomValues`, compared in constant time, never broadcast, and stored in
  `sessionStorage` so a second tab cannot inherit it. If it leaked, an attacker could
  take over that one seat in that one room until it expires.
- *Assumption: the client is hostile.* Enforced rather than assumed. Host authority is
  checked against the server's record, self-votes are refused server-side, settings are
  re-clamped, phase legality is a table lookup, and the reveal payload is built from a
  type with no author field. The harness sends hand-crafted hostile frames for each of
  these and asserts the refusal.
- *Assumption: rate limiting per socket is enough.* It is not on its own — the
  connection cap plus the new handshake sweep is what closes it.

### What happens on flaky hotel wifi?

- **Multiplayer Engineer.** The socket drops, the client shows a banner rather than an
  error screen, and reconnect backs off exponentially with jitter — so a whole room
  coming back after a blip does not stampede. The stored token restores identity,
  score, stats and the correct current screen. The seat survives 90 seconds.
- If the connection dies without a close frame, the 20-second heartbeat is what
  surfaces it.
- A player whose absence is the *only* thing a phase is waiting on no longer costs the
  room the full timer: the phase shortens itself to 22 seconds. The 90-second grace is
  about keeping a seat, not about making nine other people wait.

---

## OPEN ISSUES

| ID | Sev | Description | Fix | Status |
|----|-----|-------------|-----|--------|
| I1 | S2 | Finale scoring at the brief's constants took ~64% of all points, far outside the 25–35% band. | Kept standard-round constants; tuned finale constants and scaled drawing count by room size. Verified by Monte-Carlo over 1,000 matches × 9 player counts. | ✅ fixed |
| I2 | S2 | Eight disguised prompts leaked their story's context or echoed its title. | Rewrote the prompts/prose; added two lints that fail the build on a recurrence. | ✅ fixed |
| I3 | S2 | Blocklist letter-squashing produced false positives on ordinary words ("speed", "con"). | Two-tier folding: substring match for long roots, whole-word match for short ones. | ✅ fixed |
| I4 | S3 | Story title would have been visible on the setup screen, spoiling the hidden-context hook. | `PublicRoom.storyTitle` stays null until the first STORY_UPDATE. | ✅ fixed in Phase 4 |
| I5 | S1 | Voters never received the `roundId`, so no client could vote; the phase only ever ended on its timeout. | `roundId` moved onto the public view for every submission phase. | ✅ fixed |
| I6 | S1 | `ActionButton` disabled itself on click, cancelling the form submission it was meant to trigger — no answer or guess could be sent from the UI. | Forced `type="button"`, `Omit`ed from the prop type, explicit `send()` shared by button and Enter key. | ✅ fixed |
| I7 | S1 | React batched `state` and `private`, so the phase-change effect wiped the prompt that had just arrived. | The private payload is stamped with its phase and filtered on read. | ✅ fixed |
| I8 | S2 | A grace sweep changed eligibility without re-checking phase completion, stranding a room on a 112s drawing timer. | `settlePhase()` plus an `onPresenceChange` hook that shortens a deadline to 22s when a phase is blocked on one absent person. | ✅ fixed |
| I9 | S2 | The host had no READY control but was required to be ready; START could never enable. | Host is implicitly ready — START *is* their readiness. | ✅ fixed |
| I10 | S2 | Double-applied paper grain turned the warm cream background grey. | Grain applied once, at 3% opacity. | ✅ fixed |
| I11 | S2 | Icon-only controls were 40px, under the 48×48 touch minimum. | `.btn--icon` at full `--tap-min`; `.btn--small` raised to 44px. | ✅ fixed |
| I12 | S3 | Names truncated at 11 chars; the 10-player roster rendered as ten full-width rows. | Full 21ch chips; roster items size to content and wrap. | ✅ fixed |
| I13 | S3 | The room code overflowed its panel in the condensed group view. | Container-query sizing with the viewport clamp as fallback. | ✅ fixed |
| I14 | S3 | A burst of joins stacked four toasts over the settings panel. | Toast stack capped at three. | ✅ fixed |
| I15 | S3 | The self-vote fault case could never fire at 4 players — the *test* was wrong. | Split into a 2-player `SELF_VOTE` case and a 4-player `NOT_YOUR_TURN` case. | ✅ fixed |
| I16 | S3 | ESLint linted `web/dist`, reporting 3,270 errors in bundled React. | Recursive ignore globs. | ✅ fixed |

Severity scale: **S1** ship-blocker · **S2** major · **S3** minor · **S4** polish

---

## ASSUMPTIONS MADE

| # | Assumption | Rationale |
|---|-----------|-----------|
| A1 | The empty repo means this is a greenfield build; no legacy code to integrate. | Directory inventory showed only `.git`. |
| A2 | `pnpm` is the package manager of record; `npm` remains a working fallback. | Brief prefers pnpm; pnpm 10.33 is installed. |
| A3 | Stories are authored as prose with `{slot_id}` placeholders plus a separate slot declaration, rather than a hand-maintained `StaticLine \| SlotLine` array. | Isomorphic to the brief's shape and impossible to desynchronise — validation proves every placeholder resolves and every slot is used exactly once. |
| A4 | `typecheck` runs three tsconfig projects (web / server / tools) through `tsc -b` rather than one. | `@cloudflare/workers-types` and `lib.dom` both declare `WebSocket`, `Request` and friends; one project cannot typecheck both halves. |
| A5 | The finale's scoring constants deviate from the brief's suggested values; the standard-round constants do not. | The brief asks for both fixed constants and a 25–35% finale share, which cannot both hold. The balance test is the stated arbiter. See Phase 1 above. |
| A6 | Crude rooms draw on the classic story pack as well as the crude one. | Doubles the pool that "no repeats between matches" works against, and a filthy room still enjoys a corporate horror story. |
| A7 | A few extra `/shared` modules exist beyond the brief's file list (`awards.ts`, `views.ts`, `rng.ts`, `sfx.ts`, `blocklist.ts`, `roomWords.ts`). | Keeps every file under the ~350-line ceiling the brief also sets. Same layer, same purity rules. |

---

## DEFERRED / OUT OF SCOPE

Per **Section 16 — FORBIDDEN THIS SESSION**. Logged here and mirrored into README → FUTURE.

accounts · persistent profiles · matchmaking across rooms · store/DLC · community content
marketplace · AI-generated stories · voice chat · achievements · global leaderboards ·
spectators · native apps · moderation portal · i18n · analytics
