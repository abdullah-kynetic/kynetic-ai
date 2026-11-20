import { ClientList, type ClientListSearch } from '../client-list';

export const dynamic = 'force-dynamic';

export default async function ChurnedClients({ searchParams }: { searchParams: ClientListSearch }) {
  return <ClientList kind='churned' filters={await searchParams} />;
}
