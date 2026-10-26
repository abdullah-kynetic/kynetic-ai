import { notFound } from 'next/navigation';

import { ComponentGallery } from './gallery';

// Test-only page for the axe scan. It exists in a build but answers 404 unless the E2E server sets the flag.
export const dynamic = 'force-dynamic';

export default function Page() {
  if (process.env.COMPONENT_GALLERY !== '1') notFound();
  return <ComponentGallery />;
}
