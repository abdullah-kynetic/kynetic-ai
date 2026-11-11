'use client';
import { navGroups as clientNavGroups } from '@/config/nav-config';
import type { NavGroup } from '@/types';
import { KBarAnimator, KBarPortal, KBarPositioner, KBarProvider, KBarSearch } from 'kbar';
import { Kbd } from '@/components/ui/kbd';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useRegisterActions, type Action } from 'kbar';
import RenderResults from './render-result';
import useThemeSwitching from './use-theme-switching';
import { useFilteredNavGroups } from '@/hooks/use-nav';

export default function KBar({
  children,
  groups = clientNavGroups,
  role
}: {
  children: React.ReactNode;
  groups?: NavGroup[];
  role?: string;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const filteredGroups = useFilteredNavGroups(groups, role);

  // These action are for the navigation
  const actions = useMemo(() => {
    // Define navigateTo inside the useMemo callback to avoid dependency array issues
    const navigateTo = (url: string) => {
      router.push(url);
    };

    const allItems = filteredGroups.flatMap((group) => group.items);

    return allItems.flatMap((navItem) => {
      // Only include base action if the navItem has a real URL and is not just a container
      const baseAction =
        navItem.url !== '#'
          ? {
              id: `${navItem.title.toLowerCase()}Action`,
              name: navItem.title,
              shortcut: navItem.shortcut,
              keywords: navItem.title.toLowerCase(),
              section: 'Navigation',
              subtitle: `Go to ${navItem.title}`,
              perform: () => navigateTo(navItem.url)
            }
          : null;

      // Map child items into actions
      const childActions =
        navItem.items?.map((childItem) => ({
          id: `${childItem.title.toLowerCase()}Action`,
          name: childItem.title,
          shortcut: childItem.shortcut,
          keywords: childItem.title.toLowerCase(),
          section: navItem.title,
          subtitle: `Go to ${childItem.title}`,
          perform: () => navigateTo(childItem.url)
        })) ?? [];

      // Return only valid actions (ignoring null base actions for containers)
      return baseAction ? [baseAction, ...childActions] : childActions;
    });
  }, [router, filteredGroups]);

  return (
    <KBarProvider actions={actions} options={{ callbacks: { onQueryChange: setSearchQuery } }}>
      <ContactSearchActions searchQuery={searchQuery} />
      <KBarComponent>{children}</KBarComponent>
    </KBarProvider>
  );
}

const NO_ACTIONS: Action[] = [];

function ContactSearchActions({ searchQuery }: { searchQuery: string }) {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return [];
          const body = (await response.json()) as {
            results?: { id: string; name: string; phone: string | null }[];
          };
          return body.results ?? [];
        })
        .then((results) =>
          setActions(
            results.map((result) => ({
              id: `contact-${result.id}`,
              name: result.name,
              subtitle: result.phone ?? 'Contact',
              section: 'Contacts',
              perform: () => router.push(`/dashboard/contacts/${result.id}`)
            }))
          )
        )
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setActions([]);
        });
    }, 180);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [router, searchQuery]);

  // Short queries show no results; derived here instead of resetting state inside the effect.
  const visibleActions = searchQuery.trim().length < 2 ? NO_ACTIONS : actions;
  useRegisterActions(visibleActions, [visibleActions]);
  return null;
}

const KBarComponent = ({ children }: { children: React.ReactNode }) => {
  useThemeSwitching();

  return (
    <>
      <KBarPortal>
        <KBarPositioner className='bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-99999 flex items-start! justify-center p-4! pt-[14vh]!'>
          <KBarAnimator className='bg-popover text-popover-foreground ring-foreground/10 relative mx-auto w-full max-w-[600px] overflow-hidden rounded-xl shadow-lg ring-1'>
            <div className='bg-popover sticky top-0 z-10 border-b'>
              <KBarSearch className='placeholder:text-muted-foreground w-full border-none bg-transparent px-4 py-3.5 text-sm outline-hidden focus:ring-0 focus:outline-hidden' />
            </div>
            <div className='h-[400px]'>
              <RenderResults />
            </div>
            <div className='text-muted-foreground flex items-center gap-3 border-t px-3 py-2 text-xs'>
              <span className='flex items-center gap-1'>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className='flex items-center gap-1'>
                <Kbd>↵</Kbd> open
              </span>
              <span className='flex items-center gap-1'>
                <Kbd>esc</Kbd> close
              </span>
            </div>
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </>
  );
};
