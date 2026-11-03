import { redirect } from 'next/navigation';

// The client list lives on the admin home page.
export default function ClientsIndexPage() {
  redirect('/admin');
}
