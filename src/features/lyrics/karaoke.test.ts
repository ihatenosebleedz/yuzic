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

  it('progresses only the word being sung', () => {
    expect(karaokeWordStates(words, 1500)).toEqual([
      { text: 'one ', progress: 0.5 },
      { text: 'two ', progress: 0 },
      { text: 'three', progress: 0 },
    ]);
  });

  it('marks each finished word fully sung', () => {
    expect(karaokeWordStates(words, 3500)).toEqual([
      { text: 'one ', progress: 1 },
      { text: 'two ', progress: 1 },
      { text: 'three', progress: 0.5 },
    ]);
  });

  it('holds all words sung once the line is over', () => {
    expect(karaokeWordStates(words, 4000)).toEqual([
      { text: 'one ', progress: 1 },
      { text: 'two ', progress: 1 },
      { text: 'three', progress: 1 },
    ]);
  });

  it('clamps a badly-signed end instead of echoing a negative ramp', () => {
    const bad: LyricWord[] = [{ startMs: 1000, endMs: 500, text: 'word' }];
    expect(karaokeWordStates(bad, 900)).toEqual([{ text: 'word', progress: 0 }]);
  });

  it('treats a zero-length word as sung the instant it begins', () => {
    const instant: LyricWord[] = [
      { startMs: 1000, endMs: 1000, text: 'bang' },
      { startMs: 2000, endMs: 3000, text: 'rest' },
    ];
    expect(karaokeWordStates(instant, 1000)).toEqual([
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

  it('climbs linearly through the ramp while the word is sung', () => {
    expect(karaokeWordOpacity(0.5)).toBeCloseTo(0.725);
  });

  it('clamps out-of-range progress', () => {
    expect(karaokeWordOpacity(-1)).toBe(0.45);
    expect(karaokeWordOpacity(2)).toBe(1);
  });
});