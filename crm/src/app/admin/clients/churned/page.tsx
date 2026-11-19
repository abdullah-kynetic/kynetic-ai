import { ClientList } from '../client-list';
export default async function ChurnedClients({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return <ClientList kind='churned' search={(await searchParams).q ?? ''} />;
}
