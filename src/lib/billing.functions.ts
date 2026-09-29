import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const TEAM_SEASON_CENTS = 29900

export const startTeamCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { teamId: string }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(data.teamId)) throw new Error('Invalid team')
    return data
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: membership, error: memberError } = await supabase.from('team_members')
      .select('role').eq('team_id', data.teamId).eq('user_id', userId).maybeSingle()
    if (memberError || membership?.role !== 'owner') throw new Error('Only the team Owner can pay.')
    const { data: team, error: teamError } = await supabase.from('teams')
      .select('id, slug, published').eq('id', data.teamId).single()
    if (teamError || !team || team.published) throw new Error('This team is already live or unavailable.')
    const { data: season, error: seasonError } = await supabase.from('seasons')
      .select('id, label, paid_at').eq('team_id', team.id).eq('is_current', true).maybeSingle()
    if (seasonError || !season || season.paid_at) throw new Error('This season is already paid or unavailable.')
    const key = process.env['STRIPE_SECRET_KEY']
    if (!key || !key.startsWith('rk_test_')) throw new Error('Stripe test checkout is not configured yet.')
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })
    const origin = new URL(getRequest().url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', unit_amount: TEAM_SEASON_CENTS,
        product_data: { name: 'This Is My Team - Team Season' } }, quantity: 1 }],
      metadata: { team_id: team.id, season_id: season.id },
      client_reference_id: team.id,
      success_url: `${origin}/checkout/${team.id}?result=success`,
      cancel_url: `${origin}/checkout/${team.id}?result=cancel`,
    })
    if (!session.url) throw new Error('Stripe did not return a checkout link.')
    // The payment record can only be created by trusted server code after Stripe creates the session.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.from('team_payments').insert({
      team_id: team.id, season_id: season.id, amount_cents: TEAM_SEASON_CENTS,
      currency: 'usd', stripe_session_id: session.id, status: 'pending',
    })
    if (error) {
      console.error('Unable to save Stripe session', error)
      await stripe.checkout.sessions.expire(session.id).catch(() => {})
      throw new Error('Could not save checkout. Please try again.')
    }
    return { url: session.url }
  })

export const getTeamBilling = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { teamId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase.from('team_members')
      .select('role').eq('team_id', data.teamId).eq('user_id', context.userId).maybeSingle()
    if (membership?.role !== 'owner') throw new Error('Only the team Owner can view billing.')
    const { data: season, error } = await context.supabase.from('seasons')
      .select('id, label, paid_at').eq('team_id', data.teamId).eq('is_current', true).maybeSingle()
    if (error) throw error
    const { data: team } = await context.supabase.from('teams').select('slug, published, payment_exempt').eq('id', data.teamId).single()
    if (!team) throw new Error('Team unavailable.')
    return { season, team }
  })
