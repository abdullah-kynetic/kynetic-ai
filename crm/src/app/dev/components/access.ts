/** The gallery is 404 unless the flag is set, including in production. */
export function componentGalleryOpen(nodeEnv: string, flag: string | undefined): boolean {
  if (nodeEnv === 'production') return flag === '1';
  return flag === '1';
}
