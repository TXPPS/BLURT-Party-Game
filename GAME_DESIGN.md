# BLURT — Game Design

> "You said it. We decide what it meant."

---

## 1. The hook

Players answer a question. They know exactly what they wrote. They have **no idea
what the game is going to do with it.**

Behind the scenes, a pre-authored story is sitting there with holes in it. Every
winning answer gets dropped into one of those holes and read back in a completely
different context. "Name something you would never want to find inside a microwave"
becomes the photograph on slide one of a corporate all-hands.

The comedy engine is **contextual mismatch**, and it only works if the disguise
holds. That is why:

- the story's **title is withheld** until the first story update — a title on the
  setup screen would give the whole thing away;
- a disguised prompt **may not share a distinctive word** with its own story's prose,
  or contain any word from its own title. Both rules are lints that fail the build
  (`content/validate.test.ts`). They caught eight real leaks during the build.

---

## 2. The loop

```
LOBBY → GAME_SETUP
  ↓
  ROUND_PROMPT → ROUND_WAITING → ROUND_REVEAL → ROUND_VOTE → ROUND_RESULTS
        ↑                                                          ↓
        └────────── STORY_UPDATE (every 2 rounds) ←────────────────┘
                                     ↓ (after the last round)
                                FINAL_STORY
                                     ↓
   DRAWING_SETUP → DRAWING_ACTIVE → DRAWING_GUESS → DRAWING_VOTE → DRAWING_RESULTS
                                     ↓ (after the last artist)
                               FINAL_RESULTS → LOBBY
```

Every phase auto-advances. The host's CONTINUE button only ever *shortens* a wait —
a room whose host wandered off still finishes the match.

| Phase | What it is | Ends when |
|---|---|---|
| `ROUND_PROMPT` | 2–3 competitors get the disguised prompt privately; everyone sees the question | all competitors submit, or the answer timer |
| `ROUND_WAITING` | a 2.6s beat, "answers are in" | fixed — the pause *is* the point |
| `ROUND_REVEAL` | answers shown anonymously side by side | 6s, or host CONTINUE |
| `ROUND_VOTE` | everyone else picks | all votes in, or the vote timer |
| `ROUND_RESULTS` | authorship revealed, points awarded | 14s, or host CONTINUE |
| `STORY_UPDATE` | the story so far, new inserts stamped in | 25s, or host CONTINUE |
| `FINAL_STORY` | line-by-line read-out of the whole thing | paced, or host CONTINUE |

---

## 3. Classic vs Crude

Same engine, same UI, different content and a different accent set.

| | Classic | Crude |
|---|---|---|
| Register | absurd, weird, mischievous, mildly suggestive | adult, vulgar, gross-out, unhinged |
| Stories | 4 | 3 (plus the classic pack — see below) |
| Name pools | 17,293 usable combinations | 32,853 (classic ∪ crude) |
| Avatars | 18 | +12, code-split, gated |
| Gate | none | explicit 18+ modal per device, per session |
| Palette | tomato / marigold / teal / grape / mint on cream | hotter, dirtier variants of the same five |
| Sound | full library | some cues substituted for gross-out equivalents, half the time |

Crude rooms draw on **both** packs. That doubles the pool the "no repeats" rule works
against, and a filthy room still enjoys a corporate horror story.

Crude mode is a `[data-mode="crude"]` attribute on the root plus a swapped palette
from `brand.ts`. **There is no second UI.**

### Content boundaries (not negotiable)

Nothing sexualising minors. Nothing non-consensual. No harassment of protected
classes. No realistic pornographic description. Nothing illegal. The joke is always
absurdity or the speaker's own dignity — never cruelty toward a group. Enforced by
`shared/blocklist.ts` at content-validation time, not by scolding players.

---

## 4. Matchmaking

`shared/matchmaking.ts`. Pure, seeded, unit-tested over 100-round runs.

**Competitors per matchup**

| Players | Competitors |
|---|---|
| 2–5 | 2 |
| 6–8 | alternates 2 / 3 by matchup index |
| 9–10 | 3 |

Never fewer than 2, never more than 3, and never fewer than 2 voters left where the
player count allows it.

**Selection: tiered least-appearances-first**

