# Bulk import for roster and schedule + draft resume

## What you'll get
1. **Paste schedule** (wizard Step 4 and admin Schedule), one game per line, forgiving format:
   - `Aug 21, Valencia, Away, L 39-7` / `Aug 21 | Valencia | Away | L 39-7` / `10/2 at Lawndale 7pm`
   - "at" / "@" / "Away" means away; "vs" / "Home" means home; "Neutral" means neutral. Home is the default.
   - `L 39-7` saves as us 7, them 39. `W 28-14` saves as us 28, them 14. Games with a score are marked final.
   - Dates without a year use the season year (2026). Anything we can't read shows as a warning in the preview instead of being dropped silently.
2. **Upload a file** for roster and schedule: CSV, Excel (.xlsx), Word (.docx), PDF, or a photo/screenshot.
   - Phase A (first): CSV and Excel are read right in the browser.
   - Phase B (after A works): Word, PDF and images are read by AI and turned into rows.
3. **Preview before saving**: every import (paste or file) opens an editable table with a count ("52 players found" / "14 games found"). You can fix any cell, delete rows, then press "Save all". Nothing is saved until you confirm.
4. **Flexible column matching**: "No.", "#", "Jersey", "Number" = jersey; "Yr", "Class", "Grade" = grade; "First"/"Last" or a single "Name" column split in two; "Pos"/"Position" = position; "Opponent"/"Team"/"vs" = opponent; "H/A", "Site" = home/away; "Result"/"Score" = score. Positions are kept only if they match the sport's position list (case-insensitive, e.g. "qb" = QB); otherwise left blank and flagged.
5. **Drafts**: an unfinished team is already saved once Step 2 is done. I'll add:
   - A "Draft" label and "Continue setup" button on My Teams for unpublished teams.
   - Resume at the step you left off (today it always jumps to Review). The last step reached is remembered per team.

## Technical details
- `src/lib/import/schedule-parse.ts`: line parser (splits on `,`, `|`, tab, 2+ spaces; regexes for dates like `Aug 21`, `8/21`, `2026-08-21`; times `7pm`/`7:00 PM`; results `W|L|T n-n`; `at|@|vs` prefixes). Unit tests with vitest for the three example lines and W/L score flipping.
- `src/lib/import/columns.ts`: header alias maps for roster and schedule, turning a 2D table into draft rows; position matching against `sport.positions`.
- CSV via `papaparse`, Excel via `read-excel-file` (small, browser-only, no Node deps). Only the first sheet is read; header row auto-detected.
- AI extraction: `src/lib/import.functions.ts` authenticated server fn (`requireSupabaseAuth`, checks the caller is a team member). Files are sent as base64 (max 10MB); Word text is pulled with `mammoth` in the browser; PDFs and images go straight to Lovable AI (`google/gemini-2.5-flash`, multimodal) with a tool-call schema returning roster or game rows. The result feeds the same preview table. 429/402 errors are shown as clear messages.
- Shared `ImportPreview` component used by roster and schedule editors in both wizard and admin; "Save all" does one bulk insert with the existing save-status indicator.
- Draft resume: store `setup_step` in the wizard's URL + `localStorage` keyed by team id (no schema change); `start.tsx` resume effect uses it instead of always Step 5. Dashboard shows "Continue setup" linking to `/start?teamId=…` for unpublished teams; published teams keep "Manage".
- No changes to checkout, payment lock, navigation, naming, save feedback or Hudl.

## Order
1. Draft label/resume (quick). 2. Paste schedule + preview table. 3. CSV/Excel upload for roster and schedule. 4. AI extraction for Word/PDF/images. 5. Browser check on phone and desktop.
