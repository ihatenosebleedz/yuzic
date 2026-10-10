import type { LyricWord } from '@/providers/contracts/ServerAdapter';
import { karaokeWordOpacity, karaokeWordStates } from './karaoke';

describe('karaokeWordStates', () => {
  const words: LyricWord[] = [
    { startMs: 1000, endMs: 2000, text: 'one ' },
    { startMs: 2000, endMs: 3000, text: 'two ' },
    { startMs: 3000, endMs: 4000, text: 'three' },
  ];

  it('keeps every word waiting before the line begins', () => {
    expect(karaokeWordStates(words, 999)).toEqual([
      { text: 'one ', progress: 0 },
      { text: 'two ', progress: 0 },
      { text: 'three', progress: 0 },
    ]);
  });

  it('progresses each word through its reveal once it begins', () => {
    expect(karaokeWordStates(words, 1500)).toEqual([
      { text: 'one ', progress: 1 },
      { text: 'two ', progress: 0 },
      { text: 'three', progress: 0 },
    ]);
  });

  it('held a word mid-reveal only inside its 350 ms window', () => {
    // 1175 is 175 ms into `one`'s start, i.e. halfway through its reveal.
    expect(karaokeWordStates(words, 1175)).toEqual([
      { text: 'one ', progress: 0.5 },
      { text: 'two ', progress: 0 },
      { text: 'three', progress: 0 },
    ]);
  });

  it('marks each finished word fully sung', () => {
    expect(karaokeWordStates(words, 3500)).toEqual([
      { text: 'one ', progress: 1 },
      { text: 'two ', progress: 1 },
      { text: 'three', progress: 1 },
    ]);
  });

  it('holds all words sung once the line is over', () => {
    expect(karaokeWordStates(words, 4000)).toEqual([
      { text: 'one ', progress: 1 },
      { text: 'two ', progress: 1 },
      { text: 'three', progress: 1 },
    ]);
  });

  it('crossfades the reveal into the next words, rather than stepping', () => {
    // One hundred and fifty milliseconds apart — the pace of a wordy line —
    // and the 350 ms reveal has three words mid-ramp at once, all at
    // different depths. That overlap is what reads as the light walking.
    const fast: LyricWord[] = [
      { startMs: 1000, endMs: 1100, text: 'a ' },
      { startMs: 1100, endMs: 1200, text: 'b ' },
      { startMs: 1200, endMs: 1300, text: 'c' },
    ];
    const states = karaokeWordStates(fast, 1400);
    expect(states[0].text).toBe('a ');
    expect(states[0].progress).toBe(1);
    expect(states[1].progress).toBeCloseTo(300 / 350);
    expect(states[2].progress).toBeCloseTo(200 / 350);
  });

  it('waits until a word begins, whatever its own window', () => {
    // `bad` has a shrunken window behind it; the reveal ignores duration, so
    // it is simply dark before its start rather than forcing a negative ramp.
    const bad: LyricWord[] = [{ startMs: 1000, endMs: 500, text: 'word' }];
    expect(karaokeWordStates(bad, 900)).toEqual([{ text: 'word', progress: 0 }]);
  });

  it('reveals a zero-length word smoothly like any other', () => {
    const instant: LyricWord[] = [
      { startMs: 1000, endMs: 1000, text: 'bang' },
      { startMs: 2000, endMs: 3000, text: 'rest' },
    ];
    expect(karaokeWordStates(instant, 1000)).toEqual([
      { text: 'bang', progress: 0 },
      { text: 'rest', progress: 0 },
    ]);
    expect(karaokeWordStates(instant, 1000 + 350)).toEqual([
      { text: 'bang', progress: 1 },
      { text: 'rest', progress: 0 },
    ]);
  });

  it('yields nothing for a line without word timings', () => {
    expect(karaokeWordStates(undefined, 1234)).toEqual([]);
  });
});

describe('karaokeWordOpacity', () => {
  it('rests at the waiting opacity before a word starts', () => {
    expect(karaokeWordOpacity(0)).toBe(0.45);
  });

  it('is fully opaque once a word is sung', () => {
    expect(karaokeWordOpacity(1)).toBe(1);
  });

  it('climbs through the ramp while the word is revealed', () => {
    expect(karaokeWordOpacity(0.5)).toBeCloseTo(0.725);
  });

  it('eases the ramp so a reveal settles rather than flickers', () => {
    // A quarter of the way through, a linear ramp would be at 0.5875; the
    // ease keeps it dimmer early, then faster into the middle of the run.
    expect(karaokeWordOpacity(0.25)).toBeCloseTo(0.536, 3);
  });

  it('clamps out-of-range progress', () => {
    expect(karaokeWordOpacity(-1)).toBe(0.45);
    expect(karaokeWordOpacity(2)).toBe(1);
  });
});