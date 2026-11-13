import { OBR, CHANNEL, addToLog, loadLog, clearLog } from "./shared.js";
import { startRoll, rerollDie, canTrouble, notation, summary, damageText } from "./dice.js";
import { ABILITIES, defaultSheet, parseCharacter, exportCharacter } from "./character.js";

const $ = (id) => document.getElementById(id);
const settingsKey = "mm-dice-settings";
const SAVED = ["tn", "dr"];
let me = { id: "local", name: "Player" };
let cur = null; // the roll on screen: { id, label, private, roll }

// ---- settings (persist between sessions) ----
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(settingsKey) || "{}");
    if (ABILITIES.some((a) => a.key === s.sel)) selected = s.sel;
    for (const k of SAVED) if (s[k] !== undefined) $(k).value = s[k];
    if (s.dbl !== undefined) $("dbl").checked = s.dbl;
  } catch {}
}
function saveSettings() {
  try {
    const s = Object.fromEntries(SAVED.map((k) => [k, $(k).value]));
    s.dbl = $("dbl").checked;
    s.sel = selected;
    localStorage.setItem(settingsKey, JSON.stringify(s));
  } catch {}
}

// ---- number steppers and presets ----
document.addEventListener("click", (e) => {
  const step = e.target.closest("[data-step]");
  if (step) {
    const input = $(step.dataset.step);
    const min = input.min !== "" ? Number(input.min) : -Infinity;
    const next = (input.value === "" ? 0 : Number(input.value)) + Number(step.dataset.delta);
    input.value = Math.max(min, next);
    saveSettings();
  }
  const preset = e.target.closest("[data-tn]");
  if (preset) {
    $("tn").value = preset.dataset.tn;
    saveSettings();
  }
});
for (const k of SAVED) $(k).addEventListener("change", saveSettings);
$("dbl").addEventListener("change", saveSettings);


// ---- character sheet ----
const SHEET_KEY = "mm-dice-sheet";
const LIBRARY_KEY = "mm-dice-chars";
let sheet = defaultSheet();
let selected = "melee"; // ability key currently chosen for rolling

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const clean = (v, fallback = 0) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);

function buildSheetRows() {
  const rows = $("abilityRows");
  rows.textContent = "";
  for (const a of ABILITIES) {
    const row = document.createElement("div");
    row.className = "grid-row";
    row.dataset.key = a.key;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "rollAbility";
    radio.value = a.key;
    radio.id = `r-${a.key}`;
    radio.setAttribute("aria-label", `Roll ${a.name}`);

    const name = document.createElement("label");
    name.htmlFor = `r-${a.key}`;
    name.className = "ab-name";
    const letter = document.createElement("strong");
    letter.textContent = a.short;
    const full = document.createElement("span");
    full.textContent = a.name;
    name.append(letter, full);

    const score = document.createElement("input");
    score.type = "number";
    score.id = `s-${a.key}`;
    score.inputMode = "numeric";
    score.setAttribute("aria-label", `${a.name} score`);

    const mult = document.createElement("input");
    mult.type = "number";
    mult.id = `m-${a.key}`;
    mult.min = "0";
    mult.inputMode = "numeric";
    mult.setAttribute("aria-label", `${a.name} damage multiplier`);

    row.append(radio, name, score, mult);
    rows.append(row);
  }
}

function markSelected() {
  for (const row of $("abilityRows").children) {
    const on = row.dataset.key === selected;
    row.classList.toggle("on", on);
    row.querySelector('input[type="radio"]').checked = on;
  }
}

function fillSheetInputs() {
  $("charName").value = sheet.name;
  $("charRank").value = sheet.rank;
  for (const a of ABILITIES) {
    $(`s-${a.key}`).value = sheet.abilities[a.key].score;
    $(`m-${a.key}`).value = sheet.abilities[a.key].mult;
  }
  markSelected();
}

function readSheetInputs() {
  sheet.name = $("charName").value.trim();
  sheet.rank = Math.max(1, clean($("charRank").value, 1));
  for (const a of ABILITIES) {
    sheet.abilities[a.key] = {
      score: clean($(`s-${a.key}`).value),
      mult: Math.max(0, clean($(`m-${a.key}`).value, sheet.rank)),
    };
  }
}

function persistSheet() {
  writeJSON(SHEET_KEY, sheet);
}

function selectAbility(key) {
  selected = key;
  markSelected();
  try {
    const s = JSON.parse(localStorage.getItem(settingsKey) || "{}");
    s.sel = key;
    localStorage.setItem(settingsKey, JSON.stringify(s));
  } catch {}
}

