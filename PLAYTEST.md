# BLURT — playtest kit

Everything you need to run a session, plus the sheet to fill in while you run it.

---

## The live URL

> **NOT YET DEPLOYED.** This session could not reach Cloudflare — see
> [Deploying](#deploying) below for the one command that fills this in.

```
LIVE URL:  ______________________________________________
ROOM CODE: ____  (four letters, shown on the shared screen)
DATE:      ____________   PLAYERS: ____   MODE: Classic / Crude
```

---

## How to play — read this out loud

1. Open the link on your phone. Type the four letters on the big screen, pick a name.
2. A question appears on your phone. Answer it fast — your first instinct is the funny one.
3. Two answers go head to head. Vote for the better one. You can't vote for your own.
4. Winning answers get quietly filed into a story nobody has seen yet.
5. At the end the story is read out with your answers wedged into it. That's the joke.
6. Then a drawing round — a few of you draw, everyone else guesses — and then scores.

---

## Before everyone arrives

- **Shared screen.** Open the URL on the TV or laptop and press START A ROOM. That
  device is the host: it shows the code, the story and the results. Everyone else
  just needs the code.
- **Turn the sound up on the shared screen only.** Stings default to on for the host
  and the big screen, and off for phones, so the room does not echo.
- **Pick Classic** for a first session. Crude is funnier with people who know each
  other and it gates behind an age check that will slow a first-timer down.
- **Two players is enough** to try it; four to eight is where it works.

---

## Watch the clock on the drawing round

The single biggest pacing risk, and the main thing this session is for.

The finale runs artists **one after another**: up to four in a room of five or fewer,
up to three from six players up, and never more than the story has drawing prompts for
(a 4-player test run produced three, not four). Each artist gets `answerMs × 2.5` to
draw — **3 minutes 7 seconds** at NORMAL.

At NORMAL timing, if every phase ran to its buzzer, a 3-round match with the finale is:

| Room | Worst case | Of which is drawing time |
|---|---|---|
| 3 artists | 21.2 min | 9.4 min (44%) |
| 4 artists | 25.8 min | 12.5 min (49%) |

Each drawing phase ends the moment that artist submits, so in practice it is far
shorter. But the artists go **one at a time**, so a single slow person leaves everybody
else watching a progress bar — and a small room gets *more* artists, not fewer.

If the room stalls there, the levers in `shared/constants.ts` are
`DRAWING_TIME_MULTIPLIER` (currently `2.5×` the answer timer) and `DRAWING_MAX_ARTISTS`
(currently 4). Or just run the session on **FAST**, which is what every automated run
in this build uses.

Also worth knowing: "Budget fifteen minutes" in the read-aloud above is a realistic
expectation, not the worst case. If your session runs to 25 minutes, the table above
is why.

---

## Reading the pacing afterwards

The server logs one line per phase entry and exit. Nothing is persisted and no answer
text is ever logged — counts and phase names only.

```bash
# --search filters at the edge, so only the pacing lines come down the wire
npx wrangler tail --config server/wrangler.toml --format pretty --search '[blurt]'
```

To keep a copy of the session to read afterwards:

```bash
npx wrangler tail --config server/wrangler.toml --format json --search '[blurt]' \
  | tee playtest-$(date +%F).log
```

```
[blurt] PARK enter ROUND_PROMPT round=2/3 eligible=4 connected=4 seated=4 budget=75.0s
[blurt] PARK exit  ROUND_PROMPT reason=all-submitted after=18.3s round=2/3 eligible=4 …
```

- `reason=all-submitted` — everyone answered. Good.
- `reason=timeout` — the phase ran out. **Somebody was stuck, bored, or confused.**
- `reason=host` — you pressed continue.
- `eligible` vs `seated` — a gap means somebody dropped and the room is holding a seat.

Grep `reason=timeout` first. Every one is a place a real person did not do the thing
the screen asked for, which is more reliable than anyone's memory of the session.

---

## Observation checklist

Fill this in *during* the session. The specific numbers matter more than impressions.

**1. Time to join** — from handing someone the link to their name on screen.

| Player | Device | Seconds | Got stuck on |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |

Anyone over 45 seconds: what were they looking at? ______________________________

**2. Any phase where players looked confused.** Tick the phase, note who and why.

- [ ] Picking a name / avatar → ____________________________________________
- [ ] First prompt — did they understand it was a question? _______________
- [ ] Voting — did anyone try to vote for themselves? _____________________
- [ ] The story reveal — did they get that their answer was in it? ________
- [ ] Drawing — did the artist know what to draw? _________________________
- [ ] Guessing — did they understand they were writing a fake prompt? _____
- [ ] Final results / awards → _____________________________________________

**3. Any screen nobody read.** Watch their eyes, not the screen.

| Screen | Anyone read it? | Should it be shorter / louder / gone? |
|---|---|---|
| Story so far (STORY_UPDATE) | | |
| Round results | | |
| Final story | | |
| Awards | | |

**4. Any moment the room felt like it stalled.** Note the phase and roughly how long.

| Phase | How long it felt | What people did while waiting |
|---|---|---|
| | | |
| | | |
| | | |

Cross-check against `reason=timeout` in the tail afterwards.

**5. Laughs per round.** Tally actual audible laughs. This is the only score that matters.

| Round | Laughs on the answers | Laughs on the story reveal |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| Drawing finale | | |

**6. Did anyone ask "wait, what do I do now?"** Write the exact words and the phase.

| Phase | What they said |
|---|---|
| | |
| | |

If this happened more than twice, the phase is not explaining itself and no amount of
polish elsewhere will fix it.

**7. Closing questions** — ask the room, do not guess.

- Would you play again right now? (count the yeses) ______ / ______
- What was the single funniest moment? _____________________________________
- Did anything feel too long? ______________________________________________
- Did anyone not get a turn to be funny? ___________________________________

---

## Deploying

Deployment did not happen in the build session. Two independent blockers, both
outside the code:

1. **No Cloudflare credentials.** `wrangler whoami` reports not authenticated, and
   `wrangler login` needs an interactive browser.
2. **Egress policy.** Every Cloudflare host — `api.cloudflare.com`,
   `dash.cloudflare.com`, `workers.dev` — answers `403` to CONNECT through this
   environment's proxy. So `wrangler deploy` fails on network before it ever reaches
   the credential question.

From a machine with normal network access:

```bash
npx wrangler login                                   # once
pnpm build
npx wrangler deploy --config server/wrangler.toml
```

The first deploy applies migration tag `v1`, which creates the `RoomDO` Durable
Object class with `new_sqlite_classes`. Wrangler prints the migration and the
`*.workers.dev` URL. Paste that URL at the top of this file.

Then verify the deployment against the real edge:

```bash
# The SPA is served by the assets binding
curl -sS -o /dev/null -w '%{http_code}\n' https://YOUR-URL/

# The Worker answers before the SPA fallback (run_worker_first)
curl -sS https://YOUR-URL/api/health          # {"ok":true,"service":"blurt"}

# A full 3-round Classic match with the finale, over real WebSockets,
# with per-phase round-trip latency
pnpm simulate --url https://YOUR-URL --players 4 --rounds 3 --mode classic --timings
```

That last command is the one worth keeping. It is the same harness the build used, it
speaks the real protocol over `wss://`, and `--timings` reports round-trip time and
phase duration per phase. For reference, the identical run against a local
`wrangler dev` completes in **33.8s** with a **3ms** median round trip — that is
loopback, so treat it as the floor and expect the edge numbers to be the real ones.

---

## Known gotchas for a first session

- **Each browser tab is a separate player.** Identity is stored per-tab on purpose, so
  a second tab joins as somebody new rather than hijacking a seat. Do not test with
  two tabs and expect one player.
- **A started game refuses new joiners.** Get everyone in during the lobby.
- **Room codes are four letters and guessable.** Fine for a living room; do not post
  the code publicly.
- **Closing the shared screen does not end the room.** Host authority migrates to
  whoever is still there, so if the TV browser is shut by accident, reopen the link
  and rejoin with the same code — the match is still running. A room expires 30
  minutes after it goes quiet, or 4 hours after it was created, whichever comes first.
- **Nothing survives that.** No accounts, no history, no saved scores, by design. When
  the room expires the match is gone.
- **The music channel is silent.** There is no soundtrack — only synthesised effects.
  That is expected, not a broken asset.
