# Capra Fitness: demo site

Static site (HTML, CSS, JS). No build step, no dependencies to install.
One project, one Vercel deployment, three parts:

| Page | URL | Who | What |
|------|-----|-----|------|
| `index.html` | `/` | Anyone | CF Project, pickleball + reservations, plans, schedule, join form, visit info |
| `member.html` | `/member` | Members (ID + PIN) | Digital Project 20 card, QR check-in, 4-week calendar |
| `desk.html` | `/desk` | Staff (passcode) | Today's QR, check-ins, members, bonus points, shirt claims, join requests, pickleball reservations |

## Demo logins
- Member: `CAP-0002` (Andrew), PIN `1234`. He is at 19 points, so checking in completes Project 20.
- Staff passcode: `capra2026`

## CF Project (Project 20)
Modelled on the gym's paper card: **1 gym session = 1 point, 20 points = a free T-shirt from CF Gear**, and staff can give bonus points (e.g. for winning games).
- Points = one per day checked in + bonus points (desk > member row > More > "+1 bonus point").
- The member page shows the same 20-box card layout (7 + 7 + 6) as the paper one.

## How check-in works
1. Staff open `/desk`. It shows today's QR code (full screen or print).
2. Member scans it with the phone camera, which opens `/member?code=...`.
3. Member logs in (once; the phone stays signed in) and taps **Check in now**.
4. The code must match today's date, and only one check-in per day is allowed.

On a laptop with no phone scan, use **simulate scanning today's QR** on the member page.

## Pickleball
From the gym's poster: Open Play for Beginners, Monday 6 to 10 PM, 100 pesos per head, Coach Stan, 12 slots, paddle rental +30 pesos.
- Open play reservations are confirmed instantly while slots remain (max 12 per session).
- Court rental requests are "pending" until staff confirm or decline them on the desk page.
- The court hourly rate is a placeholder (`[court rate]` in `index.html`).

## Deploy to Vercel
Push this folder to GitHub, import it in Vercel, framework preset **Other**, no build command. Redeploys happen on every `git push`.

## Before presenting
- Open `/desk` > **Reset demo data** so Andrew is back at 19 points and open play shows 6 of 12 slots taken.
- Replace the sample prices, schedule and the `[bracketed]` details with the gym's real info.

## Questions to confirm with the gym
- Season dates and who is eligible for Project 20 (the card photo appears to say it is not valid for monthly subscribers, but the print is hard to read).
- Does the card reset after a shirt is claimed, or can a member earn another?
- What are bonus points awarded for, and how many?
- Court rental rates and hours.
- Is the shirt photo and the "almost 500 shirts" figure okay to use on the site? Replace `assets/cf-shirts.jpg` with the gym's original if they have one.

## Demo limitations (what the real build fixes)
- Data lives in each visitor's browser (localStorage), so phones and the desk laptop do not share data.
- The daily code is calculated from the date in the page's JavaScript. The real version generates and rotates it on the server.
- PINs and the staff passcode are stored in plain text for the demo. The real version uses hashed passwords, staff accounts, and server-side rate limiting.
- Vercel does not run PHP, so the real build (PHP + MySQL) goes on a host that does.

## Real version data model
- `members(id, name, pin_hash, status, joined_at)`
- `seasons(id, name, starts_on, ends_on, goal_points)`
- `checkins(member_id, season_id, date, time)` with `UNIQUE(member_id, date)`
- `bonus_points(member_id, season_id, points, reason, awarded_by)`
- `rewards(member_id, season_id, claimed_at)`
- `join_requests(name, phone, created_at)`
- `reservations(type, name, phone, date, start_time, hours, status)`
- `daily_codes(date, code)`

## Files
- `shared.js`: data layer and rules (used by all pages)
- `home.js`, `member.js`, `desk.js`: one script per page
- `vendor/qrcode.js`: QR generator (MIT licensed, Kazuhiko Arase)
- `assets/`: logos, plus the gym's shirt photo. To swap the logo, replace `logo.png` (black), `logo-cream.png` (cream) and `favicon.png`.
