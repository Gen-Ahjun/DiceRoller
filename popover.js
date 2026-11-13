import { OBR, CHANNEL, addToLog, loadLog, clearLog } from "./shared.js";
import { rollD616, notation, summary } from "./dice.js";

const $ = (id) => document.getElementById(id);
const settingsKey = "mm-dice-settings";
let me = { id: "local", name: "Player" };

// ---- settings (ability score etc. persist between sessions) ----
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(settingsKey) || "{}");
    if (s.ability !== undefined) $("ability").value = s.ability;
    if (s.tn !== undefined) $("tn").value = s.tn;
  } catch {}
}
function saveSettings() {
  try {
    localStorage.setItem(settingsKey, JSON.stringify({ ability: $("ability").value, tn: $("tn").value }));
  } catch {}
}

// ---- number steppers ----
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
$("ability").addEventListener("change", saveSettings);
$("tn").addEventListener("change", saveSettings);

// ---- rendering ----
function faceText(die, value) {
  return die === "m" && value === 1 ? "M" : String(value);
}

function renderResult(roll, animate) {
  const r = roll.result;
  const dice = $("dice");
  for (const el of dice.children) {
    const key = el.dataset.die;
    el.textContent = faceText(key, r.dice[key]);
    el.classList.toggle("fantastic", key === "m" && r.fantastic);
    el.classList.toggle("botched", r.botched);
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

  const bits = [`${notation(r)}${r.ability ? (r.ability > 0 ? ` + ${r.ability}` : ` − ${Math.abs(r.ability)}`) : ""}`];
  if (r.tn !== null) bits.push(`TN ${r.tn}`);
  if (r.net > 0) bits.push(`${r.net} edge${r.net > 1 ? "s" : ""}`);
  if (r.net < 0) bits.push(`${-r.net} trouble${r.net < -1 ? "s" : ""}`);
  let detail = bits.join("  ·  ");
  if (r.rerolls.length) {
    const rr = r.rerolls
      .map((x) => `${x.kind === "edge" ? "Edge" : "Trouble"}: ${x.die === "m" ? "Marvel die" : "die"} ${faceText(x.die, x.from)} → ${faceText(x.die, x.to)}, kept ${faceText(x.die, x.kept)}`)
      .join("\n");
    detail += "\n" + rr;
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
  for (const roll of log) {
    const li = document.createElement("li");
    const who = document.createElement("strong");
    who.textContent = roll.playerName + (roll.label ? ` · ${roll.label}` : "");
    const what = document.createElement("span");
    what.textContent = summary(roll.result);
    li.append(who, what);
    const r = roll.result;
    if (r.ultimate || (r.fantastic && r.success !== false)) li.classList.add("fantastic");
    else if (r.botched) li.classList.add("botched");
    ol.append(li);
  }
}

// ---- rolling ----
async function doRoll() {
  const num = (id) => (($(id).value ?? "") === "" ? null : Number($(id).value));
  const result = rollD616({
    ability: num("ability") ?? 0,
    tn: num("tn"),
    edges: Math.max(0, num("edges") ?? 0),
    troubles: Math.max(0, num("troubles") ?? 0),
  });
  const roll = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playerId: me.id,
    playerName: me.name,
    label: $("label").value.trim(),
    result,
  };
  renderResult(roll, true);

  const isPrivate = $("private").checked;
  if (isPrivate) {
    // Kept out of the shared log: shown only in this popover.
    roll.playerName += " (private)";
    renderLog([roll, ...loadLog()]);
    return;
  }
  const log = addToLog(roll);
  renderLog(log);
  try {
    // The background page on every client (including ours) picks this up.
    await OBR.broadcast.sendMessage(CHANNEL, roll, { destination: "REMOTE" });
  } catch (err) {
    console.error("Could not send roll to the table", err);
  }
}

$("roll").addEventListener("click", doRoll);
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
