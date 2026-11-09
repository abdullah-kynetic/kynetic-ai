import { encode, renderSVG } from 'uqr';

const QR_OPTIONS = { ecc: 'M' as const, border: 2 };

/** Module grid for an otpauth URI. True cells are dark. The secret is not written out. */
export function totpQrMatrix(uri: string): boolean[][] {
  const matrix = encode(uri, QR_OPTIONS).data;
  if (matrix.length < 21) throw new Error('QR render failed');
  return matrix;
}

/** SVG QR for an otpauth URI. The secret is encoded in the image, not written out. */
export function totpQrSvg(uri: string): string {
  const svg = renderSVG(uri, { ...QR_OPTIONS, pixelSize: 4 });
  if (!svg.includes('<svg') || svg.includes('<script')) throw new Error('QR render failed');
  return svg;
}
