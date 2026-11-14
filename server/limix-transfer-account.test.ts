import { expect, it } from 'vitest';
import { assertTransferAccount, transferAccountHash } from './limix-transfer-account.ts';
it('binds transfers to the accepted account rather than a machine or display profile', () => {
  const owner = transferAccountHash('limix:alice');
  expect(() => assertTransferAccount(owner, 'limix:alice')).not.toThrow();
  expect(() => assertTransferAccount(owner, 'limix:bob')).toThrow();
  expect(() => assertTransferAccount(owner, null)).toThrow();
  expect(() => assertTransferAccount(undefined, 'limix:alice')).toThrow();
  expect(() => transferAccountHash('Alice')).toThrow();
});
