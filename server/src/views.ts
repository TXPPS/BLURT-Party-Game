/**
 * BLURT — projecting authoritative state down to what a screen may see.
 *
 * This is the redaction boundary. Two rules are enforced here and nowhere else:
 *
 *   1. **No authorship before the vote resolves.** `ROUND_REVEAL` and `ROUND_VOTE`
 *      build `RevealAnswer`, a type with no author field at all, so a leak is a
 *      compile error rather than a code-review question.
 *   2. **No private prompt or draft crosses devices.** Anything personal is built by
 *      `buildPrivate`, which takes the single player it is building for.
 */

import { FINAL_STORY_LINE_MS } from '../../shared/constants.js';
import type { PublicView, ResultAnswer } from '../../shared/views.js';
import { unshownArtistIds } from './finale.js';
import { computeMatchAwards, buildHighlightReel } from './results.js';
import {
  eligiblePlayers,
  findPlayer,
  startBlock,
} from './roomState.js';
import { freshSlotIds, renderMatchStories, slotFor, storyById } from './story.js';
import type { MatchupRecord, RoomState } from './types.js';
import {
  buildDeltas,
  buildLeaderboard,
  currentDrawing,
  currentMatchup,
  deadlineFor,
  type ImageLookup,
} from './viewParts.js';

// The non-redacting projections and the private payload live next door, re-exported
// here so `views.js` stays the one import every caller needs.
export * from './viewParts.js';
export { buildPrivate } from './privateView.js';

/* ------------------------------------------------------------------ *
 * The public view
 * ------------------------------------------------------------------ */

function resultAnswers(state: RoomState, matchup: MatchupRecord): ResultAnswer[] {
  const outcome = matchup.resolved;
  const votersByAnswer = new Map<string, string[]>();
  for (const [voterId, answerId] of Object.entries(matchup.votes)) {
    const list = votersByAnswer.get(answerId);
    if (list === undefined) votersByAnswer.set(answerId, [voterId]);
    else list.push(voterId);
  }

  return matchup.answers.map((answer) => {
    const author = answer.authorId === null ? undefined : findPlayer(state, answer.authorId);
    return {
      id: answer.id,
      text: answer.text,
      votes: outcome?.voteCounts[answer.id] ?? 0,
      authorId: answer.authorId,
      authorName: author?.name ?? 'THE HOUSE',
      authorAvatarId: author?.avatarId ?? null,
      isFallback: answer.isFallback,
      isWinner: outcome?.winningAnswerId === answer.id,
      voterIds: votersByAnswer.get(answer.id) ?? [],
    };
  });
}

