function parsed(value: string) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) throw new Error('Không xác định được phiên bản bản sao lưu hoặc ứng dụng. Hãy dùng bản Limix Bot chính thức.');
  const core = match.slice(1, 4).map(Number);
  const pre = match[4]?.split('.') ?? [];
  if (core.some(n => !Number.isSafeInteger(n)) || pre.some(n => /^\d+$/.test(n) && (n.length > 1 && n.startsWith('0') || !Number.isSafeInteger(Number(n))))) throw new Error('Phiên bản không hợp lệ.');
  return { core, pre };
}

/** Offline transfer only accepts an app at least as new as the exporting app, including prerelease ordering. */
export function assertTransferVersion(exported: string, current: string): void {
  const source = parsed(exported), target = parsed(current);
  let order = 0;
  for (let i = 0; i < 3 && !order; i++) order = Math.sign(source.core[i] - target.core[i]);
  if (!order) {
    if (!source.pre.length && target.pre.length) order = 1;
    else if (source.pre.length && !target.pre.length) order = -1;
    else for (let i = 0; i < Math.max(source.pre.length, target.pre.length) && !order; i++) {
      const a = source.pre[i], b = target.pre[i];
      if (a === undefined) order = -1;
      else if (b === undefined) order = 1;
      else if (a !== b) order = /^\d+$/.test(a) && /^\d+$/.test(b) ? Math.sign(Number(a) - Number(b))
        : /^\d+$/.test(a) ? -1 : /^\d+$/.test(b) ? 1 : a < b ? -1 : 1;
    }
  }
  if (order > 0) throw new Error('This backup was made by a newer Limix Bot version. Hãy cập nhật Limix Bot lên bản bằng hoặc mới hơn ' + exported + ' trước khi nhập dữ liệu.');
}
