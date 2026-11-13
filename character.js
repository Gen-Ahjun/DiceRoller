// Character sheet helpers: the six abilities, a default sheet, and a forgiving JSON importer.

export const ABILITIES = [
  { key: "melee", name: "Melee", short: "M" },
  { key: "agility", name: "Agility", short: "A" },
  { key: "resilience", name: "Resilience", short: "R" },
  { key: "vigilance", name: "Vigilance", short: "V" },
  { key: "ego", name: "Ego", short: "E" },
  { key: "logic", name: "Logic", short: "L" },
];

export function defaultSheet() {
  const abilities = {};
  for (const a of ABILITIES) abilities[a.key] = { score: 0, mult: 1 };
  return { name: "", rank: 1, abilities };
}

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Finds the value for an ability in an object, matching by full name, short letter or prefix,
// case-insensitively ("melee", "Melee", "M", "mel").
function pick(obj, a) {
  for (const k of Object.keys(obj)) {
    const lk = k.toLowerCase().trim();
    if (lk === a.key || lk === a.short.toLowerCase() || (lk.length >= 3 && a.key.startsWith(lk))) return obj[k];
  }
  return undefined;
}

/**
 * Accepts several shapes:
 *   { name, rank, abilities: { melee: { score, multiplier }, ... } }
 *   { name, abilities: { melee: 3, agility: 4, ... } }            (scores only)
 *   { abilities: [ { name: "Melee", score: 3, multiplier: 2 }, ... ] }
 * A missing multiplier falls back to the rank (or 1).
 * Returns a sheet, or throws an Error with a readable message.
 */
export function parseCharacter(input) {
  let data = typeof input === "string" ? JSON.parse(input) : input;
  if (data && typeof data === "object" && data.character && typeof data.character === "object") data = data.character;
  if (!data || typeof data !== "object") throw new Error("That doesn't look like a character.");

  let source = data.abilities ?? data.stats ?? data.scores ?? data;
  if (Array.isArray(source)) {
    const obj = {};
    for (const item of source) if (item && item.name) obj[String(item.name)] = item;
    source = obj;
  }
  if (!source || typeof source !== "object") throw new Error("No abilities found.");

  const rank = toNum(data.rank ?? data.level) ?? 1;
  const sheet = defaultSheet();
  sheet.name = typeof data.name === "string" ? data.name : "";
  sheet.rank = rank;

  let found = 0;
  for (const a of ABILITIES) {
    sheet.abilities[a.key] = { score: 0, mult: rank };
    const v = pick(source, a);
    if (v === undefined) continue;
    found++;
    if (v !== null && typeof v === "object") {
      const score = toNum(v.score ?? v.value ?? v.rank ?? v.rating);
      const mult = toNum(v.multiplier ?? v.damageMultiplier ?? v.damage_multiplier ?? v.mult ?? v.damage);
      sheet.abilities[a.key] = { score: score ?? 0, mult: mult ?? rank };
    } else {
      sheet.abilities[a.key] = { score: toNum(v) ?? 0, mult: rank };
    }
  }
  if (!found) throw new Error("Couldn't find any of the six abilities in that file.");
  return sheet;
}

export function exportCharacter(sheet) {
  const abilities = {};
  for (const a of ABILITIES) {
    const v = sheet.abilities[a.key];
    abilities[a.key] = { score: v.score, multiplier: v.mult };
  }
  return JSON.stringify({ name: sheet.name, rank: sheet.rank, abilities }, null, 2);
}