export function buildPublicView(
  state: RoomState,
  now: number,
  images: ImageLookup,
  joinUrl: string,
): PublicView {
  const deadline = deadlineFor(state);
  const match = state.match;
  const matchup = currentMatchup(state);
  const drawing = currentDrawing(state);

  /**
   * Empty when the artist never submitted. Pointing an `<img>` at a URL that 404s
   * renders the browser's broken-image icon, which reads as the game failing rather
   * than as somebody running out of time — the client shows a deliberate note instead.
   */
  const currentImageUrl = (): string =>
    drawing?.hasImage === true ? images(match?.drawingIndex ?? 0) : '';
  const roundNumber = match === null ? 0 : match.matchupIndex + 1;
  const totalRounds = match?.plan.length ?? state.settings.rounds;

  const promptText = (record: MatchupRecord | undefined): string =>
    record === undefined ? '' : (slotFor(record.storyId, record.slotId)?.disguisedPrompt ?? '');

  switch (state.phase) {
    case 'LOBBY': {
      const block = startBlock(state, now);
      return {
        phase: 'LOBBY',
        joinUrl,
        canStart: block.canStart,
        blockReason: block.reason,
        crudeAcknowledged: state.players.some((p) => p.adultAcknowledged),
      };
    }

    case 'GAME_SETUP': {
      const story = match === null ? undefined : storyById(match.storyIds[0] ?? '');
      const revealed = match?.titleRevealed === true;
      return {
        phase: 'GAME_SETUP',
        storyTitle: revealed ? (story?.title ?? null) : null,
        genre: revealed ? (story?.genre ?? null) : null,
        totalRounds,
        deadline,
      };
    }

    case 'ROUND_PROMPT': {
      const slot = matchup === undefined ? undefined : slotFor(matchup.storyId, matchup.slotId);
      return {
        phase: 'ROUND_PROMPT',
        roundId: matchup?.roundId ?? '',
        roundNumber,
        totalRounds,
        prompt: slot?.disguisedPrompt ?? '',
        hint: slot?.hint ?? null,
        charLimit: slot?.charLimit ?? 0,
        competitorIds: matchup?.competitorIds ?? [],
        submittedIds: (matchup?.answers ?? [])
          .filter((a) => a.authorId !== null && !a.isFallback)
          .map((a) => a.authorId as string),
        deadline,
      };
    }

    case 'ROUND_WAITING':
      return {
        phase: 'ROUND_WAITING',
        roundNumber,
        totalRounds,
        competitorIds: matchup?.competitorIds ?? [],
        deadline,
      };

    case 'ROUND_REVEAL':
      return {
        phase: 'ROUND_REVEAL',
        roundNumber,
        totalRounds,
        prompt: promptText(matchup),
        // Anonymous by construction: RevealAnswer has no author field.
        answers: (matchup?.answers ?? []).map((a) => ({ id: a.id, text: a.text })),
        deadline,
      };

    case 'ROUND_VOTE':
      return {
        phase: 'ROUND_VOTE',
        roundId: matchup?.roundId ?? '',
        roundNumber,
        totalRounds,
        prompt: promptText(matchup),
        answers: (matchup?.answers ?? []).map((a) => ({ id: a.id, text: a.text })),
        votesIn: Object.keys(matchup?.votes ?? {}).length,
        votersTotal: matchup?.voterIds.length ?? 0,
        deadline,
      };

    case 'ROUND_RESULTS': {
      const outcome = matchup?.resolved ?? null;
      return {
        phase: 'ROUND_RESULTS',
        roundNumber,
        totalRounds,
        prompt: promptText(matchup),
        answers: matchup === undefined ? [] : resultAnswers(state, matchup),
        winningAnswerId: outcome?.winningAnswerId ?? null,
        wasCoinFlip: outcome?.wasCoinFlip ?? false,
        wasCleanSweep: outcome?.wasCleanSweep ?? false,
        nobodyVoted: outcome?.nobodyVoted ?? false,
        deltas: buildDeltas(state, outcome?.events ?? []),
        leaderboard: buildLeaderboard(state, outcome?.events ?? []),
        deadline,
      };
    }

    case 'STORY_UPDATE':
      return {
        phase: 'STORY_UPDATE',
        stories: match === null ? [] : renderMatchStories(match, { freshFrom: match.storyUpdatedThrough }),
        freshSlotIds: match === null ? [] : freshSlotIds(match, match.storyUpdatedThrough),
        roundNumber,
        totalRounds,
        deadline,
      };

    case 'FINAL_STORY':
      return {
        phase: 'FINAL_STORY',
        stories: match === null ? [] : renderMatchStories(match, { revealAll: true }),
        lineDelayMs: FINAL_STORY_LINE_MS,
        deadline,
      };

    case 'DRAWING_SETUP':
    case 'DRAWING_ACTIVE': {
      // Everybody draws at once, so this describes the whole set rather than one
      // artist's turn. Whether *you* have submitted is per-player and travels in the
      // private payload instead.
      const drawings = match?.drawings ?? [];
      const nameOf = (artistId: string): string =>
        findPlayer(state, artistId)?.name ?? 'somebody';
      const artistNames = drawings.map((d) => nameOf(d.artistId));

      if (state.phase === 'DRAWING_SETUP') {
        return { phase: 'DRAWING_SETUP', artistNames, artistTotal: drawings.length, deadline };
      }
      return {
        phase: 'DRAWING_ACTIVE',
        artistNames,
        artistTotal: drawings.length,
        submittedCount: drawings.filter((d) => d.hasImage).length,
        pendingArtistNames: drawings.filter((d) => !d.hasImage).map((d) => nameOf(d.artistId)),
        deadline,
      };
    }

    case 'DRAWING_GUESS': {
      const artist = drawing === undefined ? undefined : findPlayer(state, drawing.artistId);
      const guessers = eligiblePlayers(state, now).filter((p) => p.id !== drawing?.artistId);
      return {
        phase: 'DRAWING_GUESS',
        roundId: drawing?.roundId ?? '',
        artistId: drawing?.artistId ?? '',
        artistName: artist?.name ?? 'somebody',
        imageUrl: currentImageUrl(),
        guessesIn: Object.keys(drawing?.guesses ?? {}).length,
        guessersTotal: guessers.length,
        drawingIndex: (match?.drawingIndex ?? 0) + 1,
        drawingTotal: match?.showcase.length ?? 0,
        deadline,
      };
    }

    case 'DRAWING_VOTE': {
      const artist = drawing === undefined ? undefined : findPlayer(state, drawing.artistId);
      const voters = eligiblePlayers(state, now).filter((p) => p.id !== drawing?.artistId);
      return {
        phase: 'DRAWING_VOTE',
        roundId: drawing?.roundId ?? '',
        artistId: drawing?.artistId ?? '',
        artistName: artist?.name ?? 'somebody',
        imageUrl: currentImageUrl(),
        options: (drawing?.options ?? []).map((o) => ({ id: o.id, text: o.text })),
        votesIn: Object.keys(drawing?.votes ?? {}).length,
        votersTotal: voters.length,
        drawingIndex: (match?.drawingIndex ?? 0) + 1,
        drawingTotal: match?.showcase.length ?? 0,
        deadline,
      };
    }

    case 'DRAWING_RESULTS': {
      const artist = drawing === undefined ? undefined : findPlayer(state, drawing.artistId);
      const onLastShowcase = (match?.drawingIndex ?? 0) >= (match?.showcase.length ?? 0) - 1;
      const showcaseEvents = [
        ...(drawing?.resolved?.events ?? []),
        ...(onLastShowcase ? (match?.unshownEvents ?? []) : []),
      ];
      const outcome = drawing?.resolved ?? null;
      const votersByOption = new Map<string, string[]>();
      for (const [voterId, optionId] of Object.entries(drawing?.votes ?? {})) {
        const list = votersByOption.get(optionId);
        if (list === undefined) votersByOption.set(optionId, [voterId]);
        else list.push(voterId);
      }
      return {
        phase: 'DRAWING_RESULTS',
        artistId: drawing?.artistId ?? '',
        artistName: artist?.name ?? 'somebody',
        artistAvatarId: artist?.avatarId ?? '',
        imageUrl: currentImageUrl(),
        options: (drawing?.options ?? []).map((option) => {
          const author = option.authorId === null ? undefined : findPlayer(state, option.authorId);
          return {
            id: option.id,
            text: option.text,
            isReal: option.isReal,
            authorId: option.authorId,
            authorName: option.isReal ? 'THE REAL PROMPT' : (author?.name ?? 'somebody'),
            voterIds: votersByOption.get(option.id) ?? [],
          };
        }),
        realOptionId: outcome?.realOptionId ?? '',
        perfect: outcome?.perfect ?? false,
        // The gallery payout rides along on the last screen, so the room sees it.
        deltas: buildDeltas(state, showcaseEvents),
        leaderboard: buildLeaderboard(state, showcaseEvents),
        drawingIndex: (match?.drawingIndex ?? 0) + 1,
        // Of the *showcase*, not of everybody who drew — those are different numbers
        // now, which is why the last screen explains itself.
        drawingTotal: match?.showcase.length ?? 0,
        unshownArtistCount: onLastShowcase ? unshownArtistIds(state).length : 0,
        deadline,
      };
    }

    case 'FINAL_RESULTS':
      return {
        phase: 'FINAL_RESULTS',
        leaderboard: buildLeaderboard(state),
        awards: computeMatchAwards(state),
        highlights: buildHighlightReel(state, images),
        stories: match === null ? [] : renderMatchStories(match, { revealAll: true }),
        deadline: null,
      };
  }
}
