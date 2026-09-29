<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the landing video sequence in `LandingVideoHero` with its scoped styles in `src/styles.css`; its captions are driven by the video clock so they stay synchronized after looping or seeking.
- Keep public team reads in a server function and manager edits in authenticated, RLS-scoped browser calls; this preserves shareable SSR pages without exposing management data.
- Store private team media in the existing team media buckets under team-ID folders and persist signed URLs in team records; this keeps uploads access-controlled while allowing public team pages to play approved media.
- Claim contributor invites by verified sign-in email through the database wrapper; this prevents an unverified account from taking another person's team access.
- Only a verified Stripe test webhook may mark a season paid and publish a new team; the database guards payment fields and grandfathered publication, so browser updates cannot bypass checkout.
- Keep owner-only Checkout creation in an authenticated server function and signed raw-body Stripe events in the public webhook route; redirects only show status, never finalize payment.
- Keep team display names editable while suggesting organization short name plus mascot; this preserves existing team names and avoids a destructive rename.
- Resolve Hudl links server-side, play available embeds inline with direct-watch fallback; parent pages cannot reliably detect cross-origin failures.
- Scope admin save feedback to each edited row or section, so asynchronous writes do not imply unrelated fields were saved.
- Parse TXT/CSV/Excel imports in browser; send only Word/PDF/images to team-checked AI; review before saving.
- Match photo-day filenames locally and review before saving to the existing private team media bucket; avoid unreviewed assignments.
- Use one team-and-season-scoped, paginated roster source for every admin player picker; sort numerically by jersey, key by player ID, and never deduplicate.
