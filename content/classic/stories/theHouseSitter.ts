import type { StoryInput } from '../../schema.js';

/**
 * THE HOUSE SITTER — domestic thriller.
 *
 * Design note: the strongest disguised prompts here are the mundane ones. "What is
 * a normal thing to keep in a drawer" produces an answer the player is proud of and
 * then watches become evidence.
 */
export const theHouseSitter: StoryInput = {
  id: 'the_house_sitter',
  title: 'THE HOUSE SITTER',
  genre: 'Domestic Thriller',
  mode: 'classic',
  slots: [
    {
      id: 'drawer_thing',
      semanticType: 'object',
      disguisedPrompt: 'Name a completely normal thing to keep in a kitchen drawer.',
      charLimit: 120,
      priority: 1,
      hint: 'Boring is funnier here. Trust us.',
      fallback: ['batteries of three different sizes', 'a takeaway menu from 2011', 'one unexplained key'],
    },
    {
      id: 'house_rule',
      semanticType: 'phrase',
      disguisedPrompt: 'Write a rule that sounds reasonable but is quietly alarming.',
      charLimit: 150,
      priority: 2,
      tone: 'dark',
      fallback: [
        'Please do not open the second fridge',
        'The upstairs bathroom is for guests we like',
        'If it knocks twice, it is not the postman',
      ],
    },
    {
      id: 'the_pet',
      semanticType: 'creature',
      disguisedPrompt: 'Describe a pet that is clearly plotting something.',
      charLimit: 140,
      priority: 3,
      fallback: ['a cat that maintains eye contact through walls', 'a parrot with a filing system', 'an extremely still rabbit'],
    },
    {
      id: 'basement_place',
      semanticType: 'place',
      disguisedPrompt: 'Describe a room you would leave immediately.',
      charLimit: 140,
      priority: 4,
      fallback: ['a beige room with one chair facing the corner', 'somewhere with a drain in the middle', 'a room with too many light switches'],
    },
    {
      id: 'neighbour',
      semanticType: 'person',
      disguisedPrompt: 'Describe somebody you would not want as a neighbour.',
      charLimit: 140,
      priority: 5,
      fallback: ['a man who mows at night', 'somebody who waves before you do', 'a woman with six identical vans'],
    },
    {
      id: 'the_noise',
      semanticType: 'sound',
      disguisedPrompt: 'What sound would make you leave a building?',
      charLimit: 130,
      priority: 6,
      tone: 'dark',
      fallback: ['polite knocking from inside a wall', 'a kettle that nobody filled', 'one very slow footstep, repeated'],
    },
    {
      id: 'the_habit',
      semanticType: 'action',
      disguisedPrompt: 'Name something people do when they think nobody is watching.',
      charLimit: 140,
      priority: 7,
      fallback: ['practising an argument in the mirror', 'eating standing up over the bin', 'rehearsing a handshake'],
    },
    {
      id: 'found_item',
      semanticType: 'possession',
      disguisedPrompt: 'What would be the worst thing to find under a bed?',
      charLimit: 130,
      priority: 8,
      tone: 'dark',
      fallback: ['a shoebox with your own name on it', 'a spare set of your keys', 'forty identical birthday cards'],
    },
    {
      id: 'the_note',
      semanticType: 'threat',
      disguisedPrompt: 'Write a short note that would ruin somebody’s week.',
      charLimit: 150,
      priority: 9,
      tone: 'dark',
      fallback: ['We need to talk about the loft.', 'I moved everything one inch to the left.', 'Thanks for Tuesday. We all saw.'],
    },
    {
      id: 'final_feeling',
      semanticType: 'emotion',
      disguisedPrompt: 'Describe the feeling of being somewhere you should not be.',
      charLimit: 140,
      priority: 10,
      fallback: ['loud silence', 'the fizz of being about to be caught', 'like standing in somebody else’s shoes'],
    },
  ],
  sections: [
    {
      id: 'the_handover',
      revealAnimation: 'typewriter',
      audioCue: 'story_stamp',
      lines: [
        { id: 'l1', text: 'They said it would be easy. Ten days, one house, one small list of instructions.' },
        { id: 'l2', text: 'The list is on the fridge, held up by {drawer_thing}.' },
        { id: 'l3', text: 'Rule one, written in careful capitals: "{house_rule}"' },
      ],
    },
    {
      id: 'day_one',
      revealAnimation: 'stamp',
      audioCue: 'ding',
      lines: [
        { id: 'l1', text: 'Day one is fine. Day one is genuinely lovely.' },
        { id: 'l2', text: 'The only complication is the pet, which is {the_pet}.' },
      ],
    },
    {
      id: 'day_four',
      revealAnimation: 'slam',
      audioCue: 'gasp',
      lines: [
        { id: 'l1', text: 'On day four, a door that was locked is not locked. Behind it is {basement_place}.' },
        { id: 'l2', text: 'At 11 PM, {neighbour} knocks to ask whether everything is alright.' },
        { id: 'l3', text: 'Everything is alright. Everything is extremely alright. Please stop asking.' },
      ],
    },
    {
      id: 'day_seven',
      revealAnimation: 'typewriter',
      audioCue: 'distant_scream',
      lines: [
        { id: 'l1', text: 'Day seven brings {the_noise}, at the same time, twice.' },
        { id: 'l2', text: 'The security camera in the hallway has recorded ten days of somebody {the_habit}.' },
        { id: 'l3', text: 'Under the spare bed there is {found_item}. It has been there longer than the bed.' },
      ],
    },
    {
      id: 'the_return',
      revealAnimation: 'stamp',
      audioCue: 'sad_trombone',
      lines: [
        { id: 'l1', text: 'They come home a day early. On the hall table, in the same careful capitals, is a note:' },
        { id: 'l2', text: '"{the_note}"' },
        { id: 'l3', text: 'Nobody says anything for a while. The house feels like {final_feeling}.' },
        { id: 'l4', text: 'The pet has not moved. The pet has not moved for some time.' },
      ],
    },
  ],
};
