// Diagnosis codes: the shop's internal library of common tool problems.
// One code per problem per tool type (HJ-03), read off the wall chart and
// typed on the tracker. Mirrors backend/app/models/diagnosis_code.py.

export const GENERAL_TOOL_TYPE = 'GENERAL';   // codes that apply to every tool
export const GENERAL_PREFIX = 'GEN';

// The wall chart's sections, in chart order. A code sits in one of them and
// under one tool type within it (IMPACT WRENCH inside AIR TOOLS).
export const CATEGORIES = ['AIR TOOLS', 'HYDRAULIC TOOLS', 'ELECTRIC TOOLS', 'LIFTING TOOLS', 'DRAIN CAMERAS', 'CORDLESS TOOLS', 'GENERAL'];
export const GENERAL_CATEGORY = 'GENERAL';

// "AIR TOOLS" → "Air Tools" for labels; the data stays uppercase.
export const categoryLabel = (c) => String(c || '').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

// HYDRAULIC JACK → HJ, GRINDER → GR, PIPE INSPECTION CAMERA → PIC, GENERAL → GEN.
// "ANY AIR TOOL" (a category's generic codes) → AT: the "ANY" is skipped.
export function suggestPrefix(toolType) {
  const words = String(toolType || '').trim().split(/[^A-Za-z0-9]+/).filter(Boolean).filter((w, i) => !(i === 0 && w.toUpperCase() === 'ANY'));
  if (!words.length) return GENERAL_PREFIX;
  if (words.length === 1) {
    const word = words[0].toUpperCase();
    return word === GENERAL_TOOL_TYPE ? GENERAL_PREFIX : word.slice(0, 2);
  }
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
}

export function formatCode(prefix, number) {
  return `${String(prefix || '').toUpperCase()}-${String(number || 0).padStart(2, '0')}`;
}

// What a tech types off the wall, however sloppily: "HJ-03", "hj3", "hj 03",
// "HJ-3" all mean prefix HJ, number 3; "hj" alone means every HJ code.
// Returns null when the text isn't code-shaped (then it's a word search).
export function parseCodeQuery(q) {
  const m = String(q || '').trim().match(/^([A-Za-z]{1,6})\s*-?\s*(\d{1,4})?$/);
  if (!m) return null;
  return { prefix: m[1].toUpperCase(), number: m[2] != null ? parseInt(m[2], 10) : null };
}

export function codeQueryMatches(c, parsed) {
  return c.prefix === parsed.prefix && (parsed.number == null || c.number === parsed.number);
}

const categoryIndex = (c) => {
  const i = CATEGORIES.indexOf(c);
  return i === -1 ? CATEGORIES.length : i;
};
// Inside a category the generic type ("ANY AIR TOOL") leads, then the tool
// types alphabetically.
const typeSort = (a, b) => {
  const aa = a.startsWith('ANY ');
  const bb = b.startsWith('ANY ');
  if (aa !== bb) return aa ? -1 : 1;
  return a.localeCompare(b);
};
const codeSort = (a, b) => (a.prefix === b.prefix ? a.number - b.number : a.prefix.localeCompare(b.prefix));

// Wall-chart order: the categories as listed above, lettered A, B, C… the
// way the reference charts are, each holding its tool types with their
// codes by number: [{ category, letter, count, types: [{ toolType, codes }] }].
export function groupCodes(codes) {
  const byCat = new Map();
  for (const c of codes || []) {
    const cat = (c.category || GENERAL_CATEGORY).toUpperCase();
    const type = (c.tool_type || GENERAL_TOOL_TYPE).toUpperCase();
    if (!byCat.has(cat)) byCat.set(cat, new Map());
    const types = byCat.get(cat);
    if (!types.has(type)) types.set(type, []);
    types.get(type).push(c);
  }
  const cats = [...byCat.keys()].sort((a, b) => categoryIndex(a) - categoryIndex(b) || a.localeCompare(b));
  return cats.map((category, i) => {
    const types = [...byCat.get(category).keys()].sort(typeSort).map((toolType) => ({
      toolType,
      codes: byCat.get(category).get(toolType).sort(codeSort),
    }));
    return {
      category,
      letter: String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''),
      count: types.reduce((n, t) => n + t.codes.length, 0),
      types,
    };
  });
}

// Words that say nothing about what the tool is.
const NOISE_WORDS = new Set(['TOOL', 'TOOLS', 'EQUIPMENT', 'AND', 'OR', 'THE', 'A', 'ANY']);
// Words that say how a tool is powered — they pick a section, not a tool
// ("22-TON TRUCK JACK – AIR/HYDRAULIC" is a jack, not an air tool).
const POWER_WORDS = {
  AIR: 'AIR TOOLS', PNEUMATIC: 'AIR TOOLS',
  ELECTRIC: 'ELECTRIC TOOLS', CORDED: 'ELECTRIC TOOLS',
  CORDLESS: 'CORDLESS TOOLS', BATTERY: 'CORDLESS TOOLS',
  HYDRAULIC: 'HYDRAULIC TOOLS',
};
const words = (s) => String(s || '').toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w && !NOISE_WORDS.has(w));
const nounWords = (s) => words(s).filter((w) => !POWER_WORDS[w]);

// Codes in the order a picker should offer them for a tool. Tool types are
// typed free at intake ("1\" IMPACT WRENCH", "22-TON TRUCK JACK – AIR/HYDRAULIC",
// "5\" ANGEL GRINDER"), so: codes whose tool noun the type shares (JACK,
// WRENCH, GRINDER, HOIST…) first, then the sections its power words name
// (AIR → Air Tools), then the section of the matched noun, then General,
// then the rest.
export function orderForTool(codes, toolType) {
  const own = (toolType || '').trim().toUpperCase();
  const ownWords = new Set(words(own));
  const isOwnType = (c) => {
    const ct = (c.tool_type || '').toUpperCase();
    if (!own) return false;
    if (ct === own || own.includes(ct) || ct.includes(own)) return true;
    return nounWords(ct).some((w) => ownWords.has(w));
  };
  const list = codes || [];
  const category = (c) => (c.category || GENERAL_CATEGORY).toUpperCase();
  const powerCategories = new Set([...ownWords].map((w) => POWER_WORDS[w]).filter(Boolean));
  const nounCategories = new Set(list.filter(isOwnType).map(category));
  const rank = (c) => {
    if (isOwnType(c)) return 0;
    const cat = category(c);
    if (cat !== GENERAL_CATEGORY && powerCategories.has(cat)) return 1;
    if (cat !== GENERAL_CATEGORY && nounCategories.has(cat)) return 2;
    if (cat === GENERAL_CATEGORY) return 3;
    return 4;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || categoryIndex(category(a)) - categoryIndex(category(b)) || typeSort((a.tool_type || ''), (b.tool_type || '')) || codeSort(a, b));
}

// Free-text search over what the wall chart shows plus the quote note.
export function codeMatches(c, q) {
  const needle = (q || '').trim().toLowerCase();
  if (!needle) return true;
  const hay = [c.code, c.title, c.tool_type, c.category, ...(c.likely_causes || []), c.solution, c.quote_note]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(needle);
}
