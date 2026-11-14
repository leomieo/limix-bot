import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ConfirmDialogProps } from './ConfirmDialog';

const fixture = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, signOut: vi.fn() }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useState: (initial: unknown) => { const index = fixture.cursor++; if (!(index in fixture.values)) fixture.values[index] = initial; return [fixture.values[index], (value: unknown) => { fixture.values[index] = value; }]; },
  useRef: (initial: unknown) => { const index = fixture.cursor++; if (!(index in fixture.values)) fixture.values[index] = { current: initial }; return fixture.values[index]; },
}));
vi.mock('@/lib/limix-text', () => ({ lx: (_vi: unknown, en: unknown) => en }));
import { LimixSignOutDialog } from './LimixSignOutDialog';
import { ConfirmDialogCard } from './ConfirmDialog';
const close = vi.fn();
const render = () => { fixture.cursor = 0; return LimixSignOutDialog({ username: 'alice', onClose: close }).props as ConfirmDialogProps; };
beforeEach(() => { fixture.values = []; fixture.signOut.mockReset(); close.mockClear(); vi.stubGlobal('window', { ogb: { limixAccount: { signOut: fixture.signOut } } }); });
it('uses the themed app dialog and keeps cancellation free of sign-out effects', () => {
  const props = render();
  const html = renderToStaticMarkup(createElement(ConfirmDialogCard, props));
  expect(html).toContain('bg-panel'); expect(html).toContain('text-accent-ink');
  expect(html).toContain('alice'); expect(html).toContain('Sign out of Limix Bot');
  props.onCancel(); expect(close).toHaveBeenCalledOnce(); expect(fixture.signOut).not.toHaveBeenCalled();
});
it('requires confirmation and handles account-change failures inside the dialog', async () => {
  fixture.signOut.mockResolvedValue(false);
  render().onConfirm();
  await vi.waitFor(() => expect(fixture.signOut).toHaveBeenCalledWith('alice'));
  await vi.waitFor(() => expect(render().pending).toBe(false));
  expect(renderToStaticMarkup(createElement(ConfirmDialogCard, render()))).toContain('account changed');
  expect(close).not.toHaveBeenCalled();
});
