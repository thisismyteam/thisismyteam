import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/stripe-webhook')({
  server: { handlers: {
    POST: async ({ request }) => {
      const key = process.env['STRIPE_SECRET_KEY']
      const secret = process.env['STRIPE_WEBHOOK_SECRET']
      const signature = request.headers.get('stripe-signature')
      if (!key || !secret || !signature) return new Response('Webhook unavailable', { status: 503 })
      const { default: Stripe } = await import('stripe')
      const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })
      let event
      try {
        event = await stripe.webhooks.constructEventAsync(await request.text(), signature, secret, undefined, Stripe.createSubtleCryptoProvider())
      } catch {
        return new Response('Invalid signature', { status: 400 })
      }
      if (event.type !== 'checkout.session.completed') return new Response('ok')
      const session = event.data.object
      if (session.mode !== 'payment' || session.payment_status !== 'paid' ||
        session.amount_total !== 29900 || session.currency !== 'usd' ||
        !session.metadata?.team_id || !session.metadata.season_id ||
        session.client_reference_id !== session.metadata.team_id || !session.id.startsWith('cs_test_')) {
        console.error('Stripe checkout did not match a paid test season', event.id)
        return new Response('Checkout mismatch', { status: 400 })
      }
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      const { data, error } = await supabaseAdmin.rpc('finalize_team_checkout', {
        _session_id: session.id, _team_id: session.metadata.team_id,
        _season_id: session.metadata.season_id, _amount_cents: 29900, _currency: 'usd',
      })
      if (error || data !== true) {
        console.error('Failed to finalize Stripe checkout', event.id, error)
        return new Response('Unable to finalize payment', { status: 500 })
      }
      return new Response('ok')
    },
  } },
})
