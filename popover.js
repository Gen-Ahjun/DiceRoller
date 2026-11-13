import { OBR, CHANNEL, addToLog, loadLog, clearLog } from "./shared.js";
import { startRoll, rerollDie, canTrouble, notation, summary, damageText } from "./dice.js";

const $ = (id) => document.getElementById(id);
const settingsKey = "mm-dice-settings";
const SAVED = ["ability", "tn", "mult", "dr"];
let me = { id: "local", name: "Player" };
let cur = null; // the roll on screen: { id, label, private, roll }

// ---- settings (persist between sessions) ----
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(settingsKey) || "{}");
    for (const k of SAVED) if (s[k] !== undefined) $(k).value = s[k];
    if (s.dbl !== undefined) $("dbl").checked = s.dbl;
  } catch {}
}
function saveSettings() {
  try {
    const s = Object.fromEntries(SAVED.map((k) => [k, $(k).value]));
    s.dbl = $("dbl").checked;
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
  cur = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: $("label").value.trim(),
    private: $("private").checked,
    roll: startRoll({
      ability: num("ability") ?? 0,
      tn: num("tn"),
      attack,
      multiplier: Math.max(0, num("mult") ?? 0),
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
    playerName: me.name + (cur.private ? " (private)" : ""),
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
