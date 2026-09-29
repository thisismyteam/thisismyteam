ALTER TABLE public.teams ADD COLUMN payment_exempt BOOLEAN NOT NULL DEFAULT false;
UPDATE public.teams SET payment_exempt = true WHERE published = true;
ALTER TABLE public.seasons ADD COLUMN paid_at TIMESTAMPTZ;

CREATE TABLE public.team_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents = 29900),
  currency TEXT NOT NULL CHECK (currency = 'usd'),
  stripe_session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_status_date CHECK ((status = 'paid') = (paid_at IS NOT NULL))
);
GRANT SELECT ON public.team_payments TO authenticated;
GRANT ALL ON public.team_payments TO service_role;
ALTER TABLE public.team_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_payments_owner_read ON public.team_payments FOR SELECT TO authenticated USING (private.is_team_owner(team_id));
CREATE TRIGGER team_payments_updated_at BEFORE UPDATE ON public.team_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION private.protect_team_publication() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.payment_exempt IS DISTINCT FROM OLD.payment_exempt THEN RAISE EXCEPTION 'Payment exemption cannot be changed'; END IF;
    IF NEW.published = true AND OLD.published = false AND NOT OLD.payment_exempt AND NOT EXISTS (
      SELECT 1 FROM public.seasons s WHERE s.team_id = OLD.id AND s.is_current = true AND s.paid_at IS NOT NULL
    ) THEN RAISE EXCEPTION 'Payment required before publishing'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_team_publication BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION private.protect_team_publication();

CREATE OR REPLACE FUNCTION private.protect_season_payment() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN RAISE EXCEPTION 'Payment status cannot be changed'; END IF;
    IF OLD.paid_at IS NOT NULL AND (NEW.label IS DISTINCT FROM OLD.label OR NEW.year IS DISTINCT FROM OLD.year OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.is_current IS DISTINCT FROM OLD.is_current) THEN RAISE EXCEPTION 'Paid season cannot be changed'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_season_payment BEFORE UPDATE ON public.seasons FOR EACH ROW EXECUTE FUNCTION private.protect_season_payment();

CREATE OR REPLACE FUNCTION public.finalize_team_checkout(_session_id TEXT, _team_id UUID, _season_id UUID, _amount_cents INTEGER, _currency TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _payment public.team_payments%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _payment FROM public.team_payments WHERE stripe_session_id = _session_id FOR UPDATE;
  IF NOT FOUND OR _payment.team_id IS DISTINCT FROM _team_id OR _payment.season_id IS DISTINCT FROM _season_id OR _payment.amount_cents IS DISTINCT FROM _amount_cents OR _payment.currency IS DISTINCT FROM _currency THEN RAISE EXCEPTION 'Payment mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE id = _season_id AND team_id = _team_id AND is_current = true) THEN RAISE EXCEPTION 'Season mismatch'; END IF;
  IF _payment.status = 'paid' THEN RETURN true; END IF;
  UPDATE public.team_payments SET status = 'paid', paid_at = now() WHERE id = _payment.id;
  UPDATE public.seasons SET paid_at = now() WHERE id = _season_id AND paid_at IS NULL;
  UPDATE public.teams SET published = true, published_at = COALESCE(published_at, now()) WHERE id = _team_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.finalize_team_checkout(TEXT, UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_team_checkout(TEXT, UUID, UUID, INTEGER, TEXT) TO service_role;