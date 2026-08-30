import type { StoryInput } from '../../schema.js';

/**
 * SEVEN NIGHTS AT SEA — nautical incident.
 *
 * Design note: the disguised prompts are all dry-land questions on purpose. None of
 * them mention water, boats, holidays or the sea, so nobody writes "a boat" and
 * spoils the joke by accident.
 */
export const theCruise: StoryInput = {
  id: 'seven_nights_at_sea',
  title: 'SEVEN NIGHTS AT SEA',
  genre: 'Nautical Incident',
  mode: 'classic',
  slots: [
    {
      id: 'suitcase_item',
      semanticType: 'possession',
      disguisedPrompt: 'What is one thing nobody should be allowed to pack in hand luggage?',
      charLimit: 130,
      priority: 1,
      fallback: ['a full-size garden gnome', 'nine hundred grams of loose glitter', 'a live but polite crab'],
    },
    {
      id: 'unqualified_person',
      semanticType: 'person',
      disguisedPrompt: 'Describe somebody who is confidently unqualified.',
      charLimit: 140,
      priority: 2,
      fallback: [
        'a man who learned everything from one documentary',
        'somebody wearing a lanyard they printed themselves',
        'a teenager holding a clipboard with total authority',
      ],
    },
    {
      id: 'suspicious_smell',
      semanticType: 'sound',
      disguisedPrompt: 'What noise makes you immediately assume something is broken?',
      charLimit: 130,
      priority: 3,
      fallback: ['a single distant clunk', 'the fridge making a decision', 'something rolling that should not roll'],
    },
    {
      id: 'buffet_creature',
      semanticType: 'creature',
      disguisedPrompt: 'Invent an animal that would be a terrible pet.',
      charLimit: 140,
      priority: 4,
      fallback: ['a heron with opinions', 'a badger that has learned door handles', 'something with too many elbows'],
    },
    {
      id: 'group_activity',
      semanticType: 'action',
      disguisedPrompt: 'Name an activity that becomes sinister when done by a large group.',
      charLimit: 150,
      priority: 5,
      tone: 'dark',
      fallback: ['synchronised clapping', 'humming with the eyes closed', 'all standing up at once for no reason'],
    },
    {
      id: 'forbidden_room',
      semanticType: 'place',
      disguisedPrompt: 'Where would you least like to be locked in overnight?',
      charLimit: 130,
      priority: 6,
      fallback: ['a garden centre', 'a soft play centre after closing', 'the reptile aisle of a pet shop'],
    },
    {
      id: 'captain_announcement',
      semanticType: 'phrase',
      disguisedPrompt: 'What sentence would immediately ruin a nice evening?',
      charLimit: 150,
      priority: 7,
      tone: 'dark',
      fallback: [
        'Nobody panic, but has anyone seen Gerald',
        'The good news is it is definitely not spreading',
        'We are going to need everyone to stand very still',
      ],
    },
    {
      id: 'emergency_object',
      semanticType: 'object',
      disguisedPrompt: 'Name an object that would be useless in an emergency.',
      charLimit: 130,
      priority: 8,
      fallback: ['a decorative candle', 'a laminated menu', 'one novelty oven glove'],
    },
    {
      id: 'the_feeling',
      semanticType: 'emotion',
      disguisedPrompt: 'Describe the exact feeling of getting away with something.',
      charLimit: 140,
      priority: 9,
      fallback: ['warm, illegal calm', 'the smugness of a cat on a warm bonnet', 'like laughing in a lift'],
    },
    {
      id: 'souvenir',
      semanticType: 'possession',
      disguisedPrompt: 'What is the worst thing to bring home as a souvenir?',
      charLimit: 130,
      priority: 10,
      fallback: ['a rock, taken personally', 'somebody else’s hat', 'a small unexplained bruise'],
    },
  ],
  sections: [
    {
      id: 'embarkation',
      revealAnimation: 'typewriter',
      audioCue: 'story_stamp',
      lines: [
        { id: 'l1', text: 'The brochure promised seven nights of relaxation. The brochure was written by somebody who has never met people.' },
        { id: 'l2', text: 'At the gangway, security confiscates {suitcase_item} from a passenger in cabin 214.' },
        { id: 'l3', text: 'The passenger does not explain. The passenger never explains.' },
      ],
    },
    {
      id: 'the_crew',
      revealAnimation: 'stamp',
      audioCue: 'ding',
      lines: [
        { id: 'l1', text: 'The safety briefing is delivered by {unqualified_person}.' },
        { id: 'l2', text: 'Halfway through, the ship makes {suspicious_smell}. Everybody agrees to ignore it.' },
      ],
    },
    {
      id: 'night_two',
      revealAnimation: 'slam',
      audioCue: 'gasp',
      lines: [
        { id: 'l1', text: 'On night two, something gets into the buffet. Witnesses describe {buffet_creature}.' },
        { id: 'l2', text: 'Entertainment responds by organising {group_activity} on the lido deck.' },
        { id: 'l3', text: 'Attendance is mandatory. Attendance is enthusiastic. These are not the same thing.' },
      ],
    },
    {
      id: 'deck_seven',
      revealAnimation: 'typewriter',
      audioCue: 'distant_scream',
      lines: [
        { id: 'l1', text: 'Deck seven is sealed off. Deck seven now has the atmosphere of {forbidden_room}.' },
        { id: 'l2', text: 'At 3 AM the tannoy crackles and the captain says: "{captain_announcement}"' },
        { id: 'l3', text: 'Six hundred people are handed {emergency_object} and told to remain calm.' },
      ],
    },
    {
      id: 'disembarkation',
      revealAnimation: 'stamp',
      audioCue: 'applause',
      lines: [
        { id: 'l1', text: 'Nobody is charged. Nobody is even asked. Everybody feels {the_feeling}.' },
        { id: 'l2', text: 'Cabin 214 disembarks carrying {souvenir}, which was definitely not theirs on the way out.' },
        { id: 'l3', text: 'The cruise line has already sent a survey. The cruise line should not have sent a survey.' },
      ],
    },
  ],
};
