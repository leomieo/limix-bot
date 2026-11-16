#!/usr/bin/python3
"""Prepare the guest without activating the migrated messaging connectors."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

STATE = Path('/var/lib/limix-server')
MEDIA = Path('/mnt/limix-transfer')

def run(*args):
    subprocess.run(args, check=True, stdin=subprocess.DEVNULL)

def phase(value):
    STATE.mkdir(parents=True, exist_ok=True)
    temporary = STATE / 'phase.tmp'
    temporary.write_text(value)
    temporary.replace(STATE / 'phase')

def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def verify_media(media):
    manifest = json.loads((media / 'checksums.json').read_text())
    for name, expected in manifest.items():
        if Path(name).name != name or not re.fullmatch('[a-f0-9]{64}', expected):
            raise ValueError('Invalid transfer manifest')
        if sha256(media / name) != expected:
            raise ValueError('Transfer checksum mismatch')

def prepare():
    if (STATE / 'prepared').exists():
        if (STATE / 'activated').exists():
            run('systemctl', 'enable', '--now', 'limix-cloud-host.service')
        return
    phase('packages')
    run('sysctl', '-w', 'kernel.panic=10')
    environment = dict(os.environ, DEBIAN_FRONTEND='noninteractive')
    subprocess.run(['dpkg', '--configure', '-a'], env=environment, check=False, stdin=subprocess.DEVNULL)
    for command in [('apt-get', 'update'), ('apt-get', '-f', 'install', '-y'), ('apt-get', 'install', '-y', 'docker.io', 'docker-compose-v2', 'linux-cloud-tools-virtual', 'xz-utils')]:
        subprocess.run(command, env=environment, check=True, stdin=subprocess.DEVNULL)
    run('systemctl', 'enable', '--now', 'docker.service')
    # Ubuntu's wrapper can select a tools package for a kernel different from the cloud image's running kernel.
    binaries = []
    for candidate in Path('/usr/lib').rglob('hv_kvp_daemon'):
        if candidate.is_file():
            with candidate.open('rb') as stream:
                if stream.read(4) == b'\x7fELF':
                    binaries.append(candidate)
    if binaries:
        override = Path('/etc/systemd/system/hv-kvp-daemon.service.d')
        override.mkdir(parents=True, exist_ok=True)
        (override / 'limix.conf').write_text('[Service]\nExecStart=\nExecStart=' + str(sorted(binaries)[-1]) + ' -n\nRestart=always\n')
        run('systemctl', 'daemon-reload')
    run('systemctl', 'enable', '--now', 'hv-kvp-daemon.service')
    phase('verifying')
    MEDIA.mkdir(parents=True, exist_ok=True)
    if not os.path.ismount(MEDIA):
        run('mount', '-o', 'ro', '/dev/disk/by-label/LIMIXDATA', str(MEDIA))
    verify_media(MEDIA)
    node = Path('/opt/limix-node')
    node.mkdir(exist_ok=True)
    run('tar', '-xJf', str(MEDIA / 'node.tar.xz'), '--strip-components=1', '-C', str(node))
    phase('image')
    run('docker', 'load', '--input', str(MEDIA / 'cloud-image.tar'))
    metadata = json.loads((MEDIA / 'transfer.json').read_text())
    phase('volumes')
    for volume in metadata['volumes']:
        if not re.fullmatch(r'limix-home-[a-f0-9-]{36}_(cloud|data)', volume):
            raise ValueError('Unexpected volume name')
        stamp = STATE / ('imported-' + volume)
        if stamp.exists():
            continue
        run('docker', 'volume', 'create', volume)
        mount = 'type=volume,source=' + volume + ',target=/target'
        run('docker', 'run', '--rm', '--user', '0', '--entrypoint', 'sh', '--mount', mount,
            metadata['image'], '-c', 'test -z "$(ls -A /target)"')
        run('docker', 'run', '--rm', '--user', '0', '--entrypoint', 'tar', '--mount', mount,
            '--mount', 'type=bind,source=' + str(MEDIA) + ',target=/transfer,readonly',
            metadata['image'], '-xzf', '/transfer/' + volume + '.tgz', '-C', '/target')
        stamp.write_text('ok')
    (STATE / 'expected.json').write_text(json.dumps(metadata['homes']))
    (STATE / 'prepared').write_text('ok')
    phase('prepared')

if __name__ == '__main__':
    try:
        prepare()
    except Exception:
        phase('setup-error')
        raise
