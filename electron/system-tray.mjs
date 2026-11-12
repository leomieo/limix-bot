import nativeText from "./native-text.cjs";

// Retain the Windows notification-area identity across app restarts.
export function createSystemTray({ Tray, Menu, nativeImage, iconPath, lightIconPath = iconPath, light = false, getWindow, onQuit, t = nativeText.englishText.t }) {
  const image = (onLight) => nativeImage.createFromPath(onLight ? lightIconPath : iconPath).resize({ width: 20, height: 20 });
  let shownLight = light;
  const tray = new Tray(image(light),
    "889af657-21b5-4ec9-b5d0-cb798cbdfd30");
  let hidden = false;
  const show = () => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return false;
    hidden = false;
    win.setSkipTaskbar(false);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return true;
  };
  const label = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: t("native.tray.open"), click: show },
    { type: "separator" },
    { label: t("native.tray.quit"), click: onQuit },
  ]));
  tray.setToolTip("Limix Bot");
  label();
  tray.on("click", show);
  tray.on("double-click", show);
  return {
    show,
    hide(win) { hidden = true; win.setSkipTaskbar(true); win.hide(); },
    isHidden() { return hidden; },
    windowShown(win) { hidden = false; win.setSkipTaskbar(false); },
    relabel() { if (!tray.isDestroyed()) label(); },
    setLight(onLight) { if (tray.isDestroyed() || onLight === shownLight) return; shownLight = onLight; tray.setImage(image(onLight)); },
    destroy() { if (!tray.isDestroyed()) tray.destroy(); },
  };
}
