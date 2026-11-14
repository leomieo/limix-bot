import { expect, it, vi } from 'vitest';
import { fetchHubFile } from './limix-hub-download.ts';
it('retries the other catalog area only for a missing file', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response('pinned content'));
  expect(await (await fetchHubFile('https://fixture.invalid', 'quarantine', 'example', 'SKILL.md', fetcher)).text()).toBe('pinned content');
  expect(fetcher.mock.calls.map(call => call[0])).toEqual(['https://fixture.invalid/quarantine/example/SKILL.md', 'https://fixture.invalid/skills/example/SKILL.md']);
});
it.each([200, 403, 429, 500])('does not retry status %s', async status => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status }));
  await fetchHubFile('https://fixture.invalid', 'skills', 'example', 'SKILL.md', fetcher);
  expect(fetcher).toHaveBeenCalledOnce();
});
