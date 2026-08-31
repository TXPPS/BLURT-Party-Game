# BLURT — Content Guide

Everything a writer or artist needs, and nothing about the engine.

Engine and content are strictly separate: **no prompt string appears in a component
or in server logic.** Everything below is data, validated on the way in by
`content/schema.ts` and checked by `pnpm lint:content` before the build.

---

## Contents

1. [Adding a story](#1-adding-a-story)
2. [Writing good disguised prompts](#2-writing-good-disguised-prompts)
3. [Adding words to the name generator](#3-adding-words-to-the-name-generator)
4. [Adding an avatar pack](#4-adding-an-avatar-pack)
5. [Adding a sound](#5-adding-a-sound)
6. [Crude mode boundaries](#6-crude-mode-boundaries)
7. [Running the linter](#7-running-the-linter)

---

## 1. Adding a story

Two steps: drop in a file, add one line to the pack index.

**`content/classic/stories/myStory.ts`**

```ts
import type { StoryInput } from '../../schema.js';

export const myStory: StoryInput = {
  id: 'the_car_boot_sale',      // snake_case, unique across the whole library
  title: 'THE CAR BOOT SALE',   // the punchline — see the warning below
  genre: 'Suburban Crime',      // one flavour line, shown with the title
  mode: 'classic',              // must match the folder it lives in

  // Declare every slot once. Minimum 8.
  slots: [
    {
      id: 'weird_item',              // snake_case, unique within this story
      semanticType: 'object',        // drives drawing-prompt selection
      disguisedPrompt: 'Name something that should not have a price on it.',
      charLimit: 130,                // 120–160
      priority: 1,                   // 1 = fill this first in a short match
      hint: 'Boring is funnier here.',   // optional, shown under the prompt
      tone: 'mild',                  // 'mild' | 'dark' — feeds HUMAN RED FLAG
      fallback: [                    // ≥ 3. Used when nobody submits.
        'a mug with somebody else’s face on it',
        'half a lawnmower',
        'a bag of assorted keys',
      ],
    },
    // …at least seven more
  ],

  // Prose with {slot_id} placeholders. A line with no placeholder is just prose.
  sections: [
    {
      id: 'setup',
      revealAnimation: 'typewriter',   // 'typewriter' | 'stamp' | 'slam'
      audioCue: 'story_stamp',         // optional; must be a real SfxEventId
      lines: [
        { id: 'l1', text: 'It is 6:40 AM and the field is already full of regret.' },
        { id: 'l2', text: 'On the third table from the left sits {weird_item}.' },
      ],
    },
  ],
};
```

**`content/classic/stories.ts`**

```ts
import { myStory } from './stories/myStory.js';

export const classicStories: readonly StoryInput[] = [
  annualReview,
  theCruise,
  parentsEvening,
  theHouseSitter,
  myStory,          // ← the only other change
];
```

### What validation will hold you to

| Rule | Why |
|---|---|
| ≥ 8 slots | shorter than that and a 5-round match is mostly house-written |
| every `{placeholder}` resolves to a declared slot | otherwise the story renders a literal `{typo}` |
| every declared slot is used **exactly once** | a slot used twice would be filled twice |
| at least one slot has `priority: 1` | short matches start somewhere |
| priorities are unique | ties make the short version non-deterministic |
| ≥ 3 fallbacks per slot, each within `charLimit` | the house should not repeat itself |
| `charLimit` between 120 and 160 | long enough for a joke, short enough to read aloud |
| section and line ids unique | the renderer keys on them |
| nothing trips the blocklist | see §6 |
| `audioCue` names a real SFX event | a typo would silently play nothing |

### Slot priorities and section order

`priority` controls what a **short match** plays. Roughly follow narrative order —
priority 1 in the first section, and so on — so a three-round game still assembles
the story front-to-back. Sections unlock as their planned slots fill; slots the match
skips are house-filled and never hold their section hostage.

### Semantic types

`person · creature · object · place · action · event · body_part · emotion · phrase ·
threat · possession · sound`

The drawing finale prefers **person, creature, object, place, possession** when
choosing what somebody has to draw. Give a story at least three or four of those or
the finale will fall back to asking somebody to draw an emotion. (Which is funny once.)

---

## 2. Writing good disguised prompts

**The prompt is the whole game.** A player must be able to answer it happily without
being able to guess where it lands.

### Do

- Write a question you would genuinely ask at a bar.
  *"What sound does regret make?"*
- Keep it self-contained. It should make sense with no context at all.
- Aim at a category, not the specific answer you have in mind.
- Prefer the mundane. "Name a completely normal thing to keep in a kitchen drawer"
  produces an answer the player is proud of and then watches become evidence.
- Use `hint` sparingly, to steer register rather than content.

### Don't

- **Don't share a distinctive word with your own story's prose.** A prompt saying
  "laminated" that lands in a sentence about laminating is not disguised.
- **Don't use a word from your own title.** "THE FAMILY GROUP CHAT" plus "invent a pet
  that would cause a *family* rift" hands over the setting.
- Don't reference the setting, the era or the cast.
- Don't ask for a fill-in-the-blank (`___`) or leak the template shape (`{`, `}`).
- Don't write a prompt whose only sensible answer is the thing you wanted.

Both "don't" rules at the top are **enforced**, not advisory —
`content/validate.test.ts` fails the build on either. During this build they caught
eight real leaks that had all been written by someone who thought they were being
careful.

### The test

Read your prompt aloud with the story hidden. If a listener can guess what kind of
story it belongs to, rewrite it.

---

## 3. Adding words to the name generator

`content/classic/names.ts` and `content/crude/names.ts`. Nine pools:

`modifier · title · given · noun · animal · food · object · occupation · adjective`

Add a word to a pool and every template using that pool gains a batch of names.
Templates live in `shared/nameGenerator.ts`:

```
[MODIFIER] [GIVEN]      Suspicious Gary
[TITLE] [NOUN]          Captain Disaster
[ADJECTIVE] [ANIMAL]    Damp Possum
[MODIFIER] [OCCUPATION] Unlicensed Plumber
[TITLE] [FOOD]          Professor Pickles
[ADJECTIVE] [OBJECT]    Rusty Trombone
[TITLE] [GIVEN]         Sergeant Brenda
[MODIFIER] [ANIMAL]     Municipal Raccoon
```

**Keep entries short.** The display limit is 20 characters *including the space*, so a
13-character word can only ever pair with a 6-character one. `pnpm lint:content`
reports how many combinations actually survive that filter (currently 17,293 classic
/ 32,853 in crude), and the tests hold the classic pack above 5,000.

Every word is checked alone **and every generated pair is checked joined**, because
the hateful phrase you are guarding against is the one that only exists across the
word boundary. `Nig` and `Ger` are both individually clean; `Nig Ger` is refused.

---

## 4. Adding an avatar pack

Avatars are React SVG components. To add one to an existing pack, write the component
and add one entry to that file's array:

```tsx
const Wheelbarrow = (): React.JSX.Element => (
  <Frame>
    <path d="M12 34h30l6 12H18z" fill="#E4572E" />
    <circle cx="20" cy="52" r="6" fill="#241C14" />
  </Frame>
);

export const classicObjects: AvatarEntry[] = [
  // …
  { id: 'wheelbarrow', name: 'Wheelbarrow', pack: 'classic', tags: ['object'], Component: Wheelbarrow },
];
```

To add a whole **new pack**, create `web/src/avatars/<pack>/pack.tsx` exporting an
`AvatarEntry[]`, then register a loader in `web/src/avatars/registry.ts`. Use a
dynamic `import()` if the pack should be code-split (the crude pack is, so a player
who never turns Crude on never downloads it).

### House style — enforced by review

- Flat colour. **No gradients, no shading, no realism.**
- Bold ink outline via `var(--c-ink)`, so the whole set re-themes with the brand.
- Three to five flat colours per icon.
- One highlight per icon uses `currentColor`, which the avatar ring sets.
- `viewBox="0 0 64 64"`, few and large details.
- **Must read as a silhouette at 40px** and still look deliberate at 128px.
- Every entry needs a real `name`; it becomes the accessible name.

The 18+ pack has an additional mandate: dumb cartoon stickers, the kind of thing
drawn on a toilet door with a marker. Nothing rendered explicitly, nothing depicting
a person, no anatomical detail.

---

## 5. Adding a sound

**There are no audio files in this project and there never will be.** Every sound is
synthesised at runtime from oscillators, a noise buffer, filters and envelopes.

1. Add the id to `SFX_EVENTS` in `shared/sfx.ts` (so content and the server can name it).
2. Add a recipe to `LIBRARY` in `web/src/audio/events.ts`.

```ts
kettle_boil: one([
  { kind: 'noise', dur: 1.2, gain: 0.15, attack: 0.3, release: 0.5,
    filter: { type: 'bandpass', freq: 900, freqEnd: 2600, q: 1.1 } },
  { kind: 'tone', wave: 'sine', freq: 320, freqEnd: 1400, dur: 1.0, gain: 0.08 },
]),
```

A `Voice` is one oscillator or one burst of noise, with an ADSR envelope, an optional
pitch glide, an optional filter sweep and optional vibrato. Layer two or three and you
have covered everything from a UI click to a sad trombone.

Give an event **two or three weighted variants** where you can — fifteen rounds of a
byte-identical `ding` is how a party game becomes annoying:

```ts
ding: [
  { weight: 2, recipe: /* … */ },
  { weight: 1, recipe: /* … */ },
],
```

Crude-only events go in `CRUDE_ONLY_SFX`; they are silent in a classic room. To swap
an existing cue for a gross-out equivalent in Crude mode, add it to
`CRUDE_SUBSTITUTIONS` — substitution happens half the time, so the real cue still
lands often enough to stay funny.

**Local vs dramatic.** Events in `LOCAL_UI_SFX` play on the device that caused them.
Everything else is driven by the server so every screen lands together, and by default
only the shared big screen plays them — a room full of phones playing the same sting
sounds like a fire alarm. Any device can opt in from its own settings.

---

## 6. Crude mode boundaries

Crude mode is meant to be filthy. Vulgar, juvenile, gross-out, profane, darkly
comedic, unhinged. That is the point of it, and this document is not going to
apologise for it.

**These five are not negotiable, in any pack, ever:**

1. Nothing sexualising minors.
2. Nothing depicting non-consensual sexual scenarios.
3. No harassment of, or punching at, protected classes.
4. No realistic pornographic description.
5. Nothing illegal.

The joke is always **absurdity, or the speaker's own dignity** — never cruelty toward
a group. A story about eleven grown men humiliating themselves in a Travelodge is the
register. A story about a group of people being the punchline for who they are is not.

`shared/blocklist.ts` enforces the hard edges on *generated* content: slur roots and
hate terms, plus a boundary list covering the categories above. It is deliberately
**not** applied to what players type — policing a player's joke is not this game's
job, and the abuse surface that actually matters (structural attacks on other
people's screens) is handled by `shared/sanitize.ts` instead.

### A note on the blocklist matcher

Two folded forms are compared, because one is not enough. Long roots match as
substrings of a form with repeated letters collapsed, which defeats `niiiigger`.
Short roots (≤ 4 characters) match whole *unsquashed* words, because collapsing them
is catastrophic: `coon` collapses to `con`, and `speed` collapses to `sped`. Adding a
short root without understanding this will start rejecting ordinary English.

Known and accepted false positive: the place name "Niger" cannot appear in generated
content. Since the list only ever gates content we author ourselves, that costs
nothing.

---

## 7. Running the linter

```bash
pnpm lint:content
```

Checks stories, the room-code wordlist, both name packs (including every generated
pair), audio cue names, and the crude content boundaries. Exits non-zero on any
failure, so bad content breaks the build rather than the party.

```
  · stories: 4 classic + 3 crude, 70 slots total, smallest story has 10
  · room codes: 923 curated words, all unique and clean
  · names: 17293 classic combinations fit in 20 chars (17435 before filtering)
  · names: 32853 combinations available in crude mode (classic + crude pools)
  · names: 32853 generated pairs checked against 43 blocked roots

✓ contentLint: all content valid.
```

The deeper content assertions — the two disguise lints, fallback lengths, priority
density — live in `content/validate.test.ts` and run with `pnpm test`.

### Adding a room code word

`shared/roomWords.ts`. Four uppercase letters, pronounceable, memorable, and boring
enough to be safe. Function words (THAT, THIS, WITH, FROM) are deliberately excluded —
a room code should sound like a thing, not like grammar. The linter enforces length,
uniqueness, the blocklist, and a floor of 500 entries.
