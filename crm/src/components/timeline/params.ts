import { ACTIVITY_TYPES, type ActivityType } from '@/server/activity';

type Raw = string | string[] | undefined;

/** Reads `type` (repeatable) and `cursor` from page search params; unknown values are dropped. */
export function parseTimelineParams(sp: { type?: Raw; cursor?: Raw }): {
  types: ActivityType[];
  cursor: string | undefined;
} {
  const raw = [sp.type ?? []].flat();
  const types = ACTIVITY_TYPES.filter((t) => raw.includes(t));
  const cursor = typeof sp.cursor === 'string' && sp.cursor ? sp.cursor : undefined;
  return { types, cursor };
}
