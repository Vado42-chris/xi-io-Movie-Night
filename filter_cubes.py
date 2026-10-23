"""Private live-query cubes and home layout. Never edits library or account files."""
import copy
from datetime import datetime, timezone
import fcntl
import json
import os
import secrets
import stat
from pathlib import Path
from urllib.parse import urlsplit
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent
STORE = Path.home() / 'Documents/Personal-Movies/movie-night-runtime/filter-cubes.json'
MAX_BYTES = 2 * 1024 * 1024  # Document safety bound, not a silent row-count truncation.
CONTRACT = json.loads((ROOT / 'xiio/filter-cubes.schema.json').read_text())
Draft202012Validator.check_schema(CONTRACT)
VALIDATOR = Draft202012Validator(CONTRACT)

class CubeError(Exception):
    def __init__(self, code, message, status=400):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)

def _unique(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError('Duplicate key')
        value[key] = item
    return value

def decode(raw):
    return json.loads(raw, object_pairs_hook=_unique, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))

def validate(value):
    if not VALIDATOR.is_valid(value):
        raise CubeError('invalid_cube_layout', 'The filter cube layout is invalid. Nothing was changed.')
    ids = [row['id'] for row in value['rows']]
    if len(ids) != len(set(ids)) or (value['selected_id'] is not None and value['selected_id'] not in ids):
        raise CubeError('invalid_cube_identity', 'Each filter cube needs one distinct identity.')
    for row in value['rows']:
        f = row['filters']
        through = datetime.now(timezone.utc).year if f['yearTo'] == 'present' else int(f['yearTo']) if f['yearTo'] else None
        if f['yearFrom'] and through is not None and int(f['yearFrom']) > through:
            raise CubeError('invalid_year_range', 'The end year must follow the start year.')
        if not row['name'].strip():
            raise CubeError('cube_name_required', 'Give this filter cube a name.')
    return copy.deepcopy(value)

def _directory(create=False):
    if create:
        STORE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(STORE.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    info = os.fstat(fd)
    if info.st_uid != os.getuid() or info.st_mode & 0o077:
        os.close(fd)
        raise OSError('Private directory required')
    return fd

def _read_at(directory):
    try:
        fd = os.open(STORE.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
    except FileNotFoundError:
        return copy.deepcopy(CONTRACT['default'])
    with os.fdopen(fd, 'rb') as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_size > MAX_BYTES:
            raise OSError('Unsafe cube document')
        raw = handle.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError('Too large')
    return validate(decode(raw))

def read_document():
    directory = None
    try:
        try:
            directory = _directory()
        except FileNotFoundError:
            return copy.deepcopy(CONTRACT['default'])
        return _read_at(directory)
    except (OSError, ValueError, CubeError, RecursionError, TypeError):
        raise CubeError('cube_layout_unavailable', 'Your saved cubes could not be read safely. Existing files were left alone.', 503) from None
    finally:
        if directory is not None:
            os.close(directory)

def save_document(payload):
    value = validate(payload)
    if value['revision'] >= 9007199254740990:
        raise CubeError('revision_exhausted', 'This layout cannot advance its revision.', 409)
    raw = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
    if len(raw) > MAX_BYTES:
        raise CubeError('cube_layout_too_large', 'This layout exceeds the document size limit. No rows were removed.', 413)
    directory, temporary = None, None
    try:
        directory = _directory(True)
        fd = os.open('.filter-cubes.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600, dir_fd=directory)
        with os.fdopen(fd, 'r+b') as lock:
            info = os.fstat(lock.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
                raise OSError('Unsafe lock')
            fcntl.flock(lock, fcntl.LOCK_EX)
            current = _read_at(directory)
            if current['revision'] != value['revision']:
                raise CubeError('revision_conflict', 'Your cubes changed in another window. Reload before saving; your edits are still here.', 409)
            if current == value:
                return current
            value['revision'] += 1
            raw = (json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + '\n').encode()
            if len(raw) > MAX_BYTES:
                raise CubeError('cube_layout_too_large', 'This layout exceeds the document size limit. No rows were removed.', 413)
            temporary = '.filter-cubes-' + secrets.token_hex(12)
            fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600, dir_fd=directory)
            with os.fdopen(fd, 'wb') as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, STORE.name, src_dir_fd=directory, dst_dir_fd=directory)
            temporary = None
            os.fsync(directory)
            observed = _read_at(directory)
            if observed != value:
                raise OSError('Readback failed')
            return observed
    except CubeError:
        raise
    except (OSError, ValueError, RecursionError, TypeError):
        raise CubeError('cube_save_failed', 'The filter cube layout could not be saved safely.', 503) from None
    finally:
        if directory is not None:
            if temporary:
                try: os.unlink(temporary, dir_fd=directory)
                except OSError: pass
            os.close(directory)

def handle(handler):
    route = urlsplit(handler.path).path
    if route not in ('/api/filter-cubes', '/api/filter-cubes/declaration'):
        return False
    try:
        hosts = {f'127.0.0.1:{handler.server.server_port}', f'localhost:{handler.server.server_port}'}
        if handler.headers.get('Host') not in hosts:
            raise CubeError('invalid_origin', 'Use the local Movie Night address.', 403)
        if handler.command in ('GET', 'HEAD'):
            handler.json_response(200, CONTRACT if route.endswith('/declaration') else read_document())
            return True
        if handler.command != 'POST' or route != '/api/filter-cubes':
            raise CubeError('method_not_allowed', 'Unsupported filter cube operation.', 405)
        origin = handler.headers.get('Origin')
        if (handler.headers.get('X-Movie-Night') != '1' or handler.headers.get('Sec-Fetch-Site') == 'cross-site'
                or (origin and origin not in {'http://' + host for host in hosts})):
            raise CubeError('invalid_origin', 'Use Movie Night to edit filter cubes.', 403)
        try:
            length = int(handler.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_BYTES or handler.headers.get('Transfer-Encoding') or handler.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                raise ValueError()
            handler.connection.settimeout(10)
            raw = handler.rfile.read(length)
            if len(raw) != length: raise ValueError()
            payload = decode(raw)
        except (ValueError, OSError, TypeError, RecursionError):
            raise CubeError('invalid_cube_document', 'The cube document could not be read. Nothing was changed.') from None
        # Compatibility, not permission: old clients normalize an unknown rolling
        # bound to empty. Refuse their writes before they can erase that meaning.
        payload = validate(payload)
        current = read_document()
        uses_rolling = any(row.get('filters', {}).get('yearTo') == 'present'
                           for document in (current, payload) if isinstance(document, dict)
                           for row in document.get('rows', []) if isinstance(row, dict))
        if uses_rolling and handler.headers.get('X-Movie-Night-Cube-Features') != ','.join(CONTRACT['x-write-features']):
            raise CubeError('cube_writer_update_required', 'This cube uses a newer year rule. Reopen Movie Night before saving; your stored cubes were not changed.', 409)
        handler.json_response(200, save_document(payload))
    except CubeError as error:
        handler.json_response(error.status, {'error': error.message, 'code': error.code})
    return True
