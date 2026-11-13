import { redirect } from 'next/navigation';

export default function ArchiveIndex() {
  redirect('/admin/archive/notes');
}
