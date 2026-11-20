import { ClientList, type ClientListSearch } from '../client-list';

export const dynamic = 'force-dynamic';

export default async function LiveClients({ searchParams }: { searchParams: ClientListSearch }) {
  return <ClientList kind='live' filters={await searchParams} />;
}
