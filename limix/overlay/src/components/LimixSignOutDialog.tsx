import { useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { lx } from '@/lib/limix-text';

export function LimixSignOutDialog({ username, onClose }: { username: string; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const confirm = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      if (!await window.ogb?.limixAccount?.signOut(username)) throw new Error(lx('Tài khoản đã thay đổi hoặc không thể đăng xuất. Hãy mở lại menu và thử lại.', 'The account changed or sign-out failed. Reopen the menu and try again.'));
    } catch (cause) {
      busy.current = false; setPending(false);
      setError(cause instanceof Error ? cause.message : lx('Không thể đăng xuất.', 'Could not sign out.'));
    }
  };
  return <ConfirmDialog open title={lx('Đăng xuất Limix Bot', 'Sign out of Limix Bot')} tone="neutral"
    icon={<LogOut size={20} aria-hidden className="text-ink-secondary" />} pending={pending}
    confirmLabel={pending ? lx('Đang đăng xuất…', 'Signing out…') : lx('Đăng xuất', 'Sign out')}
    cancelLabel={lx('Hủy', 'Cancel')} onCancel={() => { if (!busy.current) onClose(); }} onConfirm={() => void confirm()}
    body={<><span className="block break-words font-medium text-ink">{username}</span>
      <span className="mt-2 block">{lx('Ứng dụng sẽ khởi động lại ở màn hình đăng nhập. Bot, bộ nhớ và lịch sử đang lưu trên máy được giữ lại.', 'The app will restart at sign-in. Bots, memory and history stored on this computer are kept.')}</span>
      {error && <span role="alert" className="mt-2 block text-danger">{error}</span>}</>} />;
}
