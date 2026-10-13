#!/usr/bin/env python3
"""Cloud proxy fallback for exact Electrobun 2.0.2 / Hutch 0.27.1 artifacts.

Uses official HTTPS manifests, validates declared size and SHA-256 before safe
extraction, then invokes Hutch's own offline validation and SDK projection.
Normal machines should use `electrobun prepare` directly.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import urllib.request
import zipfile

USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36'
VERSION = '2.0.2'
COTTONTAIL = '0.7.1'


def fetch(url, accept='application/octet-stream'):
    if not url.startswith('https://'):
        raise ValueError('Artifacts must use HTTPS')
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': accept})
    return urllib.request.urlopen(request, timeout=60)


def fetch_json(url):
    with fetch(url, 'application/json') as response:
        return json.loads(response.read(1024 * 1024))


def download(artifact, destination):
    expected = artifact['sha256']
    if len(expected) != 64 or any(c not in '0123456789abcdef' for c in expected):
        raise ValueError('Invalid official checksum')
    if destination.is_file() and destination.stat().st_size == artifact['size']:
        if hashlib.sha256(destination.read_bytes()).hexdigest() == expected:
            return destination
    temporary = destination.with_suffix(destination.suffix + '.tmp')
    hasher, total = hashlib.sha256(), 0
    with fetch(artifact['url']) as response, temporary.open('wb') as output:
        while data := response.read(1024 * 1024):
            total += len(data)
            if total > artifact['size']:
                raise ValueError('Artifact exceeds declared size')
            hasher.update(data)
            output.write(data)
    if total != artifact['size'] or hasher.hexdigest() != expected:
        temporary.unlink(missing_ok=True)
        raise ValueError('Artifact size/checksum mismatch')
    temporary.replace(destination)
    print('Verified', destination.name, total, expected, flush=True)
    return destination


def unpack_tar(archive, destination, strip=0):
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, 'r:gz') as files:
        for member in files.getmembers():
            relative = PurePosixPath(member.name)
            if relative.is_absolute() or '..' in relative.parts or member.issym() or member.islnk():
                raise ValueError('Unsafe archive member')
            relative = PurePosixPath(*relative.parts[strip:])
            if str(relative) == '.':
                continue
            member.name = str(relative)
            files.extract(member, destination, filter='data')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', type=Path, default=Path('/workspace/chocoBones'))
    parser.add_argument('--tools', type=Path, default=Path('/workspace/.tools'))
    arguments = parser.parse_args()
    tools, workspace = arguments.tools.resolve(), arguments.workspace.resolve()
    home, archives = tools / 'hutch', tools / 'hutch-downloads'
    archives.mkdir(parents=True, exist_ok=True)
    environment = {**os.environ, 'HUTCH_HOME': str(home), 'NODE_USE_ENV_PROXY': '1'}
    launcher = workspace / 'node_modules/.bin/electrobun'
    # The npm bootstrap performs its own verified Hutch installation.
    subprocess.run([str(launcher), 'prepare'], cwd=workspace, env=environment, check=False)

    manifest = fetch_json(f'https://electrobun-artifacts.blackboard.sh/cottontail/releases/{COTTONTAIL}/manifest.json')
    assert manifest['version'] == COTTONTAIL and manifest['product'] == 'cottontail' and manifest['schema'] == 1
    artifact = manifest['platforms']['linux-x64']['archive']
    assert artifact['url'].startswith('https://electrobun-artifacts.blackboard.sh/cottontail/')
    target = home / 'releases/cottontail' / COTTONTAIL / manifest['revision'] / 'linux-x64'
    if (target / '.dash-installed').exists():
        assert (target / '.dash-installed').read_text().strip() == artifact['sha256'], 'Cached Cottontail identity differs from official checksum'
    else:
        unpack_tar(download(artifact, archives / f'cottontail-{COTTONTAIL}-linux-x64.tar.gz'), target, strip=1)
        metadata = json.loads((target / 'cottontail-release.json').read_text())
        assert metadata['version'] == COTTONTAIL and metadata['revision'] == manifest['revision'] and metadata['platform'] == 'linux-x64'
        (target / '.dash-installed').write_text(artifact['sha256'])

    index = fetch_json(f'https://github.com/blackboardsh/electrobun/releases/download/v{VERSION}/electrobun-artifacts.json')
    assert index['schemaVersion'] == 1 and index['product'] == {'name': 'electrobun', 'version': VERSION}
    target = home / 'releases/electrobun' / VERSION / 'linux-x64'
    for kind in ('core', 'cef'):
        artifact = index['platforms']['linux-x64'][kind]
        assert artifact['url'].startswith(f'https://github.com/blackboardsh/electrobun/releases/download/v{VERSION}/')
        marker = target / ('.core-complete' if kind == 'core' else 'cef/.cef-complete')
        if marker.exists():
            assert marker.read_text().strip() == artifact['sha256'], 'Cached Electrobun identity differs from official checksum'
        else:
            unpack_tar(download(artifact, archives / f'electrobun-{VERSION}-{kind}-linux-x64.tar.gz'), target)
            if kind == 'core':
                metadata = json.loads((target / 'native-devkit.json').read_text())
                assert metadata['product'] == index['product'] and metadata['target'] == {'os': 'linux', 'arch': 'x64'}
            else:
                assert (target / 'cef/libcef.so').is_file() and (target / 'cef/icudtl.dat').is_file()
            marker.write_text(artifact['sha256'] + '\n')

    devkit = json.loads((target / 'native-devkit.json').read_text())
    bun_version = devkit['toolchains']['bun']['defaultVersion']
    release = fetch_json(f'https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v{bun_version}')
    asset = next(item for item in release['assets'] if item['name'] == 'bun-linux-x64.zip')
    assert asset['digest'].startswith('sha256:')
    artifact = {'url': asset['browser_download_url'], 'size': asset['size'], 'sha256': asset['digest'][7:]}
    assert artifact['url'].startswith(f'https://github.com/oven-sh/bun/releases/download/bun-v{bun_version}/')
    target = home / 'toolchains/bun' / bun_version / 'linux-x64'
    if not (target / '.hutch-toolchain').exists():
        target.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(download(artifact, archives / f'bun-linux-x64-{bun_version}.zip')) as files:
            for member in files.infolist():
                relative = PurePosixPath(member.filename)
                if relative.is_absolute() or '..' in relative.parts:
                    raise ValueError('Unsafe zip member')
                relative = PurePosixPath(*relative.parts[1:])
                if str(relative) == '.':
                    continue
                destination = target / str(relative)
                if member.is_dir():
                    destination.mkdir(parents=True, exist_ok=True)
                else:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(files.read(member))
        (target / 'bun').chmod(0o755)
        assert subprocess.check_output([str(target / 'bun'), '--version'], text=True).strip() == bun_version
        (target / '.hutch-toolchain').write_text(bun_version + '\n')
    environment['DASH_RELEASE_OFFLINE'] = '1'
    subprocess.run([str(launcher), 'prepare'], cwd=workspace, env=environment, check=True)
    print('Electrobun SDK prepared with HTTPS/checksum verification intact.', flush=True)


if __name__ == '__main__':
    main()
