# BLURT — playtest kit

Everything you need to run a session, plus the sheet to fill in while you run it.

---

## The live URL

> Deployed automatically on every push to the development branch. The exact URL is
> printed into the workflow run's job summary — Actions tab, newest **deploy** run.
> See [DEPLOY.md](DEPLOY.md).

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
6. Then everyone draws at once, three get shown and guessed at, then scores. Ten minutes.

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

## How long a session actually runs

**Everybody** draws, at the same time, in one window — ten players is one drawing
timer, same as three. The showcase after it — guess, vote, results — runs once per
picture and is capped at **three**, because that half is the show and each extra one
costs the room a full guess/vote/results cycle.

Artists whose picture is not among the three still get paid (the median of what the
shown artists earned), the last showcase screen says so, and every drawing turns up in
the end-of-match gallery.

Worst case for a 3-round match with the finale, if every single phase ran to its
buzzer and nobody ever submitted early:

| Preset | Worst case | Of which is the finale | Drawing window |
|---|---|---|---|
| **FAST** | 9.7 min | 4.1 min (42%) | 60s |
| **NORMAL** | 13.2 min | 5.6 min (43%) | 90s |
| **RELAXED** | 18.2 min | 7.6 min (42%) | 120s |

These are identical at 4 and 10 players — the finale runs the same three drawings
either way, so room size changes the length of the standard rounds, not the finale.
Real sessions land well under these numbers, because every phase ends as soon as
everyone has acted.

For reference, this used to be the top pacing risk in this document: artists drew one
at a time, so NORMAL had a 21.3-minute worst case with **64%** of it drawing. It is now
13.2 minutes at 42%.

Levers, if you still want it shorter: `DRAWING_ACTIVE_MS` in `shared/constants.ts` sets
the drawing window per preset, and `DRAWING_SHOWCASE_MAX` (currently 3) caps how many
pictures the showcase has to get through. Raising the latter is what pushes match
length up — four costs 60s at FAST and 110s at RELAXED — so measure before you do. Or run the session on **FAST**, which is what
every automated run in this build uses.

**What to actually watch now.** The drawing phase ends when the last artist submits, so
the thing worth timing is the *gap* between the first drawing landing and the last. The
holding screen shows a live "3 of 4 handed in" tally — watch whether the people who
finished early get bored before the stragglers are done. If that gap is where the
energy drops, the fix is a shorter window, not a different structure.

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
- [ ] Drawing — did the artists know what to draw? ________________________
- [ ] The holding screen — did non-artists understand they were waiting, not
      stuck? Did the "N of M handed in" tally read clearly? ________________
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
| DRAWING_ACTIVE (gap between first and last drawing in) | | |
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

Continuous deployment is set up: pushing to the development branch runs `pnpm verify`
as a gate, builds, deploys to Cloudflare, and then hits the live URL to confirm it
serves the app and can create a room. A green tick means the game is actually up.

**[DEPLOY.md](DEPLOY.md)** has the details — the two repository secrets, how to trigger
a manual redeploy, how to roll back, and how to read `wrangler tail` against the live
worker.

To run the bot harness against the deployed game:

```bash
pnpm simulate --url https://YOUR-URL --players 4 --rounds 3 --mode classic --timings
```

That is the same harness the build used, over real `wss://`, and `--timings` reports
round-trip time and phase duration per phase. For reference, the identical run against
a local `wrangler dev` completes in about 22s with a 3ms median round trip — that is
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
