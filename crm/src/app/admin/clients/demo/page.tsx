import { ClientList, type ClientListSearch } from '../client-list';

export const dynamic = 'force-dynamic';

export default async function DemoClients({ searchParams }: { searchParams: ClientListSearch }) {
  return <ClientList kind='demo' filters={await searchParams} />;
}
