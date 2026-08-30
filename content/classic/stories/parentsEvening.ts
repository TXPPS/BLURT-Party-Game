import type { StoryInput } from '../../schema.js';

/**
 * PARENTS' EVENING — educational catastrophe.
 *
 * Design note: this one leans on authority-figure comedy. The prompts are about
 * personal shame and bad decisions; the story quietly reassigns every answer to a
 * school hall on a Wednesday in November.
 */
export const parentsEvening: StoryInput = {
  id: 'parents_evening',
  title: "PARENTS' EVENING",
  genre: 'Educational Catastrophe',
  mode: 'classic',
  slots: [
    {
      id: 'bad_hobby',
      semanticType: 'action',
      disguisedPrompt: 'Name a hobby that is a cry for help.',
      charLimit: 130,
      priority: 1,
      fallback: ['competitive lawn edging', 'collecting other people’s receipts', 'reviewing bins online'],
    },
    {
      id: 'unwise_purchase',
      semanticType: 'possession',
      disguisedPrompt: 'What is the most unwise thing to buy at 2 AM?',
      charLimit: 130,
      priority: 2,
      fallback: ['a second kayak', 'a ninety-piece drum kit', 'four metres of artificial hedge'],
    },
    {
      id: 'weird_talent',
      semanticType: 'person',
      disguisedPrompt: 'Describe somebody with exactly one impressive skill and no other qualities.',
      charLimit: 150,
      priority: 3,
      fallback: [
        'a man who can name any cheese but cannot drive',
        'somebody incredible at parking and nothing else',
        'a woman who is undefeated at arm wrestling and otherwise unemployed',
      ],
    },
    {
      id: 'wall_object',
      semanticType: 'object',
      disguisedPrompt: 'What is the most upsetting thing to find in a lost-property box?',
      charLimit: 130,
      priority: 4,
      fallback: ['a single child-sized shoe', 'a doctor’s note from 1998', 'somebody’s entire trousers'],
    },
    {
      id: 'the_excuse',
      semanticType: 'phrase',
      disguisedPrompt: 'What is the least convincing excuse you have ever heard?',
      charLimit: 150,
      priority: 5,
      fallback: [
        'the dog was involved but not responsible',
        'I was there but only in a supervisory role',
        'technically the ceiling started it',
      ],
    },
    {
      id: 'hall_creature',
      semanticType: 'creature',
      disguisedPrompt: 'Invent a creature that lives in a place it definitely should not.',
      charLimit: 140,
      priority: 6,
      fallback: ['a heron living in a stairwell', 'a fox that has learned the vending machine', 'something large behind the radiator'],
    },
    {
      id: 'punishment',
      semanticType: 'threat',
      disguisedPrompt: 'Invent a punishment that is technically legal but deeply unfair.',
      charLimit: 150,
      priority: 7,
      tone: 'dark',
      fallback: [
        'being read your own text messages aloud',
        'a two-hour presentation about your own behaviour',
        'sitting in a chair that is one inch too low',
      ],
    },
    {
      id: 'unwanted_place',
      semanticType: 'place',
      disguisedPrompt: 'Where is the worst place to run into somebody you know?',
      charLimit: 130,
      priority: 8,
      fallback: ['a walk-in freezer', 'the returns desk', 'a very quiet swimming pool'],
    },
    {
      id: 'awful_sound',
      semanticType: 'sound',
      disguisedPrompt: 'Describe a sound that makes everyone in a room stop talking.',
      charLimit: 130,
      priority: 9,
      fallback: ['one chair leg dragging', 'a phone ringing with the old ringtone', 'a slow, deliberate cough'],
    },
    {
      id: 'closing_feeling',
      semanticType: 'emotion',
      disguisedPrompt: 'Name the feeling you get when it is finally over.',
      charLimit: 130,
      priority: 10,
      fallback: ['relief with a small hole in it', 'the flatness after applause', 'clean, echoing nothing'],
    },
  ],
  sections: [
    {
      id: 'arrival',
      revealAnimation: 'typewriter',
      audioCue: 'story_stamp',
      lines: [
        { id: 'l1', text: 'The school hall smells of floor polish and quiet resentment. It is 6:15 PM on a Wednesday in November.' },
        { id: 'l2', text: 'Under ENRICHMENT ACTIVITIES, the noticeboard now offers {bad_hobby}.' },
        { id: 'l3', text: 'Four parents have signed up. Two of them are the same parent.' },
      ],
    },
    {
      id: 'the_fundraiser',
      revealAnimation: 'stamp',
      audioCue: 'ding',
      lines: [
        { id: 'l1', text: 'The PTA reveals what it spent the fundraiser money on: {unwise_purchase}.' },
        { id: 'l2', text: 'A vote is held. The vote is not close. The vote changes nothing.' },
      ],
    },
    {
      id: 'the_new_teacher',
      revealAnimation: 'slam',
      audioCue: 'gasp',
      lines: [
        { id: 'l1', text: 'The new head of department is introduced. He is {weird_talent}.' },
        { id: 'l2', text: 'He has laminated {wall_object} and put it above the door as a motivational message.' },
        { id: 'l3', text: 'Nobody has asked him to explain it. Nobody is going to.' },
      ],
    },
    {
      id: 'the_meeting',
      revealAnimation: 'typewriter',
      audioCue: 'awkward_cough',
      lines: [
        { id: 'l1', text: 'At table four, a parent is asked to account for the incident. The parent replies: "{the_excuse}"' },
        { id: 'l2', text: 'The incident, for the record, involved {hall_creature} and eleven minutes of screaming.' },
        { id: 'l3', text: 'The agreed consequence is {punishment}, starting Monday.' },
      ],
    },
    {
      id: 'the_car_park',
      revealAnimation: 'slam',
      audioCue: 'record_scratch',
      lines: [
        { id: 'l1', text: 'On the way out, everybody runs into everybody else, in what can only be described as the social equivalent of {unwanted_place}.' },
        { id: 'l2', text: 'Somewhere behind the stage, there is {awful_sound}. Two hundred adults pretend not to hear it.' },
        { id: 'l3', text: 'By 8:40 PM the hall is empty and the whole building feels like {closing_feeling}.' },
      ],
    },
  ],
};
