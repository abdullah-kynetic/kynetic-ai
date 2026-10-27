import { describe, expect, it } from 'vitest';
import { transcriptLines } from '@/server/calls/detail';

describe('transcriptLines', () => {
  it('prefers timed segments', () => {
    expect(transcriptLines([{ speaker: 'Alex', text: 'Hi', start: 1.5 }], 'Alex: ignored')).toEqual(
      [{ speaker: 'Alex', text: 'Hi', startS: 1.5 }]
    );
  });

  it('splits a plain transcript into speaker lines', () => {
    expect(transcriptLines(null, 'Alex: Hi there\n\nLead: Yes: please')).toEqual([
      { speaker: 'Alex', text: 'Hi there', startS: null },
      { speaker: 'Lead', text: 'Yes: please', startS: null }
    ]);
  });

  it('keeps a line with no speaker, and reports a missing transcript as null', () => {
    expect(transcriptLines(null, 'just text')).toEqual([
      { speaker: '', text: 'just text', startS: null }
    ]);
    expect(transcriptLines(null, null)).toBeNull();
    expect(transcriptLines([], '  ')).toBeNull();
  });
});
