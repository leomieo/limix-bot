FROM trycua/xfce-cua@sha256:274eb636f5cf3fc58f705916ee72b7a701270b3877369d08533a385c5325be9b
USER root
RUN apt-get update && apt-get install -y --no-install-recommends xdotool xclip scrot && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/lib/limix-desktop && chmod 0700 /var/lib/limix-desktop && sed -i 's/-localhost no/-localhost yes/' /usr/local/bin/start-vnc.sh && sed -i 's/"${NOVNC_PORT:-6901}"/"127.0.0.1:${NOVNC_PORT:-6901}"/' /usr/local/bin/start-novnc.sh
COPY limix-desktop-api.mjs /opt/limix-desktop-api.mjs
COPY limix-desktop.conf /tmp/limix-desktop.conf
RUN cat /tmp/limix-desktop.conf >> /etc/supervisor/supervisord.conf
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 CMD test -S /tmp/.X11-unix/X1 && node -e "Promise.all([fetch('http://127.0.0.1:7000/v1/sandboxes'), fetch('http://127.0.0.1:6901/vnc.html')]).then(([api,view]) => process.exit(api.status === 401 && view.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh","-ec","umask 077; test -n \"$LIMIX_DESKTOP_TOKEN\"; printf %s \"$LIMIX_DESKTOP_TOKEN\" > /run/limix-desktop-token; unset LIMIX_DESKTOP_TOKEN; umask 022; exec supervisord -c /etc/supervisor/supervisord.conf"]