1. Bucket every eligible player by how many times they have competed.
2. Consume buckets lowest-first.
3. *Inside* a bucket, push anyone who competed in the immediately preceding matchup
   to the back, then longest-waiting first, then a seeded jitter.

Because the back-to-back rule only reorders *within* a bucket, it can never break
the balance invariant. Consuming the K smallest values of a multiset whose spread is
≤ 1 always yields a multiset whose spread is ≤ 1 — so **appearance counts never
differ by more than one**, and the tests assert it at every player count from 4 to 10.

The no-repeat rule stops applying exactly when every eligible player is level *and*
was in the last round — which is the design's own "while an eligible alternative
exists" escape hatch, and is unavoidable at 3 players.

### Two players is a first-class mode

At exactly two players there is nobody left to vote impartially, so:

- both players compete every round;
- **THE HOUSE** enters the matchup with an answer from the slot's fallback pool;
- both players vote, cannot vote for themselves, and *can* vote for the house;
- if both pick the house, the house takes the slot and both players earn an
  **OUTPLAYED BY THE HOUSE** stat, which is surfaced as an award.

### Three players

Two compete, one votes. If the single voter times out, the matchup resolves as a tie
between everything, and the winner is drawn by an announced coin flip:
**"NOBODY VOTED. THE UNIVERSE DECIDES."**

---

## 5. Scoring

All constants are named and exported from `shared/scoring.ts`. Every point in the
game is minted as a `ScoreEvent`; nothing anywhere else touches a score. That single
choke point is what lets the QA harness recompute the whole leaderboard from the
broadcast log and compare.

### Standard round — exactly as specified

| Constant | Value |
|---|---|
| `VOTE_RECEIVED` | **100** per vote |
| `MATCHUP_WIN` | **250** |
| `CLEAN_SWEEP_BONUS` | **200** (every vote, and ≥ 2 voters existed) |

### Drawing finale — tuned

| Constant | Value |
|---|---|
| `GUESSER_CORRECT` | **110** |
| `DECOY_FOOLED_SOMEONE` | **65** per player fooled |
| `ARTIST_PER_CORRECT` | **70** per identifier |
| `ARTIST_PERFECT_BONUS` | **140** |
| `FINALE_MULTIPLIER` | **0.94** — applied to all four |

**Why the finale constants differ from the brief's suggested 300 / 250 / 200 / 300.**

The brief asks for two things that cannot both hold: fixed constants *and* a finale
worth a fixed share of all points. A finale paying 300 per correct guess mints a payout for
*every voter* on *every drawing*, and at five rounds it takes roughly **64%** of the
match. Something had to give.

The standard-round constants were kept exactly as specified — they are the numbers
players see every single round — and the finale constants were tuned, which is
precisely what `tests/scoring.balance.test.ts` exists to govern.

Since everybody draws, the finale pays more people than it used to, and the share
needed moving again. Rather than rewrite the four payouts a second time and lose the
reasoning behind each, there is now a single knob — `FINALE_MULTIPLIER`, applied to
every finale payout at the point of minting. The four figures above still read as the
values the design chose; one number decides what the finale is worth overall.

### Who draws, and who gets shown

These used to be one number. They are not the same question.

| | Count |
|---|---|
| **Artists** | everybody in the room, up to 10 |
| **Showcased** | `DRAWING_SHOWCASE_MAX` = **3** |

Drawing is simultaneous, so a tenth artist costs the room nothing — one window covers
all of them. But every drawing *shown* costs a guess, a vote and a results screen, and
that is what makes a finale long: an extra showcase is 60s at FAST, 80s at NORMAL and
110s at RELAXED. So artists scale with the room and the showcase does not.

Three, not four, and that was measured rather than assumed: four pushed the worst-case
match 55–113s past where it had been, against a 60s budget. Three keeps the match
exactly the length it is today while every single player gets to draw.

**Which three.** Seeded-random among the drawings that actually arrived, preferring
artists with fewer standard-round wins — so the showcase leans towards whoever the
standard rounds passed over, and two players who both won nothing are separated by
chance rather than by something arbitrary like their player id.

**The artists who miss out** are paid `unshownArtistComp`: the *median* of what the
showcased artists earned. Median rather than mean, so one drawing everybody recognised
does not inflate what the unshown are owed and one nobody got does not deflate it —
being left out is never better or worse than average luck. The payment lands on the
last showcase screen, next to the line explaining it, because a score that moves with
no visible reason reads as a bug.

