import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db/ping', () => ({
  readHealth: vi.fn(async () => ({ database: true, workerAgeSeconds: 1 }))
}));
vi.mock('@/server/env', () => ({
  getEnv: () => ({
    DATABASE_URL: 'postgres://unused',
    BUILD_COMMIT_SHA: process.env.BUILD_COMMIT_SHA
  })
}));

import { buildCommit } from '@/server/build-info';
import { GET } from '@/app/api/health/route';

describe('/api/health build commit', () => {
  const saved = process.env.BUILD_COMMIT_SHA;
  beforeEach(() => {
    delete process.env.BUILD_COMMIT_SHA;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.BUILD_COMMIT_SHA;
    else process.env.BUILD_COMMIT_SHA = saved;
  });

  it('reports the commit from BUILD_COMMIT_SHA', async () => {
    process.env.BUILD_COMMIT_SHA = '477052fa3b1c';
    const res = await GET();
    expect((await res.json()).commit).toBe('477052fa3b1c');
  });

  it('reports unknown when the variable is unset', async () => {
    const res = await GET();
    expect((await res.json()).commit).toBe('unknown');
  });

  it('ignores a value with unsafe characters', () => {
    expect(buildCommit('abc def\n<script>')).toBe('unknown');
  });
});
