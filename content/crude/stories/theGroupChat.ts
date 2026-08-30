import type { StoryInput } from '../../schema.js';

/**
 * THE FAMILY GROUP CHAT — digital warfare. CRUDE MODE.
 *
 * Boundaries: the target is a family being appalling to each other in a way every
 * family recognises. Vulgar, petty, escalating. Nobody is attacked for who they are,
 * and the worst thing that happens to anybody is being screenshotted.
 */
export const theGroupChat: StoryInput = {
  id: 'the_family_group_chat',
  title: 'THE FAMILY GROUP CHAT',
  genre: 'Digital Warfare',
  mode: 'crude',
  slots: [
    {
      id: 'chat_name',
      semanticType: 'phrase',
      disguisedPrompt: 'Invent a name for a club that nobody wants to be in.',
      charLimit: 130,
      priority: 1,
      fallback: ['LOGISTICS 🎈🎈', 'the good ones', 'PLEASE READ (again)'],
    },
    {
      id: 'the_photo',
      semanticType: 'object',
      disguisedPrompt: 'Describe a photograph that should never have been taken.',
      charLimit: 150,
      priority: 2,
      tone: 'dark',
      fallback: [
        'a very close-up picture of a foot, unexplained',
        'somebody asleep with their mouth fully open',
        'a bathroom mirror selfie taken by a man aged sixty-one',
      ],
    },
    {
      id: 'the_message',
      semanticType: 'phrase',
      disguisedPrompt: 'Write six words that would end a friendship on the spot.',
      charLimit: 150,
      priority: 3,
      tone: 'dark',
      fallback: ['she has NO idea', 'don’t tell the others what I paid', 'ok but he is definitely the worst one'],
    },
    {
      id: 'the_relative',
      semanticType: 'person',
      disguisedPrompt: 'Describe somebody who is always slightly too involved.',
      charLimit: 150,
      priority: 4,
      fallback: [
        'a woman who has "just heard" everything',
        'somebody who replies to their own messages',
        'a man who forwards things without reading them',
      ],
    },
    {
      id: 'the_argument',
      semanticType: 'event',
      disguisedPrompt: 'Invent an argument that is somehow about nothing and everything.',
      charLimit: 150,
      priority: 5,
      fallback: ['a fifteen-year dispute about a casserole dish', 'who exactly said "fine"', 'the true ownership of a stepladder'],
    },
    {
      id: 'the_smell_gift',
      semanticType: 'possession',
      disguisedPrompt: 'What is the worst possible gift to receive from a relative?',
      charLimit: 140,
      priority: 6,
      fallback: ['a used candle', 'a framed photo of them', 'a jar of something homemade and moving'],
    },
    {
      id: 'the_animal',
      semanticType: 'creature',
      disguisedPrompt: 'Invent a pet that would split a household in two.',
      charLimit: 140,
      priority: 7,
      fallback: ['a parrot that repeats the wrong things', 'a dog that only likes one person', 'a lizard named after a grandparent'],
    },
    {
      id: 'the_venue',
      semanticType: 'place',
      disguisedPrompt: 'Where is the worst place to hold a large birthday party?',
      charLimit: 140,
      priority: 8,
      fallback: ['a soft play centre', 'the back room of a carvery', 'somebody’s garage, in February'],
    },
    {
      id: 'the_threat',
      semanticType: 'threat',
      disguisedPrompt: 'Write a threat that only somebody who raised you could make.',
      charLimit: 150,
      priority: 9,
      tone: 'dark',
      fallback: [
        'I still have the video from your eighteenth',
        'I will be telling your mother the long version',
        'I am changing the will, and I am telling everyone',
      ],
    },
    {
      id: 'the_signoff',
      semanticType: 'phrase',
      disguisedPrompt: 'Write the last thing somebody says before leaving a room forever.',
      charLimit: 130,
      priority: 10,
      fallback: ['anyway. love you. x', 'no worries either way!!', 'sent from my phone, deliberately'],
    },
  ],
  sections: [
    {
      id: 'the_chat',
      revealAnimation: 'typewriter',
      audioCue: 'story_stamp',
      lines: [
        { id: 'l1', text: 'There are nineteen members. Four of them have never spoken. One of them is a phone in a drawer.' },
        { id: 'l2', text: 'The chat is called "{chat_name}". It has been renamed six times, always without a vote.' },
      ],
    },
    {
      id: 'tuesday',
      revealAnimation: 'slam',
      audioCue: 'gasp',
      lines: [
        { id: 'l1', text: 'On Tuesday at 06:41, somebody sends {the_photo}.' },
        { id: 'l2', text: 'Four seconds later, and to the wrong chat entirely, they send: "{the_message}"' },
        { id: 'l3', text: 'It is deleted. It is not deleted fast enough. Three people have already screenshotted it.' },
      ],
    },
    {
      id: 'escalation',
      revealAnimation: 'stamp',
      audioCue: 'airhorn',
      lines: [
        { id: 'l1', text: 'The first to respond is {the_relative}, who has been waiting eleven years for this exact moment.' },
        { id: 'l2', text: 'Within an hour the chat has reopened {the_argument}, which everybody swore was finished.' },
        { id: 'l3', text: 'Somebody brings up {the_smell_gift}, from Christmas, from four Christmases ago.' },
      ],
    },
    {
      id: 'the_summit',
      revealAnimation: 'typewriter',
      audioCue: 'record_scratch',
      lines: [
        { id: 'l1', text: 'A family meeting is called. The venue is {the_venue}, because the good venue said no.' },
        { id: 'l2', text: 'Somebody brings {the_animal}, uninvited, and refuses to explain the reasoning.' },
        { id: 'l3', text: 'At 4 PM, an aunt stands up and says: "{the_threat}"' },
      ],
    },
    {
      id: 'aftermath',
      revealAnimation: 'stamp',
      audioCue: 'sad_trombone',
      lines: [
        { id: 'l1', text: 'Eleven people leave the chat. Nine of them are added back within the hour.' },
        { id: 'l2', text: 'The final message of the day reads, in full: "{the_signoff}"' },
        { id: 'l3', text: 'Nobody responds. The chat stays quiet for six weeks, which everybody agrees is the best it has ever been.' },
      ],
    },
  ],
};