// Choosing which ability to roll
$("abilityRows").addEventListener("change", (e) => {
  if (e.target.type === "radio") selectAbility(e.target.value);
});
// Focusing or editing a row's numbers also selects it, so you never roll the wrong stat by accident
$("abilityRows").addEventListener("focusin", (e) => {
  const row = e.target.closest(".grid-row");
  if (row && e.target.type === "number" && row.dataset.key !== selected) selectAbility(row.dataset.key);
});

// Anything typed in the ability section or character box updates and saves the sheet
document.addEventListener("input", (e) => {
  if (!e.target.closest(".abilities, #sheet")) return;
  if (e.target.type === "radio") return;
  readSheetInputs();
  persistSheet();
});

$("rankToMult").addEventListener("click", () => {
  readSheetInputs();
  for (const a of ABILITIES) sheet.abilities[a.key].mult = sheet.rank;
  fillSheetInputs();
  persistSheet();
});

// saved characters
function renderSaved() {
  const lib = readJSON(LIBRARY_KEY, {});
  const sel = $("saved");
  sel.textContent = "";
  const names = Object.keys(lib).sort();
  if (!names.length) {
    const o = document.createElement("option");
    o.textContent = "No saved characters";
    o.value = "";
    sel.append(o);
    return;
  }
  for (const n of names) {
    const o = document.createElement("option");
    o.value = n;
    o.textContent = n;
    sel.append(o);
  }
  if (names.includes(sheet.name)) sel.value = sheet.name;
}
const msg = (text, bad = false) => {
  $("ioMsg").textContent = text;
  $("ioMsg").className = "msg" + (bad ? " bad" : "");
};

function useSheet(next) {
  sheet = next;
  fillSheetInputs();
  persistSheet();
  renderSaved();
}

$("saveChar").addEventListener("click", () => {
  readSheetInputs();
  if (!sheet.name) return msg("Give the character a name first.", true);
  const lib = readJSON(LIBRARY_KEY, {});
  lib[sheet.name] = sheet;
  writeJSON(LIBRARY_KEY, lib);
  persistSheet();
  renderSaved();
  msg(`Saved ${sheet.name}.`);
});
$("loadChar").addEventListener("click", () => {
  const lib = readJSON(LIBRARY_KEY, {});
  const name = $("saved").value;
  if (!name || !lib[name]) return msg("Nothing to load.", true);
  useSheet(parseCharacter(lib[name]));
  msg(`Loaded ${name}.`);
});
$("delChar").addEventListener("click", () => {
  const lib = readJSON(LIBRARY_KEY, {});
  const name = $("saved").value;
  if (!name || !lib[name]) return;
  delete lib[name];
  writeJSON(LIBRARY_KEY, lib);
  renderSaved();
  msg(`Deleted ${name}.`);
});

// JSON import / export
$("exportChar").addEventListener("click", () => {
  readSheetInputs();
  $("json").value = exportCharacter(sheet);
  $("json").select();
  msg("Copy this to back it up or share it.");
});
function importText(text) {
  try {
    useSheet(parseCharacter(text));
    msg(`Imported${sheet.name ? " " + sheet.name : ""}.`);
  } catch (err) {
    msg(err instanceof SyntaxError ? "That isn't valid JSON." : err.message, true);
  }
}
$("importChar").addEventListener("click", () => importText($("json").value));
$("file").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  $("json").value = await f.text();
  importText($("json").value);
  e.target.value = "";
});

// ---- rendering ----
const faceText = (die, value) => (die === "m" && value === 1 ? "M" : String(value));
const rerollName = (die) => (die === "m" ? "Marvel die" : "die");

