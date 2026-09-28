import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '@bhoomisetu/db';
import { Injectable, NotImplementedException } from '@nestjs/common';
import { env } from '../../config/env';

export interface SttSegment {
  index: number;
  speaker: string | null;
  start: number;
  end: number;
  text: string;
}

export interface SttResult {
  text: string;
  language: string;
  segments: SttSegment[];
  provider: 'MOCK';
}

function demoTranscriptPath(): string {
  return join(repoRoot(), 'data', 'demo-docs', 'hearing-audio-transcript.json');
}

/**
 * SttAdapter (§17, §30, G7). Real speech recognition is out of scope for the demo — the mock
 * returns the same committed synthetic transcript for every hearing recording, so the objection
 * pipeline downstream is deterministic and reproducible.
 */
@Injectable()
export class SttService {
  async transcribe(_document: { id: string; objectKey: string }): Promise<SttResult> {
    if (env().STT_PROVIDER !== 'mock') throw new NotImplementedException('No real STT integration (G7).');
    const raw = JSON.parse(readFileSync(demoTranscriptPath(), 'utf8')) as {
      language: string;
      text: string;
      segments: Array<{ index: number; speaker: string; start: number; end: number; text: string }>;
    };
    return {
      text: raw.text,
      language: raw.language,
      segments: raw.segments.map((s) => ({ ...s, speaker: s.speaker ?? null })),
      provider: 'MOCK',
    };
  }
}
