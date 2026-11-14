/** The host accepts only a local renderer's confirmation for the still-current account. */
export function createLimixSignOutHandler({ info, signOut, relaunch }) {
  let pending = false;
  return async expectedUsername => {
    const current = info();
    if (pending || !current || typeof expectedUsername !== 'string' || expectedUsername !== current.username) return false;
    pending = true;
    try {
      await signOut();
      relaunch();
      return true;
    } finally { pending = false; }
  };
}
