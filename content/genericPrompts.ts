/**
 * BLURT — fallback drawing prompts.
 *
 * Drawing prompts normally come out of the story the room just built, which is the
 * whole joke: you are drawing something one of *you* wrote. But those come from slots
 * that were actually *played*, so a three-round match yields three of them — and every
 * player now draws. A ten-person, three-round game needs seven more.
 *
 * The alternative was to cut the artist count back to the prompt supply, which is
 * exactly the coupling this change exists to remove. So the shortfall is filled with
 * these instead, and the room is told nothing: an artist cannot tell whether their
 * prompt came from the story or from here, because the guessers never see either.
 *
 * Written to be drawable, guessable and mode-neutral. They appear in crude matches
 * too, so nothing here relies on being rude — the crude mode's edge comes from the
 * stories and the answers players write, not from the house.
 */

export const GENERIC_DRAWING_PROMPTS: readonly string[] = [
  'a dog that has just remembered something terrible',
  'the worst possible chair',
  'a wizard doing an ordinary job',
  'two vegetables having an argument',
  'a haunted household appliance',
  'somebody losing a fight with an umbrella',
  'a bird that has clearly been in prison',
  'the last sandwich on earth',
  'a horse wearing a suit that does not fit',
  'an alarming amount of soup',
  'a cat operating heavy machinery',
  'the moment a balloon betrays you',
  'a very confident frog',
  'somebody who has never seen stairs before',
  'a piece of furniture that has given up',
  'an octopus running late',
  'the concept of Monday, drawn literally',
  'a snowman in an unwise location',
  'a robot attempting to be casual',
  'a sheep with a secret',
];

/** Enough for a full room even when the story supplies nothing at all. */
export const GENERIC_PROMPT_CONTEXT = 'No story clause for this one — just draw it.';
