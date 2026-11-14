import { createHash, timingSafeEqual } from 'node:crypto';

/** ID is supplied by the desktop's accepted Limix sign-in, never by the import request or editable profile. */
export function transferAccountHash(id: string | null | undefined): string {
  if (typeof id !== 'string' || !/^limix:[a-z0-9._-]{1,64}$/.test(id)) throw new Error('Hãy đăng nhập tài khoản Limix trước khi chuyển máy Offline.');
  return createHash('sha256').update(`limix-offline-transfer-v1:${id}`).digest('hex');
}

export function assertTransferAccount(owner: string | undefined, accountId: string | null | undefined): void {
  const expected = transferAccountHash(accountId);
  if (!owner || !/^[0-9a-f]{64}$/.test(owner) || !timingSafeEqual(Buffer.from(owner, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new Error('File chuyển máy không thuộc tài khoản Limix đang đăng nhập. Hãy đăng nhập đúng tài khoản đã xuất file. File cũ không có thông tin chủ tài khoản cần được xuất lại.');
  }
}
