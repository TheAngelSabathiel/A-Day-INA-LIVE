# A Day INA: LIVE · Audience App

QR app, projector screen and cue control for **A Day INA: LIVE** (Act Avenue).
Next.js on Vercel, Supabase for data and realtime.

| Page | Who uses it | What it does |
|---|---|---|
| `/` | Audience (QR) | Program, voting, flowers and reactions (love, haha, wow, sad). Follows the cue: goes dark during blackouts, lights up for votes. |
| `/screen` | Projector laptop | Show backdrop: idle + QR, lower thirds, title cards, live vote bars, breaking news, scripted chat, glitch, SMS, reveal, curtain call. |
| `/control` | Stage manager (PIN) | Cue list with big GO / Back, active show selector, live tally, emergency blackout, push a chat line. |
| `/admin` | Admin (PIN) | Logo/sublogo, colors, program text, cast + photos, every cue, shows, votes and resets. |

Every page works on phone and desktop. The app is locked against browser auto-translate, so titles and epithets always show as written.

---

## 1. Supabase

1. Create a project at supabase.com (region: Singapore).
2. **SQL Editor > New query**, paste all of `supabase/schema.sql`, **Run**.
   This creates the tables, security rules, the `brand` storage bucket, realtime, and seeds the cast, the 5 shows and all 26 cues from the script.
   Already ran an older `schema.sql`? Run `supabase/patch-01-reactions-epithets.sql` once instead (adds audience reactions, script epithets, removes the text message cue).
3. **Project Settings > API Keys**, copy:
   - Project URL
   - **Publishable key** (`sb_publishable_...`)
   - **Secret key** (`sb_secret_...`). Create one named `vercel` so you can rotate it on its own.

   Use the new keys, not the legacy `anon` / `service_role` (being retired). Once the deploy works, you can deactivate the legacy keys under **Settings > API Keys**.

## 2. Vercel

1. Push this folder to a GitHub repo, then **Add New Project** in Vercel and import it.
2. Add Environment Variables (see `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ADMIN_PIN=
ADMIN_SECRET=
```

3. Deploy. Open `/admin`, enter the PIN.
4. In **Admin > Branding**, upload the sublogo (used by default) and main logo, set **Public URL** to the final domain so the QR points there.

Local dev: `npm install`, copy `.env.example` to `.env.local`, `npm run dev`.

## 3. Cues

Each cue sets what the projector and phones show. Edit them anytime in **Admin > Cues**; changes go live immediately, even mid-show.

- **Screen modes:** idle, live, title, vote, drumroll, result, news, chat, glitch, message, sms, black, curtain
- **Phone modes:** program, standby, vote, flowers, dark, glitch, message, thanks
- **Voting:** same `round_key` = same poll. Votes are accepted only while the current cue has *Voting OPEN*, only for listed options, one per phone per round, and are blocked during emergency blackout.
- **Round 1 "WALA!"** is just the result card's title. Real votes are still recorded (see Admin > Shows & Votes).
- **Final "ELIMINATED:"** has no name on purpose. A title ending in `:` with no body shows a blinking blank.
- **Reactions:** tick *Audience reactions* on a cue to give phones the reaction bar; reactions rise up the right side of the projector. On by default for the intros, show logo and "WALA!".
- **Chat lines:** one per line, `name|message` for a fixed username, loop for floods.
- **Viewer counter:** in-world number. Set a target (e.g. `525600` on the reveal) or leave blank to drift upward.

## 4. Show-day checklist

- [ ] Open Supabase dashboard the day before (free projects pause after a week idle).
- [ ] Projector laptop: Chrome, open `/screen`, click **Fullscreen**, plug in power, disable sleep.
- [ ] SM: `/control` on a laptop or phone. Keyboard: Space / → = GO, ← = Back.
- [ ] Tech run on **Rehearsal / Test**, then **Admin > Shows & Votes > Reset votes**.
- [ ] Before house open: set the correct show (e.g. *Nov 28 · 3PM*) as active, GO to cue 1 *House open*.
- [ ] Post the venue Wi-Fi next to the QR.
- [ ] Sound (theme, gunshot, drumroll, buzzer) stays with the sound op.

## 5. Capacity

About 150 phones + screen + control. Phones fall back to polling if realtime drops, so a weak signal only delays updates by a few seconds. Supabase Free allows 200 concurrent realtime connections; for a full house with walk-ins, upgrade the project to Pro for the show weekend.

With publishable keys, public realtime connections close after 24 hours. Phones only stay ~2 hours, and the screen and control reconnect on their own (with polling as backup), but refresh the projector page before each show anyway.

---

App by TheAngelSabathiel for Act Avenue.
