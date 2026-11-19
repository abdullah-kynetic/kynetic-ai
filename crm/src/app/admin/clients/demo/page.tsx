import { ClientList } from '../client-list';
export default async function DemoClients({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return <ClientList kind='demo' search={(await searchParams).q ?? ''} />;
}
