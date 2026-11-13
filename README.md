# Marvel Multiverse Dice (d616) — Owlbear Rodeo extension

## Rules implemented
- Roll 3d6: two regular dice and the Marvel die (shown in the middle, in red). Total = dice + ability score, compared to the target number (TN).
- A 1 on the Marvel die shows as **M**, counts as 6 and makes the roll **Fantastic** (Fantastic success / Fantastic failure).
- **6 M 6** is an **Ultimate Fantastic** roll (18): automatic success, and it ignores trouble.
- **1 1 1** (Marvel die counted as 1) is a **botched roll** (total 3 + ability).
- **Edge**: reroll one die, keep the better number. The roller rerolls your lowest die.
- **Trouble**: reroll your best die, keep the worse number. Ties go to a regular die, so the Marvel die is only rerolled when it is strictly the best.
- Edges and troubles cancel each other out.

## Deploy
Any static host works (Firebase Hosting, Netlify, Vercel, GitHub Pages, Cloudflare Pages). Upload the files in this folder as the site root, so that
`https://YOUR-SITE/manifest.json` (a subfolder like `https://USER.github.io/repo/manifest.json` works too) loads.

Owlbear needs CORS enabled on `manifest.json`. Netlify/Vercel/GitHub Pages/Firebase send `Access-Control-Allow-Origin: *` for static files by default or with a one-line header rule. For Firebase add this to `firebase.json` under `hosting`:

    "headers": [{ "source": "/**", "headers": [{ "key": "Access-Control-Allow-Origin", "value": "*" }] }]

## Install in Owlbear Rodeo
Profile → Add Extension → paste `https://YOUR-SITE/manifest.json` (a subfolder like `https://USER.github.io/repo/manifest.json` works too). Then enable it in each room.
