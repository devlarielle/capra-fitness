# Capra Fitness: demo site

Static site (HTML, CSS, JS). No build step, no dependencies.

## Deploy to Vercel

**Option A: GitHub (recommended)**
1. Create a new GitHub repo and push this folder to it.
2. On vercel.com choose **Add New > Project**, import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty. Deploy.

**Option B: Vercel CLI**
```
npm i -g vercel
cd capra-fitness
vercel --prod
```

## What's in the demo
- Check-in with name autocomplete (one check-in per member per day)
- 20-day progress meter and live progress board
- Staff view: today's check-ins, 7-day attendance, add member, mark shirt claimed, undo a wrong check-in
- Plans and schedule (sample content, replace with the gym's real info)

## Notes
- Demo data lives in the visitor's browser (localStorage), so each device sees its own copy. Use "Reset demo data" in the Staff section before presenting.
- To replace the logo, overwrite `assets/logo.png` (transparent, black), `assets/logo-cream.png` (same shape in cream) and `assets/favicon.png`.
- Placeholder text in square brackets in the footer needs the gym's real address, hours and contacts.

## Real version
Vercel doesn't run PHP, so the production build would use a host with PHP + MySQL
(members table, check-ins table with a UNIQUE(member_id, date) key, rewards flag).
The logic in `app.js` maps directly onto that schema.
