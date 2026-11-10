import PDFDocument from 'pdfkit';

const SECTIONS = [
  ['problem', 'Problem'],
  ['solution', 'Agentic Solution'],
  ['roadmap', 'Roadmap'],
  ['roi', 'ROI']
] as const;

export const PRICING_PLACEHOLDER = 'Pricing to be confirmed';

type ProposalPdfInput = {
  title: string;
  dealTitle: string;
  problem: string;
  solution: string;
  roadmap: string;
  roi: string;
};

function sectionText(value: string) {
  const text = value.trim();
  return text.length ? text : 'Not drafted yet.';
}

/** Printable PDF from the saved draft. Standard fonts only, so generation makes no network request. */
export function renderProposalPdf(input: ProposalPdfInput): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111111').text('Kynetic AI');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(11).fillColor('#333333').text('AI growth partner');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#555555').text('Draft for internal review');
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text(input.title);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor('#333333').text(input.dealTitle);
    doc.moveDown(1);
    for (const [key, title] of SECTIONS) {
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111').text(title);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(11).fillColor('#222222').text(sectionText(input[key]), {
        align: 'left'
      });
      doc.moveDown(0.8);
    }
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111').text('Pricing');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor('#222222').text(PRICING_PLACEHOLDER);
    doc.end();
  });
}
