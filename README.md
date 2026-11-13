# Marvel Multiverse Dice (d616) — Owlbear Rodeo extension

## Rules implemented
- Roll 3d6: two regular dice and the Marvel die (shown in the middle, in red). Total = dice + ability score, compared to the target number (TN).
- A 1 on the Marvel die shows as **M**, counts as 6 and makes the roll **Fantastic** (Fantastic success / Fantastic failure).
- **6 M 6** is an **Ultimate Fantastic** roll (18): automatic success, and it ignores trouble.
- **1 1 1** (Marvel die counted as 1) is a **botched roll** (total 3 + ability).
- **Edge**: after the roll, click any die to reroll it and keep the better number. Repeat for stacked edges, or click "Keep this roll" to skip.
- **Trouble**: click the die to reroll (the rules say your best die, or the one the Narrator picks) and keep the worse number. Trouble is ignored on an Ultimate Fantastic roll.
- Edges and troubles cancel each other out. A roll is shared with the table once all edges/troubles are resolved.
- **Damage** ("Attack + damage"): (Marvel die x damage multiplier) + ability score. Damage reduction lowers the multiplier, and a Fantastic success doubles the total (toggleable). A miss does no damage. Damage updates after any rerolls.

## Deploy
Any static host works (Firebase Hosting, Netlify, Vercel, GitHub Pages, Cloudflare Pages). Upload the files in this folder as the site root, so that
`https://YOUR-SITE/manifest.json` (a subfolder like `https://USER.github.io/repo/manifest.json` works too) loads.

Owlbear needs CORS enabled on `manifest.json`. Netlify/Vercel/GitHub Pages/Firebase send `Access-Control-Allow-Origin: *` for static files by default or with a one-line header rule. For Firebase add this to `firebase.json` under `hosting`:

    "headers": [{ "source": "/**", "headers": [{ "key": "Access-Control-Allow-Origin", "value": "*" }] }]

## Install in Owlbear Rodeo
Profile → Add Extension → paste `https://YOUR-SITE/manifest.json` (a subfolder like `https://USER.github.io/repo/manifest.json` works too). Then enable it in each room.
