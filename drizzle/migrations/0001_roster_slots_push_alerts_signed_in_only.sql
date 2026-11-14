-- Members can leave a slot; their history stays, and the slot can be reused.
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_slot_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS members_active_slot_key ON public.members (slot_no) WHERE removed_at IS NULL;

-- When the 1-minute phone alert for a month's live draw went out.
ALTER TABLE public.payatt_months ADD COLUMN IF NOT EXISTS draw_alert_sent_at timestamptz;

-- Phone notification subscriptions for draw alerts (server-only).
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text,
  auth text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz
);
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Everything is now visible only after signing in, through server functions.
DROP POLICY IF EXISTS "Members list is public" ON public.members;
DROP POLICY IF EXISTS "Payatt schedule is public" ON public.payatt_months;
DROP POLICY IF EXISTS "Payattu events are public" ON public.payatt_events;
DROP POLICY IF EXISTS "Only verified and published entries are public" ON public.contributions;
DROP POLICY IF EXISTS "Tea parties are public" ON public.tea_parties;
DROP POLICY IF EXISTS "Live draw results are public" ON public.live_draws;
REVOKE SELECT ON public.members, public.payatt_months, public.payatt_events, public.contributions, public.tea_parties, public.live_draws FROM anon, authenticated;

-- Data-free "something changed" doorbell for the live wheel, on a public broadcast topic.
CREATE OR REPLACE FUNCTION public.payatt_live_doorbell()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM realtime.send(jsonb_build_object('t', TG_TABLE_NAME), 'changed', 'payatt-live', false);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.payatt_live_doorbell() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS live_draws_doorbell ON public.live_draws;
CREATE TRIGGER live_draws_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.live_draws
  FOR EACH STATEMENT EXECUTE FUNCTION public.payatt_live_doorbell();
DROP TRIGGER IF EXISTS payatt_events_doorbell ON public.payatt_events;
CREATE TRIGGER payatt_events_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.payatt_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.payatt_live_doorbell();
DROP TRIGGER IF EXISTS payatt_months_doorbell ON public.payatt_months;
CREATE TRIGGER payatt_months_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.payatt_months
  FOR EACH STATEMENT EXECUTE FUNCTION public.payatt_live_doorbell();