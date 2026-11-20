export type StatTile = { label: string; value: string; note?: string };

/** Headline numbers for an area dashboard. Same tile look as the admin areas. */
export function StatTiles({ label, tiles }: { label: string; tiles: readonly StatTile[] }) {
  return (
    <ul aria-label={label} className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
      {tiles.map((tile) => (
        <li
          key={tile.label}
          className='bg-card flex flex-col gap-1 rounded-[var(--radius-card)] border p-5'
        >
          <span className='text-muted-foreground text-[13px] font-medium'>{tile.label}</span>
          <span className='text-3xl/[1.1] font-semibold tracking-tight tabular-nums'>
            {tile.value}
          </span>
          {tile.note ? <span className='text-muted-foreground text-xs'>{tile.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
