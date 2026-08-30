import type { StoryInput } from '../../schema.js';

/**
 * THE ANNUAL REVIEW — corporate horror.
 *
 * Design note: every disguised prompt here reads as a bar-conversation question.
 * Nothing mentions an office, a meeting, HR or a job. The comedy is the player
 * discovering that their answer to "what sound does regret make?" is now the noise
 * a legal department made in a conference room.
 */
export const annualReview: StoryInput = {
  id: 'annual_review',
  title: 'THE ANNUAL REVIEW',
  genre: 'Corporate Horror',
  mode: 'classic',
  slots: [
    {
      id: 'microwave_object',
      semanticType: 'object',
      disguisedPrompt: 'Name something you would never want to find inside a microwave.',
      charLimit: 120,
      priority: 1,
      fallback: ['a single wet glove', 'somebody’s retainer', 'four hundred paperclips'],
    },
    {
      id: 'fake_job_title',
      semanticType: 'person',
      disguisedPrompt: 'Invent a job title that absolutely should not exist.',
      charLimit: 120,
      priority: 2,
      hint: 'Say it like it is printed on a badge.',
      fallback: ['Deputy Vibes Officer', 'Senior Apology Coordinator', 'Head of Standing Nearby'],
    },
    {
      id: 'given_up_animal',
      semanticType: 'creature',
      disguisedPrompt: 'Describe an animal that has clearly given up on life.',
      charLimit: 140,
      priority: 3,
      fallback: [
        'a pigeon with one functioning leg and no ambition',
        'a goose that has stopped hissing entirely',
        'an extremely damp cat',
      ],
    },
    {
      id: 'banned_habit',
      semanticType: 'action',
      disguisedPrompt: 'What habit would get somebody permanently banned from a library?',
      charLimit: 140,
      priority: 4,
      fallback: ['humming, but only the wrong notes', 'licking the index cards', 'narrating everything aloud'],
    },
    {
      id: 'worst_nap_spot',
      semanticType: 'place',
      disguisedPrompt: 'Where is the worst possible place to fall asleep?',
      charLimit: 130,
      priority: 5,
      fallback: ['a bouncy castle at closing time', 'the fish counter', 'inside a photo booth'],
    },
    {
      id: 'hug_whisper',
      semanticType: 'phrase',
      disguisedPrompt: 'What is a terrible thing to whisper to somebody mid-hug?',
      charLimit: 140,
      priority: 6,
      tone: 'dark',
      fallback: ['I have read all of your emails', 'this is the last one of these', 'they know about the shed'],
    },
    {
      id: 'the_threat',
      semanticType: 'threat',
      disguisedPrompt: 'Finish this sentence: "Do that one more time and I will..."',
      charLimit: 150,
      priority: 7,
      tone: 'dark',
      fallback: [
        'sell your car to a man named Keith',
        'move every clock in this building forward by nine minutes',
        'tell your mother exactly what you said',
      ],
    },
    {
      id: 'regret_sound',
      semanticType: 'sound',
      disguisedPrompt: 'What sound does regret make?',
      charLimit: 120,
      priority: 8,
      fallback: ['a fridge starting up in an empty house', 'one balloon deflating slowly', 'a distant reversing lorry'],
    },
    {
      id: 'nameless_feeling',
      semanticType: 'emotion',
      disguisedPrompt: 'Name a feeling that does not have a word for it yet.',
      charLimit: 140,
      priority: 9,
      fallback: [
        'the dread of a group photo being taken',
        'the calm of hearing somebody else get told off',
        'the specific shame of waving at a stranger',
      ],
    },
    {
      id: 'sad_gift',
      semanticType: 'possession',
      disguisedPrompt: 'What is the least impressive thing a person could own two of?',
      charLimit: 130,
      priority: 10,
      fallback: ['identical broken umbrellas', 'two thirds of a chess set', 'a pair of one-litre novelty mugs'],
    },
  ],
  sections: [
    {
      id: 'open',
      revealAnimation: 'typewriter',
      audioCue: 'story_stamp',
      lines: [
        { id: 'l1', text: 'MONDAY. 9:04 AM. The all-hands begins four minutes late, which is somehow worse than an hour.' },
        { id: 'l2', text: 'HR has printed the slides. HR has printed far too many slides.' },
      ],
    },
    {
      id: 'exhibit_a',
      revealAnimation: 'slam',
      audioCue: 'gasp',
      lines: [
        { id: 'l1', text: 'Slide one is a photograph of {microwave_object}.' },
        { id: 'l2', text: 'Nobody will say who submitted it. Everybody has a theory. Two of the theories are about Deborah.' },
      ],
    },
    {
      id: 'the_promotion',
      revealAnimation: 'stamp',
      audioCue: 'ding',
      lines: [
        { id: 'l1', text: 'Management announces a new position, effective immediately: {fake_job_title}.' },
        { id: 'l2', text: 'There are no applicants. There is one volunteer, and the volunteer is {given_up_animal}.' },
        { id: 'l3', text: 'Management accepts. Management does not make eye contact while accepting.' },
      ],
    },
    {
      id: 'incident_report',
      revealAnimation: 'typewriter',
      audioCue: 'awkward_cough',
      lines: [
        { id: 'l1', text: 'An incident report is passed around. Under REASON, somebody has written: {banned_habit}.' },
        { id: 'l2', text: 'Under LOCATION, somebody has written: {worst_nap_spot}.' },
        { id: 'l3', text: 'Under ADDITIONAL NOTES, in red pen, underlined twice: "{hug_whisper}"' },
      ],
    },
    {
      id: 'the_confrontation',
      revealAnimation: 'slam',
      audioCue: 'record_scratch',
      lines: [
        { id: 'l1', text: 'Legal stands up. Legal has been waiting all year for this. Legal says, and this is a direct quote:' },
        { id: 'l2', text: '"{the_threat}"' },
        { id: 'l3', text: 'The room fills with {regret_sound}. It goes on for slightly too long.' },
        { id: 'l4', text: 'Every single person present experiences {nameless_feeling} at exactly the same moment.' },
      ],
    },
    {
      id: 'resolution',
      revealAnimation: 'stamp',
      audioCue: 'sad_trombone',
      lines: [
        { id: 'l1', text: 'The meeting ends. Somebody is presented with {sad_gift} in recognition of their service.' },
        { id: 'l2', text: 'It is Tuesday now. Nobody speaks of the Annual Review.' },
        { id: 'l3', text: 'The photograph is still on the wall. Nobody has removed it. Nobody will.' },
      ],
    },
  ],
};
