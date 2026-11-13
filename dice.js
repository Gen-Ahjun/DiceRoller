// d616 roll logic for the Marvel Multiverse RPG. Pure functions, no Owlbear dependency.

const rollD6 = (rng) => 1 + Math.floor(rng() * 6);

// A Marvel die showing 1 (the Marvel logo) counts as a 6 when adding up.
const effective = (die, value) => (die === "m" && value === 1 ? 6 : value);

/**
 * @param {object} opts
 * @param {number} opts.ability  ability score added to the dice
 * @param {number} opts.edges    number of edges
 * @param {number} opts.troubles number of troubles
 * @param {number|null} opts.tn  target number, or null for none
 */
export function rollD616({ ability = 0, edges = 0, troubles = 0, tn = null, rng = Math.random } = {}) {
  const dice = { a: rollD6(rng), m: rollD6(rng), b: rollD6(rng) };
  const initial = { ...dice };
  const rerolls = [];

  const isUltimate = () => dice.m === 1 && dice.a === 6 && dice.b === 6;

  // Edges and troubles cancel one another out.
  const net = edges - troubles;

  if (net > 0) {
    for (let i = 0; i < net; i++) {
      // Edge: reroll one die and keep the better of the two numbers.
      // We pick the lowest die; ties go to a regular die.
      const order = ["a", "b", "m"].sort((x, y) => effective(x, dice[x]) - effective(y, dice[y]));
      const die = order[0];
      const from = dice[die];
      const to = rollD6(rng);
      const kept = effective(die, to) > effective(die, from) ? to : from;
      dice[die] = kept;
      rerolls.push({ kind: "edge", die, from, to, kept });
    }
  } else if (net < 0) {
    for (let i = 0; i < -net; i++) {
      // An ultimate Fantastic roll ignores trouble.
      if (isUltimate()) break;
      // Trouble: reroll the best die and keep the worse of the two numbers.
      // Ties go to a regular die.
      const order = ["a", "b", "m"].sort((x, y) => effective(y, dice[y]) - effective(x, dice[x]));
      const die = order[0];
      const from = dice[die];
      const to = rollD6(rng);
      const kept = effective(die, to) < effective(die, from) ? to : from;
      dice[die] = kept;
      rerolls.push({ kind: "trouble", die, from, to, kept });
    }
  }

  const botched = dice.a === 1 && dice.m === 1 && dice.b === 1;
  const ultimate = isUltimate();
  const fantastic = dice.m === 1 && !botched;
  const marvelValue = botched ? 1 : effective("m", dice.m);
  const diceTotal = dice.a + dice.b + marvelValue;
  const total = diceTotal + ability;

  let success = null;
  if (tn !== null && tn !== undefined) success = ultimate || total >= tn;

  let outcome = "Result";
  if (botched) outcome = success === null ? "Botched roll" : success ? "Botched roll (success)" : "Botched roll";
  else if (success === null) outcome = ultimate ? "Ultimate Fantastic!" : fantastic ? "Fantastic roll" : "Result";
  else if (ultimate) outcome = "Ultimate Fantastic success!";
  else if (success && fantastic) outcome = "Fantastic success";
  else if (success) outcome = "Success";
  else if (fantastic) outcome = "Fantastic failure";
  else outcome = "Failure";

  return {
    dice: { a: dice.a, m: dice.m, b: dice.b },
    initial,
    rerolls,
    ability,
    edges,
    troubles,
    net,
    tn: tn ?? null,
    diceTotal,
    total,
    fantastic,
    ultimate,
    botched,
    success,
    outcome,
  };
}

// "6 M 5" style notation: the Marvel die is always the middle die.
export function notation(r) {
  const m = r.dice.m === 1 ? "M" : String(r.dice.m);
  return `${r.dice.a} ${m} ${r.dice.b}`;
}

export function summary(r) {
  const parts = [`${notation(r)}`];
  if (r.ability) parts.push(r.ability > 0 ? `+ ${r.ability}` : `- ${Math.abs(r.ability)}`);
  let s = `${parts.join(" ")} = ${r.total}`;
  if (r.tn !== null) s += ` vs TN ${r.tn}`;
  return `${s} — ${r.outcome}`;
}
