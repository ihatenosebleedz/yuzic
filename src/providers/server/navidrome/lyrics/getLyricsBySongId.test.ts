import { getLyricsBySongId } from './getLyricsBySongId';
import type { NavidromeClient } from '../client';

function makeClient(lyricsList: unknown): NavidromeClient {
  return {
    request: jest.fn().mockResolvedValue({ 'subsonic-response': { status: 'ok', lyricsList } }),
    buildStreamUrl: jest.fn(),
    serverUrl: 'https://example',
    username: 'u',
    password: 'p',
  } as unknown as NavidromeClient;
}

describe('getLyricsBySongId', () => {
  it('keeps the timings of a synced list', async () => {
    const client = makeClient({
      structuredLyrics: [
        { synced: true, line: [{ start: 0, value: 'first' }, { start: 4200, value: 'second' }] },
      ],
    });

    const result = await getLyricsBySongId(client, 'song-1');

    expect(result).toEqual({
      synced: true,
      lines: [
        { startMs: 0, text: 'first' },
        { startMs: 4200, text: 'second' },
      ],
    });
  });

  /** The whole point of the change: this used to return null. */
  it('returns an unsynced list instead of dropping it', async () => {
    const client = makeClient({
      structuredLyrics: [
        { synced: false, line: [{ value: 'a plain line' }, { value: 'and another' }] },
      ],
    });

    const result = await getLyricsBySongId(client, 'song-1');

    expect(result).toEqual({
      synced: false,
      lines: [
        { startMs: 0, text: 'a plain line' },
        { startMs: 0, text: 'and another' },
      ],
    });
  });

  it('zeroes an unsynced line that still carries a start value', async () => {
    const client = makeClient({
      structuredLyrics: [{ synced: false, line: [{ start: 999, value: 'untimed' }] }],
    });

    const result = await getLyricsBySongId(client, 'song-1');

    expect(result?.lines).toEqual([{ startMs: 0, text: 'untimed' }]);
  });

  it('is null when there are no lyrics at all', async () => {
    expect(await getLyricsBySongId(makeClient({}), 'song-1')).toBeNull();
    expect(await getLyricsBySongId(makeClient({ structuredLyrics: [] }), 'song-1')).toBeNull();
  });

  it('is null when every line is blank, rather than an empty sheet', async () => {
    const client = makeClient({
      structuredLyrics: [{ synced: false, line: [{ value: '   ' }, { value: '' }] }],
    });

    expect(await getLyricsBySongId(client, 'song-1')).toBeNull();
  });

  it('attaches word timings from a v2 cueLine', async () => {
    const client = makeClient({
      structuredLyrics: [
        {
          kind: 'main',
          synced: true,
          line: [{ start: 10990, value: 'If I can get out of this' }],
          cueLine: [
            {
              index: 0,
              start: 10990,
              end: 13830,
              value: 'If I can get out of this',
              cue: [
                { start: 10990, end: 11110, byteStart: 0, byteEnd: 2, value: 'If ' },
                { start: 11110, end: 11210, byteStart: 3, byteEnd: 4, value: 'I ' },
                { start: 11210, end: 11400, byteStart: 5, byteEnd: 8, value: 'can ' },
                { start: 11400, byteStart: 9, byteEnd: 12, value: 'get ' },
              ],
            },
          ],
        },
      ],
    });

    const result = await getLyricsBySongId(client, 'song-1');

    expect(result).toEqual({
      synced: true,
      lines: [
        {
          startMs: 10990,
          text: 'If I can get out of this',
          words: [
            { startMs: 10990, endMs: 11110, text: 'If ', byteStart: 0, byteEnd: 2 },
            { startMs: 11110, endMs: 11210, text: 'I ', byteStart: 3, byteEnd: 4 },
            { startMs: 11210, endMs: 11400, text: 'can ', byteStart: 5, byteEnd: 8 },
            // No end of its own, no cue after it — resolves to the line's end.
            { startMs: 11400, endMs: 13830, text: 'get ', byteStart: 9, byteEnd: 12 },
          ],
        },
      ],
    });
  });

  it("resolves a word's end from the next cue when the server omits it", async () => {
    const client = makeClient({
      structuredLyrics: [
        {
          synced: true,
          line: [{ start: 0, value: 'a b' }],
          cueLine: [
            {
              index: 0,
              value: 'a b',
              cue: [
                { start: 0, value: 'a ' },
                { start: 500, value: 'b' },
              ],
            },
          ],
        },
      ],
    });

    expect((await getLyricsBySongId(client, 'song-1'))?.lines[0].words).toEqual([
      { startMs: 0, endMs: 500, text: 'a ' },
      { startMs: 500, endMs: 500, text: 'b' },
    ]);
  });

  it('drops a cue that carries no timing rather than a word that cannot light up', async () => {
    const client = makeClient({
      structuredLyrics: [
        {
          synced: true,
          line: [{ start: 0, value: 'a b' }],
          cueLine: [
            {
              index: 0,
              end: 400,
              value: 'a b',
              cue: [
                { value: 'a ' },
                { start: 100, end: 400, value: 'b' },
              ],
            },
          ],
        },
      ],
    });

    expect((await getLyricsBySongId(client, 'song-1'))?.lines[0].words).toEqual([
      { startMs: 100, endMs: 400, text: 'b' },
    ]);
  });

  it('reads the main track when a v2 response also carries translation and pronunciation', async () => {
    const client = makeClient({
      structuredLyrics: [
        { kind: 'translation', synced: true, line: [{ start: 0, value: 'needs to be translated' }] },
        { kind: 'main', synced: true, line: [{ start: 0, value: 'the lyrics' }] },
        { kind: 'pronunciation', synced: true, line: [{ start: 0, value: 'romanization' }] },
      ],
    });

    expect((await getLyricsBySongId(client, 'song-1'))?.lines).toEqual([
      { startMs: 0, text: 'the lyrics' },
    ]);
  });

  it('leaves a line without a matching cueLine un-worded beside one that has them', async () => {
    const client = makeClient({
      structuredLyrics: [
        {
          synced: true,
          line: [
            { start: 0, value: 'first' },
            { start: 2000, value: 'second' },
          ],
          cueLine: [
            {
              index: 1,
              start: 2000,
              end: 2500,
              value: 'second',
              cue: [{ start: 2000, end: 2500, value: 'second' }],
            },
          ],
        },
      ],
    });

    const result = await getLyricsBySongId(client, 'song-1');

    expect(result?.lines[0].words).toBeUndefined();
    expect(result?.lines[1].words).toEqual([
      { startMs: 2000, endMs: 2500, text: 'second' },
    ]);
  });

  it('never attaches words to an unsynced list, even if it carries cueLine data', async () => {
    const client = makeClient({
      structuredLyrics: [
        {
          synced: false,
          line: [{ value: 'plain' }],
          cueLine: [
            {
              index: 0,
              start: 0,
              end: 100,
              value: 'plain',
              cue: [{ start: 0, end: 100, value: 'plain' }],
            },
          ],
        },
      ],
    });

    expect(await getLyricsBySongId(client, 'song-1')).toEqual({
      synced: false,
      lines: [{ startMs: 0, text: 'plain' }],
    });
  });
});
