import { ClientList, type ClientListSearch } from '../client-list';

export const dynamic = 'force-dynamic';

export default async function ArchivedClients({
  searchParams
}: {
  searchParams: ClientListSearch;
}) {
  return <ClientList kind='archived' filters={await searchParams} />;
}
