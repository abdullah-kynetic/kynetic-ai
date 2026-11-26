import { describe, expect, it } from 'vitest';
import { dealColumn, splitLeads } from '@/server/agency/pipeline';

const lead = (firstName: string, stageName: string | null, lostReason: string | null = null) => ({
  firstName,
  email: `${firstName.toLowerCase()}@example.test`,
  deal: stageName ? { dealId: `deal-${firstName}`, stageName, lostReason } : null
});

describe('pipeline split', () => {
  it('maps stored agency stages to pipeline columns', () => {
    expect(dealColumn('Contacted')).toBe('audit_pending');
    expect(dealColumn('Interested')).toBe('audit_pending');
    expect(dealColumn('Proposal Sent')).toBe('proposal');
    expect(dealColumn('Nurture')).toBe('proposal');
    expect(dealColumn('Won')).toBe('won');
    expect(dealColumn('Lost')).toBe('declined');
    expect(dealColumn('New')).toBe('lead');
    expect(dealColumn('Something else')).toBe('lead');
  });

  it('puts audit and proposal deals on the board, others on the leads tab, hides won', () => {
    const { deals, leadRows } = splitLeads([
      lead('A', 'Contacted'),
      lead('B', 'Proposal Sent'),
      lead('C', 'New'),
      lead('D', 'Lost', 'Too expensive'),
      lead('E', 'Won'),
      lead('F', null)
    ]);
    expect(deals.map((d) => [d.name, d.column])).toEqual([
      ['A', 'audit_pending'],
      ['B', 'proposal']
    ]);
    expect(leadRows.map((l) => [l.name, l.state, l.reason])).toEqual([
      ['C', 'new', null],
      ['D', 'declined', 'Too expensive'],
      ['F', 'new', null]
    ]);
  });
});