**Every drawing is shown eventually.** The end-of-match gallery carries all of them,
showcased or not, so nobody draws into a void.

### Measured balance

1,000 simulated matches per player count, using the real `resolveMatchup` /
`resolveDrawing` / matchmaking code with uniformly-random voters (the worst case for
the artist):

| Players | Artists | Shown | Standard pts/match | Finale pts/match | Finale share |
|--------:|--------:|------:|-------------------:|-----------------:|-------------:|
| 2 | 2 | 2 | 1135 | 602 | 34.7% |
| 3 | 3 | 3 | 1750 | 792 | 31.2% |
| 4 | 4 | 3 | 2745 | 965 | **26.0%** |
| 5 | 5 | 3 | 2993 | 1179 | 28.3% |
| 6 | 6 | 3 | 3179 | 1419 | **30.9%** |
| 7 | 7 | 3 | 3602 | 1667 | 31.6% |
| 8 | 8 | 3 | 4070 | 1920 | **32.1%** |
| 9 | 9 | 3 | 4255 | 2135 | 33.4% |
| 10 | 10 | 3 | 4751 | 2421 | 33.8% |

The band is **22–38%** and the measured range is **26.0–34.7%**, so there is roughly
four points of headroom at each end. The three counts the brief names (4 / 6 / 8) sit
near the middle.

Two players reads highest, which is right: with only two people a finale *should*
weigh more. It is now inside the band rather than just outside it, because everybody
drawing lifted the floor at small player counts.

### Ties

Tied answers **split `MATCHUP_WIN` equally, rounded up**, and both keep every vote
point they earned. The story slot needs exactly one winner, so it is drawn by a
seeded coin flip that is announced on screen: **"TIE. FLIPPING A COIN."** Because the
draw is seeded on room + round, it is reproducible — which is what makes announcing
it honest rather than theatrical.

---

## 6. The story engine

`shared/storyEngine.ts` — pure, so the client, the server and the tests render
byte-identical stories.

A story declares its slots once, then writes prose with `{slot_id}` placeholders.
Validation proves every placeholder resolves and every declared slot is used exactly
once, so a template can never desynchronise from its slots.

**Fewer rounds than slots.** Slots carry a `priority`; a short match takes the lowest
numbers, then plays them in narrative order. Everything skipped is filled by the
house from that slot's own fallback pool, deterministically seeded on story + slot —
so the same story always tells the same joke in the same gap.

**More rounds than slots.** The match continues into a second story, and the final
read-out plays both back to back as a double feature. A 15-round match through
10-slot stories is a normal, tested configuration.

**A rendered story never contains a visible blank or a `{placeholder}`.** That is
asserted in unit tests and again by the bot harness on every simulated match.

**Progressive unlock.** A section opens once every slot in it *that this match will
actually play* has been played. Slots the match skips are house-filled and must not
hold their section hostage — without that rule, a three-round match through a
ten-slot story would only ever reveal two sections.

---

## 7. The drawing finale

Prompts are **derived from the story the room just built**, so the artist is usually
drawing something one of *them* wrote — visual semantic types (person, creature,
object, place, possession) first, falling through to anything filled if a short match
did not produce enough. An unillustratable prompt is funnier than a finale that
cannot start.

Prompts are derived from the **whole finished story**, not just the slots a round was
spent on. A three-round match plays three slots, but the story still has ten and the
room reads all ten in the final story — the unplayed ones filled from each slot's own
pool. All ten are drawable, so a ten-player finale is about *this* story rather than
falling back to filler for most of the room.

Within that, the order is **visual first, then a player's own words ahead of authored
filler** — somebody's real answer is funnier to draw than a line the house wrote — and
**nobody is given their own answer to draw**. Drawing a phrase you wrote yourself is
the one assignment with no surprise in it: you already know what it should look like,
and the guessers are competing against your own mental image.

`content/genericPrompts.ts` is the safety net beneath all that, and with the current
content it never fires: every MVP story has ten slots and ten is the player cap. It is
not dead code, though — the schema only requires eight slots per story, so a
schema-valid future story could leave a full table one or two prompts short.

The finale splits into a **drawing half** and a **showcase half**, and they are paced
differently on purpose.

