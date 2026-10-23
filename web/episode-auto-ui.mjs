/* Existing Movie Night episodic player, single-session presentation controller.
 * No separate storage, transport, process or authority plane. Default OFF.
 */
import { nextSeriesEpisode, chooseEligibleNextSource } from '/episode-autonext.mjs';

export function mountEpisodeAutoContinue({ doc = document, request, start, isBusy, notify }) {
  const box = doc.getElementById('player-next-prompt');
  const description = doc.getElementById('player-next-description');
  const now = doc.getElementById('player-next-now');
  const cancelButton = doc.getElementById('player-next-cancel');
  const toggle = doc.getElementById('player-auto-next');
  const toggleWrap = doc.getElementById('player-auto-next-wrap');
  let enabled = false;
  let episodeContext = null;
  let generation = 0;
  let timeout = null;
  let pending = null;
  let completedKey = '';
  let status = null;

  const same = (target, current) => target && current
    && target.imdb_id === current.imdb_id && current.type === 'series'
    && target.season === current.season && target.episode === current.episode;
  function dismiss() {
    if (timeout !== null) clearTimeout(timeout);
    timeout = null; pending = null; box.hidden = true;
  }
  function cancel() {
    generation++;
    dismiss();
  }
  function remember(series, target, preference = null) {
    cancel();
    completedKey = '';
    episodeContext = series?.episodesLoaded === true && same(target, {
      ...target, type:'series'
    }) ? {series, target, preference} : null;
  }
  async function advance(ticket) {
    if (ticket !== generation || isBusy()) { cancel(); return; }
    const queued = pending;
    if (!queued || !same(episodeContext?.target, status)) { cancel(); return; }
    dismiss();
    description.textContent = 'Checking the next episode’s available sources…';
    box.hidden = false;
    now.hidden = true;
    cancelButton.hidden = false;
    try {
      const result = await request('sources', {
        imdb_id: queued.imdb_id, title: queued.title, type:'series',
        season: queued.season, episode: queued.episode
      });
      if (ticket !== generation || !same(episodeContext?.target, status) || isBusy()) return;
      const source = chooseEligibleNextSource(result, queued, episodeContext?.preference);
      if (!source) {
        notify('No eligible cached stream was found for the next episode. Choose a source manually.');
        return;
      }
      // Once the native play request is dispatched, Cancel cannot revoke that
      // already-issued media effect. Keep it available through source lookup.
      cancelButton.hidden = true;
      const started = await start(queued, source.id, () => ticket === generation && enabled,
        episodeContext?.target);
      if (ticket !== generation || !started) {
        if (ticket === generation && !started) notify('The next episode could not start. Playback was not changed.');
        return;
      }
      const original = episodeContext;
      remember(original.series, queued, result.sources.find(s => s.id === source.id) || null);
    } catch {
      if (ticket === generation) notify('Next episode unavailable. Choose a source manually.');
    } finally {
      if (ticket === generation) dismiss();
    }
  }
  function tick(ticket, deadline) {
    if (ticket !== generation || !pending) return;
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    description.textContent = `Up next: S${String(pending.season).padStart(2,'0')}E${String(pending.episode).padStart(2,'0')} · ${pending.episode_title} · ${left}s`;
    box.hidden = false;
    now.hidden = false;
    cancelButton.hidden = false;
    timeout = left > 0 ? setTimeout(() => tick(ticket, deadline), 300) : null;
    if (left === 0) void advance(ticket);
  }
  function observe(nextStatus) {
    status = nextStatus;
    const active = nextStatus?.type === 'series'
      && ['playing','paused','loading','ended'].includes(nextStatus.state);
    toggleWrap.hidden = !active;
    if (!active || !enabled || !episodeContext || !same(episodeContext.target, nextStatus)) {
      if (pending) cancel();
      return;
    }
    if (nextStatus.state !== 'ended' || pending) return;
    const key = `${nextStatus.imdb_id}:${nextStatus.season}:${nextStatus.episode}`;
    if (completedKey === key) return;
    completedKey = key;
    const candidate = nextSeriesEpisode(episodeContext.series, nextStatus);
    if (!candidate) {
      notify('No verified next episode is available in this series. Auto-play stopped.');
      return;
    }
    pending = candidate;
    const ticket = ++generation;
    tick(ticket, Date.now() + 10000);
  }
  const onChange = () => {
    enabled = toggle.checked;
    if (!enabled) { cancel(); return; }
    completedKey = '';
    if (status) observe(status);
  };
  const onCancel = () => {
    cancel();
    notify('Next episode cancelled. Your current playback is unchanged.');
  };
  const onNow = () => { if (pending) { if (timeout !== null) clearTimeout(timeout); timeout=null; void advance(generation); } };
  toggle.addEventListener('change', onChange);
  cancelButton.addEventListener('click', onCancel);
  now.addEventListener('click', onNow);
  return Object.freeze({remember, observe, cancel, isEnabled:()=>enabled, destroy() {
    cancel(); toggle.removeEventListener('change',onChange);
    cancelButton.removeEventListener('click',onCancel); now.removeEventListener('click',onNow);
  }});
}
