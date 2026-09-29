# This Is My Team

Build "This Is My Team" (thisismyteam.app): a platform where any school, club or league launches a pro-level home for their team in minutes. Fans follow their teams, watch highlights, get to know the players and coaches, and get involved.

Mission line for the landing page: "Every team deserves to be seen."

FULL PRODUCT (design the database for all of this now; build the screens listed under BUILD NOW in this message):
- Organizations (school, club or league) have teams. Teams have seasons. Players, coaches, games, player game stats, highlight videos, announcements, get-involved links and followers belong to a team season.
- Team roles: Owner and Contributor. Contributors can do everything the Owner can except billing.
- Sports are rows in a sports settings table, not code: name, period label (Quarters or Halves), position list, player stat columns, and headline team stats. Seed three sports:
  - Football: periods Quarters; positions QB, RB, WR, TE, OL, DL, LB, DB, K; player stats Passing Yards, Rushing Yards, Receiving Yards, Touchdowns, Tackles.
  - Basketball: periods Quarters; positions PG, SG, SF, PF, C; player stats Points, Rebounds, Assists, Steals, Blocks, Fouls.
  - Soccer: periods Halves; positions GK, DEF, MID, FWD; player stats Goals, Assists, Shots, Saves.
  Adding a sport later should only mean adding a row.

BUILD NOW:

1. Login: Google Sign-In, plus email and password as a backup.

2. Landing page (root):
- Hero with the mission line and a "Create My Team" button.
- Three sport cards: Football, Basketball, Soccer. Picking one starts sign-up with that sport already chosen.
- "How it works" section: 1. Pick your sport. 2. Add your roster, schedule and logo. 3. Go live and share with your fans.
- "Featured teams" strip showing published teams with logo, name and sport.
- An empty section reserved for a promo video (placeholder for now).

3. Setup wizard (after sign-up, sport already chosen):
- Step 1 Organization: name and type (school, club, league).
- Step 2 Team basics: team name, mascot, level (Varsity, JV, Freshman, One program), season (2026), logo upload, then team colors pulled automatically from the logo's two main colors, with manual override.
- Step 3 Roster: paste a list (one player per line: jersey, first name, last name, grade, level) or add players one at a time. Position picked from the sport's list. Coaches with name and title.
- Step 4 Schedule: games with date, opponent, home or away, location, time, and final score when played.
- Step 5 Review, then a "Pay and publish" placeholder button (payments come later; for now it publishes).

4. Public team page at thisismyteam.app/<team-slug> (slug auto-made from the team name, editable, must be unique):
- Themed in the team's colors with the logo.
- Top area reserved for a hero video that autoplays muted, loops, plays inline on phones, with a tap-for-sound button. Use the logo on team colors until a video exists.
- Record (W-L), current streak, next game.
- Schedule with results.
- Roster as player tiles: photo (or jersey number on team color if no photo), name, number, position, grade. Tap a player for a profile.
- Coaches section with photo and title.
- Placeholder sections for Highlights, Last Game Leaders, Get Involved, and a Follow button (these get built next).

5. Admin dashboard (after publish): edit everything from the wizard at any time: team info, roster, coaches, schedule and scores.

DESIGN:
- Phone first: it should feel like a real pro team app on a phone. Then lay it out properly for desktop with wider grids so it feels like a real team website on a laptop.
- Bold, energetic sports broadcast feel. Big numbers, strong type, team colors everywhere.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/348c302c-cb41-4918-9b5c-1490affc54ac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
