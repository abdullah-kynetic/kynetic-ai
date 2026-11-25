import { money, day } from '@/app/dashboard/shop/_lib/format';
import type { WeekStats } from '@/server/shop';

/**
 * Money in per week as plain bars. The bars are decoration for sighted readers; the caption states
 * the same facts in words and the table under it lists every number, so nothing depends on seeing
 * the bars.
 */
export function WeekBars({ weeks, timeZone }: { weeks: WeekStats[]; timeZone: string }) {
  const max = Math.max(...weeks.map((w) => w.moneyInCents), 0);
  const best = weeks.reduce((a, w) => (w.moneyInCents > a.moneyInCents ? w : a), weeks[0]!);
  const current = weeks[weeks.length - 1]!;
  const caption =
    max === 0
      ? 'No money came in during the last 8 weeks.'
      : `Money in per week over the last ${weeks.length} weeks. Best week: ${money(best.moneyInCents)} (week of ${day(best.weekStart, timeZone)}). This week: ${money(current.moneyInCents)}.`;
  return (
    <figure className='grid gap-3' data-testid='week-bars'>
      <div className='flex h-40 items-end gap-2' aria-hidden='true'>
        {weeks.map((w, i) => (
          <div key={w.weekStart} className='flex h-full min-w-0 flex-1 flex-col justify-end gap-1'>
            <div
              className={`rounded-t-sm ${i === weeks.length - 1 ? 'bg-primary' : 'bg-primary/45'}`}
              style={{ height: max > 0 ? `${Math.max(2, (w.moneyInCents / max) * 100)}%` : '2px' }}
            />
            <span className='text-muted-foreground text-center text-[10px] whitespace-nowrap'>
              {day(w.weekStart, timeZone)}
            </span>
          </div>
        ))}
      </div>
      <figcaption className='text-sm'>{caption}</figcaption>
      <details className='text-sm'>
        <summary className='focus-visible:ring-ring flex min-h-11 cursor-pointer items-center rounded-md focus-visible:ring-2 focus-visible:outline-none'>
          Show the numbers
        </summary>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <caption className='sr-only'>
              Cars done and money in for each of the last 8 weeks
            </caption>
            <thead>
              <tr className='text-muted-foreground'>
                <th scope='col' className='py-1 pr-3 font-normal'>
                  Week of
                </th>
                <th scope='col' className='py-1 pr-3 font-normal'>
                  Cars done
                </th>
                <th scope='col' className='py-1 font-normal'>
                  Money in
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.weekStart} className='border-t'>
                  <th scope='row' className='py-1 pr-3 font-normal'>
                    {day(w.weekStart, timeZone)}
                  </th>
                  <td className='py-1 pr-3 tabular-nums'>{w.carsDone}</td>
                  <td className='py-1 tabular-nums'>{money(w.moneyInCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
