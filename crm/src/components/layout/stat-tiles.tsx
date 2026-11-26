import type { ReactNode } from 'react';

export type StatTile = {
  label: string;
  value: ReactNode;
  /** What the figure compares to or counts, in a few words. */
  note?: ReactNode;
  /** The one figure on the screen that carries the accent. */
  key?: boolean;
};

/** Headline numbers: a label, a figure, one line of context. The one tile look for every area. */
export function StatTiles({
  label,
  tiles,
  className
}: {
  label: string;
  tiles: readonly StatTile[];
  className?: string;
}) {
  // Fill whole rows: 3 and 6 tiles in threes, 5 in one row, anything else in fours.
  const wide =
    tiles.length === 3 || tiles.length === 6
      ? 'lg:grid-cols-3'
      : tiles.length === 5
        ? 'lg:grid-cols-5'
        : 'lg:grid-cols-4';
  return (
    <ul
      aria-label={label}
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${wide} [&>li]:min-w-0 [&>li:last-child:nth-child(odd)]:col-span-2 lg:[&>li:last-child:nth-child(odd)]:col-span-1 ${className ?? ''}`}
    >
      {tiles.map((tile) => (
        <li
          key={tile.label}
          className='bg-card flex flex-col gap-1 rounded-[var(--radius-card)] border p-3 sm:p-4'
        >
          <span className='text-muted-foreground text-[13px] leading-5'>{tile.label}</span>
          <span
            className={`text-2xl/8 font-medium tracking-[-0.01em] tabular-nums ${tile.key ? 'text-primary-text' : ''}`}
          >
            {tile.value}
          </span>
          {tile.note ? (
            <span className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4'>
              {tile.note}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