1. **DRAWING_ACTIVE** — *everybody* draws at the same time, privately, on their own
   device, inside one shared window. Eight colours, three brush sizes, undo, clear.
   Deliberately not an editor: bad drawings are the joke, and every extra tool makes
   them less bad. Everybody who is not drawing watches a live count of how many
   drawings are in and who is still working.

   This phase used to run once per artist. Drawing is solitary work — nobody watching
   gains anything from watching it — so running it in series meant a room of six spent
   three drawing timers looking at a progress bar. Simultaneous drawing costs one
   timer no matter how many artists there are.

Then, **once per showcased drawing, in sequence**, because this half *is* the show and
the whole room is meant to be looking at the same picture. Only three are shown — see
"Who draws, and who gets shown" above for why, and for what the other artists are
paid:

2. **DRAWING_GUESS** — everyone else sees the drawing and writes what they think the
   prompt was. These become the decoys.
3. **DRAWING_VOTE** — the real prompt, shuffled in with every decoy. Nobody may pick
   their own decoy (enforced server-side, not just hidden). The artist does not vote.
4. **DRAWING_RESULTS** — who wrote what, who fell for what, and the points.

Every step degrades rather than stalls: an artist who never submits still gets their
drawing shown (blank, which is funnier), a guesser who times out gets a house decoy,
and a vote nobody casts still resolves and scores zero.

Because the artists share one window, an artist who leaves mid-phase stops being
counted rather than holding the room — but the deadline is only pulled in when *every*
artist still owing a drawing has disconnected. One person dropping must never take
time away from the people still mid-picture.

---

## 8. Host settings

| Setting | Options | Default |
|---|---|---|
| Mode | Classic / Crude (18+ gate) | Classic |
| Rounds | 1–15, with QUICK 3 / STANDARD 5 / LONG 8 presets and −/+ | 5 |
| Timer | FAST 45/20s · NORMAL 75/30s · RELAXED 120/45s | Normal |
| Drawing finale | on / off | on |

The drawing window is its own setting — 60s on FAST, 90s on NORMAL, 120s on RELAXED —
rather than a multiple of the answer timer. Answering is a sentence and drawing is a
picture; there is no reason a room that wants longer to type also wants proportionally
longer to draw. Every setting is re-validated and re-clamped
server-side, so a hand-built socket message asking for 900 rounds gets 15.

The host has no READY button — pressing START **is** their readiness.

---

## 9. Awards

`shared/awards.ts`. Every award is derived from a stat the game actually tracked;
nothing is randomised. Every award also has a documented "nobody qualified" line, so
the screen is never blank and never claims something absurd.

| Award | Rule | If nobody qualifies |
|---|---|---|
| MOST VOTES | highest `votesReceived` | "Nobody voted for anybody. Bleak." |
| CROWD PLEASER | best wins ÷ appearances, min 2 appearances | "Nobody played enough rounds to prove anything." |
| PROFESSIONAL LIAR | most `playersFooled` in the finale | "Every decoy failed. This group is too honest." |
| QUESTIONABLE ARTIST | drew ≥ 1, identified by zero people | "Every drawing was identified. Suspiciously competent room." |
| PICASSO'S DISAPPOINTMENT | fewest identifications among people who drew | "Nobody drew anything. Cowards." |
| HUMAN RED FLAG | most votes on slots the content marks `tone: 'dark'` | "Nobody leaned into the dark ones. Disappointing." |
| BIGGEST TRAINWRECK | most appearances with fewest wins, min 2 appearances | "Everybody won something. Weirdly wholesome." |
| WHAT IS WRONG WITH YOU | longest answer that still won | "Everyone kept it short. How restrained." |
| GHOST | most house auto-fills | "Nobody missed a deadline. Frankly unsettling." |
| OUTPLAYED BY THE HOUSE | 2-player only: matchups lost to the house | "The house went home empty-handed." |

Ties break by (a) preferring somebody who has not already won an award, so the screen
spreads the love, then (b) higher match score, then (c) player id. No randomness.

**Highlight reel:** the three most-voted answers with attribution, the drawing whose
decoys pulled the most votes away from the truth, and the winning answer the room
voted for hardest.

---

## 10. Play again

Preserves players, names, avatars and settings. Resets scores and stats. Picks a
story the room has not played recently — each room remembers its last four.
