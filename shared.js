import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

export { OBR };
export const CHANNEL = "com.marvel-multiverse.dice/roll";
const LOG_KEY = "mm-dice-log";
const MAX_LOG = 40;

export function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

// Adds a roll to the stored log (deduplicated by id) and returns the new log.
export function addToLog(roll) {
  const log = loadLog();
  if (log.some((r) => r.id === roll.id)) return log;
  log.unshift(roll);
  log.length = Math.min(log.length, MAX_LOG);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    /* storage can be unavailable; the live view still works */
  }
  return log;
}

export function clearLog() {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {}
}
