# Real team app: media, fans, leaders, and collaborators

## Outcome
The public team page becomes a working destination: team video, playable highlights, last-game leaders, email following, action links, and matching portrait cards for players and coaches. Team managers get the corresponding tools without disrupting the landing video, setup wizard, schedules, or existing team pages.

## Build sequence

### 1. Data and permissions
- Keep the existing teams, highlights, games, player-game stats, links, followers, and team-members data; extend rather than replace them.
- Add highlight-to-player tags as a join table. Enforce that tagged players, games, stats, and links belong to the same team and season, and keep public reads limited to published teams. Featured is an existing highlight field.
- Represent leaders using the existing player-game-stats rows with an explicit rank (maximum three per final game). Stat values use the selected sport's configured columns, rather than sport-specific code.
- Allow email-only followers by adding normalized email and a per-team uniqueness rule. Keep follower emails private; public visitors receive only a count. Preserve existing signed-in follower rows. Handle anonymous submissions through a validated, rate-limited server action; never expose the follower list publicly.
- Add pending contributor invitations keyed by normalized email. Only owners may create/revoke invitations and remove contributors; both owners and contributors may edit team content. Once a signed-in person has a **verified matching email**, securely claim their invitation and join the existing team-members table. No contributor can assign themselves owner status or remove an owner.
- Keep media in the current private storage buckets and enforce the 100MB video limit in both the picker and storage bucket. Restrict new team-video uploads to team managers. Uploaded photos continue using the existing photo bucket.

### 2. Team management
- Add a hero-video control in Team info: upload MP4/MOV, preview, replace, or remove. Use the existing team video field; show upload progress and clear errors.
- Add Highlights management: upload a clip or enter a validated YouTube/Hudl URL, title, optional final/scheduled game, multi-select tagged players, Featured switch, edit/delete, and playable preview. Keep featured clips first.
- Add a Leaders editor to each **final** schedule game: choose up to three distinct roster players, choose their order, and enter short numeric stats from the sport's configured stat columns. Clearing a final score hides or clears that game's leader display rather than presenting a scheduled game as played.
- Add Get Involved management for labeled, validated external links, with edit/remove and predictable order.
- Add Followers management with count, owner/contributor-only list, and CSV export.
- Add a Team Members page reachable from the management tabs: show owner, contributors, and pending invitations; owner invites by email, revokes invitations, and removes contributors. Signing in with Google or email/password claims matching verified invitations automatically, so teams appear in “My teams.”

### 3. Public team page
- Preserve the existing muted autoplaying, looping, inline team video and tap-for-sound behavior, with logo/team-color fallback. Only display media from the team's current selection.
- Replace placeholders with real Highlights, Last Game Leaders (near the top for the latest final game), Follow, and Get Involved sections. Make file clips play full-width; safely embed supported YouTube/Hudl links without accepting arbitrary HTML. Show tagged clips inside player profiles.
- Use one shared 3:4 portrait card for players and coaches: full-bleed photo or large jersey number/coach initials, with a bold information band. Grid: two across on phones, three on tablets, and four to six on desktops. Preserve player profiles and make coach cards tappable for their profiles.
- Make the follow control open an email form, save a follow without an account, show a confirmation or already-following state, and refresh the visible follower count. Never reveal emails or permit public exports.
- Keep the schedule's home/away label based **only** on the stored home/away value: VS for home and AT for away, regardless of date or result. Check both final and upcoming games.

### 4. Verification
- Verify the migration and permissions (including unauthorized member changes and private follower emails), video-size/type validation, invite claiming, and public reads.
- Test mobile and desktop layouts and representative flows: add a highlight, tag a player, enter three leaders, follow, export followers, invite/remove a contributor, and view home/away final and upcoming games. Re-check the landing page video sequence and preview diagnostics.

## Assumptions
- “Admins” means team Owners and Contributors for content and follower management; only Owners manage invitations and contributors. Billing remains untouched.
- Invitations are stored until the recipient signs in with the invited, verified email; they are not emailed automatically because no invitation-mail service is set up. The owner can share the existing sign-in page with them. The members page will clearly show “Pending.”
- MOV uploads are accepted, but some browsers cannot play every MOV codec; provide an unsupported-format message and recommend MP4 if preview playback fails. Existing private media URLs remain compatible.
- Email following is a simple unverified subscription list for now; no alerts or email verification messages are sent.

## Technical approach
- Use new migrations for the join/invite structures, follower and leader fields, consistency constraints, grants and row-level policies. Use authenticated server actions for verified invitation claiming; a public, narrowly validated server action for following; existing authenticated browser reads for admin-only data; and the existing public team read for safe public data.
- Keep related editor modules small and share the portrait card and video-player behavior. Leave `LandingVideoHero` and its clock-synced styles untouched. Preserve existing routes and add unique page metadata for any new content route.
