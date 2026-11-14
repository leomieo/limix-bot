import { describe, expect, it } from 'vitest';
import { assertTransferVersion } from './limix-transfer-version.ts';

describe('offline transfer version policy', () => {
  it.each([['0.3.31', '0.3.31'], ['0.3.31', '0.3.32'], ['0.3.99', '0.4.0'], ['1.0.0-beta.2', '1.0.0-beta.10'], ['1.0.0-rc.1', '1.0.0'], ['1.0.0+abc', '1.0.0+def']])('accepts %s on %s', (source, target) => expect(() => assertTransferVersion(source, target)).not.toThrow());
  it.each([['0.3.32', '0.3.31'], ['1.0.0', '1.0.0-beta.1'], ['1.0.0-beta.10', '1.0.0-beta.2']])('rejects newer %s on %s', (source, target) => expect(() => assertTransferVersion(source, target)).toThrow(/newer/));
  it.each(['test', '', '01.0.0', '1.0', '1.0.0-beta.01'])('rejects unknown source %s', source => expect(() => assertTransferVersion(source, '1.0.0')).toThrow());
});
