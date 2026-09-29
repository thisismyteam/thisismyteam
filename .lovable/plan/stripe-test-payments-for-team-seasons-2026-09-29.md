# Stripe test payments for team seasons

## What will change
- The Step 5 review shows **$299 / season** for **This Is My Team - Team Season**. “Pay and publish” opens a one-time Stripe Checkout in test mode. No price appears on the landing page.
- Only an Owner can start checkout. A cancelled checkout returns to the saved review with a clear cancellation message and the team still unpublished. A successful checkout returns to a “You’re live!” screen with the public link, Copy link and a QR code; the screen waits for the verified payment if Stripe’s webhook arrives after the redirect.
- The dashboard shows the Owner’s billing status (for example, “Paid for 2026 season”). Contributors continue managing team content but see no billing controls.
- Teams already live before this change retain their published status and are exempt from the new payment gate. No existing landing video, team page or editor behavior changes otherwise.

## Implementation stages
1. Add the payment data and safeguards: record team, season, amount, currency, Stripe Checkout session ID, status and paid date. Record the season’s paid date. Restrict payment records to the Owner for reading and trusted server code for writes. Lock payment fields and publishing behind database checks so editing a browser request cannot publish an unpaid new team. Grandfather teams already published at migration time.
2. Add an authenticated checkout action that verifies current Owner membership and season on the server, fixes the amount at 29,900 cents in USD, uses Stripe test credentials server-side, and creates a Checkout session with success and cancel URLs. Do not rely on values supplied by the browser for pricing or authority.
3. Add a public Stripe webhook endpoint for `checkout.session.completed`: verify the signature against the raw request body, validate session identity, payment status, amount, currency, team and season, then atomically and idempotently mark the season paid and publish the team. A redirect alone never changes payment status.
4. Connect the saved wizard review, cancellation message, and verified success screen. Add Copy link and QR. Show season payment status on the dashboard and remove the unrestricted Publish control for unpaid new teams; keep existing published teams manageable.
5. Check the landing video, unpaid/cancelled review, owner-only checkout, existing published team, dashboard, mobile layout and webhook rejection/idempotence. A real test payment requires your Stripe test credentials and registered webhook.

## Stripe setup and boundaries
- Use **your own Stripe test account**, as explicitly requested, not managed payments. Do not paste keys in chat or code. After the endpoint exists, add the restricted `rk_test_…` key in **Project Settings → Secrets** as `STRIPE_SECRET_KEY`. The restricted key needs permission to create Checkout Sessions (and any product/price permissions required by Stripe for inline price data).
- Register `https://thisismyteam.app/api/public/stripe-webhook` as a Stripe test-mode webhook for `checkout.session.completed`. Generate the signing secret in Stripe and save that same `whsec_…` value in **Project Settings → Secrets** as `STRIPE_WEBHOOK_SECRET`. This is a shared external-service secret, so it cannot be generated privately here.
- The production webhook URL only receives Stripe events after the updated app is published. Until those credentials and publication are done, the flow will be implemented but real Checkout and webhook delivery cannot be verified end to end. No payment will be simulated or marked paid without Stripe confirmation.
