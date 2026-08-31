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
| 8 | QA (bot harness + matrix) | QA Engineer | ✅ complete | Executive Producer | PASS — matrix 16/16, fault suite green, 207 unit tests |
| 9 | Visual audit | Visual/Brand Designer + Accessibility Reviewer | ✅ complete | Game UX Designer | PASS — 14 findings, all fixed; screenshots + live DOM assertions at 5 breakpoints |
| 10 | Functional audit | Game UX Designer | ✅ complete | Executive Producer | PASS — full arc played through the real UI, including PLAY AGAIN and RETURN TO LOBBY |
| 11 | Adversarial review | All roles | ✅ complete | Final Integration Reviewer | PASS — every finding fixed or in KNOWN LIMITATIONS |
| 12 | Docs, git, deploy readiness | DevOps / Deployment Engineer | ✅ complete | Final Integration Reviewer | PASS — `wrangler deploy --dry-run` clean, four docs written, history intact |

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

## PHASE 8 — QA

**Driving role:** QA Engineer
**Auditor:** Executive Producer / Technical Director

`scripts/simulate.ts` opens **real `ws` clients against a real `wrangler dev`** and
speaks the real protocol. No mocks, no in-process shortcuts, no test-only server
hooks. It was built immediately after the first playable server and *before any UI
existed*, which is why it caught the protocol defects that a type-checker cannot.

### Invariants asserted on every simulated match

| Invariant | How |
|---|---|
| Points reconcile | Every broadcast `deltas` array is collected, summed independently, and compared against the final leaderboard. Dedup is **per results screen**, because one drawing legitimately emits several identical `artist_identified` events. |
| Appearance fairness | No player's `appearances` differs from another's by more than 1 at 4+ players. |
| No self-vote option | A player is never offered their own answer, checked against every `private` payload received. |
| **No early authorship** | Scans every captured frame: no `authorId` in any `ROUND_REVEAL` or `ROUND_VOTE` view, and none in `votableAnswers`. |
| House only at two players | A house answer must never appear in a matchup above two players. Added after the visual audit caught exactly that (I17). |
| Complete final story | No `{placeholder}`, no `undefined`/`null` text, no empty line, no redaction block. |
| Legal transitions only | Every phase change each bot observed is checked against the FSM edge table. |

### Player-count matrix — **16/16 passed**

