import { ClientList } from '../client-list';
export default async function LiveClients({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return <ClientList kind='live' search={(await searchParams).q ?? ''} />;
}
