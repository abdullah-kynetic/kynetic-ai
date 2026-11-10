import { notFound } from 'next/navigation';

import { componentGalleryOpen } from './access';
import { ComponentGallery } from './gallery';

// Test-only page for the axe scan. It exists in a build but answers 404 unless the flag is set.
// Production stays 404 unless COMPONENT_GALLERY=1.
export const dynamic = 'force-dynamic';

export default function Page() {
  if (!componentGalleryOpen(process.env.NODE_ENV ?? 'production', process.env.COMPONENT_GALLERY))
    notFound();
  return <ComponentGallery />;
}
