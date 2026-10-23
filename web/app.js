"use strict";

(async () => {
  document.body.classList.toggle("studio-embedded", new URLSearchParams(location.search).get("studio") === "1");
  const byId = (id) => document.getElementById(id);
  const elements = {
    siteTitle: byId("site-title"), title: byId("collection-title"), description: byId("collection-description"),
    total: byId("collection-total"), pickerWrap: byId("collection-picker-wrap"), picker: byId("collection-picker"),
    search: byId("film-search"), genre: byId("genre-filter"), sort: byId("film-sort"),
    count: byId("results-count"), reset: byId("clear-filters"), grid: byId("film-grid"),
    empty: byId("empty-state"), error: byId("error-state"), footer: byId("footer-count"),
    dialog: byId("film-dialog"), dialogPoster: byId("dialog-poster"), dialogRank: byId("dialog-rank"),
    dialogTitle: byId("dialog-title"), dialogMeta: byId("dialog-meta"), dialogGenres: byId("dialog-genres"),
    dialogDescription: byId("dialog-description"),
  };
  const { CenteredCarousel, mountFilterCubes } = await import("/filter-cubes.mjs");
  let cubeHome = null, detailCarousel = null, activeCubeLabel = "";
  let collections = [];
  let curatedCollections = [];
  let collection = null;
  let personalLibrary = { favorites: [], recent: [], watched: [], collections: [], imported_at: null };
  let libraryAvailable = false;
  let favoriteKeys = new Set();
  let watchedKeys = new Set();
  let historyByKey = new Map();
  let providerMembership = new Map();
  const favoritePending = new Set();
  const defaultFilters = () => ({ yearFrom: "", yearTo: "", include: [], exclude: [], genreMode: "any", rating: 0, runtime: "", type: "", watch: "", provider: "" });
  let filters = defaultFilters();
  const savedViewsKey = "movie-night.filter-views.v1";
  let savedViews = [];
  let declared, schema;
  try {
    declared = await import('/settings-contract.mjs');
    const response = await fetch('/api/settings/declaration', { cache: 'no-store' });
    if (!response.ok) throw new Error('declaration_unavailable');
    schema = declared.qualify(await response.json());
  } catch {
    const notice = document.createElement('p'); notice.setAttribute('role', 'alert');
    notice.textContent = 'Movie Night could not load its settings declaration. Reload when the local service is available.';
    document.body.prepend(notice);
    return;
  }
  let wallSettings = declared.defaults(schema);
  let settingsEpoch = 0;
  let settingsLoaded = false;
  let startupApplied = false;
  let lastPublishedContext = "";
  const sourceLabels = { top: "Popular", imdbRating: "Featured", year: "By year" };
  const currentYear = new Date().getFullYear();
  const fallbackGenres = ["Action", "Adventure", "Animation", "Biography", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Mystery", "Romance", "Sci-Fi", "Sport", "Thriller", "War", "Western"];
  let catalogueDirectory = ["movie", "series"].flatMap((type) => Object.keys(sourceLabels).map((catalog) => ({
    type, catalog, genre_options: catalog === "year" ? [] : [...fallbackGenres, ...(type === "series" ? ["Reality-TV", "Talk-Show", "Game-Show"] : [])],
    year_options: catalog === "year" ? Array.from({ length: currentYear - (type === "movie" ? 1920 : 1960) + 1 }, (_, index) => currentYear - index) : [],
  })));
  const browseCollections = Object.fromEntries(["movie", "series"].map((type) => [type, {
    id: `browse-${type}`, name: type === "movie" ? "A world of movies." : "Find your next series.",
    description: type === "movie" ? "A wider catalogue, one good discovery at a time." : "Explore TV series, choose an episode, and check its available streams.",
    movies: [], kind: "browse", type, loaded: false, loading: false, hasMore: true, nextSkip: 0, search: "", error: "",
    catalog: "top", catalogGenre: "", catalogYear: String(currentYear), pages: 0, generation: 0, controller: null,
  }]));
  let loadController;
  let selectedMovie = null;
  let selectedEpisode = null, selectedSeason = null;
  // Presentation only, scoped by canonical episode identity in this mounted
  // window. No new library/settings store or watched-state write.
  const revealedEpisodeDetails = new Set();
  let hideEpisodeArt = false;
  let visibleMovies = [];
  let carouselIndex = 0;
  let detailsExpanded = false;
  let detailController = null;
  let detailGeneration = 0;
  let wallReturn = { scroll: 0, focus: null };
  let sourceGeneration = 0;
  let sourceController = null;
  let sourceBusy = false;
  let sourceChoices = [];
  let sourceTitle = "";
  let selectedSource = "";
  let sourceError = "";
  let launchPending = false;
  let commandPending = false;
  let pollTimer;
  let statusPending = false;
  let playerRevision = 0;
  let playerConnected = false;
  let dockDismissed = false;
  let nativePlayerMode = false;
  let nativeFullscreen = false;
  let miniPlayer = false;
  let controlsTimer;
  let lastTrackSignature = "";
  let nativeActionPending = false;
  let nativeHeightTimer;
  let lastNativeHeight = 0;
  let nativeHeightSupported = true;
  let initialMovieOpened = false;
  let playerStatus = { state: "idle", title: "", imdb_id: "", position: 0, duration: 0, volume: 100, muted: false, fullscreen: false };
  const playerStates = new Set(["idle", "loading", "playing", "paused", "error"]);
  const player = {
    play: byId("play-on-aries"), playLabel: byId("play-on-aries-label"), feedback: byId("playback-feedback"),
    dock: byId("player-dock"), artwork: byId("player-artwork"), title: byId("player-title"),
    state: byId("player-state"), toggle: byId("player-toggle"), toggleIcon: byId("player-toggle-icon"),
    toggleLabel: byId("player-toggle-label"), stop: byId("player-stop"), timeline: byId("player-timeline"),
    position: byId("player-position"), duration: byId("player-duration"), seek: byId("player-seek"),
    messageWrap: byId("player-message-wrap"), message: byId("player-message"), reconnect: byId("player-reconnect"),
    back: byId("player-back"), forward: byId("player-forward"), mute: byId("player-mute"),
    volume: byId("player-volume"), volumeValue: byId("player-volume-value"), volumeIcon: byId("player-volume-icon"),
    fullscreen: byId("player-fullscreen"), fullscreenIcon: byId("player-fullscreen-icon"), fullscreenLabel: byId("player-fullscreen-label"),
    deviceStatus: byId("device-status"), deviceIndicator: byId("device-indicator"),
    viewActions: byId("player-view-actions"), wall: byId("player-wall"), watch: byId("player-watch"),
    close: byId("player-close"), controls: byId("player-controls"), secondary: byId("player-secondary"), volumeGroup: byId("player-volume-group"),
  };

  const text = (value) => typeof value === "string" ? value.trim() : "";
  const normalize = (value) => String(value).normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  const filmCount = (count) => `${count} ${count === 1 ? "film" : "films"}`;
  const titleCount = (count) => `${count} ${count === 1 ? "title" : "titles"}`;
  const movieKey = (movie) => `${movie.type}:${movie.id || movie.imdbId}`;

  function publishContext() {
    if (parent === window) return;
    const ids = visibleMovies.map(movie => `${movie.type}:${movie.imdbId}`).filter(id => /^(movie|series):tt\d{5,12}$/.test(id));
    const context = { type: "movie-night:context", view: nativePlayerMode ? "playback" : "browsing", collectionId: collection?.id || null, mediaType: collection?.type || null, catalog: collection?.kind === "browse" ? collection.catalog : null,
      selection: { ids: ids.slice(0, 1000), name: activeCubeLabel || collection?.name || "This selection", count: ids.length, limited: ids.length > 1000,
        selected: selectedMovie ? `${selectedMovie.type}:${selectedMovie.imdbId}` : null, title: selectedMovie?.title || null } };
    const serialized = JSON.stringify(context);
    if (serialized !== lastPublishedContext) {
      lastPublishedContext = serialized;
      parent.postMessage(context, location.origin);
    }
  }

  function syncCatalogueAvailability() {
    const enabled = wallSettings.plugins.cinemeta_enabled;
    document.querySelectorAll('[data-collection="browse-movie"], [data-collection="browse-series"]').forEach((button) => {
      button.disabled = !enabled;
      button.title = enabled ? "" : "Enable Cinemeta catalogue browsing in Settings";
    });
    for (const option of elements.picker.options) {
      if (["browse-movie", "browse-series"].includes(option.value)) option.disabled = !enabled;
    }
    for (const id of ["catalog-source", "catalog-genre", "catalog-year", "catalog-search", "catalog-search-button"]) byId(id).disabled = !enabled;
    byId("catalog-availability").hidden = enabled;
  }

  function applyWallSettings(value) {
    const settings = value?.settings || value;
    if (!declared.accepts(schema, settings)) return false;
    const wasEnabled = wallSettings.plugins.cinemeta_enabled;
    wallSettings = structuredClone(settings);
    document.body.dataset.cardSize = wallSettings.browsing.card_size;
    document.body.dataset.showRatings = String(wallSettings.browsing.show_ratings);
    const seconds = wallSettings.playback.seek_seconds;
    for (const [button, forward] of [[player.back, false], [player.forward, true]]) {
      button.querySelector("span").textContent = `${forward ? "+" : "−"}${seconds}s`;
      button.setAttribute("aria-label", `Go ${forward ? "forward" : "back"} ${seconds} seconds on Aries`);
      button.title = `${forward ? "Ahead" : "Back"} ${seconds} seconds`;
    }
    if (wasEnabled !== wallSettings.plugins.cinemeta_enabled) {
      Object.values(browseCollections).forEach(invalidateBrowse);
      if (!wallSettings.plugins.cinemeta_enabled && detailController) {
        detailController.abort();
        detailController = null;
        detailGeneration += 1;
        const status = byId("dialog-metadata-status");
        status.textContent = "Catalogue details are turned off in Settings. Your saved title information is still here.";
        status.hidden = false;
      }
    }
    syncCatalogueAvailability();
    if (collection) selectCollection(collection.id);
    if (selectedMovie && !elements.dialog.hidden) renderFilmDetails(selectedMovie);
    measureDock();
    // The Aries adapter applies default volume only on an explicit new play.
    // Saving settings must never send a command to a film already playing.
    return true;
  }

  window.movieNightSettings = (settings) => {
    settingsEpoch += 1;
    return applyWallSettings(settings);
  };

  function isNativeHost() {
    return window.__MOVIE_NIGHT_NATIVE__ === true;
  }

  function nativeInvoker() {
    const bindings = [window.__MOVIE_NIGHT_SHELL__, window.__TAURI__?.core, window.__TAURI_INTERNALS__, window.__TAURI__?.tauri, window.__TAURI__];
    const binding = bindings.find((candidate) => typeof candidate?.invoke === "function");
    return binding ? binding.invoke.bind(binding) : null;
  }

  async function nativeCall(command, args) {
    if (!isNativeHost()) return null;
    const invoke = nativeInvoker();
    if (!invoke) throw new Error("native_player_unavailable");
    return invoke(command, args);
  }

  function measureDock() {
    const height = Math.ceil(player.dock.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--player-dock-height", `${height}px`);
    clearTimeout(nativeHeightTimer);
    if (!nativePlayerMode || !isNativeHost() || !nativeHeightSupported || height <= 0 || height === lastNativeHeight) return;
    nativeHeightTimer = setTimeout(async () => {
      if (!nativePlayerMode || height === lastNativeHeight) return;
      lastNativeHeight = height;
      try { await nativeCall("set_movie_controls_height", { height }); }
      catch { nativeHeightSupported = false; }
    }, 80);
  }

  window.movieNightNativeMode = (active) => {
    const next = active === true && isNativeHost();
    const changed = next !== nativePlayerMode;
    nativePlayerMode = next;
    miniPlayer = false;
    document.body.classList.remove("native-player-mini", "player-controls-hidden");
    if (next) dockDismissed = false;
    document.body.classList.toggle("native-player-mode", next);
    byId("native-video-placeholder").hidden = !next;
    if (next && !elements.dialog.hidden) closeFilm();
    if (next && byId("filter-dialog").open) byId("filter-dialog").close();
    if (next) document.body.classList.remove("dialog-open");
    updatePlayerControls();
    measureDock();
    if (changed && next) player.dock.focus({ preventScroll: true });
    publishContext();
    return next;
  };

  window.movieNightNativeFullscreen = (fullscreen) => {
    if (typeof fullscreen === "boolean") nativeFullscreen = fullscreen;
    revealPlayerControls();
    updatePlayerControls();
    return nativeFullscreen;
  };

  function revealPlayerControls() {
    clearTimeout(controlsTimer);
    document.body.classList.remove("player-controls-hidden");
    byId("player-reveal").hidden = !nativePlayerMode;
    if (!nativePlayerMode || miniPlayer || playerStatus.state !== "playing") return;
    controlsTimer = setTimeout(() => {
      if (playerStatus.state === "playing" && !miniPlayer && !player.dock.matches(":hover, :focus-within") && byId("player-options").hidden) {
        document.body.classList.add("player-controls-hidden");
        measureDock();
      }
    }, 2800);
  }
  window.movieNightVideoInteraction = revealPlayerControls;

  async function setMiniPlayer(value) {
    if (!isNativeHost() || !["playing", "paused", "loading"].includes(playerStatus.state)) return;
    if (value && nativeFullscreen) await togglePlayerFullscreen();
    if (!nativePlayerMode && await showNativePlayer() === false) return;
    miniPlayer = value;
    document.body.classList.toggle("native-player-mini", value);
    document.body.classList.toggle("native-player-mode", !value);
    document.body.classList.remove("player-controls-hidden");
    byId("native-video-placeholder").hidden = false;
    setText(byId("player-mini"), value ? "Expand player" : "Mini player");
    revealPlayerControls(); measureDock();
  }

  function updateTrackControls() {
    const tracks = playerStatus.tracks || [];
    const signature = JSON.stringify([playerStatus.imdb_id, playerStatus.type, playerStatus.season, playerStatus.episode, tracks]);
    if (signature === lastTrackSignature) return;
    lastTrackSignature = signature;
    for (const [kind, id] of [["audio", "player-audio-track"], ["sub", "player-subtitle-track"]]) {
      const select = byId(id), rows = tracks.filter(t => t.type === kind);
      select.replaceChildren();
      if (kind === "sub") { const off = node("option", "", "Off"); off.value = "off"; select.append(off); }
      for (const track of rows) {
        const option = node("option", "", [track.language || "Language not tagged", track.title, track.codec].filter(Boolean).join(" · "));
        option.value = String(track.id); option.selected = track.selected === true; select.append(option);
      }
      if (!rows.length && kind === "audio") select.append(node("option", "", "No audio tracks available"));
      select.disabled = !rows.length;
    }
  }

  async function showPlayingDetails() {
    const id = playerStatus.imdb_id, kind = playerStatus.type || "movie";
    const records = collections.flatMap(c => c.movies || []);
    const record = records.find(row => row.imdbId === id && row.type === kind);
    if (!record) { playerMessage("This playing title is not in the loaded catalogue. Playback continues."); return; }
    await setMiniPlayer(true);
    showFilm(record);
  }

  async function quickPlay() {
    const movie = selectedMovie, target = mediaTarget();
    if (!target || launchPending || sourceBusy || commandPending) return;
    byId("quick-play").disabled = true;
    try {
      if (sameMedia(target, playerStatus) && ["playing", "paused", "loading"].includes(playerStatus.state)) {
        await playSelectedMovie(); return;
      }
      await openSources();
      if (selectedMovie !== movie || sourceTitle !== mediaKey(target) || mediaKey(mediaTarget()) !== mediaKey(target) || elements.dialog.hidden) return;
      if (!sourceChoices.length) { playerMessage("No eligible cached source was found. Choose a source to review availability."); return; }
      selectedSource = sourceChoices[0].id;
      await playSelectedMovie(selectedSource);
    } finally { updatePlayerControls(); }
  }

  async function showNativePlayer() {
    if (!isNativeHost()) return;
    const shown = await nativeCall("show_movie_player");
    if (shown !== true) {
      playerMessage("Your film is in its existing player window on Aries.");
      return false;
    }
    playerMessage("");
    window.movieNightNativeMode(true);
    return true;
  }

  async function showMovieWall() {
    if (isNativeHost()) await nativeCall("show_movie_wall");
    window.movieNightNativeMode(false);
  }

  async function changePlayerView(showPlayer) {
    if (nativeActionPending || launchPending || commandPending) return;
    nativeActionPending = true;
    updatePlayerControls();
    try {
      if (showPlayer) await showNativePlayer();
      else await showMovieWall();
    } catch {
      playerMessage("The player view could not be opened. Your film has not been restarted.");
    } finally {
      nativeActionPending = false;
      updatePlayerControls();
    }
  }

  async function togglePlayerFullscreen() {
    if (!isNativeHost()) return sendPlayerCommand("fullscreen");
    if (nativeActionPending || launchPending || commandPending) return;
    nativeActionPending = true;
    updatePlayerControls();
    try {
      const fullscreen = await nativeCall("toggle_movie_fullscreen");
      if (typeof fullscreen !== "boolean") throw new Error("invalid_fullscreen_state");
      window.movieNightNativeFullscreen(fullscreen);
    } catch {
      playerMessage("Full screen could not be changed. You can keep using the player controls.");
    } finally {
      nativeActionPending = false;
      updatePlayerControls();
    }
  }

  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function icon(name) {
    const paths = {
      play: "m8 5 11 7-11 7V5Z", pause: "M8 5v14M16 5v14",
      screen: "M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 21h8M12 17v4",
      volume: "m11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14",
      muted: "m11 5-6 4H2v6h3l6 4V5ZM16 9l5 6M21 9l-5 6",
      expand: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
      shrink: "M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5",
      heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) svg.setAttribute(key, value);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", paths[name] || paths.screen);
    svg.append(path);
    return svg;
  }

  function setIcon(element, name) {
    if (element.dataset.icon !== name) {
      element.replaceChildren(icon(name));
      element.dataset.icon = name;
    }
  }

  function imageUrl(value) {
    if (!text(value)) return "";
    try {
      const url = new URL(value, location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function normalizeMovie(movie, index) {
    if (!movie || typeof movie !== "object" || !text(movie.title || movie.name)) return null;
    const numericRank = Number(movie.rank);
    const numericYear = Number(movie.year || text(movie.releaseInfo).match(/^\d{4}/)?.[0]);
    const genres = Array.isArray(movie.genres) ? [...new Set(movie.genres.map(text).filter(Boolean))] : [];
    const result = {
      title: text(movie.title || movie.name),
      rank: Number.isFinite(numericRank) && numericRank > 0 ? numericRank : index + 1,
      year: Number.isInteger(numericYear) && numericYear > 1800 && numericYear < 3000 ? numericYear : null,
      imdbId: text(movie.imdb_id || movie.imdbId || (/^tt\d+$/.test(movie.id || "") ? movie.id : "")),
      id: text(movie.id || movie.imdb_id || movie.imdbId),
      type: ["tv", "series"].includes(movie.type) ? "series" : "movie",
      poster: imageUrl(movie.poster),
      genres,
      runtime: typeof movie.runtime === "number" ? `${movie.runtime} min` : text(movie.runtime),
      rating: parseRating(movie.rating ?? movie.imdbRating ?? movie.imdb_rating),
      lastPositionMs: Math.max(0, Number(movie.lastPositionMs) || 0),
      durationMs: Math.max(0, Number(movie.durationMs) || 0),
      lastUpdatedEpochMs: Math.max(0, Number(movie.lastUpdatedEpochMs) || 0),
      isCompleted: movie.isCompleted === true,
      season: Number.isInteger(Number(movie.season)) && movie.season !== null ? Number(movie.season) : null,
      episode: Number.isInteger(Number(movie.episode)) && movie.episode !== null ? Number(movie.episode) : null,
      episodes: Array.isArray(movie.episodes) ? movie.episodes.filter(ep => ep && Number.isInteger(ep.season) && ep.season >= 0 && Number.isInteger(ep.episode) && ep.episode >= 1 && ep.id === `${movie.imdb_id || movie.imdbId || movie.id}:${ep.season}:${ep.episode}`).map(ep => ({ id: ep.id, season: ep.season, episode: ep.episode, title: text(ep.title), overview: text(ep.overview), released: text(ep.released),
        thumbnail: imageUrl(ep.thumbnail), rating: parseRating(ep.rating),
        runtimeMinutes: typeof ep.runtime_minutes === "number" && Number.isFinite(ep.runtime_minutes) && ep.runtime_minutes > 0 && ep.runtime_minutes <= 1440 ? ep.runtime_minutes : null,
        ...Object.fromEntries(["cast", "guest_stars", "director", "writer"].map(key => [key, Array.isArray(ep[key]) ? ep[key].filter(x => typeof x === "string").slice(0,40) : []])) })) : [],
      episodesLoaded: Array.isArray(movie.episodes),
      description: text(movie.description),
      background: imageUrl(movie.background),
      cast: Array.isArray(movie.cast) ? movie.cast.filter(x => typeof x === "string").slice(0, 40) : [],
      director: Array.isArray(movie.director) ? movie.director.filter(x => typeof x === "string").slice(0, 20) : [],
      writer: Array.isArray(movie.writer) ? movie.writer.filter(x => typeof x === "string").slice(0, 20) : [],
      country: text(movie.country), awards: text(movie.awards), language: text(movie.language),
      index,
    };
    result.runtimeMinutes = runtimeMinutes(movie.runtimeMinutes ?? movie.runtime_minutes ?? movie.runtime);
    result.searchText = normalize([result.title, result.year || "", ...genres].join(" "));
    return result;
  }

  function parseRating(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 10 ? number : null;
  }

  function runtimeMinutes(value) {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    const raw = text(value).toLowerCase();
    if (/^\d+(?:\.\d+)?(?:\s*(?:min(?:ute)?s?|m))?$/.test(raw)) return Number.parseFloat(raw) || null;
    const hours = raw.match(/(\d+)\s*h(?:ours?)?/);
    const minutes = raw.match(/(\d+)\s*m(?:in(?:ute)?s?)?/);
    return hours || minutes ? Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0) : null;
  }

  function setControlsEnabled(enabled) {
    [elements.search, elements.genre, elements.sort, elements.picker, byId("provider-filter")].forEach((element) => {
      element.disabled = !enabled;
    });
  }

  function showLoading() {
    elements.error.hidden = true;
    elements.empty.hidden = true;
    elements.reset.hidden = true;
    elements.count.textContent = "Getting the collection ready…";
    elements.grid.setAttribute("aria-busy", "true");
    const skeletons = document.createDocumentFragment();
    for (let index = 0; index < 12; index += 1) {
      const skeleton = node("div", "skeleton-card");
      skeleton.setAttribute("aria-hidden", "true");
      skeletons.append(skeleton);
    }
    elements.grid.replaceChildren(skeletons);
    setControlsEnabled(false);
  }

  async function requestJSON(path, payload, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 30000);
    try {
      const options = { signal: controller.signal, cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } };
      if (payload !== undefined) {
        options.method = "POST";
        options.headers["Content-Type"] = "application/json";
        options.headers["X-Movie-Night"] = "1";
        options.body = JSON.stringify(payload);
      }
      const response = await fetch(path, options);
      if (!response.ok) throw new Error("request_failed");
      const data = await response.json();
      if (!data || typeof data !== "object" || data.error) throw new Error("request_failed");
      return data;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  function catalogueEntry(type, catalog) {
    return catalogueDirectory.find((entry) => entry.type === type && entry.catalog === catalog);
  }

  function acceptCatalogueDirectory(value) {
    if (!Array.isArray(value?.catalogues)) return;
    catalogueDirectory = catalogueDirectory.map((fallback) => {
      const entry = value.catalogues.find((item) => item?.type === fallback.type && item?.catalog === fallback.catalog);
      if (!entry) return fallback;
      const genres = Array.isArray(entry.genre_options) ? [...new Set(entry.genre_options.filter((genre) => typeof genre === "string" && genre.length <= 60 && genre.trim()))].slice(0, 50) : fallback.genre_options;
      const years = Array.isArray(entry.year_options) ? [...new Set(entry.year_options.filter((year) => Number.isInteger(year) && year >= 1900 && year <= currentYear))].sort((a, b) => b - a) : fallback.year_options;
      return { ...fallback, genre_options: genres, year_options: (years.length || fallback.catalog !== "year") ? years : fallback.year_options };
    });
  }

  function browseSettings(value, type) {
    const query = text(value?.search).slice(0, 160);
    const catalog = query ? "top" : Object.prototype.hasOwnProperty.call(sourceLabels, value?.catalog) ? value.catalog : "top";
    const entry = catalogueEntry(type, catalog);
    const years = catalogueEntry(type, "year").year_options;
    const year = years.includes(Number(value?.year)) ? String(value.year) : String(years[0] || currentYear);
    const genre = !query && entry.genre_options.includes(value?.genre) ? value.genre : "";
    return { catalog, catalogGenre: genre, catalogYear: year, search: query };
  }

  function savedBrowseSettings(item) {
    return item?.kind === "browse" ? { catalog: item.catalog, genre: item.catalogGenre, year: item.catalogYear, search: item.search } : null;
  }

  function updateBrowseHeading(item) {
    const typeLabel = item.type === "series" ? "TV series" : "movies";
    item.name = item.search ? `${item.type === "series" ? "TV" : "Movies"} matching “${item.search}”`
      : item.catalog === "year" ? `${item.catalogYear} ${typeLabel}`
      : `${sourceLabels[item.catalog]} ${typeLabel}${item.catalogGenre ? ` · ${item.catalogGenre}` : ""}`;
    item.description = item.search ? "Title search across Cinemeta. Choose a poster to see more."
      : item.catalog === "year" ? "Revisit a year, discover a classic, or see what is new. Keep loading to explore the list."
      : item.catalog === "imdbRating" ? "Featured discoveries from Cinemeta, with more titles as you browse."
      : "Explore what is popular, find your genre, and keep going beyond the first page.";
    if (item.type === "series") item.description += " Choose a season and episode to check streams.";
  }

  function renderCatalogueControls(item) {
    updateBrowseHeading(item);
    byId("catalog-source").value = item.catalog;
    const genreSelect = byId("catalog-genre");
    genreSelect.replaceChildren(node("option", "", "All genres"), ...catalogueEntry(item.type, item.catalog === "year" ? "top" : item.catalog).genre_options.map((genre) => {
      const option = node("option", "", genre); option.value = genre; return option;
    }));
    genreSelect.firstElementChild.value = "";
    genreSelect.value = item.catalogGenre;
    byId("catalog-year").replaceChildren(...catalogueEntry(item.type, "year").year_options.map((year) => {
      const option = node("option", "", String(year)); option.value = String(year); return option;
    }));
    byId("catalog-year").value = item.catalogYear;
    byId("catalog-genre-wrap").hidden = item.catalog === "year";
    byId("catalog-year-wrap").hidden = item.catalog !== "year";
    byId("catalog-search").value = item.search;
    byId("catalog-search").placeholder = `Search the ${item.type === "series" ? "TV" : "movie"} catalogue…`;
    byId("catalog-intro").textContent = item.type === "series" ? "Popular discoveries, featured series, and every available year." : "Popular discoveries, featured films, and years worth revisiting.";
    byId("catalog-scope").textContent = item.search
      ? "Searching titles across the catalogue. The filters below refine the search results you have loaded."
      : "List, genre and year browse the catalogue. The filters below refine the titles you have loaded.";
  }

  function invalidateBrowse(item) {
    item.controller?.abort();
    item.controller = null;
    item.generation += 1;
    item.loading = false;
    item.loaded = false;
    item.movies = [];
    item.nextSkip = 0;
    item.pages = 0;
    item.hasMore = true;
    item.error = "";
  }

  function changeBrowseSettings(settings) {
    if (collection?.kind !== "browse" || !wallSettings.plugins.cinemeta_enabled) return;
    Object.assign(collection, browseSettings(settings, collection.type));
    invalidateBrowse(collection);
    selectCollection(collection.id);
  }

  function updatePickerLabels() {
    const labels = { "personal-favorites": "Favorites", "personal-recent": "Recently watched", "browse-movie": "All movies", "browse-series": "TV series" };
    for (const option of elements.picker.options) {
      const item = collections.find((entry) => entry.id === option.value);
      if (!item) continue;
      const label = labels[item.id] || item.name;
      option.textContent = item.kind === "browse" ? `${label}${item.loaded ? ` · ${item.movies.length} loaded` : ""}` : `${label} · ${titleCount(item.movies.length)}`;
    }
    syncCatalogueAvailability();
  }

  function rebuildCollections() {
    favoriteKeys = new Set(personalLibrary.favorites.map(movieKey));
    watchedKeys = new Set(personalLibrary.watched.filter((id) => typeof id === "string"));
    historyByKey = new Map(personalLibrary.recent.map((movie) => [movieKey(movie), movie]));
    const imported = personalLibrary.collections.some((item) => item.id === "nuvio-library") ? personalLibrary.collections : [
      ...personalLibrary.collections, { id: "nuvio-library", kind: "imported", name: "Your Nuvio library.", description: "Bring the titles you’ve collected in Nuvio into Movie Night.", movies: [] },
    ];
    const libraryRows = new Map();
    for (const item of imported) for (const movie of item.movies) if (!libraryRows.has(movieKey(movie))) libraryRows.set(movieKey(movie), movie);
    const combined = [...curatedCollections,
      { id: "library", kind: "library", name: "Your library", description: "Saved titles across your sources. Choose a provider separately from genre, year or title type.", movies: [...libraryRows.values()] },
      ...imported.filter(item => item.id !== "nuvio-library"),
      { id: "personal-favorites", kind: "personal", name: "The ones you love.", description: "Your favorites, together in one place. Save a heart whenever something catches your eye.", movies: personalLibrary.favorites },
      { id: "personal-recent", kind: "personal", name: "Pick up the story.", description: "Your recently watched titles, imported from Nuvio. Movie playback uses your existing Aries player.", movies: personalLibrary.recent },
      ...Object.values(browseCollections)];
    // Private saved lists appear in both library endpoints. Keep one identity,
    // preferring the canonical/private catalogue record encountered first.
    const seen = new Set();
    collections = combined.filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
    const labels = { "personal-favorites": "Favorites", "personal-recent": "Recently watched", "browse-movie": "All movies", "browse-series": "TV series" };
    elements.picker.replaceChildren(...collections.map((item) => {
      const option = node("option", "", labels[item.id] || item.name);
      option.value = item.id;
      return option;
    }));
    updatePickerLabels();
    elements.pickerWrap.hidden = false;
    byId("favorite-count").textContent = String(personalLibrary.favorites.length);
  }

  async function loadLibrary(preferredId) {
    const targetId = typeof preferredId === "string" ? preferredId : collection?.id;
    if (loadController) loadController.abort();
    const controller = new AbortController();
    loadController = controller;
    const requestSettingsEpoch = settingsEpoch;
    const timeout = setTimeout(() => controller.abort(), 15000);
    if (!collection) showLoading();
    else elements.grid.setAttribute("aria-busy", "true");
    try {
      const [curated, personal, directory, settings] = await Promise.allSettled([
        requestJSON("/api/library.json", undefined, controller.signal),
        requestJSON("/api/personal-library", undefined, controller.signal),
        requestJSON("/api/catalogues", undefined, controller.signal),
        settingsLoaded ? Promise.resolve(null) : requestJSON("/api/settings", undefined, controller.signal),
      ]);
      if (loadController !== controller) return;
      if (directory.status === "fulfilled") acceptCatalogueDirectory(directory.value);
      if (settings.status === "fulfilled" && settings.value && settingsEpoch === requestSettingsEpoch) applyWallSettings(settings.value);
      settingsLoaded = true;
      const library = curated.status === "fulfilled" ? curated.value : {};
      if (Array.isArray(library.collections)) {
        curatedCollections = library.collections.filter((item) => item && typeof item === "object").map((item, index) => ({
          id: text(item.id) || `collection-${index + 1}`, kind: "curated",
          name: text(item.name) || `Collection ${index + 1}`, description: text(item.description),
          movies: Array.isArray(item.movies) ? item.movies.map(normalizeMovie).filter(Boolean) : [],
        }));
      } else if (!curatedCollections.length && personal.status !== "fulfilled") throw new Error("library_unavailable");
      if (personal.status === "fulfilled") {
        const value = personal.value;
        personalLibrary = {
          favorites: Array.isArray(value.favorites) ? value.favorites.map(normalizeMovie).filter(Boolean) : [],
          recent: Array.isArray(value.recent) ? value.recent.map(normalizeMovie).filter(Boolean) : [],
          watched: Array.isArray(value.watched) ? value.watched : [], imported_at: value.imported_at || null,
          collections: Array.isArray(value.collections) ? value.collections.filter((item) => item && typeof item === "object" && text(item.id)).map((item) => ({
            id: text(item.id), kind: "imported", name: text(item.name) || "Nuvio library", description: text(item.description),
            movies: Array.isArray(item.movies) ? item.movies.map(normalizeMovie).filter(Boolean) : [],
          })) : [],
        };
        libraryAvailable = true;
        const date = new Date(personalLibrary.imported_at);
        byId("library-feedback").textContent = personalLibrary.imported_at && Number.isFinite(date.getTime())
          ? `Nuvio library imported ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}. Favorites stay in your personal library.`
          : "Bring your Nuvio favorites and recently watched titles into Movie Night.";
      } else {
        libraryAvailable = false;
        byId("library-feedback").textContent = "Your personal library is unavailable right now. You can still browse your collections.";
      }
      rebuildCollections();
      const siteTitle = text(library.title) || "Movie Night";
      elements.siteTitle.textContent = siteTitle;
      document.title = siteTitle;
      elements.siteTitle.closest("a").setAttribute("aria-label", `${siteTitle} home`);
      setControlsEnabled(true);
      let initialTarget = null;
      if (!startupApplied) {
        startupApplied = true;
        for (const item of Object.values(browseCollections)) Object.assign(item, browseSettings({ catalog: wallSettings.browsing.catalog, year: currentYear }, item.type));
        initialTarget = wallSettings.browsing.start_view === "curated" ? curatedCollections[0]?.id : wallSettings.browsing.start_view;
        if (!wallSettings.plugins.cinemeta_enabled && ["browse-movie", "browse-series"].includes(initialTarget)) initialTarget = curatedCollections[0]?.id;
      }
      selectCollection(targetId || initialTarget || collections[0]?.id);
      updateFavoriteDetail();
      if (!initialMovieOpened) {
        initialMovieOpened = true;
        const requestedMovie = new URLSearchParams(location.search).get("movie");
        if (/^tt\d{5,12}$/.test(requestedMovie || "")) {
          const requestedCollection = collections.findIndex((item) => item.movies.some((movie) => movie.imdbId === requestedMovie));
          if (requestedCollection >= 0) {
            selectCollection(requestedCollection);
            const movie = collection.movies.find((item) => item.imdbId === requestedMovie);
            if (!nativePlayerMode) showFilm(movie);
          }
        }
      }
    } catch {
      if (loadController !== controller) return;
      collection = null;
      elements.grid.replaceChildren();
      elements.count.textContent = "Collection unavailable";
      elements.error.hidden = false;
      elements.total.textContent = "—";
    } finally {
      clearTimeout(timeout);
      if (loadController === controller) elements.grid.setAttribute("aria-busy", "false");
    }
  }

  function selectCollection(target) {
    // Preserve old saved-view/startup IDs without keeping a provider as a category.
    if (target === "nuvio-library") { target = "library"; filters.provider = "nuvio"; }
    collection = (typeof target === "number" ? collections[target] : collections.find((item) => item.id === target)) || collections[0];
    if (!collection) return;
    elements.picker.value = collection.id;
    elements.sort.querySelector('option[value="rank"]').textContent = collection.kind === "curated" ? "Curated order" : collection.kind === "browse" ? "Catalogue order" : "Library order";
    if (collection.kind === "browse") renderCatalogueControls(collection);
    elements.title.textContent = collection.name;
    elements.description.textContent = collection.description || "Old favorites. New discoveries. A great night in.";
    elements.total.textContent = String(collection.movies.length);
    elements.footer.textContent = `${titleCount(collection.movies.length)} · Movie Night`;
    document.querySelectorAll("[data-collection]").forEach((button) => {
      const active = button.dataset.collection === collection.id || (button.dataset.collection === "curated" && collection.kind === "curated");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    byId("catalog-browse").hidden = collection.kind !== "browse";
    const previousGenre = elements.genre.value;
    const allGenres = [...new Set([...collection.movies.flatMap((movie) => movie.genres), ...(previousGenre ? [previousGenre] : [])])].sort(collator.compare);
    const allOption = node("option", "", "All genres");
    allOption.value = "";
    elements.genre.replaceChildren(allOption, ...allGenres.map((genre) => {
      const option = node("option", "", genre);
      option.value = genre;
      return option;
    }));
    elements.genre.value = allGenres.includes(previousGenre) ? previousGenre : "";
    renderGenreOptions();
    renderFilms();
    publishContext();
    if (collection.kind === "browse" && wallSettings.plugins.cinemeta_enabled && !collection.loaded && !collection.loading) void loadBrowse(collection.type);
  }

  function resetFilters() {
    elements.search.value = "";
    elements.genre.value = "";
    elements.sort.value = "rank";
    filters = defaultFilters();
    syncFilterControls();
    byId("saved-views").value = "";
    byId("delete-view").disabled = true;
    renderFilms();
  }

  async function loadBrowse(type, more = false) {
    const item = browseCollections[type];
    if (!item || !wallSettings.plugins.cinemeta_enabled || (more && (item.loading || !item.hasMore))) return;
    if (!more) invalidateBrowse(item);
    const generation = item.generation;
    const controller = new AbortController();
    item.controller = controller;
    const skip = item.nextSkip;
    item.loading = true;
    item.loaded = true;
    item.error = "";
    if (collection === item) renderFilms();
    try {
      const params = new URLSearchParams({ type, catalog: item.catalog, skip: String(skip) });
      if (item.catalog === "year") params.set("genre", item.catalogYear);
      else if (item.catalogGenre) params.set("genre", item.catalogGenre);
      if (item.search) params.set("search", item.search);
      const result = await requestJSON(`/api/browse?${params}`, undefined, controller.signal);
      if (item.generation !== generation || item.controller !== controller) return;
      if (!Array.isArray(result.movies) || typeof result.has_more !== "boolean"
          || (result.has_more && (!Number.isInteger(result.next_skip) || result.next_skip <= skip))) throw new Error("browse_unavailable");
      const incoming = result.movies.map((movie, index) => normalizeMovie({ ...movie, type: movie.type || type }, skip + index)).filter(Boolean);
      const seen = new Set(item.movies.map(movieKey));
      item.movies.push(...incoming.filter((movie) => { const key = movieKey(movie); if (seen.has(key)) return false; seen.add(key); return true; }));
      // Provider positions include missing or duplicate metadata. Even an empty
      // sanitized page can have a valid next cursor, so never advance by row count.
      item.hasMore = result.has_more;
      item.nextSkip = result.has_more ? result.next_skip : skip;
      item.pages += 1;
    } catch {
      if (item.generation !== generation || item.controller !== controller || controller.signal.aborted) return;
      item.error = "The catalogue couldn’t be reached. Your loaded titles are still here. Try again in a moment.";
    } finally {
      if (item.generation === generation && item.controller === controller) {
        item.loading = false;
        item.controller = null;
        updatePickerLabels();
        if (collection === item) selectCollection(item.id);
      }
    }
  }

  async function importPersonalLibrary() {
    const button = byId("import-library");
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "Importing…";
    byId("library-feedback").textContent = "Reading your Nuvio favorites and viewing history…";
    try {
      await requestJSON("/api/personal-library/import", {});
      await loadLibrary("personal-recent");
    } catch {
      byId("library-feedback").textContent = "Your Nuvio library couldn’t be imported. Try again when Aries is connected.";
    } finally {
      button.disabled = false;
      button.textContent = "Import Nuvio library";
    }
  }

  function isFavorite(movie) { return favoriteKeys.has(movieKey(movie)); }

  function watchState(movie) {
    const recent = historyByKey.get(movieKey(movie)) || movie;
    if (movie.isCompleted || recent.isCompleted || watchedKeys.has(movie.id) || watchedKeys.has(movie.imdbId) || watchedKeys.has(movieKey(movie))) return "watched";
    return recent.lastPositionMs > 0 ? "watching" : "unwatched";
  }

  function updateFavoriteDetail() {
    const button = byId("favorite-detail");
    const saved = selectedMovie && isFavorite(selectedMovie);
    button.replaceChildren(icon("heart"), node("span", "", saved ? "In your favorites" : "Add to favorites"));
    button.setAttribute("aria-pressed", String(Boolean(saved)));
    button.disabled = !selectedMovie?.id || !libraryAvailable || favoritePending.has(movieKey(selectedMovie));
  }

  async function toggleFavorite(movie) {
    if (!movie?.id || !libraryAvailable || favoritePending.has(movieKey(movie))) return;
    const key = movieKey(movie);
    const favorite = !isFavorite(movie);
    favoritePending.add(key);
    updateFavoriteDetail();
    renderFilms();
    try {
      const updated = await requestJSON("/api/personal-library/favorite", { id: movie.id, type: movie.type, favorite });
      if (Array.isArray(updated.favorites)) personalLibrary.favorites = updated.favorites.map(normalizeMovie).filter(Boolean);
      else {
        personalLibrary.favorites = personalLibrary.favorites.filter((item) => movieKey(item) !== key);
        if (favorite) personalLibrary.favorites.push(movie);
      }
      const selected = collection?.id;
      rebuildCollections();
      selectCollection(selected);
      byId("library-feedback").textContent = `${movie.title} ${favorite ? "added to" : "removed from"} your favorites.`;
    } catch {
      byId("library-feedback").textContent = "That favorite couldn’t be saved. Please try again.";
    } finally {
      favoritePending.delete(key);
      updateFavoriteDetail();
      renderFilms();
    }
  }

  function renderGenreOptions() {
    const genres = [...new Set(["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western", ...collections.flatMap((item) => item.movies.flatMap((movie) => movie.genres)), ...filters.include, ...filters.exclude])].sort(collator.compare);
    for (const kind of ["include", "exclude"]) {
      byId(`${kind}-genres`).replaceChildren(...genres.map((genre) => {
        const label = node("label", "genre-chip");
        const input = node("input");
        input.type = "checkbox";
        input.value = genre;
        input.dataset.genreKind = kind;
        input.checked = filters[kind].includes(genre);
        label.append(input, node("span", "", genre));
        return label;
      }));
    }
  }

  function syncFilterControls() {
    byId("provider-filter").value = filters.provider;
    for (const [id, key] of [["filter-year-from", "yearFrom"], ["filter-year-to", "yearTo"], ["filter-genre-mode", "genreMode"], ["filter-rating", "rating"], ["filter-runtime", "runtime"], ["filter-type", "type"], ["filter-watch", "watch"]]) byId(id).value = String(filters[key]);
    byId("filter-rating-value").textContent = filters.rating ? `${Number(filters.rating).toFixed(1)}+` : "Any";
    renderGenreOptions();
  }

  function readFilterControls() {
    filters.yearFrom = byId("filter-year-from").value;
    filters.yearTo = byId("filter-year-to").value;
    filters.genreMode = byId("filter-genre-mode").value;
    filters.rating = Number(byId("filter-rating").value);
    filters.runtime = byId("filter-runtime").value;
    filters.type = byId("filter-type").value;
    filters.watch = byId("filter-watch").value;
    byId("filter-rating-value").textContent = filters.rating ? `${filters.rating.toFixed(1)}+` : "Any";
    byId("saved-views").value = "";
    byId("delete-view").disabled = true;
    renderFilms();
  }

  function matchesFilters(movie, terms, genre, rules = filters, sourceProvider = null) {
    if (rules.provider && sourceProvider !== rules.provider && !providerMembership.get(movieKey(movie))?.has(rules.provider)) return false;
    if (genre && !movie.genres.includes(genre)) return false;
    if (!terms.every((term) => movie.searchText.includes(term))) return false;
    if (rules.yearFrom !== "" && (!movie.year || movie.year < Number(rules.yearFrom))) return false;
    if (rules.yearTo !== "" && (!movie.year || movie.year > (rules.yearTo === "present" ? new Date().getUTCFullYear() : Number(rules.yearTo)))) return false;
    const genres = movie.genres.map(normalize);
    if (rules.include.length && !(rules.genreMode === "all" ? rules.include.every((value) => genres.includes(normalize(value))) : rules.include.some((value) => genres.includes(normalize(value))))) return false;
    if (rules.exclude.some((value) => genres.includes(normalize(value)))) return false;
    if (rules.rating > 0 && (movie.rating === null || movie.rating < rules.rating)) return false;
    if (rules.runtime !== "" && (!movie.runtimeMinutes || movie.runtimeMinutes > Number(rules.runtime))) return false;
    if (rules.type && movie.type !== rules.type) return false;
    if (rules.watch === "favorites" && !isFavorite(movie)) return false;
    if (["watching", "watched", "unwatched"].includes(rules.watch) && watchState(movie) !== rules.watch) return false;
    return true;
  }

  function filterChips() {
    const chips = [];
    const add = (label, clear) => chips.push({ label, clear });
    if (filters.provider) add(`Provider: ${filters.provider === 'nuvio' ? 'Nuvio' : 'Cinemeta'}`, () => { filters.provider = ''; });
    if (elements.search.value.trim()) add(`“${elements.search.value.trim()}”`, () => { elements.search.value = ""; });
    if (elements.genre.value) add(elements.genre.value, () => { elements.genre.value = ""; });
    if (filters.yearFrom !== "" || filters.yearTo !== "") add(`${filters.yearFrom || "Any year"} – ${filters.yearTo || "any year"}`, () => { filters.yearFrom = filters.yearTo = ""; });
    for (const genre of filters.include) add(`${filters.genreMode === "all" ? "Includes" : "Genre"}: ${genre}`, () => { filters.include = filters.include.filter((value) => value !== genre); });
    for (const genre of filters.exclude) add(`No ${genre}`, () => { filters.exclude = filters.exclude.filter((value) => value !== genre); });
    if (filters.rating) add(`Rating ${filters.rating}+`, () => { filters.rating = 0; });
    if (filters.runtime !== "") add(`Up to ${filters.runtime} min`, () => { filters.runtime = ""; });
    if (filters.type) add(filters.type === "series" ? "TV series" : "Movies", () => { filters.type = ""; });
    if (filters.watch) add({ favorites: "Favorites", watching: "Watching", watched: "Watched", unwatched: "Unwatched" }[filters.watch], () => { filters.watch = ""; });
    return chips;
  }

  function renderFilterSummary(visibleCount) {
    const chips = filterChips();
    byId("filter-count").hidden = !chips.length;
    byId("filter-count").textContent = String(chips.length);
    byId("active-filters").hidden = !chips.length;
    byId("active-filters").replaceChildren(...chips.map(({ label, clear }) => {
      const button = node("button", "active-filter", label);
      button.type = "button";
      button.append(node("span", "", "×"));
      button.setAttribute("aria-label", `Remove filter: ${label}`);
      button.addEventListener("click", () => { clear(); syncFilterControls(); renderFilms(); });
      return button;
    }));
    const invalidYears = filters.yearFrom !== "" && filters.yearTo !== "" && Number(filters.yearFrom) > (filters.yearTo === "present" ? new Date().getUTCFullYear() : Number(filters.yearTo));
    byId("filter-year-error").hidden = !invalidYears;
    byId("filter-year-to").setCustomValidity(invalidYears ? "Choose an end year on or after the start year." : "");
    byId("apply-filters").disabled = invalidYears;
    byId("apply-filters").textContent = `Show ${titleCount(visibleCount)}`;
    const scope = collection?.kind === "browse"
      ? `Filters apply to the ${collection.movies.length} loaded titles, not the entire catalogue. Load more to explore further.`
      : `Filters apply to the ${collection?.movies.length || 0} titles in this collection.`;
    byId("filter-scope").textContent = scope;
    byId("drawer-filter-scope").textContent = scope;
    return chips.length > 0;
  }

  function sanitizedFilters(value) {
    if (!value || typeof value !== "object") return defaultFilters();
    const numeric = (v, min, max) => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? String(Number(v)) : "";
    const genres = (v) => Array.isArray(v) ? [...new Set(v.filter((item) => typeof item === "string" && item.length <= 60))].slice(0, 50) : [];
    return { yearFrom: numeric(value.yearFrom, 1800, 2999), yearTo: value.yearTo === "present" ? "present" : numeric(value.yearTo, 1800, 2999),
      include: genres(value.include), exclude: genres(value.exclude), genreMode: value.genreMode === "all" ? "all" : "any",
      rating: Number(numeric(value.rating, 0, 10)) || 0, runtime: numeric(value.runtime, 1, 1440),
      type: ["movie", "series"].includes(value.type) ? value.type : "",
      watch: ["favorites", "watching", "watched", "unwatched"].includes(value.watch) ? value.watch : "",
      provider: ["nuvio", "cinemeta"].includes(value.provider) ? value.provider : "" };
  }

  function renderSavedViews() {
    byId("saved-views").replaceChildren(node("option", "", "Choose a saved view…"), ...savedViews.map((view, index) => {
      const option = node("option", "", view.name);
      option.value = String(index);
      return option;
    }));
    byId("saved-views").firstElementChild.value = "";
    byId("delete-view").disabled = true;
  }

  function readSavedViews() {
    try {
      const data = JSON.parse(localStorage.getItem(savedViewsKey) || "[]");
      savedViews = Array.isArray(data) ? data.filter((view) => view && typeof view.name === "string" && view.name.trim()).slice(0, 20).map((view) => ({
        name: view.name.slice(0, 60), filters: sanitizedFilters(view.filters), search: text(view.search).slice(0, 160),
        genre: text(view.genre).slice(0, 60), sort: ["rank", "title", "year-desc", "year-asc", "rating", "runtime"].includes(view.sort) ? view.sort : "rank", collectionId: text(view.collectionId),
        browse: view.browse && typeof view.browse === "object" ? { catalog: text(view.browse.catalog), genre: text(view.browse.genre).slice(0, 60), year: text(String(view.browse.year || "")), search: text(view.browse.search).slice(0, 160) } : null,
      })) : [];
    } catch { savedViews = []; }
    renderSavedViews();
  }

  function saveFilterView() {
    const name = byId("saved-view-name").value.trim();
    if (!name) { byId("saved-view-feedback").textContent = "Give this view a name first."; byId("saved-view-name").focus(); return; }
    if (!byId("filter-form").reportValidity()) return;
    const view = { name: name.slice(0, 60), filters: sanitizedFilters(filters), search: elements.search.value.trim(), genre: elements.genre.value, sort: elements.sort.value, collectionId: collection?.id || "", browse: savedBrowseSettings(collection) };
    const next = [...savedViews.filter((item) => normalize(item.name) !== normalize(view.name)), view].slice(-20);
    try {
      localStorage.setItem(savedViewsKey, JSON.stringify(next));
      savedViews = next;
      renderSavedViews();
      byId("saved-view-name").value = "";
      byId("saved-view-feedback").textContent = `“${name}” saved on this device.`;
    } catch { byId("saved-view-feedback").textContent = "This browser couldn’t save the view. Your current filters still work."; }
  }

  function applySavedView() {
    const selected = byId("saved-views").value;
    byId("delete-view").disabled = selected === "";
    if (selected === "") return;
    const view = savedViews[Number(selected)];
    if (!view) return;
    filters = sanitizedFilters(view.filters);
    elements.search.value = view.search;
    elements.sort.value = view.sort;
    const target = collections.find((item) => item.id === view.collectionId);
    if (target?.kind === "browse" && view.browse) {
      const settings = browseSettings(view.browse, target.type);
      const changed = ["catalog", "catalogGenre", "catalogYear", "search"].some((key) => target[key] !== settings[key]);
      if (changed) { Object.assign(target, settings); invalidateBrowse(target); }
    }
    if (view.genre && ![...elements.genre.options].some((option) => option.value === view.genre)) {
      const option = node("option", "", view.genre); option.value = view.genre; elements.genre.append(option);
    }
    elements.genre.value = view.genre;
    selectCollection(view.collectionId);
    syncFilterControls();
    renderFilms();
    byId("saved-view-feedback").textContent = `Applied “${view.name}”. Filters use the titles currently loaded.`;
  }

  function deleteSavedView() {
    const selected = byId("saved-views").value;
    if (selected === "") return;
    const next = savedViews.filter((_, index) => index !== Number(selected));
    try {
      localStorage.setItem(savedViewsKey, JSON.stringify(next));
      savedViews = next;
      renderSavedViews();
      byId("saved-view-feedback").textContent = "Saved view deleted. Your current filters are unchanged.";
    } catch { byId("saved-view-feedback").textContent = "This browser couldn’t update saved views."; }
  }

  function poster(movie, eager = false) {
    const wrap = node("span", "poster-wrap");
    const placeholder = node("span", "poster-placeholder");
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.append(node("span", "", movie.title.slice(0, 1)), node("span", "", movie.title));
    wrap.append(placeholder);
    if (movie.poster) {
      const image = node("img", "poster-image");
      image.alt = `${movie.title} poster`;
      image.loading = eager ? "eager" : "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.width = 300;
      image.height = 450;
      image.addEventListener("error", () => image.classList.add("is-missing"), { once: true });
      image.src = movie.poster;
      wrap.append(image);
    }
    return wrap;
  }

  function movieCard(movie, index) {
    const tile = node("article", "movie-tile");
    const card = node("button", "movie-card");
    card.type = "button";
    card.setAttribute("aria-label", `View details: ${movie.title}${movie.year ? ` (${movie.year})` : ""}, ${movie.type === "series" ? "TV series" : "movie"}`);
    card.setAttribute("aria-controls", "film-dialog");
    const cover = poster(movie, index < 6);
    cover.append(node("span", "poster-rank", collection?.kind === "curated" ? `#${String(movie.rank).padStart(2, "0")}` : movie.type === "series" ? "TV" : "Film"));
    const hint = node("span", "poster-hint", movie.type === "series" ? "View series" : "View film");
    hint.setAttribute("aria-hidden", "true");
    cover.append(hint);
    const recent = historyByKey.get(movieKey(movie)) || movie;
    if (watchState(movie) === "watched") cover.append(node("span", "poster-watched", "Watched"));
    else if (recent.lastPositionMs > 0 && recent.durationMs > 0) {
      const progress = node("span", "poster-progress");
      const fill = node("span");
      fill.style.width = `${Math.max(0, Math.min(100, recent.lastPositionMs / recent.durationMs * 100))}%`;
      progress.setAttribute("aria-label", `${Math.round(recent.lastPositionMs / recent.durationMs * 100)} percent watched`);
      progress.append(fill);
      cover.append(progress);
    }
    card.append(cover, node("span", "movie-title", movie.title));
    const meta = node("span", "movie-meta");
    if (movie.year) meta.append(node("span", "movie-year", String(movie.year)));
    if (movie.genres.length) meta.append(document.createTextNode(`${movie.year ? " · " : ""}${movie.genres[0]}`));
    if (movie.rating !== null) meta.append(node("span", "movie-rating", `${movie.year || movie.genres.length ? " · " : ""}★ ${movie.rating.toFixed(1)}`));
    card.append(meta);
    const action = node("span", "movie-action");
    action.append(icon(movie.type === "series" ? "screen" : "play"), node("span", "", movie.type === "series" ? "View series" : "View film"));
    card.append(action);
    card.addEventListener("click", () => showFilm(movie));
    const favorite = node("button", "card-favorite");
    favorite.type = "button";
    favorite.append(icon("heart"));
    favorite.setAttribute("aria-label", `${isFavorite(movie) ? "Remove" : "Add"} ${movie.title} ${isFavorite(movie) ? "from" : "to"} favorites`);
    favorite.setAttribute("aria-pressed", String(isFavorite(movie)));
    favorite.title = isFavorite(movie) ? "Remove from favorites" : "Add to favorites";
    favorite.disabled = !movie.id || !libraryAvailable || favoritePending.has(movieKey(movie));
    favorite.addEventListener("click", () => toggleFavorite(movie));
    tile.append(card, favorite);
    return tile;
  }

  function refreshProviderMembership() {
    // A view over existing records, not a new provider/entitlement registry.
    const next = new Map();
    const add = (movies, id) => movies.forEach(movie => {
      const key = movieKey(movie);
      if (!next.has(key)) next.set(key, new Set());
      next.get(key).add(id);
    });
    for (const source of personalLibrary.collections) if (source.id === 'nuvio-library') add(source.movies, 'nuvio');
    for (const source of Object.values(browseCollections)) add(source.movies, 'cinemeta');
    providerMembership = next;
  }

  function currentFilterView() {
    return { filters: sanitizedFilters(filters), search: elements.search.value.trim(), genre: elements.genre.value,
      sort: elements.sort.value, collectionId: collection?.id || "", browse: savedBrowseSettings(collection) };
  }

  function filterMovieQuery(movies, query) {
    refreshProviderMembership();
    const sourceProvider = ["browse-movie", "browse-series"].includes(query.collectionId) ? "cinemeta" : null;
    const terms = normalize(query.search.trim()).split(/\s+/).filter(Boolean);
    const genre = query.genre;
    const sort = query.sort;
    const visible = movies.filter((movie) => matchesFilters(movie, terms, genre, query.filters, sourceProvider));
    visible.sort((left, right) => {
      if (sort === "title") return collator.compare(left.title, right.title) || left.rank - right.rank;
      if (sort === "year-desc") return (right.year || 0) - (left.year || 0) || left.rank - right.rank;
      if (sort === "year-asc") return (left.year || 9999) - (right.year || 9999) || left.rank - right.rank;
      if (sort === "rating") return (right.rating ?? -1) - (left.rating ?? -1) || left.rank - right.rank;
      if (sort === "runtime") return (left.runtimeMinutes || Infinity) - (right.runtimeMinutes || Infinity) || left.rank - right.rank;
      return left.rank - right.rank || left.index - right.index;
    });
    return visible;
  }

  function renderFilms() {
    if (!collection) return;
    byId("provider-filter").value = filters.provider;
    const visible = filterMovieQuery(collection.movies, currentFilterView());
    const sort = elements.sort.value;
    visibleMovies = visible;
    const fragment = document.createDocumentFragment();
    if (!cubeHome?.isCarousel()) visible.forEach((movie, index) => fragment.append(movieCard(movie, index)));
    if (collection.kind === "browse" && collection.loading && !collection.movies.length) {
      for (let index = 0; index < 6; index += 1) { const skeleton = node("div", "skeleton-card"); skeleton.setAttribute("aria-hidden", "true"); fragment.append(skeleton); }
    }
    elements.grid.replaceChildren(fragment);
    const filtered = renderFilterSummary(visible.length);
    elements.count.textContent = filtered
      ? `${visible.length} of ${titleCount(collection.movies.length)}${collection.kind === "browse" ? " loaded" : ""}`
      : `${titleCount(collection.movies.length)}${collection.kind === "browse" ? " loaded" : collection.kind === "curated" && sort === "rank" ? " · In curated order" : ""}`;
    if (collection.loading) elements.count.textContent += " · Loading…";
    elements.total.textContent = String(collection.movies.length);
    byId("collection-total-label").textContent = collection.kind === "browse" ? "titles loaded" : "titles to explore";
    elements.footer.textContent = `${titleCount(collection.movies.length)}${collection.kind === "browse" ? " loaded" : ""} · Movie Night`;
    updatePickerLabels();
    elements.reset.hidden = !filtered && sort === "rank";
    elements.empty.hidden = visible.length !== 0 || collection.loading === true;
    elements.error.hidden = true;
    elements.grid.setAttribute("aria-busy", String(collection.loading === true));
    byId("empty-title").textContent = filtered ? "Nothing quite fits yet." : collection.id === "personal-favorites" ? "Make room for your favorites." : collection.id === "personal-recent" ? "Your next chapter starts here." : "No titles to show yet.";
    byId("empty-description").textContent = filtered ? "Try widening the years or removing a filter. You can also load more catalogue results." : collection.id === "personal-favorites" ? "Tap a heart on any poster to keep it here." : collection.kind === "personal" || collection.kind === "imported" || collection.kind === "library" ? "Import your Nuvio library to bring your titles and viewing history across." : collection.error || "Try another catalogue search.";
    byId("empty-reset").hidden = !filtered;
    byId("browse-more").hidden = collection.kind !== "browse";
    if (collection.kind === "browse") {
      const catalogueEnabled = wallSettings.plugins.cinemeta_enabled;
      byId("load-more").disabled = collection.loading || !catalogueEnabled;
      byId("load-more").hidden = !catalogueEnabled || (!collection.hasMore && !collection.error);
      byId("load-more").textContent = collection.loading ? "Loading titles…" : collection.error ? "Try again" : "Load more titles";
      const pageLabel = collection.pages ? `${collection.pages} ${collection.pages === 1 ? "page" : "pages"} explored · ` : "";
      byId("browse-feedback").textContent = collection.error || (!collection.hasMore && !collection.loading ? `${pageLabel}You’ve reached the end of these catalogue results.` : `${pageLabel}Keep loading to explore the full list. Filters apply to loaded titles.`);
      if (!catalogueEnabled) {
        elements.count.textContent = "Catalogue browsing is off";
        byId("empty-title").textContent = "Your catalogue is paused.";
        byId("empty-description").textContent = "Enable Cinemeta in Settings to browse movies and TV again. Your collections and favorites are still available.";
        byId("browse-feedback").textContent = "Cinemeta catalogue browsing is turned off in Settings.";
      }
      byId("catalog-search-button").disabled = !catalogueEnabled;
    }
    if (!elements.dialog.hidden) syncCarouselSelection();
    cubeHome?.refresh();
    publishContext();
  }

  function mediaTarget(movie = selectedMovie) {
    if (!movie || !/^tt\d{5,12}$/.test(movie.imdbId)) return null;
    if (movie.type === "series") {
      if (!selectedEpisode || !movie.episodes?.some(ep => ep.id === selectedEpisode.id)) return null;
      return { imdb_id: movie.imdbId, title: movie.title, type: "series", season: selectedEpisode.season, episode: selectedEpisode.episode };
    }
    return { imdb_id: movie.imdbId, title: movie.title, type: "movie" };
  }
  function mediaKey(target) {
    if (!target) return "";
    return `${target.type || "movie"}:${target.imdb_id}${target.type === "series" ? `:${target.season}:${target.episode}` : ""}`;
  }
  function sameMedia(target, result) {
    return Boolean(target && result && result.imdb_id === target.imdb_id
      && (result.type || "movie") === target.type
      && (target.type !== "series" || (result.season === target.season && result.episode === target.episode)));
  }
  function mediaLabel(target = mediaTarget()) {
    if (!target) return selectedMovie?.title || "Choose a title";
    return target.type === "series" ? `${target.title} · S${String(target.season).padStart(2,"0")} E${String(target.episode).padStart(2,"0")} · ${selectedEpisode?.title || "Episode"}` : target.title;
  }
  function updateEpisodeSelection() {
    for (const button of byId("episode-list").querySelectorAll('button[data-episode-id]')) {
      const selected = button.dataset.episodeId === selectedEpisode?.id;
      button.setAttribute("aria-pressed", String(selected));
      button.closest(".episode-card")?.classList.toggle("is-selected", selected);
      button.disabled = launchPending;
    }
    byId("episode-selection").textContent = selectedEpisode ? `Selected: ${mediaLabel()}` : "Select an episode to choose its streams. Nothing plays on selection.";
    updatePlayerControls();
  }
  function episodeHistoryLabel(movie, ep) {
    const rows = personalLibrary.recent.filter(row => row.type === "series"
      && (row.imdbId === movie.imdbId || row.id?.split(":")[0] === movie.imdbId)
      && ((row.season === ep.season && row.episode === ep.episode) || row.id === ep.id));
    const recent = rows.reduce((latest,row) => !latest || row.lastUpdatedEpochMs > latest.lastUpdatedEpochMs ? row : latest, null);
    if (recent?.isCompleted || watchedKeys.has(ep.id) || watchedKeys.has(`series|${ep.id}`)) return "Watched";
    return recent?.lastPositionMs > 0 ? `Resume at ${clock(recent.lastPositionMs / 1000)}` : "";
  }
  function renderEpisodes(movie) {
    const section = byId("detail-episodes"); section.hidden = movie.type !== "series";
    if (section.hidden) return;
    section.dataset.seriesId = movie.imdbId;
    byId("episode-list").setAttribute("aria-label", `${movie.title} episodes`);
    const rows = movie.episodes || [], seasons = [...new Set(rows.map(ep => ep.season))].sort((a,b) => a-b);
    if (!seasons.includes(selectedSeason)) selectedSeason = seasons.find(s => s > 0) ?? seasons[0] ?? null;
    const select = byId("episode-season"); select.replaceChildren();
    for (const season of seasons) { const option = node("option", "", season === 0 ? "Specials" : `Season ${season}`); option.value = String(season); select.append(option); }
    select.disabled = !rows.length || launchPending; if (selectedSeason !== null) select.value = String(selectedSeason);
    const count = rows.filter(ep => ep.season === selectedSeason).length;
    byId("episode-metadata-status").textContent = !/^tt\d{5,12}$/.test(movie.imdbId)
      ? "This series has no supported catalogue identity. Its episodes cannot be linked yet."
      : !wallSettings.plugins.cinemeta_enabled && !rows.length
        ? "The episode metadata connection is disabled in Settings. Your library is unchanged."
        : movie.episodeError || (!movie.episodesLoaded ? "Loading seasons and episodes…"
          : rows.length ? `${count} ${count === 1 ? "episode" : "episodes"} in this season`
          : "The catalogue returned no episodes for this series. We will check again when you reopen it.");
    const list = byId("episode-list"), focused = list.contains(document.activeElement) ? document.activeElement : null;
    const focusEpisode = focused?.closest(".episode-card")?.dataset.episodeId;
    const focusKind = focused?.tagName;
    list.replaceChildren();
    list.classList.toggle("episode-art-hidden", hideEpisodeArt);
    for (const ep of rows.filter(ep => ep.season === selectedSeason)) {
      const card = node("article", "episode-card"); card.dataset.episodeId = ep.id;
      const titleId = `episode-title-${ep.id.replaceAll(":","-")}`;
      card.setAttribute("aria-labelledby", titleId);
      const button = node("button", "episode-option"); button.type = "button"; button.dataset.episodeId = ep.id;
      const label = `E${String(ep.episode).padStart(2,"0")} · ${ep.title || `Episode ${ep.episode}`}`;
      button.setAttribute("aria-label", `Select S${String(ep.season).padStart(2,"0")} ${label}`);
      const art = node("span", "episode-art"); art.setAttribute("aria-hidden","true");
      const fallback = node("span", "episode-art-fallback", "Episode artwork unavailable"); art.append(fallback);
      if (ep.thumbnail) {
        const image = document.createElement("img"); image.alt = ""; image.loading = "lazy"; image.decoding = "async"; image.referrerPolicy = "no-referrer";
        image.addEventListener("load", () => { fallback.hidden = true; }, {once:true});
        image.addEventListener("error", () => { image.remove(); fallback.hidden = false; }, {once:true});
        image.src = ep.thumbnail; art.append(image);
      }
      const copy = node("span", "episode-card-copy"), heading = node("strong", "", label); heading.id = titleId;
      copy.append(heading);
      const facts = [ep.released ? `Aired ${ep.released.slice(0,10)}` : "Air date unavailable", ep.runtimeMinutes ? `${ep.runtimeMinutes} min` : ""];
      copy.append(node("span", "episode-card-facts", facts.filter(Boolean).join(" · ")));
      const history = episodeHistoryLabel(movie,ep);
      if (history) {
        const historyNode = node("span", "episode-history", history); historyNode.id = `${titleId}-history`;
        copy.append(historyNode); button.setAttribute("aria-describedby", historyNode.id);
      }
      button.append(art,copy);
      button.addEventListener("click", () => { if (launchPending) return; resetSources(); selectedEpisode = ep; updateEpisodeSelection(); });
      card.append(button);
      // Plot, episode ratings and guests can spoil. Keep them outside the
      // selection button and absent from accessibility exposure when closed.
      const details = node("details", "episode-spoilers"); details.dataset.episodeId = ep.id;
      const summary = node("summary", "", "Episode details · spoilers");
      const body = node("div", "episode-spoiler-body");
      body.append(node("p", "", ep.overview || "An episode summary was not supplied."));
      const credits = node("dl", "episode-credits");
      if (ep.rating !== null) { const fact = node("div"); fact.append(node("dt","","Provider rating"),node("dd","",`${ep.rating.toFixed(1)} / 10`)); credits.append(fact); }
      for (const [key,label] of [["cast","Episode cast"],["guest_stars","Guest appearances"],["director","Directed by"],["writer","Written by"]]) {
        if (!ep[key]?.length) continue;
        const fact = node("div"); fact.append(node("dt","",label),node("dd","",ep[key].join(" · ")));credits.append(fact);
      }
      if (credits.children.length) body.append(credits);
      details.append(summary,body); details.open = revealedEpisodeDetails.has(ep.id);
      details.addEventListener("toggle", () => { if (!details.isConnected) return; if (details.open) revealedEpisodeDetails.add(ep.id); else revealedEpisodeDetails.delete(ep.id); });
      card.append(details); list.append(card);
    }
    updateEpisodeSelection();
    if (focusEpisode) {
      const card = [...list.children].find(card => card.dataset.episodeId === focusEpisode);
      card?.querySelector(focusKind === "SUMMARY" ? "summary" : "button")?.focus({preventScroll:true});
    }
  }

  function renderFilmDetails(movie) {
    // The shared centred carousel owns the poster nodes.
    elements.dialogRank.textContent = movie.type === "series" ? "TV series · Your next story" : collection?.kind === "curated" ? `No. ${String(movie.rank).padStart(2, "0")} in the collection` : "Movie Night · Film";
    elements.dialogTitle.textContent = movie.title;
    elements.dialogMeta.textContent = [movie.year, movie.runtime, wallSettings.browsing.show_ratings && movie.rating !== null ? `★ ${movie.rating.toFixed(1)} / 10` : "", movie.type === "series" && movie.season && movie.episode ? `Last watched: S${movie.season} · E${movie.episode}` : ""].filter(Boolean).join(" · ");
    elements.dialogGenres.replaceChildren(...movie.genres.map((genre) => node("span", "genre-tag", genre)));
    elements.dialogDescription.textContent = movie.description || "More details are not available for this title yet.";
    player.feedback.textContent = launchPending ? "Getting your selection ready on Aries…" : "";
    byId("playback-explanation").textContent = movie.type === "series" ? "Choose a season and episode, then a stream. Playback starts only when you press Play." : "Picture and sound play on Aries. Control your film from the playback bar at the bottom of this page.";
    renderEpisodes(movie);
    renderRichDetails(movie);
    updateFavoriteDetail();
    updatePlayerControls();
  }

  function renderRichDetails(movie) {
    const backdrop = byId("detail-backdrop");
    backdrop.replaceChildren();
    if (movie.background) {
      const image = new Image();
      image.alt = ""; image.decoding = "async"; image.referrerPolicy = "no-referrer";
      image.src = movie.background;
      image.addEventListener("error", () => image.remove(), { once: true });
      backdrop.append(image);
    }
    const facts = byId("detail-facts");
    facts.replaceChildren();
    for (const [label, value] of [["Directed by", movie.director.join(", ")], ["Starring", movie.cast.join(" · ")],
      ["Written by", movie.writer.join(", ")], ["Country", movie.country], ["Language", movie.language], ["Awards", movie.awards]]) {
      if (!value) continue;
      const group = node("div", "detail-fact");
      group.append(node("dt", "", label), node("dd", "", value)); facts.append(group);
    }
    byId("detail-credits").hidden = !facts.children.length;
    const seen = new Set([movieKey(movie)]);
    const related = visibleMovies.filter(candidate => {
      const key = movieKey(candidate);
      if (seen.has(key) || candidate.type !== movie.type) return false;
      seen.add(key); return candidate.genres.some(genre => movie.genres.includes(genre));
    }).sort((a, b) => b.genres.filter(g => movie.genres.includes(g)).length - a.genres.filter(g => movie.genres.includes(g)).length).slice(0, 8);
    const row = byId("related-titles"); row.replaceChildren();
    for (const candidate of related) {
      const button = node("button", "related-title"); button.type = "button";
      button.append(poster(candidate), node("strong", "", candidate.title), node("span", "", String(candidate.year || "")));
      button.addEventListener("click", () => showFilm(candidate)); row.append(button);
    }
    byId("detail-related").hidden = movie.type === "series";
    byId("related-empty").hidden = related.length > 0;
    byId("choose-sources").hidden = false;
    byId("credits-heading").textContent = movie.type === "series" ? "About this series" : "Behind the film";
  }

  async function loadFilmDetails(movie, generation) {
    const controller = new AbortController();
    detailController = controller;
    movie.episodeError = "";
    const status = byId("dialog-metadata-status");
    status.hidden = false;
    status.textContent = "Getting the full details…";
    updatePlayerControls();
    try {
      const params = new URLSearchParams({ type: movie.type, id: movie.imdbId });
      const result = await requestJSON(`/api/browse/meta?${params}`, undefined, controller.signal);
      if (generation !== detailGeneration || detailController !== controller || selectedMovie !== movie || elements.dialog.hidden) return;
      const extra = normalizeMovie(result.movie, movie.index);
      if (!extra || extra.imdbId !== movie.imdbId || extra.type !== movie.type) throw new Error("metadata_mismatch");
      if (movie.type === "series" && !extra.episodesLoaded) throw new Error("episode_metadata_incomplete");
      // Hydrate display fields only. Keep list identity, rank and watch progress.
      if (extra.description) movie.description = extra.description;
      if (extra.genres.length) movie.genres = extra.genres;
      if (extra.runtime) { movie.runtime = extra.runtime; movie.runtimeMinutes = extra.runtimeMinutes; }
      if (extra.year) movie.year = extra.year;
      if (extra.rating !== null) movie.rating = extra.rating;
      if (!movie.poster && extra.poster) movie.poster = extra.poster;
      for (const key of ["background", "cast", "director", "writer", "country", "awards", "language"]) movie[key] = extra[key];
      movie.searchText = normalize([movie.title, movie.year || "", ...movie.genres].join(" "));
      movie.episodes = extra.episodes;
      movie.episodesLoaded = extra.episodesLoaded;
      if (movie.type === "series" && selectedEpisode) {
        selectedEpisode = movie.episodes.find(ep => ep.id === selectedEpisode.id) || null;
      }
      movie.detailsLoaded = true;
      renderFilmDetails(movie);
      status.textContent = "";
      status.hidden = true;
    } catch {
      if (generation !== detailGeneration || detailController !== controller || controller.signal.aborted || selectedMovie !== movie || elements.dialog.hidden) return;
      status.textContent = "Extra details are unavailable right now. Your current title information is still here.";
      if (movie.type === "series") {
        movie.episodeError = "Episode metadata could not load. Reopening this series will try again; your library is unchanged.";
        renderEpisodes(movie);
      }
    } finally {
      if (detailController === controller) detailController = null;
      updatePlayerControls();
    }
  }

  function resetSources() {
    sourceController?.abort(); sourceController = null; sourceGeneration += 1;
    sourceChoices = []; selectedSource = ""; sourceTitle = ""; sourceError = ""; sourceBusy = false;
    byId("source-picker").hidden = true;
    byId("source-quality").value = ""; byId("source-range").value = "";
    renderSources();
  }

  function closeFilm() {
    if (elements.dialog.hidden) return;
    detailController?.abort(); detailController = null; detailGeneration += 1;
    resetSources();
    elements.dialog.hidden = true;
    placeBrowseControls(false);
    document.querySelector(".page-shell").hidden = false;
    document.body.classList.remove("detail-open");
    window.scrollTo(0, wallReturn.scroll);
    if (wallReturn.focus?.isConnected) wallReturn.focus.focus({ preventScroll: true });
    publishContext();
  }

  function showFilm(movie, { focus = true, resetScroll = true } = {}) {
    if (launchPending) return;
    if (elements.dialog.hidden) wallReturn = { scroll: window.scrollY, focus: document.activeElement };
    detailController?.abort(); detailController = null; detailGeneration += 1;
    resetSources(); selectedMovie = movie; selectedEpisode = null; selectedSeason = null;
    const status = byId("dialog-metadata-status"); status.textContent = ""; status.hidden = true;
    renderFilmDetails(movie);
    placeBrowseControls(true);
    document.querySelector(".detail-hero").hidden = false;
    document.querySelector(".page-shell").hidden = true;
    elements.dialog.hidden = false;
    document.body.classList.add("detail-open");
    if (resetScroll) elements.dialog.scrollTop = 0;
    if (focus) elements.dialogTitle.focus({ preventScroll: true });
    carouselIndex = Math.max(0, visibleMovies.findIndex(item => movieKey(item) === movieKey(movie)));
    renderCarousel();
    publishContext();
    // Every series entry uses the existing server metadata cache. Reopening
    // refreshes the hierarchy without another client cache, per-title repair,
    // or Refresh requirement. Already linked episodes remain visible while read.
    if (wallSettings.plugins.cinemeta_enabled && (movie.type === "series" || !movie.detailsLoaded) && /^tt\d{5,12}$/.test(movie.imdbId)) void loadFilmDetails(movie, detailGeneration);
  }

  function placeBrowseControls(inDetail) {
    // The wall and carousel use the actual SAME controls, values and handlers.
    // Moving their nodes avoids a second filter state, rule set or fallback list.
    const destination = byId(inDetail ? "detail-filter-controls" : "browse-controls-home");
    destination.append(document.querySelector(".browse-toolbar"), byId("active-filters"));
  }

  function renderCarousel() {
    const index = selectedMovie ? visibleMovies.findIndex(item => movieKey(item) === movieKey(selectedMovie)) : -1;
    const count = visibleMovies.length;
    byId("detail-collection-label").textContent = collection?.name || "Movie Night";
    byId("carousel-counter").textContent = count ? `${index + 1} of ${count} matching titles${collection?.kind === "browse" ? " loaded" : ""}` : "0 matching titles";
    byId("carousel-cards").hidden = !count;
    byId("carousel-hint").hidden = !count;
    byId("carousel-empty").hidden = Boolean(count);
    byId("detail-expanded").hidden = !count || !detailsExpanded;
    byId("expand-details").setAttribute("aria-expanded", String(detailsExpanded));
    byId("expand-details").textContent = detailsExpanded ? "Less detail" : "More details";
    detailCarousel?.setItems(visibleMovies, selectedMovie ? movieKey(selectedMovie) : null);
    byId("carousel-previous").disabled = byId("carousel-next").disabled = count < 2 || launchPending;
    const more = byId("carousel-load-more");
    more.hidden = collection?.kind !== "browse" || !collection.hasMore || !wallSettings.plugins.cinemeta_enabled;
    more.disabled = Boolean(collection?.loading);
    more.textContent = collection?.loading ? "Loading titles…" : "Load more titles";
  }

  function syncCarouselSelection() {
    if (launchPending) return;
    if (!visibleMovies.length) {
      detailController?.abort(); detailController = null; detailGeneration += 1;
      resetSources(); selectedMovie = null;
      document.querySelector(".detail-hero").hidden = true;
      byId("detail-backdrop").replaceChildren();
      byId("detail-related").hidden = true;
      renderCarousel(); publishContext(); return;
    }
    const retained = selectedMovie && visibleMovies.find(item => movieKey(item) === movieKey(selectedMovie));
    if (!retained) {
      showFilm(visibleMovies[Math.min(carouselIndex, visibleMovies.length - 1)], { focus: false, resetScroll: false });
    } else {
      carouselIndex = visibleMovies.indexOf(retained);
      renderCarousel(); publishContext();
    }
  }

  function stepCarousel(delta) {
    if (launchPending || elements.dialog.hidden || !selectedMovie || !byId("source-picker").hidden) return false;
    const index = visibleMovies.findIndex(item => movieKey(item) === movieKey(selectedMovie));
    const next = visibleMovies.length ? visibleMovies[(index + delta + visibleMovies.length) % visibleMovies.length] : null;
    if (index < 0 || !next) return false;
    showFilm(next, { focus: false, resetScroll: false });
    if (collection?.kind === "browse" && collection.hasMore && index >= visibleMovies.length - 4) void loadBrowse(collection.type, true);
    return true;
  }

  function expandTitleDetails(force) {
    if (!selectedMovie) return;
    detailsExpanded = typeof force === "boolean" ? force : !detailsExpanded;
    renderCarousel();
    if (detailsExpanded) byId("detail-expanded").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  function sourceSize(value) {
    return Number.isFinite(value) && value > 0 ? `${(value / (1024 ** 3)).toFixed(1)} GiB` : "Size unspecified";
  }

  function filteredSources() {
    const quality = byId("source-quality").value;
    const range = byId("source-range").value;
    return sourceChoices.filter(source => (!quality || source.quality === quality)
      && (!range || (range === "hdr" ? Boolean(source.dynamic_range) : !source.dynamic_range)));
  }

  function renderSources() {
    const visible = filteredSources();
    if (!visible.some(source => source.id === selectedSource)) selectedSource = "";
    const list = byId("source-list"); list.replaceChildren(node("legend", "visually-hidden", "Available sources"));
    for (const source of visible) {
      const row = node("div", "source-option");
      const choice = node("label", "source-choice");
      const input = document.createElement("input"); input.type = "radio"; input.name = "source";
      input.value = source.id; input.checked = source.id === selectedSource;
      input.disabled = sourceBusy || launchPending;
      input.addEventListener("change", () => { selectedSource = source.id; updateSourceAction(); });
      const quality = source.quality === "2160p" ? "4K" : source.quality === "unknown" ? "Quality unknown" : source.quality;
      const copy = node("span", "source-copy");
      const details = [source.source_format, source.video_codec, source.dynamic_range, ...(source.audio || []), source.container, sourceSize(source.size_bytes)].filter(Boolean);
      copy.append(node("strong", "", [quality, source.source_format, source.video_codec].filter(Boolean).join(" · ")));
      copy.append(node("span", "source-technical", details.join(" · ")));
      copy.append(node("span", "source-technical", source.languages?.length ? `Language hints: ${source.languages.join(", ")}` : "Languages not supplied by provider"));
      input.setAttribute("aria-label", `Select ${source.label || quality}`);
      choice.append(input, node("span", "source-quality-badge", quality), copy);
      const play = node("button", "small-button source-row-play", "Play this stream");
      play.type = "button"; play.disabled = sourceBusy || launchPending;
      play.setAttribute("aria-label", `Play ${source.label || quality}`);
      play.addEventListener("click", () => {
        if (sourceBusy || launchPending) return;
        selectedSource = source.id; input.checked = true; updateSourceAction();
        void playSelectedMovie(source.id);
      });
      row.append(choice, node("span", "source-cached", "Provider reports cached"), play);
      list.append(row);
    }
    byId("source-status").textContent = sourceBusy ? "Checking your configured connection…"
      : sourceError || (sourceChoices.length ? `${visible.length} of ${sourceChoices.length} sources${visible.length ? ". Choose one below." : ". No sources match these filters."}`
      : sourceTitle ? "No confirmed cached sources were returned. Try again or choose another title." : "");
    byId("source-list").setAttribute("aria-busy", String(sourceBusy));
    for (const id of ["refresh-sources", "source-quality", "source-range"]) byId(id).disabled = sourceBusy || launchPending;
    byId("cancel-sources").disabled = launchPending;
    updateSourceAction();
  }

  function updateSourceAction() {
    byId("play-source").disabled = sourceBusy || launchPending || !selectedSource || sourceTitle !== mediaKey(mediaTarget());
    byId("source-selection-note").textContent = `${mediaLabel()} · ${selectedSource ? "Stream selected. Press Play to start." : "Select a stream or use its Play button."}`;
    byId("play-source").setAttribute("aria-busy", String(launchPending));
  }

  async function openSources() {
    const target = mediaTarget();
    if (!target || sourceBusy || launchPending) return;
    const movie = selectedMovie; const generation = ++sourceGeneration;
    sourceController?.abort(); const controller = new AbortController(); sourceController = controller;
    sourceBusy = true; sourceChoices = []; selectedSource = ""; sourceTitle = mediaKey(target); sourceError = "";
    byId("source-heading").textContent = `Streams for ${mediaLabel(target)}`;
    byId("source-picker").hidden = false; renderSources();
    byId("source-heading").focus({ preventScroll: true });
    byId("source-picker").scrollIntoView({ block: "start", behavior: "instant" });
    try {
      const result = await playerRequest("sources", target, controller.signal);
      if (generation !== sourceGeneration || selectedMovie !== movie || elements.dialog.hidden) return;
      if (mediaKey(mediaTarget()) !== mediaKey(target) || !sameMedia(target, result) || !Array.isArray(result.sources)) throw new Error("source_mismatch");
      const seen = new Set();
      sourceChoices = result.sources.slice(0, 100).filter(source => {
        if (!source || typeof source.id !== "string" || !/^[A-Za-z0-9_-]{24,64}$/.test(source.id) || seen.has(source.id)) return false;
        seen.add(source.id); return true;
      }).map(source => ({ id: source.id, quality: text(source.quality), label: text(source.label).slice(0, 180),
        video_codec: text(source.video_codec), dynamic_range: text(source.dynamic_range),
        source_format: text(source.source_format), container: text(source.container),
        languages: Array.isArray(source.languages) ? source.languages.filter(x => typeof x === "string").slice(0, 12) : [],
        audio: Array.isArray(source.audio) ? source.audio.filter(x => typeof x === "string").slice(0, 8) : [],
        size_bytes: typeof source.size_bytes === "number" ? source.size_bytes : null }));
    } catch (error) {
      if (generation !== sourceGeneration || controller.signal.aborted || selectedMovie !== movie) return;
      sourceError = safePlayerError(error?.message);
    } finally {
      if (generation === sourceGeneration) { sourceBusy = false; sourceController = null; renderSources(); }
    }
  }

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function clock(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
      : `${minutes}:${String(total % 60).padStart(2, "0")}`;
  }

  function safePlayerError(code) {
    const key = typeof code === "string" ? code.toLowerCase() : "";
    if (key.includes("native_player") || key.includes("embedding")) return "The player window isn’t ready yet. Your film has not been started. Please try again.";
    if (key.includes("source_mismatch")) return "These streams do not match the selected title or episode. Nothing has started. Search again.";
    if (key.includes("source_expired")) return "That source has expired. Search again and select a fresh source.";
    if (key.includes("plugin_disabled")) return "Torrentio is disabled in Movie Night settings. Enable it to choose a stream.";
    if (key.includes("source_required")) return "Choose a stream before starting your film.";
    if (key.includes("no_cached_sources")) return "This film isn’t available to play right now. Please choose another film.";
    if (key.includes("timeout") || key === "aborterror") return "That took longer than expected. Check the player below before trying again.";
    if (key.includes("unavailable") || key.includes("offline") || key.includes("unreachable")) return "The Movie Night player on Aries is unavailable. Reconnect to check again.";
    if (key.includes("invalid_imdb") || key.includes("unknown_movie")) return "This film could not be matched for playback.";
    return "Aries could not complete that request. Check the player status, then try again.";
  }

  function playerMessage(message, reconnect = false) {
    setText(player.message, message);
    player.messageWrap.hidden = !message;
    player.reconnect.hidden = !reconnect;
  }

  async function playerRequest(path, payload, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, ["play", "sources"].includes(path) ? 45000 : payload === undefined ? 8000 : 12000);
    try {
      const options = { signal: controller.signal, cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } };
      if (payload !== undefined) {
        options.method = "POST";
        options.headers["Content-Type"] = "application/json";
        options.headers["X-Movie-Night"] = "1";
        options.body = JSON.stringify(payload);
      }
      const response = await fetch(`/api/player/${path}`, options);
      let data;
      try { data = await response.json(); } catch { throw new Error("player_unavailable"); }
      if (!response.ok || data?.error) throw new Error(text(data?.code) || text(data?.error) || "request_failed");
      return data;
    } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
  }

  function updatePlayerControls() {
    const state = playerStatus.state;
    const active = ["loading", "playing", "paused"].includes(state);
    const busy = commandPending || launchPending || nativeActionPending;
    player.dock.hidden = dockDismissed || (cubeHome?.isCarousel() && playerStatus.state === "idle");
    player.controls.hidden = !active;
    player.secondary.hidden = !active && !nativePlayerMode;
    player.volumeGroup.hidden = !active;
    player.fullscreen.hidden = !active && !nativeFullscreen;
    byId("player-mini").hidden = !active || !isNativeHost();
    byId("player-details-open").hidden = !active;
    byId("player-options-toggle").hidden = !active;
    byId("quick-play").hidden = false;
    byId("quick-play").disabled = busy || sourceBusy || !mediaTarget();
    updateTrackControls();
    player.close.disabled = busy;
    const closeLabel = active ? "Stop playback and close controls" : "Close player controls";
    player.close.setAttribute("aria-label", closeLabel);
    player.close.title = closeLabel;
    const canControl = playerConnected && !busy && ["playing", "paused"].includes(state);
    const target = mediaTarget();
    const sameMovie = sameMedia(target, playerStatus);
    const isSeries = selectedMovie?.type === "series";
    player.play.disabled = !target || busy || (sameMovie && state === "loading");
    const playLabel = sameMovie && state === "paused" ? "Resume on Aries" : sameMovie && state === "playing" ? "Watch on Aries" : sameMovie && state === "loading" ? "Getting your film ready…" : "Choose a stream";
    setText(player.playLabel, isSeries && !target ? "Select an episode" : launchPending ? "Getting your selection ready…" : playLabel);
    player.play.setAttribute("aria-busy", String(launchPending));
    byId("choose-sources").disabled = busy || !target;
    byId("episode-season").disabled = launchPending || !selectedMovie?.episodes?.length;
    byId("refresh-episodes").disabled = launchPending || Boolean(detailController) || !wallSettings.plugins.cinemeta_enabled || !/^tt\d{5,12}$/.test(selectedMovie?.imdbId || "");
    for (const button of byId("episode-list").querySelectorAll("button")) button.disabled = launchPending;
    byId("close-dialog").disabled = launchPending;
    updateSourceAction();
    player.toggle.disabled = !canControl;
    player.stop.disabled = !playerConnected || busy || !["loading", "playing", "paused"].includes(state);
    player.fullscreen.disabled = isNativeHost() ? nativeActionPending : !canControl;
    [player.back, player.forward, player.mute, player.volume].forEach((control) => { control.disabled = !canControl; });
    const action = state === "paused" ? "Resume" : "Pause";
    setText(player.toggleLabel, action);
    setIcon(player.toggleIcon, state === "paused" ? "play" : "pause");
    player.toggle.setAttribute("aria-label", `${action} on Aries`);
    player.toggle.title = `${action} on Aries`;
    player.seek.disabled = !canControl || !(playerStatus.duration > 0);
    const muteLabel = playerStatus.muted ? "Unmute Aries" : "Mute Aries";
    player.mute.setAttribute("aria-label", muteLabel);
    player.mute.setAttribute("aria-pressed", String(playerStatus.muted));
    player.mute.title = muteLabel;
    setIcon(player.volumeIcon, playerStatus.muted || playerStatus.volume === 0 ? "muted" : "volume");
    const fullscreen = isNativeHost() ? nativeFullscreen : playerStatus.fullscreen;
    const fullscreenLabel = fullscreen ? "Exit full screen" : "Full screen";
    setText(player.fullscreenLabel, fullscreenLabel);
    player.fullscreen.setAttribute("aria-label", `${fullscreen ? "Exit" : "Enter"} full screen on Aries`);
    player.fullscreen.setAttribute("aria-pressed", String(fullscreen));
    player.fullscreen.title = `${fullscreenLabel} on Aries`;
    setIcon(player.fullscreenIcon, fullscreen ? "shrink" : "expand");
    player.wall.hidden = !nativePlayerMode;
    player.wall.disabled = nativeActionPending || launchPending;
    player.watch.hidden = !isNativeHost() || nativePlayerMode || !["playing", "paused"].includes(state);
    player.watch.disabled = !canControl;
    player.viewActions.hidden = player.wall.hidden && player.watch.hidden;
  }

  function applyPlayerStatus(data) {
    if (!data || !playerStates.has(data.state)) throw new Error("player_unavailable");
    playerConnected = true;
    const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    playerStatus = {
      state: data.state, imdb_id: text(data.imdb_id), title: text(data.title),
      position: Math.max(0, finite(data.position)), duration: Math.max(0, finite(data.duration)),
      volume: Math.max(0, Math.min(100, finite(data.volume, playerStatus.volume))),
      muted: data.muted === true, fullscreen: data.fullscreen === true,
      type: data.type === "series" ? "series" : "movie", season: data.season ?? null, episode: data.episode ?? null,
      tracks: Array.isArray(data.tracks) ? data.tracks : [],
    };
    const active = ["loading", "playing", "paused"].includes(playerStatus.state);
    if (playerStatus.state !== "playing") revealPlayerControls();
    setText(player.title, active ? playerStatus.title || "Movie Night player" : "Choose tonight’s film");
    const labels = { idle: "Ready when you are. Choose a film above.", loading: "Getting your film ready…", playing: "Enjoy your film", paused: "Paused. Ready when you are.", error: "Let’s try that again" };
    setText(player.state, labels[playerStatus.state]);
    const deviceLabels = { idle: "Ready", loading: "Starting…", playing: "Playing", paused: "Paused", error: "Check player" };
    setText(player.deviceStatus, deviceLabels[playerStatus.state]);
    player.deviceIndicator.dataset.state = playerStatus.state;
    player.dock.dataset.state = playerStatus.state;
    const movie = collections.flatMap((item) => item.movies).find((item) => item.imdbId === playerStatus.imdb_id);
    const artworkKey = active && movie ? movie.imdbId : "";
    if (player.artwork.dataset.film !== artworkKey) {
      player.artwork.dataset.film = artworkKey;
      player.artwork.replaceChildren(artworkKey ? poster(movie) : icon("screen"));
    }
    const duration = Number.isFinite(playerStatus.duration) ? playerStatus.duration : 0;
    const position = Number.isFinite(playerStatus.position) ? playerStatus.position : 0;
    player.timeline.hidden = !active || duration <= 0;
    setText(player.position, clock(position));
    setText(player.duration, clock(duration));
    player.seek.max = String(Math.max(1, Math.floor(duration)));
    if (document.activeElement !== player.seek) player.seek.value = String(Math.min(position, duration));
    player.seek.setAttribute("aria-valuetext", `${clock(position)} of ${clock(duration)}`);
    if (document.activeElement !== player.volume) {
      player.volume.value = String(Math.round(playerStatus.volume));
      setText(player.volumeValue, playerStatus.muted ? "Muted" : `${Math.round(playerStatus.volume)}%`);
      player.volume.setAttribute("aria-valuetext", `${Math.round(playerStatus.volume)} percent${playerStatus.muted ? ", muted" : ""}`);
    }
    if (data.state === "error") playerMessage(safePlayerError(data.last_error));
    else if (!launchPending && !commandPending && !player.reconnect.hidden) playerMessage("");
    updatePlayerControls();
  }

  async function pollPlayer() {
    clearTimeout(pollTimer);
    if (document.hidden || statusPending) return;
    statusPending = true;
    const revision = playerRevision;
    try {
      const data = await playerRequest("status");
      if (revision === playerRevision) applyPlayerStatus(data);
    } catch {
      if (!document.hidden && revision === playerRevision) {
        playerConnected = false;
        setText(player.state, "Waiting for Aries to reconnect");
        setText(player.deviceStatus, "Reconnecting");
        player.deviceIndicator.dataset.state = "offline";
        updatePlayerControls();
        if (!launchPending && !commandPending) playerMessage("We can’t reach Aries right now. Your film choices are still here.", true);
      }
    } finally {
      statusPending = false;
      if (!document.hidden) pollTimer = setTimeout(pollPlayer, 2000);
    }
  }

  async function playSelectedMovie(sourceId = null) {
    const target = mediaTarget();
    if (!target || launchPending || commandPending || nativeActionPending) return;
    const movie = selectedMovie;
    const currentSelection = sourceId && sourceTitle === mediaKey(target) && sourceChoices.some(source => source.id === sourceId);
    const sameActive = sameMedia(target, playerStatus) && ["paused", "playing", "loading"].includes(playerStatus.state);
    if (!sourceId && !sameActive) { await openSources(); return; }
    if (sourceId && !currentSelection) return;
    const generation = detailGeneration;
    dockDismissed = false; launchPending = true; playerRevision += 1;
    updatePlayerControls(); renderSources();
    const waiting = `Getting ${movie.title} ready on Aries…`;
    setText(player.feedback, waiting); playerMessage(waiting);
    try {
      const current = await playerRequest("status");
      if (selectedMovie !== movie || generation !== detailGeneration || elements.dialog.hidden) return;
      applyPlayerStatus(current);
      const sameMovie = sameMedia(target, current);
      let data;
      if (!sourceId && sameMovie && current.state === "paused") { const {title, ...identity} = target; data = await playerRequest("command", { command: "resume", ...identity }); }
      else if (!sourceId && sameMovie && ["playing", "loading"].includes(current.state)) data = current;
      else if (!sourceId) {
        launchPending = false; playerMessage(""); await openSources(); return;
      } else {
        if (isNativeHost()) {
          const ready = await nativeCall("prepare_movie_player");
          if (ready !== true) throw new Error("native_player_embedding_not_ready");
        }
        if (selectedMovie !== movie || generation !== detailGeneration || elements.dialog.hidden) return;
        data = await playerRequest("play", { ...target, source_id: sourceId });
      }
      if (data?.state === "error") throw new Error(text(data.last_error) || "playback_error");
      if (data?.state && playerStates.has(data.state)) applyPlayerStatus(data);
      const shown = await showNativePlayer();
      if (shown !== false) playerMessage("");
      if (selectedMovie === movie) { closeFilm(); player.dock.focus({ preventScroll: true }); }
    } catch (error) {
      if (isNativeHost()) { try { await showMovieWall(); } catch { /* Keep usable controls. */ } }
      const message = safePlayerError(error?.name === "AbortError" ? "timeout" : error?.message);
      if (selectedMovie === movie) {
        setText(player.feedback, message);
        if (String(error?.message).includes("source_expired")) { sourceError = message; sourceChoices = []; selectedSource = ""; }
      }
      playerMessage(message);
    } finally {
      launchPending = false; updatePlayerControls(); renderSources(); void pollPlayer();
    }
  }

  async function sendPlayerCommand(command, value) {
    if (commandPending || launchPending || nativeActionPending) return false;
    commandPending = true;
    playerRevision += 1;
    updatePlayerControls();
    playerMessage("");
    try {
      const payload = { command };
      if (["audio-track", "subtitle-track"].includes(command)) Object.assign(payload, {imdb_id: playerStatus.imdb_id, type: playerStatus.type, season: playerStatus.season, episode: playerStatus.episode});
      if (value !== undefined) payload.value = value;
      const data = await playerRequest("command", payload);
      if (data?.state === "error") throw new Error(text(data.last_error) || "player_error");
      if (data?.state && playerStates.has(data.state)) applyPlayerStatus(data);
      return true;
    } catch (error) {
      playerMessage(safePlayerError(error?.name === "AbortError" ? "timeout" : error?.message));
      return false;
    } finally {
      commandPending = false;
      updatePlayerControls();
      void pollPlayer();
    }
  }

  async function closePlayerControls() {
    if (commandPending || launchPending || nativeActionPending) return;
    if (["loading", "playing", "paused"].includes(playerStatus.state)) {
      if (!await sendPlayerCommand("stop")) return;
    }
    if (nativePlayerMode) {
      try { await showMovieWall(); }
      catch { playerMessage("The wall could not be reopened. Your player controls are still here."); return; }
    }
    dockDismissed = true;
    updatePlayerControls();
    measureDock();
  }

  elements.search.addEventListener("input", renderFilms);
  elements.genre.addEventListener("change", renderFilms);
  byId("provider-filter").addEventListener("change", () => {
    filters.provider = byId("provider-filter").value;
    renderFilms();
  });
  elements.sort.addEventListener("change", renderFilms);
  elements.picker.addEventListener("change", () => { activeCubeLabel = ""; selectCollection(elements.picker.value); });
  document.querySelectorAll("[data-collection]").forEach((button) => button.addEventListener("click", () => {
    activeCubeLabel = "";
    const id = button.dataset.collection === "curated" ? curatedCollections[0]?.id : button.dataset.collection;
    selectCollection(id);
  }));
  byId("import-library").addEventListener("click", importPersonalLibrary);
  byId("favorite-detail").addEventListener("click", () => toggleFavorite(selectedMovie));
  byId("load-more").addEventListener("click", () => { if (collection?.kind === "browse") void loadBrowse(collection.type, true); });
  byId("catalog-source").addEventListener("change", () => {
    if (collection?.kind !== "browse") return;
    changeBrowseSettings({ catalog: byId("catalog-source").value, genre: collection.catalogGenre, year: collection.catalogYear, search: "" });
  });
  byId("catalog-genre").addEventListener("change", () => {
    if (collection?.kind !== "browse") return;
    changeBrowseSettings({ catalog: collection.catalog, genre: byId("catalog-genre").value, year: collection.catalogYear, search: "" });
  });
  byId("catalog-year").addEventListener("change", () => {
    if (collection?.kind !== "browse") return;
    changeBrowseSettings({ catalog: "year", year: byId("catalog-year").value, search: "" });
  });
  byId("catalog-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (collection?.kind !== "browse") return;
    changeBrowseSettings({ catalog: "top", year: collection.catalogYear, genre: "", search: byId("catalog-search").value.trim().slice(0, 160) });
  });
  const filterDialog = byId("filter-dialog");
  byId("open-filters").addEventListener("click", () => { filterDialog.showModal(); document.body.classList.add("dialog-open"); });
  byId("close-filters").addEventListener("click", () => filterDialog.close());
  filterDialog.addEventListener("close", () => { if (elements.dialog.hidden) document.body.classList.remove("dialog-open"); });
  filterDialog.addEventListener("click", (event) => {
    if (event.target !== filterDialog) return;
    const bounds = filterDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) filterDialog.close();
  });
  byId("filter-form").addEventListener("submit", (event) => { event.preventDefault(); filterDialog.close(); });
  byId("filter-form").addEventListener("input", (event) => {
    if (["filter-year-from", "filter-year-to", "filter-genre-mode", "filter-rating", "filter-runtime", "filter-type", "filter-watch"].includes(event.target.id)) readFilterControls();
  });
  byId("filter-form").addEventListener("change", (event) => {
    const kind = event.target.dataset.genreKind;
    if (!kind || !["include", "exclude"].includes(kind)) return;
    const genre = event.target.value;
    filters[kind] = filters[kind].filter((value) => value !== genre);
    if (event.target.checked) {
      filters[kind].push(genre);
      const other = kind === "include" ? "exclude" : "include";
      filters[other] = filters[other].filter((value) => value !== genre);
      document.querySelectorAll(`[data-genre-kind="${other}"]`).forEach((input) => { input.checked = filters[other].includes(input.value); });
    }
    renderFilms();
  });
  byId("reset-advanced-filters").addEventListener("click", resetFilters);
  byId("save-view").addEventListener("click", saveFilterView);
  byId("saved-views").addEventListener("change", applySavedView);
  byId("delete-view").addEventListener("click", deleteSavedView);
  window.addEventListener("message", (event) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== location.origin) return;
    if (!event.data || event.data.type !== "movie-night:library-updated") return;
    void loadLibrary(text(event.data.collectionId || event.data.collection_id || event.data.collection) || collection?.id);
  });
  elements.reset.addEventListener("click", resetFilters);
  byId("empty-reset").addEventListener("click", resetFilters);
  byId("retry-load").addEventListener("click", loadLibrary);
  byId("carousel-previous").addEventListener("click", () => stepCarousel(-1));
  byId("carousel-next").addEventListener("click", () => stepCarousel(1));
  byId("expand-details").addEventListener("click", () => expandTitleDetails());
  byId("carousel-reset").addEventListener("click", resetFilters);
  byId("carousel-load-more").addEventListener("click", () => { if (collection?.kind === "browse") void loadBrowse(collection.type, true); });
  const carousel = byId("title-carousel");
  carousel.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented || event.repeat) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (stepCarousel(event.key === "ArrowLeft" ? -1 : 1)) { event.preventDefault(); carousel.focus({ preventScroll: true }); }
    }
  });
  detailCarousel = new CenteredCarousel(byId("carousel-cards"), {
    poster, legacyIds: true,
    onSelect(movie, index) {
      if (launchPending || !byId("source-picker").hidden) return;
      showFilm(movie, { focus: false, resetScroll: false });
      if (collection?.kind === "browse" && collection.hasMore && !collection.error && index >= visibleMovies.length - 4) void loadBrowse(collection.type, true);
    },
    onOpen() { expandTitleDetails(true); },
  });
  byId("close-dialog").addEventListener("click", closeFilm);
  byId("episode-hide-art").addEventListener("change", event => {
    hideEpisodeArt = event.target.checked;
    byId("episode-list").classList.toggle("episode-art-hidden", hideEpisodeArt);
  });
  byId("episode-season").addEventListener("change", () => {
    if (launchPending || !selectedMovie) return;
    resetSources(); selectedEpisode = null; selectedSeason = Number(byId("episode-season").value); renderEpisodes(selectedMovie);
  });
  byId("refresh-episodes").addEventListener("click", () => {
    if (!selectedMovie || launchPending || detailController || !wallSettings.plugins.cinemeta_enabled || !/^tt\d{5,12}$/.test(selectedMovie.imdbId)) return;
    selectedMovie.episodeError = ""; selectedMovie.detailsLoaded = false; resetSources(); renderEpisodes(selectedMovie); void loadFilmDetails(selectedMovie, detailGeneration);
  });
  byId("choose-sources").addEventListener("click", openSources);
  byId("refresh-sources").addEventListener("click", openSources);
  byId("cancel-sources").addEventListener("click", () => { if (!launchPending) { resetSources(); player.play.focus(); } });
  byId("source-quality").addEventListener("change", renderSources);
  byId("source-range").addEventListener("change", renderSources);
  byId("source-form").addEventListener("submit", event => { event.preventDefault(); if (selectedSource) void playSelectedMovie(selectedSource); });
  player.play.addEventListener("click", () => playSelectedMovie());
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || elements.dialog.hidden || launchPending || event.defaultPrevented) return;
    event.preventDefault();
    if (!byId("source-picker").hidden) { resetSources(); player.play.focus(); } else closeFilm();
  });
  player.toggle.addEventListener("click", () => sendPlayerCommand(playerStatus.state === "paused" ? "resume" : "pause"));
  player.stop.addEventListener("click", () => sendPlayerCommand("stop"));
  player.back.addEventListener("click", () => sendPlayerCommand("skip", -wallSettings.playback.seek_seconds));
  player.forward.addEventListener("click", () => sendPlayerCommand("skip", wallSettings.playback.seek_seconds));
  player.mute.addEventListener("click", () => sendPlayerCommand("mute"));
  byId("quick-play").addEventListener("click", quickPlay);
  byId("player-reveal").addEventListener("click", () => { revealPlayerControls(); player.dock.focus({preventScroll:true}); });
  byId("player-mini").addEventListener("click", () => setMiniPlayer(!miniPlayer).catch(() => playerMessage("Player view could not change. Playback continues.")));
  byId("player-details-open").addEventListener("click", () => showPlayingDetails().catch(() => playerMessage("Title details could not open. Playback continues.")));
  byId("player-options-toggle").addEventListener("click", () => {
    const opened = byId("player-options").hidden;
    byId("player-options").hidden = !opened;
    byId("player-options-toggle").setAttribute("aria-expanded", String(opened));
    revealPlayerControls(); measureDock();
  });
  for (const [id, command] of [["player-audio-track", "audio-track"], ["player-subtitle-track", "subtitle-track"]]) {
    byId(id).addEventListener("change", () => sendPlayerCommand(command, byId(id).value === "off" ? "off" : Number(byId(id).value)));
  }
  player.dock.addEventListener("pointermove", revealPlayerControls);
  player.dock.addEventListener("focusin", revealPlayerControls);
  player.dock.addEventListener("focusout", revealPlayerControls);
  byId("native-video-placeholder").addEventListener("dblclick", togglePlayerFullscreen);
  byId("native-video-placeholder").addEventListener("pointermove", revealPlayerControls);
  player.fullscreen.addEventListener("click", togglePlayerFullscreen);
  player.watch.addEventListener("click", () => changePlayerView(true));
  player.wall.addEventListener("click", () => changePlayerView(false));
  player.close.addEventListener("click", closePlayerControls);
  document.querySelector(".device-badge").addEventListener("click", (event) => {
    event.preventDefault();
    dockDismissed = false;
    updatePlayerControls();
    measureDock();
    player.dock.focus({ preventScroll: true });
  });
  player.volume.addEventListener("input", () => {
    setText(player.volumeValue, `${player.volume.value}%`);
    player.volume.setAttribute("aria-valuetext", `${player.volume.value} percent`);
  });
  player.volume.addEventListener("change", () => sendPlayerCommand("volume", Number(player.volume.value)));
  player.seek.addEventListener("input", () => {
    setText(player.position, clock(player.seek.value));
    player.seek.setAttribute("aria-valuetext", `${clock(player.seek.value)} of ${clock(playerStatus.duration)}`);
  });
  player.seek.addEventListener("change", () => sendPlayerCommand("seek", Number(player.seek.value)));
  player.reconnect.addEventListener("click", pollPlayer);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(pollTimer);
    if (!document.hidden) void pollPlayer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !elements.dialog.hidden || filterDialog.open) return;
    const target = event.target;
    if (typeof target?.closest === "function" && target.closest("input, textarea, select, [contenteditable], [role='textbox'], [role='slider']")) return;
    if (event.key === "Escape" && isNativeHost() && nativeFullscreen) {
      event.preventDefault();
      void togglePlayerFullscreen();
      return;
    }
    if (event.key.toLowerCase() === "f" && isNativeHost()) {
      event.preventDefault();
      void togglePlayerFullscreen();
      return;
    }
    if (!playerConnected || !["playing", "paused"].includes(playerStatus.state)) return;
    if (event.key === " " || event.code === "Space") {
      if (typeof target?.closest === "function" && target.closest("button, a, summary")) return;
      event.preventDefault();
      void sendPlayerCommand(playerStatus.state === "paused" ? "resume" : "pause");
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      void sendPlayerCommand("skip", (event.key === "ArrowLeft" ? -1 : 1) * wallSettings.playback.seek_seconds);
    }
  });
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(measureDock).observe(player.dock);
  }
  readSavedViews();
  syncFilterControls();
  applyWallSettings(wallSettings);
  await loadLibrary();
  cubeHome = await mountFilterCubes({
    poster, current: currentFilterView, collections: () => collections,
    presentation(mode, count) {
      if (mode === "carousel") {
        elements.title.textContent = "Your filter cubes";
        elements.description.textContent = "A home built from your interests. Each row is a live query, never a fixed playlist.";
      } else if (collection) { elements.title.textContent=collection.name; elements.description.textContent=collection.description; }
      player.dock.hidden = dockDismissed || (mode === "carousel" && playerStatus.state === "idle");
      measureDock();
    },
    evaluate: filterMovieQuery, catalogueEnabled: () => wallSettings.plugins.cinemeta_enabled,
    sourceDefaults(id) { const item = collections.find(c => c.id === id); return savedBrowseSettings(item); },
    summary(query) {
      const f = query.filters;
      return [collections.find(c => c.id === query.collectionId)?.name || "Source unavailable",
        query.search ? `Matching “${query.search}”` : "", f.provider ? `Provider: ${f.provider}` : "", query.genre, f.include.join(" + "),
        f.exclude.length ? `Without ${f.exclude.join(", ")}` : "", f.yearFrom || f.yearTo ? `${f.yearFrom || "Any year"}–${f.yearTo === "present" ? "current year" : f.yearTo || "any year"}` : "",
        f.type === "series" ? "TV" : f.type === "movie" ? "Films" : "", f.rating ? `Rating ${f.rating}+` : "",
        f.runtime ? `Under ${f.runtime} min` : "", f.watch].filter(Boolean).join(" · ");
    },
    async fetchPage(row, skip) {
      const type = row.collectionId === "browse-series" ? "series" : "movie";
      const view = row.browse || { catalog: "top", genre: "", year: String(currentYear), search: "" };
      const params = new URLSearchParams({ type, catalog: view.catalog, skip: String(skip) });
      if (view.catalog === "year") params.set("genre", view.year); else if (view.genre) params.set("genre", view.genre);
      if (view.search) params.set("search", view.search);
      const result = await requestJSON(`/api/browse?${params}`);
      return {...result, movies: Array.isArray(result.movies) ? result.movies.map((m,i) => normalizeMovie({...m,type:m.type||type},skip+i)).filter(Boolean) : null};
    },
    activate(row, source, movie) {
      activeCubeLabel = row.name;
      const target = collections.find(c => c.id === row.collectionId); if (!target) return;
      filters = sanitizedFilters(row.filters); elements.search.value = row.search; elements.sort.value = row.sort;
      if (target.kind === "browse") {
        Object.assign(target, browseSettings(row.browse, target.type));
        target.movies = [...source.movies]; target.loaded = true; target.hasMore = source.hasMore;
        target.nextSkip = source.next || 0; target.loading = false; target.pages = source.pages || 0;
      }
      if (row.genre && ![...elements.genre.options].some(o=>o.value===row.genre)) {const option=node("option","",row.genre);option.value=row.genre;elements.genre.append(option);}
      elements.genre.value = row.genre; selectCollection(target.id); syncFilterControls();
      if (movie) selectedMovie = movie; publishContext();
    },
    open(movie) { showFilm(movie); },
    openFilters() { byId("open-filters").click(); },
  });
  // Same-origin shell exposes ONLY review entry and current query, never a generic executor.
  window.movieNightCubeContext = () => cubeHome?.context() || null;
  window.movieNightReviewCube = operation => cubeHome.reviewOperation(operation);
  void pollPlayer();
})();
