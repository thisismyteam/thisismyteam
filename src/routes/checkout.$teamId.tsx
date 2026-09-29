import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/site-header'
import { Btn } from '@/components/ui-kit'
import { useAuth } from '@/lib/auth'
import { getTeamBilling } from '@/lib/billing.functions'

export const Route = createFileRoute('/checkout/$teamId')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { result?: 'success' | 'cancel' } =>
    search['result'] === 'success' || search['result'] === 'cancel' ? { result: search['result'] } : {},
  head: () => ({ meta: [
    { title: 'Team checkout — This Is My Team' },
    { name: 'description', content: 'Check your team season payment and publication.' },
    { property: 'og:title', content: 'Team checkout — This Is My Team' },
    { property: 'og:description', content: 'Check your team season payment and publication.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: CheckoutResult,
})

function CheckoutResult() {
  const { teamId } = Route.useParams()
  const { result } = Route.useSearch()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const fetchBilling = useServerFn(getTeamBilling)
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  useEffect(() => { if (!loading && !user) navigate({ to: '/auth', replace: true }) }, [loading, user, navigate])
  const billing = useQuery({
    queryKey: ['team-billing', teamId], enabled: !!user,
    queryFn: () => fetchBilling({ data: { teamId } }),
    refetchInterval: (query) => result === 'success' && !query.state.data?.season?.paid_at ? 3000 : false,
  })
  const live = !!billing.data?.season?.paid_at && !!billing.data?.team.published
  const url = `${origin}/${billing.data?.team.slug ?? ''}`
  return <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
    {billing.isError ? <p className="text-destructive">Could not verify your team. Please sign in as its Owner.</p> : result === 'cancel' ? <>
      <p className="eyebrow text-primary">Checkout cancelled</p><h1 className="display-xl mt-3 text-4xl">Your team is still a draft.</h1>
      <p className="mt-4 text-muted-foreground">No payment was completed. Your team details are saved; return to review whenever you're ready.</p>
      <Link to="/start" search={{ teamId, checkout: 'cancel' }} className="mt-7 inline-block"><Btn>Back to review</Btn></Link>
    </> : live ? <>
      <p className="eyebrow text-primary">Game on</p><h1 className="display-xl mt-3 text-5xl">You're live!</h1>
      <p className="mt-4 text-muted-foreground">Your team page is published and ready to share.</p>
      <div className="mt-8 border-y border-border py-6"><a className="break-all text-lg font-semibold text-primary" href={url}>{url}</a>
        <div className="mt-5 flex flex-wrap gap-2"><Btn onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Link copied')).catch(() => toast.error('Could not copy link'))}><Copy className="mr-2 h-4 w-4" />Copy link</Btn>
          <Link to="/$slug" params={{ slug: billing.data?.team.slug ?? '' }}><Btn variant="outline">View page <ExternalLink className="ml-2 h-4 w-4" /></Btn></Link></div></div>
      {origin ? <div className="mt-8 inline-block bg-surface p-4"><QRCodeSVG value={url} size={180} bgColor="transparent" fgColor="currentColor" aria-label="QR code for your team page" /></div> : null}
      <div className="mt-8"><Link to="/admin/$teamId" params={{ teamId }}><Btn variant="outline">Manage team</Btn></Link></div>
    </> : <><p className="eyebrow text-primary">Payment received</p><h1 className="display-xl mt-3 text-4xl">Confirming your team</h1>
      <p className="mt-4 text-muted-foreground">We're waiting for Stripe to confirm the payment. Your team stays unpublished until it does. This page updates automatically.</p>
      <div className="mt-7 flex gap-2"><Btn variant="outline" onClick={() => billing.refetch()}>Check again</Btn><Link to="/dashboard"><Btn variant="ghost">My teams</Btn></Link></div>
    </>}
  </main></div>
}
