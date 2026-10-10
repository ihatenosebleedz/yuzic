import { useEffect, useState } from 'react';
import { getBackend } from '@/features/player/activeBackend';
import { usePlaybackSink } from '@/features/player/PlaybackSinkContext';
import { usePlayingProgress } from '@/features/playback/PlayingContext';

/**
 * How often the word clock reads the engine's position.
 *
 * Fifty milliseconds lands a word boundary to a twentieth of a second — far
 * finer than any lyrics source times words — while leaving the main thread
 * alone the rest of the time. It is only ever one running timer, because only
 * the current lyric line switches it on.
 */
const KARAOKE_TICK_MS = 50;

type KaraokeProgress = {
  /** Seconds, at word-level precision while `wordLevel`, context precision otherwise. */
  positionSeconds: number;
  /**
   * Whether a word-level clock is actually running. False when karaoke wasn't
   * asked for, and when there is no finer clock to read: on a jukebox the
   * server keeps time and answers once a second at best, so the caller falls
   * back to its whole-line highlight rather than stepping through words.
   */
  wordLevel: boolean;
};

/**
 * A position clock fast enough for word-level lyrics.
 *
 * The app's position context ticks once a second — right for whole lines, one
 * tenth of the fidelity a word needs. While word-level rendering is wanted
 * this polls the engine directly and returns that value; otherwise it hands
 * the context's value through unchanged, timer untouched. Only the active
 * lyric line asks, so only its words re-render on these ticks.
 */
export function useKaraokeProgress(enabled: boolean): KaraokeProgress {
  const { position } = usePlayingProgress();
  const { jukeboxState } = usePlaybackSink();

  const wordLevel = enabled && !jukeboxState;
  const [fastPosition, setFastPosition] = useState(position);

  useEffect(() => {
    if (!wordLevel) return;
    // Reading a field synchronously; a paused engine returns the same number
    // each tick and React bails out of the re-render, so an idle song costs
    // nothing beyond the read.
    const read = () => setFastPosition(getBackend().getProgress().position);
    read();
    const timer = setInterval(read, KARAOKE_TICK_MS);
    return () => clearInterval(timer);
  }, [wordLevel]);

  return wordLevel
    ? { positionSeconds: fastPosition, wordLevel: true }
    : { positionSeconds: position, wordLevel: false };
}