function renderRoll(animate) {
  const r = cur.roll;
  const dice = $("dice");

  for (const el of dice.querySelectorAll(".die")) {
    const key = el.dataset.die;
    el.textContent = faceText(key, r.dice[key]);
    el.classList.toggle("fantastic", key === "m" && r.fantastic);
    el.classList.toggle("botched", r.botched);
  }
  // Edge and trouble buttons are live once there is a roll.
  for (const btn of dice.querySelectorAll(".rr button")) {
    const trouble = btn.dataset.kind === "trouble";
    btn.disabled = trouble && !canTrouble(r);
    btn.title = trouble && !canTrouble(r) ? "Ultimate Fantastic ignores trouble" : "";
  }
  if (animate) {
    dice.classList.remove("tumble");
    void dice.offsetWidth; // restart the animation
    dice.classList.add("tumble");
  }

  $("total").textContent = r.total;
  const out = $("outcome");
  out.textContent = r.outcome;
  out.className = "outcome " + (r.ultimate ? "ultimate" : r.fantastic ? "fantastic" : r.botched ? "botched" : r.success === true ? "good" : r.success === false ? "bad" : "");

  const dmg = $("damage");
  if (r.damage) {
    dmg.hidden = false;
    dmg.textContent = damageText(r);
    dmg.className = "damage-out" + (r.damage.amount > 0 ? " hit" : "");
  } else {
    dmg.hidden = true;
  }

  const bits = [`${notation(r)}${r.ability ? (r.ability > 0 ? ` + ${r.ability}` : ` − ${Math.abs(r.ability)}`) : ""}`];
  if (r.tn !== null) bits.push(`TN ${r.tn}`);
  let detail = bits.join("  ·  ");
  if (r.ultimate && r.rerolls.length) detail += "\nUltimate Fantastic: trouble is ignored";
  if (r.rerolls.length) {
    detail += "\n" + r.rerolls
      .map((x) => `${x.kind === "edge" ? "Edge" : "Trouble"}: ${rerollName(x.die)} ${faceText(x.die, x.from)} → ${faceText(x.die, x.to)}, kept ${faceText(x.die, x.kept)}`)
      .join("\n");
  }
  $("detail").textContent = detail;
}

function renderLog(log) {
  const ol = $("log");
  ol.textContent = "";
  if (!log.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No rolls yet.";
    ol.append(li);
    return;
  }
  for (const entry of log) {
    const li = document.createElement("li");
    const who = document.createElement("strong");
    who.textContent = entry.playerName + (entry.label ? ` · ${entry.label}` : "");
    const what = document.createElement("span");
    what.textContent = summary(entry.result);
    li.append(who, what);
    const r = entry.result;
    if (r.ultimate || (r.fantastic && r.success !== false)) li.classList.add("fantastic");
    else if (r.botched) li.classList.add("botched");
    ol.append(li);
  }
}

// ---- rolling ----
const num = (id) => ($(id).value === "" ? null : Number($(id).value));

function begin(attack) {
  readSheetInputs();
  cur = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: [ABILITIES.find((a) => a.key === selected).name, $("label").value.trim()].filter(Boolean).join(" · "),
    private: $("private").checked,
    roll: startRoll({
      ability: sheet.abilities[selected].score,
      tn: num("tn"),
      attack,
      multiplier: sheet.abilities[selected].mult,
      reduction: Math.max(0, num("dr") ?? 0),
      doubleFantastic: $("dbl").checked,
    }),
  };
  renderRoll(true);
  share();
}

// Records the roll on screen and sends it to the table. Called after the first roll and
// again after each edge or trouble, so everyone sees the current result.
async function share() {
  const entry = {
    id: cur.id,
    playerId: me.id,
    playerName: (sheet.name || me.name) + (cur.private ? " (private)" : ""),
    label: cur.label,
    result: cur.roll,
  };
  if (cur.private) {
    // Shown only here, never shared.
    renderLog([entry, ...loadLog().filter((r) => r.id !== entry.id)]);
    return;
  }
  renderLog(addToLog(entry));
  try {
    await OBR.broadcast.sendMessage(CHANNEL, entry, { destination: "REMOTE" });
  } catch (err) {
    console.error("Could not send roll to the table", err);
  }
}

$("roll").addEventListener("click", () => begin(false));
$("attack").addEventListener("click", () => begin(true));

$("dice").addEventListener("click", (e) => {
  const btn = e.target.closest(".rr button");
  if (!btn || !cur || btn.disabled) return;
  cur.roll = rerollDie(cur.roll, btn.dataset.die, btn.dataset.kind);
  renderRoll(false);
  share();
});

$("clear").addEventListener("click", () => {
  clearLog();
  renderLog([]);
});

// ---- startup ----
loadSettings();
buildSheetRows();
{
  const stored = readJSON(SHEET_KEY, null);
  if (stored) {
    try {
      sheet = parseCharacter(stored);
    } catch {}
  }
}
fillSheetInputs();
renderSaved();
renderLog(loadLog());

OBR.onReady(async () => {
  try {
    me = { id: await OBR.player.getId(), name: (await OBR.player.getName()) || "Player" };
    OBR.player.onChange(async () => {
      me.name = (await OBR.player.getName()) || "Player";
    });
  } catch {}
  // Keep the log live while the popover is open.
  OBR.broadcast.onMessage(CHANNEL, (event) => {
    if (event.data && event.data.id) renderLog(addToLog(event.data));
  });
});
window.addEventListener("storage", () => renderLog(loadLog()));