2 / 4 / 10 players across both modes, with and without the finale (the brief's floor),
plus 3, 6 and 8 for the single-voter case and the 2/3-competitor alternation band, and
one 5-round match to exercise the story-update cadence.

```
✓ 2p  classic finale   ✓ 2p  classic no-finale   ✓ 2p  crude finale   ✓ 2p  crude no-finale
✓ 4p  classic finale   ✓ 4p  classic no-finale   ✓ 4p  crude finale   ✓ 4p  crude no-finale
✓ 10p classic finale   ✓ 10p classic no-finale   ✓ 10p crude finale   ✓ 10p crude no-finale
✓ 3p classic finale    ✓ 6p crude finale         ✓ 8p classic finale  ✓ 5p classic finale 5r
16/16 passed.
```

### Fault injection — **22/22 passed**

| Case | Result |
|---|---|
| a competitor never submits | ✓ house fills, story stays coherent |
| nobody votes at all | ✓ resolves, announced as "NOBODY VOTED. THE UNIVERSE DECIDES." |
| blank / 160-char / double-submitted answers | ✓ blank refused, no duplicate answers created |
| self-vote via a raw socket frame (2 players) | ✓ `SELF_VOTE` |
| a competitor voting in their own matchup (4 players) | ✓ `NOT_YOUR_TURN` |
| a host-only action from a non-host | ✓ `NOT_HOST` |
| player leaves mid-round | ✓ |
| player leaves mid-vote | ✓ |
| player leaves during drawing | ✓ |
| player reconnects mid-round | ✓ restored to the right screen with the right private data |
| host leaves and returns within grace | ✓ |
| host leaves permanently | ✓ authority migrates, match finishes (was a hang — see I18) |
| the artist never draws | ✓ |
| nobody writes a decoy | ✓ house decoys keep the vote alive |
| oversized drawing payload | ✓ refused, a legal one still lands |
| message flood | ✓ `RATE_LIMITED` |
| 2 players, the house plays | ✓ |
| 3 players, a single voter | ✓ |
| 15 rounds through 10-slot stories | ✓ continues into a second story |
| 1 round through a 10-slot story | ✓ house fills the rest, story reads complete |
| crude mode, 8 players, finale | ✓ |
| full house: 10 players | ✓ |

```
22/22 passed.
```

Malformed JSON, binary frames, wrong protocol version, duplicate names, oversized
names, emoji/RTL/Zalgo names, whitespace-only input, joining a nonexistent room, a
full room and a started game are all covered by the unit tests and the manual socket
probe rather than the match harness, because none of them get far enough to affect a
match.

### Unit and integration tests — **207 passing**

Room codes · name generation and the adversarial blocklist filter · matchmaking
fairness over 100-round runs at every player count · scoring maths · tie handling ·
story assembly and progressive unlock · content schema · the two disguise lints ·
sanitiser (XSS / Zalgo / emoji / length fixtures) · FSM legal and illegal transitions ·
awards at every player count · **finale scoring balance over 1,000 Monte-Carlo
matches** · **33 WCAG contrast assertions across both palettes**.

---

## PHASE 9 — VISUAL AUDIT

**Driving roles:** Visual / Brand Designer + Accessibility Reviewer
**Auditor:** Game UX Designer

Audited the **running application**, not the source. `scripts/screenshots.ts` drives
it with one real browser context per player — Chromium via Playwright, which the
preflight confirmed was available — and captures every screen at 320 / 390 / 768 /
1280 / 1920 px. It also runs structural assertions against the live DOM at every
breakpoint, because a screenshot cannot prove the absence of horizontal overflow:

- nothing wider than the viewport
- every button, link and input at least 44×44
- every control has an accessible name
- every `<img>` has an `alt`
- nothing with `.breakable` overflowing its container (long names, 160-char answers)

Contrast is asserted separately and deterministically in `tests/contrast.test.ts`:
33 checks across 15 real text/background pairs in **both** palettes. That is a
better artefact than a screenshot — if somebody re-themes the game by editing
`brand.ts`, which is the entire point of that file, the test tells them immediately
whether the new palette is still legible.

### Findings and fixes

| # | Screen | Found | Fixed |
|---|--------|-------|-------|
| V1 | every screen | The warm cream paper rendered **grey**. `background-blend-mode: multiply` on `body` plus a `::before` grain overlay applied the noise twice. | Grain applied once, at 3–4% opacity. The paper is cream again, and the fixed blended layer that was also a scrolling-jank risk on weak GPUs is gone. |
| V2 | lobby (10 players) | Names truncated to 11 characters (`Suspicious …`) with plenty of room to spare, and ten players rendered as ten full-width rows. | Chips get the full 21ch; only the tight header slot opts into a short clamp. Roster items size to content and wrap into a block. |
| V3 | lobby | Kick buttons floated outside their chips as detached dashed circles. | Each roster entry is one flex row: chip plus its own control. |
| V4 | lobby, everywhere | Icon-only controls (⚙, ✕) were 40px, under the 48×48 minimum. | `.btn--icon` at the full `--tap-min`; `.btn--small` raised to 44px. Now asserted on every screen at every width. |
| V5 | lobby (condensed group view) | The room code overflowed its panel — `--t-code` is viewport-relative, but the condensed panel is narrow. | The code sizes against its **container** (`21cqw` inside `container-type: inline-size`), with the viewport clamp as the `@supports` fallback. |
| V6 | lobby | A burst of joins stacked four toasts over the settings panel. | Toast stack capped at three. |
| V7 | identify | The avatar grid was two across on a phone, making the page enormous. | Three across at 320px, more as the screen grows. |
| V8 | round prompt / vote / results | The condensed group view was a **full duplicate** of the player's own controls: the prompt, the timer, the round counter and the scoreboard all appeared twice on one phone screen. | The condensed strip now drops whatever the player already has — the prompt when they are competing, the timer, the phase heading, and the answer list on the vote screen. |
| V9 | story update, final story | Copy read "Look up. This is the good bit." — but plenty of groups play with no shared screen at all, and the story was rendered *below* those words. | Reworded to be direction-agnostic. |
| V10 | drawing canvas | Eight colour swatches wrapped 7 + 1, orphaning pink onto its own row at phone widths. | Swatches are a `repeat(8, 1fr)` grid and share the row evenly. |
| V11 | drawing (artist's device) | The condensed group view told the artist "Captain Meatball is drawing" — on Captain Meatball's own phone. | Suppressed for the artist. |
| V12 | error screens | Every one said the same sentence twice: the server sent `"title. body"` and the client already renders the title from `ERROR_COPY`. | The server sends the body only. |
| V13 | error screens | `RETRYABLE` was configured but `onRetry` was never wired, so the retry path was dead. | Wired to a reload. |
| V14 | **round results (4 players)** | A third answer credited to **THE HOUSE** — in a four-player game, where the house should never play. | A genuine gameplay bug, not a visual one. See I17. |
| V15 | identify (320px) | The avatar grid silently fell back to **two** columns, making the picker a third of a page longer than it needed to be. The `minmax` floor did not account for the page + card padding chain. | 76px floor; three across at 320px. |
| V16 | **final results** | An artist who never drew produced an `<img>` pointing at a URL that 404s, so the screen showed the browser's **broken-image icon**. | The server sends an empty `imageUrl`; the client renders a deliberate note ("…drew nothing at all. Bold. Minimalist. Impossible to guess."). |
| V17 | **drawing vote** | Three players who timed out on a decoy all received the **same** house decoy, so the vote screen listed one line three times. The seed was derived from the player id's *length*, and every id is a UUID of the same length. | Seeded per player, and de-duplicated against everything already on the board. |
| V18 | lobby settings | The round −/+ steppers measured 38×45, and at 320px eight forced swatch columns squeezed each colour to 25px. | Both hold a 44px floor. Caught by the automated pass, not by eye. |
| V19 | lobby (10 players) | Join toasts stacked over the host's settings panel. | In the lobby the roster *is* the feedback, so arrivals are only announced once a match is under way. |
| V20 | lobby (condensed strip) | The group view repeated the full roster the player's own controls already showed. | The strip keeps the room code and join URL; the roster is dropped. |
| V22 | **final results** | The leaderboard rendered **upside-down** under `prefers-reduced-motion`. The bottom-up reveal reversed the *list* to get its reveal order, so with the animation disabled everybody saw last place at the top. | Reveal fills from the bottom while the list stays in rank order. |
| V23 | final results (condensed strip) | PLAY AGAIN / BACK TO THE LOBBY rendered **twice**, and the leaderboard and heading with them. | The strip drops what the player's own controls already carry. |
| V24 | audio | Dramatic stings defaulted to **off on every device, including the host's** — so out of the box nobody heard them, which is not what the design asks for. | The preference is now tri-state: `null` means "decide for me" and resolves to on for the host or the big screen, off for everybody else. A player who touches the toggle keeps their choice. |
| V21 | lobby settings | The round **−/+ stepper was lossy under rapid taps**: both taps computed from the same not-yet-updated server value, so the second was swallowed and the number visibly lagged a thumb. Found because a scripted scene set 3 rounds and got 3 back after two decrements. | The stepper leads the server by one tap with a local value. Every other control stays a straight send-and-render; the server still re-clamps whatever arrives. |

### Automated layout pass — final result

Verification sweeps after the fixes, at **320px** (the narrowest, highest-risk
breakpoint) and **390px** (every scene, including the full drawing finale, the
results screen and PLAY AGAIN → RETURN TO LOBBY), both reported:

```
✓ no overflow, undersized targets or unlabelled controls found.
```

with **zero failed captures**. Across the full sweep at 320 / 390 / 768 / 1280 / 1920:

- **zero** horizontal overflow, on any screen, at any width
- **zero** controls without an accessible name
- **zero** images without `alt`
- **zero** cases of player text overflowing its container (long names, 160-character answers)
- three undersized tap targets — V18 above, now fixed

The tap-target findings are worth dwelling on: both were controls a person would
look at and call fine. A 38×45 button is not visibly wrong. Measuring it is the only
way to know, which is the argument for making the audit an assertion rather than a
judgement call.

**V14 is the case for doing this phase at all.** It is a rules bug that no unit test
caught, that the bot harness did not assert, and that is invisible in the source
unless you already suspect it. It was obvious in one screenshot of a results screen.

### What the screenshots confirm works

- The **payoff lands.** "Management announces a new position, effective immediately:
  *my uncle, legally*" — a player's answer to "invent a job title that absolutely
  should not exist", read back as a corporate announcement. That is the whole game,
  and it works on the first playthrough.
- House-filled slots are visually distinct from player-filled ones (italic and muted
  versus mint with an attribution chip), so a room can see what they wrote and what
  the game wrote for them.
- Freshly inserted answers stamp in marigold on the story update.
- The room code is the largest object on the shared screen and legible across a room.
- The drawing brief carries the derived clause — "…from: *At the gangway, security
  confiscates the concept of a Tuesday from a passenger in cabin 214.*" — so the
  artist knows the context without being told the answer.

---

## PHASE 10 — FUNCTIONAL AUDIT

**Driving role:** Game UX Designer
**Auditor:** Executive Producer / Technical Director

Complete matches played through the **real UI**, in multiple simultaneous browser
contexts — one per player, each with its own `sessionStorage`, exactly as separate
phones would be. `scripts/screenshots.ts` is the functional audit as well as the
visual one: it types into the real inputs, clicks the real buttons, draws on the real
canvas with real pointer events, and waits on the real phase transitions.

### The full arc, verified end to end

create a room → the code appears on screen → join from a second and third context →
name and avatar on each → host sets mode, rounds, timer and finale → rounds with
private prompts and anonymous voting → story updates → the final story → the drawing
finale (draw, guess, vote, results) → final leaderboard, awards and highlights →
**PLAY AGAIN** → a second match starts with the same people and a fresh story →
**RETURN TO LOBBY**.

### Does the comedy actually land?

This is the part that cannot be asserted, so it was read.

- **The hook works on the first playthrough.** "Invent a job title that absolutely
  should not exist" produced *my uncle, legally*, which the story read back as:
  *"Management announces a new position, effective immediately: my uncle, legally.
  There are no applicants."* Nobody who wrote that answer could have seen it coming,
  which is the entire design goal.
- **The reveal has beats, not a dump.** The story update opens only as far as play has
  reached, stamps the new insertions in marigold, and attributes each to a player with
  their avatar. The final read-out paces line by line.
- **House fills read differently from player fills** — italic and muted versus mint
  with an attribution chip — so a room can see at a glance what they wrote and what
  the game wrote for them. In a three-round match through a ten-slot story that is
  most of the page, and it still reads as a finished story rather than a gap-filler.
- **The derived drawing prompts are the right kind of absurd.** "Draw this: *the
  concept of a Tuesday*" with the clause it came from underneath — the artist knows
  the context without being handed the joke.

### Copy fixed as a result of playing it

- "Look up. This is the good bit." assumed a shared screen. Plenty of groups play
  with none, and the story was rendered directly below those words.
- "Look at the big screen." on the results screen, same problem.
- The condensed group view repeated the player's own prompt, timer, round counter and
  scoreboard — on a phone that is the same information twice on one screen.
- The artist's own device was told who was drawing.

### What could not be audited this way

Real human comedy at a real party. A harness can prove the machine assembles the
joke correctly; it cannot prove that six people in a room laugh. That is what the
first playtest is for, and nothing in this build substitutes for it.

---

## PHASE 12 — DOCS, GIT, DEPLOY READINESS

**Driving role:** DevOps / Deployment Engineer
**Auditor:** Final Integration Reviewer

### Deploy validation

`wrangler deploy --dry-run` against the real config:

```
✨ Read 13 files from the assets directory web/dist
Total Upload: 914.90 KiB / gzip: 158.99 KiB
Your Worker has access to the following bindings:
Binding                 Resource
env.ROOMS (RoomDO)      Durable Object
```

Config parses, the Durable Object binding resolves, the static-asset directory is
found, and the worker script is well inside Cloudflare's 1 MiB gzipped script limit.
`pnpm deploy` is `pnpm build && wrangler deploy` — one command, one origin, no
environment variables and no secrets.

The migration uses `new_sqlite_classes`, which is available on the free plan.

### Documentation

| File | What it is |
|---|---|
| `README.md` | Overview, quick start, architecture and **why Durable Objects**, structure, dev, deploy, multiplayer model, testing, performance, accessibility, security, known limitations, future |
| `GAME_DESIGN.md` | The loop, the hidden-context hook, Classic vs Crude, matchmaking rules, scoring tables with the actual constants and the measured balance, the story engine, finale rules, host settings, every award and its derivation |
| `CONTENT_GUIDE.md` | Adding a story with a full annotated example, writing disguised prompts (do's and don'ts, and the two lints that enforce them), name-generator words, avatar packs, SFX recipes, Crude boundaries, running the linter |
| `BUILD_LOG.md` | This file |

### Git

History begins at the first commit of this session and is intact — no force-push, no
rewrite, no deleted branches. Conventional commits, one per phase gate plus one per
round of audit fixes, each describing what was found rather than what was typed.

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

## FINAL INTEGRATION REVIEW

**Driving role:** Final Integration Reviewer

Reviewed adversarially against the brief, not against the build log. Verdict: **ship**.

**What convinced me.** The three worst defects in this build — no vote could be
submitted, no answer could be submitted, and THE HOUSE played in every four-player
game — were all invisible to a type-checker, a linter and 207 unit tests. Each was
found by running the thing: two by a bot harness written before any UI existed, one
by looking at a screenshot of a results screen. The process that found them is in the
repo and runs on one command, which matters more than the fixes.

**What I pushed back on.** Two things were argued down and then argued back:

1. *"The balance test passes, so the finale constants are fine."* It passes because
   the constants were tuned to make it pass. The reviewer's question is whether the
   tuning is principled or fitted. It is principled — the standard-round constants
   are untouched, the finale scales with room size for an independently stated pacing
   reason, and the measured share holds across every player count from 3 to 10 rather
   than at the three the test asserts. Accepted.
2. *"The visual audit is done, the screenshots look right."* Screenshots cannot prove
   the absence of overflow or a 38px button. The audit was made an assertion — live
   DOM checks at every breakpoint plus 33 contrast unit tests — and immediately found
   three undersized targets nobody had noticed by eye. Accepted after that change.

**What I am still uneasy about**, and which is in KNOWN LIMITATIONS rather than
fixed: UI interaction coverage is narrower than protocol coverage. Two of the three
S1 bugs were UI-only. The browser sweep covers every screen and the full match arc,
but not every interaction on every screen. That is the first thing I would fund next.

**What I am not uneasy about.** Room codes being guessable, no persistence, seven
stories, and a silent music channel are all deliberate, documented, and correct for
what this is.

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
| I17 | **S1** | **THE HOUSE played in every matchup from 2 to 5 players.** `needsHouseAnswer` asks "does this room have two people" and both call sites passed `competitorIds.length`, which is 2 for any room that size. Found in a screenshot of a 4-player results screen. | Pass the eligible *room* size. Harness now asserts it on every match above two players. | ✅ fixed |
| I18 | **S1** | A room could stick in `ROUND_VOTE` forever when the host left permanently; the fault case timed out at 300s. | Fixed alongside I19/I20; the case now finishes in 92s. | ✅ fixed |
| I19 | S2 | Host migration returned early when nobody was promotable *without* clearing its timer, so `refreshDerivedTimers` re-armed an already-past deadline and the alarm span hot. Reachable when the host leaves while everyone else is still on the name screen. | Push `hostMissingSince` forward instead of leaving a past deadline. | ✅ fixed |
| I20 | S2 | A phase blocked on one absent player only re-checked itself on presence changes, so the last online competitor answering still left the room waiting out the full 45s timer. | Re-check after every submission too. Fault cases dropped 96s→77s and 80s→55s. | ✅ fixed |
| I21 | S2 | Locked story sections shipped their real prose and were only blurred in CSS — the rest of the story was one devtools panel away. | Redacted server-side; the client physically cannot render it. | ✅ fixed |
| I22 | S2 | Drawings were inlined in the view, so a 200 KB PNG was re-sent to every socket on every broadcast (megabytes per drawing at 10 players). | Served from a cacheable HTTP route, cache-busted per match. | ✅ fixed |
| I23 | S2 | The countdown called `setState` every animation frame — 60 full re-renders a second for a number that changes once a second. | Quantised to 500ms. | ✅ fixed |
| I24 | S2 | `MAX_CONNECTIONS_PER_ROOM` was declared but never enforced, and unbound sockets cost an attacker nothing to hold. | Cap enforced, plus a 10s handshake sweep that runs *before* the count. | ✅ fixed |
| I25 | S2 | Stored drawings were never cleared between matches, so a replay could show the previous match's picture. | Cleared on PLAY AGAIN and RETURN TO LOBBY. | ✅ fixed |
| I26 | S2 | A host who declined the 18+ gate was locked out of their own room, with no way back to the setting they had just changed. | For the host, declining reverts the room to Classic. | ✅ fixed |
| I27 | S3 | The canvas exported at `devicePixelRatio` (1600×1200 on a retina phone) instead of the fixed 800×600 the transport spec sets, and a `pointerleave` handler chopped strokes short mid-drag. | Downscale through an offscreen canvas; drop the handler (pointer capture already covers it). | ✅ fixed |
| I28 | S3 | Story sections declared `audioCue`s that nothing ever played, and every UI interaction made the same click. | Cues fire as sections reveal; distinct sounds for join/ready/submit/vote, plus local timer warnings. | ✅ fixed |
| I29 | S2 | An artist who never submitted produced an `<img>` pointing at a 404, so the results screen showed the browser's broken-image icon. | Empty `imageUrl` server-side; a deliberate note client-side. | ✅ fixed |
| I30 | S2 | Every timed-out guesser received the **same** house decoy — the seed came from their id's *length*, and every id is a same-length UUID. | Seeded per player and de-duplicated against the board. | ✅ fixed |
| I31 | S2 | The final leaderboard rendered **upside-down** under `prefers-reduced-motion`. | The reveal fills from the bottom; the list stays in rank order. | ✅ fixed |
| I32 | S2 | Dramatic stings defaulted to off on every device including the host's, so out of the box nobody heard them. | Tri-state preference: "decide for me" → on for the host or big screen. | ✅ fixed |
| I33 | S3 | The round −/+ stepper was lossy under rapid taps (both taps read the same stale server value). | The stepper leads the server by one tap locally; the server still re-clamps. | ✅ fixed |
| I34 | S3 | Three undersized tap targets (38×45 steppers, 25px swatches at 320px) that looked fine to the eye. | 44px floor on both. Found by the automated pass. | ✅ fixed |
| I35 | S3 | Two crude decoration CSS classes were never used by any component. | Removed; the censor-bar motif now styles the redacted locked story sections. | ✅ fixed |
| I36 | S3 | The finale's perfect-bonus denominator can drift if a grace window lapses between the guess and the resolve. | Worst case is a missed bonus, never a crash. | 📄 documented |
| I37 | S3 | UI interaction coverage is narrower than protocol coverage; two of three S1 bugs were UI-only. | Browser sweep covers every screen and the full arc, not every interaction. | 📄 documented |

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
| A8 | `create_room` is a protocol message, but the room code is allocated first by `POST /api/rooms`. | A code has to exist before a socket can be routed to the Durable Object that owns it. Claiming happens *inside* the object, which is single-threaded, so two simultaneous creators cannot both win. The `?code=NEW` sentinel keeps the pure-WebSocket path working too. |
| A9 | Drawings travel over HTTP (`/api/rooms/:code/drawing/:index`), not in the `state` broadcast. | The brief specifies a 200 KB PNG data URL on the *submission*; putting it back into every broadcast would have sent megabytes per drawing at ten players. The submission is unchanged; only the distribution is. |
| A10 | The story *title* is withheld until the first STORY_UPDATE. | Not in the brief's field list, but showing it on the setup screen defeats the hidden-context hook the brief is built around. |
| A11 | The host is implicitly ready; there is no READY button on the host's own controls. | Pressing START *is* their readiness. Otherwise START can never enable, which is what shipped until the visual audit caught it. |
| A12 | Locked story sections are redacted server-side rather than hidden with CSS. | Blurring still ships the text. The rest of the story would have been one devtools panel away. |
| A13 | The matrix runs 3 rounds rather than 5 for most configurations. | The round *loop* is identical at 5; the extra rounds buy wall clock, not coverage. 1, 5 and 15 rounds are each covered explicitly elsewhere. |

---

## DEFERRED / OUT OF SCOPE

Per **Section 16 — FORBIDDEN THIS SESSION**. Logged here and mirrored into README → FUTURE.

accounts · persistent profiles · matchmaking across rooms · store/DLC · community content
marketplace · AI-generated stories · voice chat · achievements · global leaderboards ·
spectators · native apps · moderation portal · i18n · analytics

Nothing on that list was built, and no role proposed anything from it. The Executive
Producer rejected two in-scope-adjacent ideas during the build:

| Proposed by | Idea | Ruling |
|---|---|---|
| Audio Designer | A procedural music loop for the lobby and the final story. | **Rejected.** The brief says "do not spend session time on a soundtrack". The mixer keeps its music channel; it is silent, and README says so. |
| Content Designer | A fifth and sixth classic story to widen the rotation. | **Rejected.** "Engine quality > content volume." Seven stories is enough to prove repeat matches without repeats; the linter and the two disguise lints matter more than the eighth story. |

---

## DEFINITION OF DONE

| | Criterion | Evidence |
|---|---|---|
| ✅ | `pnpm dev` starts client + worker with no errors or console warnings | Verified: worker answers on :8787, client on :5173, and Vite proxies `/api` through to the worker. Playwright captures zero `pageerror` and zero console errors across the whole sweep. The only log noise is `wrangler` failing to fetch Cloudflare's `Request.cf` metadata through this sandbox's egress proxy — an environment artefact, not the project's |
| ✅ | A group can open the site, create a room, share a code and join in ~10 seconds | Home → START A ROOM → code on screen; join is four letters and a name |
| ✅ | Full match at 2, 4 and 10 players, both modes, with and without the finale | Matrix **16/16** |
| ✅ | The bot harness passes the full fault-injection list | 22 cases, all green |
| ✅ | All unit + integration tests pass, including the finale balance test | **207 passing**; finale lands 29.3–33.3% across 3–10 players |
| ✅ | Visual audit screenshots captured, issues found **and fixed**, before/after logged | Phase 9 — 14 findings, all fixed |
| ✅ | No horizontal scroll or clipping at 320px on any screen | Asserted against the live DOM at every breakpoint, not eyeballed |
| ✅ | Reconnect restores identity, score and the correct phase view | Fault cases "reconnect mid-round" and "host leaves and returns" |
| ✅ | Host disconnect migrates authority; no room can become unrecoverable | Fault case "host leaves permanently"; the FSM test proves every phase can reach the lobby |
| ✅ | Every error state has a designed screen with a working action | 12 error codes, one copy source, screenshots at every width |
| ✅ | No TODO/FIXME/placeholder in any gameplay code path | `grep` clean |
| ✅ | No dead code, no unused deps, no `any` in shared or server code | 20 unused exports removed; eslint bans `any` in `shared`/`server`/`content` |
| ✅ | Bundle size recorded and within budget | **90.6 KB gzipped** initial, against 250 KB |
| ✅ | All four docs written and accurate | README · GAME_DESIGN · CONTENT_GUIDE · BUILD_LOG |
| ✅ | Git tree clean, history intact, meaningful commits | Conventional commits, one per phase gate plus audit fixes |
| ✅ | Adversarial review complete with findings fixed or documented | Phase 11; everything unfixed is in README → KNOWN LIMITATIONS |
