# This Is My Team — Build Plan

**Every team deserves to be seen.**

A platform where any school, club or league launches a pro-level home for their team in minutes.

## Assumptions

- Payments are a placeholder button for now; "Pay and publish" just publishes.
- Highlights, Last Game Leaders, Get Involved and Follow appear as designed placeholder sections on the public page, with the database already built for them.
- Season "2026" is the default in the wizard but editable.
- Team colors are extracted in the browser from the uploaded logo (two dominant colors), with manual override.
- Anyone signed in can create a team; they become its Owner.

## Backend (Lovable Cloud)

This needs accounts, a database and file storage, so Lovable Cloud gets switched on first. Google Sign-In plus email/password are both enabled.

### Data model (built in full now, even for later screens)

- **organizations** — name, type (school/club/league), owner
- **teams** — org, sport, name, mascot, level, slug (unique, auto from name, editable), logo, primary/secondary color, published flag
- **team_members** — user + team + role (owner / contributor)
- **seasons** — team, year label, current flag
- **players** — team season, jersey, first/last name, grade, level, position, photo, bio
- **coaches** — team season, name, title, photo
- **games** — team season, date, time, opponent, home/away, location, team score, opponent score, status
- **player_game_stats** — player, game, stat values (flexible per sport)
- **highlights** — team season, title, video, thumbnail, game link
- **announcements** — team season, title, body, pinned
- **get_involved_links** — team season, label, url, type
- **followers** — team season + user
- **sports** — name, period label, position list, player stat columns, headline team stats

Seeded sports: Football (Quarters; QB, RB, WR, TE, OL, DL, LB, DB, K; Passing Yards, Rushing Yards, Receiving Yards, Touchdowns, Tackles), Basketball (Quarters; PG, SG, SF, PF, C; Points, Rebounds, Assists, Steals, Blocks, Fouls), Soccer (Halves; GK, DEF, MID, FWD; Goals, Assists, Shots, Saves). A new sport later is one new row — no code changes.

Access rules: published team pages are readable by everyone; only a team's Owner and Contributors can edit its content; Contributors are blocked from billing when billing arrives.

## Screens

### 1. Sign in
Google button front and centre, email + password below as backup. Sign-up carries the chosen sport through to the wizard.

### 2. Landing page (root)
- Hero: "Every team deserves to be seen." + **Create My Team**
- Three sport cards (Football, Basketball, Soccer) — picking one jumps straight into sign-up with the sport locked in
- How it works: 1. Pick your sport. 2. Add your roster, schedule and logo. 3. Go live and share with your fans.
- Featured teams strip: published teams with logo, name and sport
- Reserved promo video block (placeholder)

### 3. Setup wizard
Five steps with a progress bar, saving as you go so nobody loses work.
1. Organization — name, type
2. Team basics — name, mascot, level, season, logo upload, colors auto-pulled from the logo with manual override
3. Roster — paste a list (jersey, first, last, grade, level — one per line) or add one at a time; positions come from the sport; coaches with name and title
4. Schedule — date, opponent, home/away, location, time, final score when played
5. Review — **Pay and publish** (publishes for now)

### 4. Public team page — `/<team-slug>`
- Fully themed in the team's colors with the logo
- Hero area reserved for a video: autoplays muted, loops, plays inline on phones, tap-for-sound button; until a video exists it shows the logo on team colors
- Record (W-L), current streak, next game as big broadcast-style numbers
- Schedule with results
- Roster tiles: photo, or jersey number on team color when there's no photo; name, number, position, grade; tap opens a player profile
- Coaches with photo and title
- Placeholder sections: Highlights, Last Game Leaders, Get Involved, Follow

### 5. Admin dashboard
After publishing, edit everything the wizard covered at any time: team info, roster, coaches, schedule and scores. Includes slug editing with a uniqueness check and a live link to the public page.

## Design direction

Phone first — it should feel like a real pro team app in the hand — then opened out into wide desktop grids so it also reads as a proper team website. Bold sports-broadcast energy: oversized numerals, tight condensed headline type, heavy contrast, team colors driving every page.

## Build order

1. Cloud + auth + full database and seeded sports
2. Design system and landing page
3. Sign in / sign up
4. Setup wizard
5. Public team page
6. Admin dashboard
