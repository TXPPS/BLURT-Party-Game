import type { StoryInput } from '../../schema.js';

/**
 * THE ROUTINE CHECK-UP — bodily betrayal. CRUDE MODE.
 *
 * Boundaries: medical-humiliation comedy, aimed squarely at the narrator's own body.
 * No real conditions are mocked, nobody is a punchline for who they are, and every
 * gross-out is something a human body genuinely does at an inconvenient moment.
 */
export const theCheckUp: StoryInput = {
  id: 'the_routine_checkup',
  title: 'THE ROUTINE CHECK-UP',
  genre: 'Bodily Betrayal',
  mode: 'crude',
  slots: [
    {
      id: 'form_answer',
      semanticType: 'phrase',
      disguisedPrompt: 'Write an answer that should never appear on a form.',
      charLimit: 140,
      priority: 1,
      fallback: ['Prefer not to say, but yes', 'Only on weekends', 'Define "regularly"'],
    },
    {
      id: 'the_noise',
      semanticType: 'sound',
      disguisedPrompt: 'Describe a noise a human body should not be able to make.',
      charLimit: 140,
      priority: 2,
      tone: 'dark',
      fallback: ['a long, thoughtful creak', 'something between a hiccup and a foghorn', 'a wet click'],
    },
    {
      id: 'the_area',
      semanticType: 'body_part',
      disguisedPrompt: 'Name the worst place to develop an itch.',
      charLimit: 120,
      priority: 3,
      tone: 'dark',
      fallback: ['directly behind the eye', 'the exact middle of the back', 'somewhere legally unreachable'],
    },
    {
      id: 'the_doctor',
      semanticType: 'person',
      disguisedPrompt: 'Describe somebody you would not want holding a clipboard about you.',
      charLimit: 150,
      priority: 4,
      fallback: [
        'a man who says "interesting" four times',
        'somebody who keeps looking at the door',
        'a woman visibly enjoying this',
      ],
    },
    {
      id: 'the_instrument',
      semanticType: 'object',
      disguisedPrompt: 'Invent a tool that would be terrifying in the wrong hands.',
      charLimit: 140,
      priority: 5,
      tone: 'dark',
      fallback: ['a very confident pair of tongs', 'something cold with a handle', 'a device with only one setting'],
    },
    {
      id: 'the_diet',
      semanticType: 'action',
      disguisedPrompt: 'Describe how somebody with no self-control gets through a week.',
      charLimit: 150,
      priority: 6,
      fallback: [
        'breakfast is whatever is closest',
        'a diet consisting largely of sauce',
        'liquids only, but the wrong liquids',
      ],
    },
    {
      id: 'the_result',
      semanticType: 'event',
      disguisedPrompt: 'Invent a piece of news that is bad but also very funny.',
      charLimit: 150,
      priority: 7,
      tone: 'dark',
      fallback: [
        'you are technically fine but nobody can explain why',
        'it is not contagious, it is just loud',
        'the good news is it has a name now',
      ],
    },
    {
      id: 'the_creature',
      semanticType: 'creature',
      disguisedPrompt: 'Invent something that could live in a shoe for a year undetected.',
      charLimit: 140,
      priority: 8,
      fallback: ['a very committed beetle', 'something soft with plans', 'a small, patient crab'],
    },
    {
      id: 'waiting_room',
      semanticType: 'place',
      disguisedPrompt: 'Describe the most uncomfortable place to wait forty minutes.',
      charLimit: 140,
      priority: 9,
      fallback: ['a corridor with one chair and no clock', 'a room where everybody knows why you are there', 'a lift that has stopped'],
    },
    {
      id: 'the_advice',
      semanticType: 'phrase',
      disguisedPrompt: 'Give advice that is technically correct and completely unhelpful.',
      charLimit: 150,
      priority: 10,
      fallback: ['try doing less of it', 'that will either settle down or it will not', 'drink water, but angrily'],
    },
  ],
  sections: [
    {
      id: 'reception',
      revealAnimation: 'typewriter',
      audioCue: 'story_stamp',
      lines: [
        { id: 'l1', text: 'It is a routine check-up. Everybody has agreed to call it routine.' },
        { id: 'l2', text: 'On the intake form, under LIFESTYLE, the patient has written: "{form_answer}"' },
        { id: 'l3', text: 'Reception photocopies it twice, which is one more time than necessary.' },
      ],
    },
    {
      id: 'the_wait',
      revealAnimation: 'stamp',
      audioCue: 'awkward_cough',
      lines: [
        { id: 'l1', text: 'The waiting area has the specific energy of {waiting_room}.' },
        { id: 'l2', text: 'At 10:14 the patient produces {the_noise}. Four other patients look up. Nobody says anything.' },
      ],
    },
    {
      id: 'the_examination',
      revealAnimation: 'slam',
      audioCue: 'gasp',
      lines: [
        { id: 'l1', text: 'The consultation is conducted by {the_doctor}.' },
        { id: 'l2', text: 'The chief complaint is recorded as: persistent trouble with {the_area}.' },
        { id: 'l3', text: 'A tool is produced from a drawer. It is {the_instrument}.' },
        { id: 'l4', text: 'The patient is asked to relax. This is, at this point, an unreasonable request.' },
      ],
    },
    {
      id: 'the_history',
      revealAnimation: 'typewriter',
      audioCue: 'record_scratch',
      lines: [
        { id: 'l1', text: 'Asked about diet, the patient describes {the_diet}, at length, with visible pride.' },
        { id: 'l2', text: 'The results come back. The results say: {the_result}.' },
        { id: 'l3', text: 'Also, and separately, they have found {the_creature}. It is doing fine.' },
      ],
    },
    {
      id: 'discharge',
      revealAnimation: 'stamp',
      audioCue: 'sad_trombone',
      lines: [
        { id: 'l1', text: 'The patient is discharged with one line of medical advice: "{the_advice}"' },
        { id: 'l2', text: 'A follow-up is booked for six months. Everybody involved knows it will not be attended.' },
        { id: 'l3', text: 'The creature is sent home too. Nobody wanted to be the one to decide otherwise.' },
      ],
    },
  ],
};
