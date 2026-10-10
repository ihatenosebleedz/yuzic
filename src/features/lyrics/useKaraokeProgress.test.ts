import { renderHook, act } from '@testing-library/react-native';

let mockPosition = 0;
jest.mock('@/features/player/activeBackend', () => ({
  getBackend: () => ({ getProgress: () => ({ position: mockPosition, duration: 0, buffered: 0 }) }),
}));

let mockContextPosition = 0;
let mockJukebox = false;
jest.mock('@/features/player/PlaybackSinkContext', () => ({
  usePlaybackSink: () => ({
    jukeboxState: mockJukebox
      ? { currentIndex: 0, playing: true, gain: 1, positionSeconds: 0 }
      : null,
  }),
}));
jest.mock('@/features/playback/PlayingContext', () => ({
  usePlayingProgress: () => ({ position: mockContextPosition, duration: 0, buffered: 0 }),
}));

import { useKaraokeProgress } from './useKaraokeProgress';

describe('useKaraokeProgress', () => {
  beforeEach(() => {
    mockPosition = 0;
    mockContextPosition = 0;
    mockJukebox = false;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs no fast clock (and passes the context position through) while disabled', async () => {
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useKaraokeProgress(enabled),
      { initialProps: { enabled: false } }
    );

    expect(result.current).toEqual({ positionSeconds: 0, wordLevel: false });

    mockPosition = 42;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current).toEqual({ positionSeconds: 0, wordLevel: false });

    await rerender({ enabled: true });
    // The first read lands immediately, so the engine's position shows at once
    // rather than a fiftieth of a second later.
    expect(result.current).toEqual({ positionSeconds: 42, wordLevel: true });
  });

  it('reads the engine at word-level speed while enabled', async () => {
    mockPosition = 1;
    const { result } = await renderHook(() => useKaraokeProgress(true));

    await act(async () => {
      mockPosition = 1.1;
      await jest.advanceTimersByTimeAsync(50);
    });

    expect(result.current.positionSeconds).toBeCloseTo(1.1);
    expect(result.current.wordLevel).toBe(true);
  });

  it('stops ticking once disabled', async () => {
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useKaraokeProgress(enabled),
      { initialProps: { enabled: true } }
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });

    await rerender({ enabled: false });

    mockPosition = 9;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });

    expect(result.current).toEqual({ positionSeconds: 0, wordLevel: false });
  });

  it('refuses word-level rendering on a jukebox, whose clock answers once a second', async () => {
    mockContextPosition = 7.5;
    mockJukebox = true;
    const { result } = await renderHook(() => useKaraokeProgress(true));

    await act(async () => {
      mockPosition = 99;
      await jest.advanceTimersByTimeAsync(10_000);
    });

    // No fast clock ran, and the jukebox's own position (the context's, fed by
    // the server poll) is what the caller should read.
    expect(result.current).toEqual({ positionSeconds: 7.5, wordLevel: false });
  });
});