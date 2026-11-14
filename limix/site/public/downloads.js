(() => {
  const prefix = 'https://github.com/leomieo/limix-bot/releases/download/';
  const labels = {
    'LimixBot-Apple-Silicon.dmg': 'Tải cho macOS Apple Silicon',
    'LimixBot-Intel.dmg': 'Tải cho macOS Intel',
    'LimixBot-Linux-x64.AppImage': 'Tải Linux x64 AppImage',
    'LimixBot-Linux-x64.deb': 'Tải Linux x64 DEB',
  };
  fetch('https://api.github.com/repos/leomieo/limix-bot/releases/latest', { signal: AbortSignal.timeout(10000) })
    .then(response => { if (!response.ok) throw new Error('Release unavailable'); return response.json(); })
    .then(release => {
      if (release.draft || release.prerelease || !Array.isArray(release.assets)) return;
      for (const pending of document.querySelectorAll('[data-release-asset]')) {
        const name = pending.dataset.releaseAsset;
        const asset = release.assets.find(item => item.name === name && item.size > 0 && typeof item.browser_download_url === 'string' && item.browser_download_url.startsWith(prefix));
        if (!asset || !labels[name]) continue;
        const link = document.createElement('a');
        link.className = pending.className;
        link.href = asset.browser_download_url;
        link.textContent = labels[name];
        pending.replaceWith(link);
      }
    })
    .catch(() => {});
})();
