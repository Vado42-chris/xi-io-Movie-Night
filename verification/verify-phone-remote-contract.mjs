import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedRemoteCapability, acceptedRemoteInvitation } from '../studio-shell/src/phone-remote-contract.mjs';

const now = Date.parse('2026-10-22T22:00:00Z');
const caps = () => ({
  schema: 'movie-night.phone-remote-capabilities/v1',
  application_ref: 'personal:movie-night',
  state: 'PAIRING_READY',
  transport: 'https',
  pairing_origin: 'https://remote.example.test/',
});
const offered = () => ({
  schema: 'movie-night.phone-remote-pairing/v1',
  state: 'OFFERED',
  application_ref: 'personal:movie-night',
  method: 'single-use-approved-session',
  url: 'https://remote.example.test/remote/pair/one-use-opaque',
  expires_at: new Date(now + 90_000).toISOString(),
  qr_png: 'data:image/png;base64,' + 'A'.repeat(320),
});

test('valid native capability is a display gate, not an authority grant', () => {
  assert.equal(acceptedRemoteCapability(caps()).origin, 'https://remote.example.test');
});
test('absent, forged, insecure and wrong-purpose capability is rejected', () => {
  const a = caps();
  for (const mutation of [
    { state: 'RUNNING' }, { state: 'UNQUALIFIED' }, { transport: 'http' },
    { schema: 'movie-night.phone-remote-capabilities/v2' },
    { application_ref: 'xiio:hex' },
    { pairing_origin: 'http://remote.example.test/' },
    { pairing_origin: 'https://user:pass@remote.example.test/' },
    { pairing_origin: 'https://remote.example.test/path' },
    { pairing_origin: 'https://remote.example.test/?q=x' },
    { pairing_origin: 'https://remote.example.test/#secret' },
    { pairing_origin: 'not a url' }
  ]) assert.equal(acceptedRemoteCapability({ ...a, ...mutation }), null, JSON.stringify(mutation));
  assert.equal(acceptedRemoteCapability(null), null);
});
test('one-use bounded invitation is displayable only under exact capability', () => {
  const result = acceptedRemoteInvitation(offered(), acceptedRemoteCapability(caps()), now);
  assert.equal(result.url, offered().url);
  assert.equal(result.expiresAt, now + 90_000);
  assert.ok(result.image.startsWith('data:image/png;base64,'));
});
test('cross-origin, stale, wrong-path and non-image invitations are rejected', () => {
  const cap = acceptedRemoteCapability(caps());
  const sample = offered();
  for (const mutation of [
    { schema: 'unknown' }, { state: 'REVOKED' }, { state: 'READY' },
    { application_ref: 'xiio:hex' }, { method: 'bearer-session-token' },
    { url: 'http://remote.example.test/remote/pair/x' },
    { url: 'https://wrong.example.test/remote/pair/x' },
    { url: 'https://remote.example.test/cli/v1/publish/cube' },
    { url: 'https://remote.example.test/remote/pair/x#token' },
    { url: 'https://u:p@remote.example.test/remote/pair/x' },
    { expires_at: new Date(now - 1).toISOString() },
    { expires_at: new Date(now + 130_000).toISOString() },
    { expires_at: 'not a date' },
    { qr_png: '<svg onload=alert(1) />' },
    { qr_png: 'data:image/svg+xml;base64,' + 'A'.repeat(320) },
    { qr_png: 'data:image/png;base64,x' },
    { qr_png: 'data:image/png;base64,' + 'A'.repeat(131000) },
  ]) assert.equal(acceptedRemoteInvitation({ ...sample, ...mutation }, cap, now), null, JSON.stringify(mutation).slice(0,200));
  assert.equal(acceptedRemoteInvitation(sample, null, now), null);
});
test('offer cannot be replayed after its expiry', () => {
  assert.equal(acceptedRemoteInvitation(offered(), acceptedRemoteCapability(caps()), now + 90_001), null);
});
