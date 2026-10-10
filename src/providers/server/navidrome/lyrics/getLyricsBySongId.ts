import type { NavidromeClient } from "../client";
import { LyricsResult, LyricWord } from "@/providers/contracts/ServerAdapter";

type NavidromeLyricLine = {
  start?: number; // milliseconds
  value: string;
};

/** One timed word/syllable, from the OpenSubsonic `songLyrics` v2 `cueLine`. */
type NavidromeCue = {
  start?: number;
  end?: number;
  byteStart?: number;
  byteEnd?: number;
  value: string;
};

type NavidromeCueLine = {
  /** Index into `line` — which lyric line this group of cues belongs to. */
  index: number;
  start?: number;
  end?: number;
  value: string;
  cue?: NavidromeCue[];
};

type NavidromeStructuredLyrics = {
  /** v2 only: `main` / `translation` / `pronunciation`. Absent on v1. */
  kind?: string;
  synced: boolean;
  line: NavidromeLyricLine[];
  /** v2 only, and only for word-level sources (ELRC/TTML/YAML sidecars). */
  cueLine?: NavidromeCueLine[];
};

type NavidromeLyricsList = {
  structuredLyrics?: NavidromeStructuredLyrics[];
};

type NavidromeResponse = {
  "subsonic-response"?: {
    lyricsList?: NavidromeLyricsList;
  };
};

/**
 * Which of a v2 response's tracks to read.
 *
 * v2 splits a song's lyrics by `kind` — the lyrics, a translation, a
 * pronunciation — emitted in no fixed order, and only the `main` track is the
 * one the sheet follows. v1 (and any server that does not set `kind`) answers
 * with a single track, which the fallback returns unchanged.
 */
function pickStructured(
  list: NavidromeStructuredLyrics[]
): NavidromeStructuredLyrics | undefined {
  return list.find((track) => track.kind === "main") ?? list[0];
}

/**
 * One line's words, from the `cueLine` that belongs to it.
 *
 * A cue with no `start` carries no timing and is dropped — the server
 * normalizes those away itself, and a word that can never light up is worse
 * than no word. A cue's end falls back to the next cue's start, then the line's
 * own end, then its start, so a source that omits end times still yields a
 * usable (if not perfectly resolving) window rather than a NaN or a
 * zero-length one.
 */
function wordsForLine(
  cueLine: NavidromeCueLine | undefined,
  lineEndMs: number | undefined
): LyricWord[] | undefined {
  const cues = (cueLine?.cue ?? []).filter(
    (cue): cue is NavidromeCue & { start: number } =>
      typeof cue.start === "number" &&
      typeof cue.value === "string" &&
      cue.value.length > 0
  );
  if (cues.length === 0) return undefined;

  return cues.map((cue, index) => {
    const nextStart = cues[index + 1]?.start;
    const end = cue.end ?? nextStart ?? lineEndMs ?? cue.start;
    return {
      startMs: cue.start,
      endMs: Math.max(end, cue.start),
      text: cue.value,
      byteStart: cue.byteStart,
      byteEnd: cue.byteEnd,
    };
  });
}

export async function getLyricsBySongId(
  client: NavidromeClient,
  songId: string
): Promise<LyricsResult | null> {
  try {
    // `enhanced` opts into OpenSubsonic `songLyrics` v2, which is where word
    // timing (`cueLine[].cue[]`) lives. A server that predates the parameter
    // ignores an unknown one and answers v1, so this needs no capability probe
    // — the extra field simply comes back absent and every line stays textual.
    const raw = await client.request<NavidromeResponse>("getLyricsBySongId.view", {
      id: songId,
      enhanced: "true",
    });

    const structured = pickStructured(
      raw["subsonic-response"]?.lyricsList?.structuredLyrics ?? []
    );

    if (!structured || structured.line.length === 0) {
      return null;
    }

    const cueLinesByIndex = new Map(
      (structured.cueLine ?? []).map((cueLine) => [cueLine.index, cueLine])
    );
    const lineStarts = structured.line.map((line) => line.start);

    const lines = structured.line
      .map((line, index) => {
        // An unsynced list has no timings to carry; `start` is absent rather
        // than zero on some servers, and a NaN here would break the seek.
        const startMs = structured.synced ? line.start ?? 0 : 0;
        if (!structured.synced) {
          return { startMs, text: line.value };
        }

        const cueLine = cueLinesByIndex.get(index);
        // The end of a line is only known from its cueLine or the next line's
        // start; passed down so the line's last word can resolve.
        const nextStart = lineStarts
          .slice(index + 1)
          .find((value) => typeof value === "number");
        const lineEndMs = cueLine?.end ?? nextStart;
        const words = wordsForLine(cueLine, lineEndMs);
        return words
          ? { startMs, text: line.value, words }
          : { startMs, text: line.value };
      })
      .filter((line) => typeof line.text === "string" && line.text.trim().length > 0);

    if (lines.length === 0) return null;

    return {
      synced: structured.synced,
      lines,
    };
  } catch (error) {
    console.error('Navidrome getLyricsBySongId failed:', error);
    throw error;
  }
}
