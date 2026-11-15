// Several puzzles on one device: how their data is laid out in the
// database (store 'kv' of IndexedDB 'puzzlehelfer', shared by app.js and
// worker.js) and what is shown about them in the list. No database access
// here, so that Node can test it.
//
//   puzzle:<id>          {id, name, created, opened, count, cols, rows, thumb}
//   <id>/ref             reference photo (Blob), corners, piece count, grid
//   <id>/feat            feature points of the reference
//   <id>/round           photos of the round, marks, view
//   <id>/photo:<n>       a photo of the round (Blob)
//   <id>/analysis:<n>    its analysis (written by the worker)
//   <id>/solved          the last search for places (written by the worker)
//
// Before there were several puzzles the same keys stood without '<id>/'.
(() => {
  globalThis.PH ??= {};
  const PH = globalThis.PH;

  const prefix = (id) => `${id}/`;
  const metaKey = (id) => `puzzle:${id}`;
  // All keys from..to (to excluded) starting with a prefix.
  const span = (start) => [
    start,
    start.slice(0, -1) + String.fromCharCode(start.charCodeAt(start.length - 1) + 1),
  ];
  const META = span('puzzle:');
  const dataSpan = (id) => span(prefix(id));

  const nextId = (ids) => Math.max(0, ...ids) + 1;
  const defaultName = (id) => `Puzzle ${id}`;
  // An empty name keeps the old one.
  const cleanName = (name, old) => name.replace(/\s+/g, ' ').trim().slice(0, 60) || old;

  // What to do with data stored before there were several puzzles. keys:
  // all keys in the store, ids: the puzzles there are. With a reference it
  // becomes a puzzle of its own ({id, moves: [from, to]}); photos without
  // one cannot be used ({drop}); null if there is nothing old.
  const LEGACY = /^(ref|feat|round|solved|photo:\d+|analysis:\d+)$/;
  function migration(keys, ids) {
    const old = keys.filter((k) => typeof k === 'string' && LEGACY.test(k));
    if (!old.length) return null;
    if (!old.includes('ref')) return { drop: old };
    const id = nextId(ids);
    return { id, moves: old.map((k) => [k, prefix(id) + k]) };
  }

  // Opened last first.
  const sorted = (list) => [...list].sort((a, b) => (b.opened ?? 0) - (a.opened ?? 0) || b.id - a.id);

  const date = (t) => {
    const d = new Date(t);
    const two = (n) => String(n).padStart(2, '0');
    return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`;
  };
  // Line under the name in the list.
  const label = (p) =>
    [p.count ? `${p.count} Teile` : '', p.created ? `angelegt ${date(p.created)}` : '']
      .filter(Boolean)
      .join(' · ');

  const size = (bytes) => {
    const mb = bytes / 2 ** 20;
    if (mb >= 1000) return `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
    return `${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB`;
  };

  const isQuota = (err) => err?.name === 'QuotaExceededError' || err?.code === 22;
  const QUOTA =
    'Der Speicher des Geräts ist voll. Lösche Puzzles, die du nicht mehr brauchst, oder Fotos der Runde.';

  PH.puzzles = {
    prefix,
    metaKey,
    META,
    dataSpan,
    nextId,
    defaultName,
    cleanName,
    migration,
    sorted,
    label,
    size,
    isQuota,
    QUOTA,
  };
})();
