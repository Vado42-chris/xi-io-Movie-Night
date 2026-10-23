/* Episode continuation for the existing Movie Night player.
 * Pure typed selection only: NO HTTP, playback, timer, storage, or process authority.
 */
const ID = /^tt[0-9]{5,12}$/;
const SOURCE = /^[A-Za-z0-9_-]{24,64}$/;

export function nextSeriesEpisode(series, current) {
  if (!series || !current || !ID.test(String(series.imdbId || ''))
      || series.imdbId !== current.imdb_id || current.type !== 'series'
      || !Number.isInteger(current.season) || !Number.isInteger(current.episode)
      || current.season < 0 || current.episode < 1
      || series.episodesLoaded !== true || !Array.isArray(series.episodes)) return null;
  const valid = series.episodes.filter(row => row && Number.isInteger(row.season)
    && Number.isInteger(row.episode) && row.season >= 0 && row.episode >= 1
    && row.id === `${series.imdbId}:${row.season}:${row.episode}`);
  const desired = valid.find(row => row.season === current.season && row.episode === current.episode + 1)
    || (current.season > 0 ? valid.find(row => row.season === current.season + 1 && row.episode === 1) : null);
  if (!desired) return null; // No guessed/skipped episodes, seasons or specials.
  if (valid.filter(row => row.id === desired.id).length !== 1) return null;
  return Object.freeze({ imdb_id: series.imdbId, title: series.title,
    type: 'series', season: desired.season, episode: desired.episode,
    episode_title: desired.title || `Episode ${desired.episode}` });
}

export function chooseEligibleNextSource(reply, target, preferred = null) {
  if (!reply || !target || reply.imdb_id !== target.imdb_id || reply.type !== 'series'
      || reply.season !== target.season || reply.episode !== target.episode
      || !Array.isArray(reply.sources)) return null;
  const matches = reply.sources.filter(source => source && typeof source.id === 'string'
    && SOURCE.test(source.id) && source.quality && source.quality !== 'unknown');
  if (!matches.length) return null;
  // Preserve the prior language hint when the provider actually reports one;
  // this is not proof of decoder track availability.
  const languages = Array.isArray(preferred?.languages) ? preferred.languages.filter(x => typeof x === 'string') : [];
  const preferredLanguage = languages.length ? matches.find(s => Array.isArray(s.languages)
    && languages.some(lang => s.languages.includes(lang))) : null;
  const preferredQuality = preferred?.quality ? matches.find(s => s.quality === preferred.quality) : null;
  return Object.freeze({ id: (preferredLanguage || preferredQuality || matches[0]).id });
}
