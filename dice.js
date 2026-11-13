// d616 logic for the Marvel Multiverse RPG. Pure functions, no Owlbear dependency.
//
// A roll is a plain object. startRoll() makes one; rerollDie() spends an edge or trouble
// on a die of the player's choice, any time after the roll.

const rollD6 = (rng) => 1 + Math.floor(rng() * 6);

// A Marvel die showing 1 (the Marvel logo) counts as a 6 when adding up.
const effective = (die, value) => (die === "m" && value === 1 ? 6 : value);

function evaluate(s) {
  const { dice } = s;
  const botched = dice.a === 1 && dice.m === 1 && dice.b === 1;
  const ultimate = dice.m === 1 && dice.a === 6 && dice.b === 6;
  const fantastic = dice.m === 1 && !botched;
  const marvelValue = botched ? 1 : effective("m", dice.m);
  const diceTotal = dice.a + dice.b + marvelValue;
  const total = diceTotal + s.ability;

  let success = null;
  if (s.tn !== null) success = ultimate || total >= s.tn;

  let outcome;
  if (botched) outcome = "Botched roll";
  else if (success === null) outcome = ultimate ? "Ultimate Fantastic!" : fantastic ? "Fantastic roll" : "Result";
  else if (ultimate) outcome = "Ultimate Fantastic success!";
  else if (success && fantastic) outcome = "Fantastic success";
  else if (success) outcome = "Success";
  else if (fantastic) outcome = "Fantastic failure";
  else outcome = "Failure";

  // Damage = (Marvel die x damage multiplier) + ability score.
  // Damage reduction lowers the multiplier; a Fantastic success doubles the total.
  let damage = null;
  if (s.attack) {
    const mult = s.multiplier - s.reduction;
    const base = marvelValue * mult + s.ability;
    const doubled = s.doubleFantastic && fantastic && success !== false;
    const amount = mult <= 0 || success === false ? 0 : doubled ? base * 2 : base;
    damage = { marvel: marvelValue, mult, ability: s.ability, base, doubled, amount, hit: success };
  }

  return { botched, ultimate, fantastic, marvelValue, diceTotal, total, success, outcome, damage };
}

function settle(s) {
  return { ...s, ...evaluate(s) };
}

export function startRoll({
  ability = 0, tn = null,
  attack = false, multiplier = 0, reduction = 0, doubleFantastic = true,
  rng = Math.random,
} = {}) {
  const dice = { a: rollD6(rng), m: rollD6(rng), b: rollD6(rng) };
  return settle({
    dice,
    initial: { ...dice },
    rerolls: [],
    ability, tn,
    attack, multiplier, reduction, doubleFantastic,
  });
}

// Whether trouble can still be applied (an Ultimate Fantastic roll ignores it).
export function canTrouble(roll) {
  return !roll.ultimate;
}

// Reroll one die ("a", "m" or "b") using an edge or trouble.
// Edge keeps the better of the two numbers, trouble keeps the worse.
export function rerollDie(roll, die, kind, rng = Math.random) {
  if (kind === "trouble" && !canTrouble(roll)) return roll;
  const from = roll.dice[die];
  const to = rollD6(rng);
  const better = effective(die, to) > effective(die, from);
  const worse = effective(die, to) < effective(die, from);
  const kept = kind === "edge" ? (better ? to : from) : worse ? to : from;
  return settle({
    ...roll,
    dice: { ...roll.dice, [die]: kept },
    rerolls: [...roll.rerolls, { kind, die, from, to, kept }],
  });
}

// "6 M 5" style notation: the Marvel die is always the middle die.
export function notation(r) {
  const m = r.dice.m === 1 ? "M" : String(r.dice.m);
  return `${r.dice.a} ${m} ${r.dice.b}`;
}

export function damageText(r) {
  const d = r.damage;
  if (!d) return "";
  const calc = `${d.marvel}×${d.mult}${d.ability ? (d.ability > 0 ? `+${d.ability}` : `${d.ability}`) : ""}${d.doubled ? " ×2" : ""}`;
  if (d.mult <= 0) return "No damage (damage reduction)";
  if (d.hit === false) return "Miss — no damage";
  return `${d.amount} damage (${calc})${d.hit === null ? " if it hits" : ""}`;
}

export function summary(r) {
  let s = `${notation(r)}`;
  if (r.ability) s += r.ability > 0 ? ` + ${r.ability}` : ` - ${Math.abs(r.ability)}`;
  s += ` = ${r.total}`;
  if (r.tn !== null) s += ` vs TN ${r.tn}`;
  s += ` — ${r.outcome}`;
  const d = damageText(r);
  if (d) s += ` — ${d}`;
  return s;
}
