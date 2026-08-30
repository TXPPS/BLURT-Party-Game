import type { StoryInput } from '../../schema.js';

/**
 * THE STAG DO — regrettable weekend. CRUDE MODE.
 *
 * Boundaries (see CONTENT_GUIDE.md): the joke is always the participants' own
 * humiliation and bad judgement. Nothing here punches at a group, nothing describes
 * anything non-consensual, and nothing is rendered pornographically. It is a bunch
 * of grown adults being disgusting to themselves in a Travelodge.
 */
export const theStagDo: StoryInput = {
  id: 'the_stag_do',
  title: 'THE STAG DO',
  genre: 'Regrettable Weekend',
  mode: 'crude',
  slots: [
    {
      id: 'shirt_slogan',
      semanticType: 'phrase',
      disguisedPrompt: 'Write a slogan that should never be printed on a t-shirt.',
      charLimit: 140,
      priority: 1,
      fallback: ['ASK ME ABOUT MY RASH', 'I PEAKED IN 2009', 'NOT LEGALLY MY DOG'],
    },
    {
      id: 'body_situation',
      semanticType: 'body_part',
      disguisedPrompt: 'Name a body part nobody wants to hear a noise come from.',
      charLimit: 120,
      priority: 2,
      tone: 'dark',
      fallback: ['the left knee', 'somewhere behind the ribs', 'a nostril, unfortunately'],
    },
    {
      id: 'bad_shot',
      semanticType: 'object',
      disguisedPrompt: 'Invent a drink that should be illegal.',
      charLimit: 140,
      priority: 3,
      fallback: ['warm cider and a crushed mint', 'gin with a bit of gravy in it', 'something blue and slightly warm'],
    },
    {
      id: 'the_bloke',
      semanticType: 'person',
      disguisedPrompt: 'Describe the one person nobody remembers inviting.',
      charLimit: 150,
      priority: 4,
      fallback: [
        'a man called Gaz who nobody can place',
        'somebody’s cousin, allegedly',
        'a bloke in a suit who says he works "in logistics"',
      ],
    },
    {
      id: 'the_smell',
      semanticType: 'sound',
      disguisedPrompt: 'Describe the worst smell you have ever had to pretend not to notice.',
      charLimit: 150,
      priority: 5,
      tone: 'dark',
      fallback: ['hot bin', 'a wet dog that has been in a pond', 'somebody’s trainers, but warmer'],
    },
    {
      id: 'regret_venue',
      semanticType: 'place',
      disguisedPrompt: 'Name a venue that has clearly given up.',
      charLimit: 130,
      priority: 6,
      fallback: ['a pub with one working light', 'a nightclub in a garden centre', 'a bar that is also a launderette'],
    },
    {
      id: 'the_animal',
      semanticType: 'creature',
      disguisedPrompt: 'Invent an animal that would immediately ruin a party.',
      charLimit: 140,
      priority: 7,
      fallback: ['a swan with a grudge', 'a goose that has tasted lager', 'something ferrety and extremely fast'],
    },
    {
      id: 'the_charge',
      semanticType: 'event',
      disguisedPrompt: 'Invent a crime that is embarrassing rather than serious.',
      charLimit: 150,
      priority: 8,
      tone: 'dark',
      fallback: ['aggravated karaoke', 'unlawful use of a water feature', 'public wrongness'],
    },
    {
      id: 'the_receipt',
      semanticType: 'possession',
      disguisedPrompt: 'What is the worst thing to find in your own pocket the next morning?',
      charLimit: 140,
      priority: 9,
      tone: 'dark',
      fallback: ['a receipt for £412 of something called "extras"', 'somebody else’s dentures', 'a wet, folded photograph of yourself'],
    },
    {
      id: 'the_apology',
      semanticType: 'phrase',
      disguisedPrompt: 'Write an apology that makes things significantly worse.',
      charLimit: 150,
      priority: 10,
      fallback: [
        'Sorry about the thing, and also the other thing',
        'I was not myself, I was somebody worse',
        'In fairness, nobody stopped me',
      ],
    },
  ],
  sections: [
    {
      id: 'friday',
      revealAnimation: 'typewriter',
      audioCue: 'story_stamp',
      lines: [
        { id: 'l1', text: 'FRIDAY, 4:52 PM. Eleven grown men meet at a service station. Nine of them are already a problem.' },
        { id: 'l2', text: 'They are all wearing matching shirts. The shirts say: "{shirt_slogan}"' },
        { id: 'l3', text: 'The groom did not approve the shirts. The groom was not consulted about anything.' },
      ],
    },
    {
      id: 'the_first_round',
      revealAnimation: 'stamp',
      audioCue: 'airhorn',
      lines: [
        { id: 'l1', text: 'By 6 PM somebody has made a noise from {body_situation} that the group agrees to never discuss.' },
        { id: 'l2', text: 'The bar has a house speciality. The house speciality is {bad_shot}.' },
        { id: 'l3', text: 'Everybody has three. Nobody enjoys any of them.' },
      ],
    },
    {
      id: 'the_extra_man',
      revealAnimation: 'slam',
      audioCue: 'gasp',
      lines: [
        { id: 'l1', text: 'At some point the group becomes twelve. The twelfth is {the_bloke}.' },
        { id: 'l2', text: 'He is welcomed immediately. He brings with him {the_smell}, which everybody politely ignores.' },
      ],
    },
    {
      id: 'saturday',
      revealAnimation: 'typewriter',
      audioCue: 'record_scratch',
      lines: [
        { id: 'l1', text: 'Saturday is spent in {regret_venue}, which has a two-drink minimum and a one-exit maximum.' },
        { id: 'l2', text: 'Something gets in through the fire door. Reliable witnesses describe {the_animal}.' },
        { id: 'l3', text: 'Two members of the party are formally accused of {the_charge}.' },
      ],
    },
    {
      id: 'sunday',
      revealAnimation: 'stamp',
      audioCue: 'sad_trombone',
      lines: [
        { id: 'l1', text: 'SUNDAY, 11:40 AM. The groom wakes up in a corridor holding {the_receipt}.' },
        { id: 'l2', text: 'He sends one message to the group chat: "{the_apology}"' },
        { id: 'l3', text: 'Nobody replies for four days. The twelfth man replies immediately. Nobody knows how he got the number.' },
      ],
    },
  ],
};
