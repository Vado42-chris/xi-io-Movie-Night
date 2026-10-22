#!/usr/bin/env python3
"""Copy the pinned Studio component closure into the isolated personal app.

Managed repositories are read only. Missing donor modules are copied verbatim
from the currently qualified Studio renderer and recorded with their hashes.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import subprocess

REPO = Path('/home/chrishallberg/.local/share/xi-io/repos/xi-io-studio')
PIN = '94c49141a132ed00cdd72d0457911fc40523794f'
PREFIX = 'base44-donor/xi-io-node/'
QUALIFIED = Path('/media/chrishallberg/Storage 22/001_Flatpack_installs/xi-io-studio/workspaces/base44-app-qualified')
DEST = Path('/home/chrishallberg/Documents/Personal-Movies/movie-night/studio-shell/vendor')
EXTERNAL_BOUNDARY = {'src/api/base44Client', 'src/api/base44Client.js'}
EXTENSIONS = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.css', '/index.js', '/index.jsx']
cache = {}
manifest = []
missing = []
packages = set()

def source(path):
    if path in cache:
        return cache[path]
    result = subprocess.run(['git', '-C', str(REPO), 'show', f'{PIN}:{PREFIX}{path}'], capture_output=True, timeout=8)
    if result.returncode == 0:
        value = (result.stdout, {'kind': 'git', 'commit': PIN, 'path': PREFIX + path})
    elif (QUALIFIED / path).is_file():
        value = ((QUALIFIED / path).read_bytes(), {'kind': 'qualified-renderer', 'path': str(QUALIFIED / path)})
    else:
        value = None
    cache[path] = value
    return value

def resolve(path):
    import posixpath
    path = posixpath.normpath(path)
    if path in EXTERNAL_BOUNDARY:
        return None
    for extension in EXTENSIONS:
        candidate = path + extension
        if source(candidate):
            return candidate
    return False

def imports(text, path):
    result = re.findall(r'(?:import|export)\s+(?:[\w*\s{},$]+\s+from\s*)?[\'"]([^\'"]+)[\'"]', text)
    result += re.findall(r'import\(\s*[\'"]([^\'"]+)[\'"]', text)
    if path.endswith('.css'):
        result += re.findall(r'@import\s+(?:url\()?\s*[\'"]([^\'"]+)[\'"]', text)
    return result

queue = ['src/components/desktop/WindowFrame.jsx', 'src/components/chat/ChatSnapControl.jsx', 'src/lib/snapGuide.jsx', 'src/index.css']
seen = set()
while queue:
    path = queue.pop(0)
    if path in seen:
        continue
    seen.add(path)
    entry = source(path)
    if entry is None:
        missing.append({'path': path, 'from': 'entrypoint'})
        continue
    data, provenance = entry
    destination = DEST / path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    manifest.append({'file': path, 'sha256': hashlib.sha256(data).hexdigest(), 'source': provenance})
    if path.endswith(('.js', '.jsx', '.mjs', '.ts', '.tsx', '.css')):
        for name in imports(data.decode('utf-8'), path):
            if name.startswith('@/'):
                requested = 'src/' + name[2:]
            elif name.startswith('.'):
                requested = str(PurePosixPath(path).parent / name)
            elif path.endswith('.css') and not name.startswith(('http:', 'https:', 'data:')):
                requested = str(PurePosixPath(path).parent / name)
            else:
                packages.add(name)
                continue
            dependency = resolve(requested)
            if dependency is False:
                missing.append({'path': requested, 'from': path})
            elif dependency:
                queue.append(dependency)

for original, target in [('tailwind.config.js', 'tailwind.config.cjs')]:
    data, provenance = source(original)
    (DEST / target).write_bytes(data)
    manifest.append({'file': target, 'sha256': hashlib.sha256(data).hexdigest(), 'source': provenance})

record = {'schema': 'movie-night.studio-donor/v1', 'pin': PIN, 'files': manifest, 'missing': missing, 'packages': sorted(packages), 'service_boundary': '@/api/base44Client is supplied by host/studio-services.js; unbound managed services refuse calls.'}
(DEST / 'provenance.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'files': len(manifest), 'fallback_files': [x['file'] for x in manifest if x['source']['kind'] != 'git'], 'missing': missing, 'packages': sorted(packages)}))
raise SystemExit(1 if missing else 0)
