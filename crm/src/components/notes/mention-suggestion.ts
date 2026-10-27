import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';

type Item = { id: string; label: string };

// A small keyboard-navigable popup for the @mention menu (DESIGN_SYSTEM Notes). Plain DOM keeps it
// independent of the editor's React tree. It lists teammates in the tenant only: the page passes
// them in, and the server drops any mention that is not a member anyway.
export function mentionRender() {
  let list: HTMLUListElement | null = null;
  let props: SuggestionProps<Item, Item> | null = null;
  let active = 0;

  const paint = () => {
    if (!list || !props) return;
    list.replaceChildren();
    if (!props.items.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No teammate found';
      empty.className = 'text-muted-foreground px-2 py-1.5 text-sm';
      list.append(empty);
    }
    props.items.forEach((item, i) => {
      const li = document.createElement('li');
      li.id = `mention-option-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.textContent = item.label;
      li.className =
        'cursor-pointer rounded px-2 py-1.5 text-sm ' +
        (i === active ? 'bg-muted font-medium' : '');
      // mousedown, not click: the editor must not lose focus before the item is inserted.
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        props?.command(item);
      });
      list!.append(li);
    });
    const rect = props.clientRect?.();
    if (rect) {
      list.style.left = `${rect.left}px`;
      list.style.top = `${rect.bottom + 4}px`;
    }
  };

  return {
    onStart(p: SuggestionProps<Item, Item>) {
      props = p;
      active = 0;
      list = document.createElement('ul');
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', 'Teammates');
      list.className =
        'bg-popover text-popover-foreground border-border fixed z-50 max-h-56 min-w-44 overflow-auto rounded-lg border p-1 shadow-md';
      document.body.append(list);
      paint();
    },
    onUpdate(p: SuggestionProps<Item, Item>) {
      props = p;
      active = Math.min(active, Math.max(p.items.length - 1, 0));
      paint();
    },
    onKeyDown({ event }: SuggestionKeyDownProps) {
      if (!props) return false;
      const n = props.items.length;
      if (event.key === 'Escape') {
        list?.remove();
        list = null;
        return true;
      }
      if (!n) return false;
      if (event.key === 'ArrowDown') active = (active + 1) % n;
      else if (event.key === 'ArrowUp') active = (active - 1 + n) % n;
      else if (event.key === 'Enter' || event.key === 'Tab') {
        props.command(props.items[active]);
        return true;
      } else return false;
      paint();
      return true;
    },
    onExit() {
      list?.remove();
      list = null;
      props = null;
    }
  };
}
