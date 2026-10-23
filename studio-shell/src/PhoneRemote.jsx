import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, X, Copy, Check } from 'lucide-react';
import { acceptedRemoteCapability, acceptedRemoteInvitation } from './phone-remote-contract.mjs';

/*
 * Movie Night's existing Tauri shell owns this disclosure.
 * No pairing is created until the human presses "Pair this phone".
 * No UI "ready" state is inferred from a healthy HEX tunnel, a URL,
 * or a source-only flag. Only the admitted Movie Night session endpoint
 * can return a redeemable one-use invitation.
 */
const CAPABILITIES = '/api/phone-remote/capabilities';
const PAIR = '/api/phone-remote/pairings';
const APP = 'personal:movie-night';


async function loadJson(url, options) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options });
  if (!response.ok) throw Error('not_available');
  return response.json();
}

export default function PhoneRemote({ native = false }) {
  const [capability, setCapability] = useState(null);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const panel = useRef(null);
  const opener = useRef(null);
  const pending = useRef(null);

  useEffect(() => {
    if (!native) return undefined;
    const controller = new AbortController();
    loadJson(CAPABILITIES, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setCapability(acceptedRemoteCapability(value)); })
      .catch(() => { if (!controller.signal.aborted) setCapability(null); });
    return () => controller.abort();
  }, [native]);

  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (opened && !dialog.open) dialog.showModal();
    else if (!opened && dialog.open) dialog.close();
  }, [opened]);

  function close() {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setInvitation(null);
    setNotice('');
    setCopied(false);
    setOpened(false);
    opener.current?.focus({ preventScroll: true });
  }

  async function offer() {
    if (!capability || busy) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setNotice('');
    setInvitation(null);
    try {
      const data = await loadJson(PAIR, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-movie-night': '1' },
        body: JSON.stringify({ operation: 'PAIR_MOVIE_NIGHT_PHONE', application_ref: APP }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const accepted = acceptedRemoteInvitation(data, capability);
      if (!accepted) throw Error('unqualified');
      setInvitation(accepted);
    } catch {
      if (!controller.signal.aborted) setNotice('Phone pairing is not available. Movie Night and your playback are unchanged.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  async function copyLink() {
    if (!invitation || invitation.expiresAt <= Date.now()) {
      setNotice('This pairing invitation expired. Create a new one.');
      setInvitation(null);
      return;
    }
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
    } catch { setNotice('Could not copy the link. You can scan the QR instead.'); }
  }

  // No misleading button or decorative QR unless the native session endpoint
  // actually advertises a qualified HTTPS pairing capability.
  if (!native || !capability) return null;

  return <>
    <button ref={opener} type="button" className="native-title-action native-title-icon"
      aria-label="Pair phone remote" title="Phone remote" aria-haspopup="dialog"
      onClick={() => { setOpened(true); setInvitation(null); setNotice(''); }}>
      <Smartphone size={17} aria-hidden="true" />
    </button>
    <dialog ref={panel} className="movie-phone-dialog" aria-label="Pair Phone Remote"
      onCancel={event => { event.preventDefault(); close(); }} onClose={() => { if (opened) close(); }}>
      <div className="movie-phone-heading">
        <h2>Phone Remote</h2>
        <button type="button" onClick={close} aria-label="Close phone pairing"><X size={22} /></button>
      </div>
      <p>Scan once to open Movie Night on your phone. Control only this player, not Aries or HEX.</p>
      {!invitation && <button type="button" className="movie-phone-primary" onClick={offer} disabled={busy}>
        {busy ? 'Preparing secure pairing…' : 'Pair this phone'}
      </button>}
      {invitation && <div className="movie-phone-offer">
        <div className="movie-phone-qr"><img src={invitation.image} alt="Scan to pair your phone with Movie Night" width="192" height="192" /></div>
        <p>Single-use invitation · expires shortly. Approve the phone in Movie Night to connect.</p>
        <button type="button" onClick={copyLink}><>{copied ? <Check size={18} /> : <Copy size={18} />}</>{copied ? 'Copied link' : 'Copy pairing link'}</button>
      </div>}
      {notice && <p role="status" className="movie-phone-notice">{notice}</p>}
    </dialog>
  </>;
}
