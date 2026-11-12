-- Members (36 faculty slots)
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_no integer NOT NULL UNIQUE CHECK (slot_no BETWEEN 1 AND 36),
  name text NOT NULL,
  department text NOT NULL,
  phone text,
  has_conducted boolean NOT NULL DEFAULT false,
  conducted_month date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.members TO anon, authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members list is public" ON public.members FOR SELECT TO anon, authenticated USING (true);

-- Monthly Payatt schedule
CREATE TABLE public.payatt_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  payatt_date date NOT NULL,
  venue text,
  conductor1_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  conductor1_reason text CHECK (conductor1_reason IS NULL OR conductor1_reason IN ('health','marriage','house')),
  conductor1_payout integer NOT NULL DEFAULT 0 CHECK (conductor1_payout >= 0),
  conductor2_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  conductor2_payout integer NOT NULL DEFAULT 0 CHECK (conductor2_payout >= 0),
  wheel_override boolean NOT NULL DEFAULT false,
  ledger_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payatt_months TO anon, authenticated;
GRANT ALL ON public.payatt_months TO service_role;
ALTER TABLE public.payatt_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payatt schedule is public" ON public.payatt_months FOR SELECT TO anon, authenticated USING (true);

-- Contributions
CREATE TABLE public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  month date NOT NULL,
  amount integer NOT NULL CHECK (amount >= 2500),
  utr text CHECK (utr IS NULL OR utr ~ '^[0-9]{12}$'),
  screenshot_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  published boolean NOT NULL DEFAULT false,
  entered_by text NOT NULL DEFAULT 'member' CHECK (entered_by IN ('member','conductor','admin')),
  verified_by text CHECK (verified_by IS NULL OR verified_by IN ('conductor','admin')),
  verified_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contributions_month_idx ON public.contributions(month);
CREATE INDEX contributions_member_idx ON public.contributions(member_id);
GRANT SELECT ON public.contributions TO anon, authenticated;
GRANT ALL ON public.contributions TO service_role;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only verified and published entries are public" ON public.contributions
  FOR SELECT TO anon, authenticated USING (status = 'verified' AND published = true);

-- Tea parties
CREATE TABLE public.tea_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_date date NOT NULL,
  party_time text,
  title text NOT NULL,
  venue text,
  host_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  menu text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tea_parties TO anon, authenticated;
GRANT ALL ON public.tea_parties TO service_role;
ALTER TABLE public.tea_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tea parties are public" ON public.tea_parties FOR SELECT TO anon, authenticated USING (true);

-- Role PINs (server-only)
CREATE TABLE public.role_pins (
  role text PRIMARY KEY CHECK (role IN ('admin','conductor')),
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.role_pins TO service_role;
ALTER TABLE public.role_pins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.role_pins (role, pin_hash) VALUES
  ('admin', 'f8e68e8d44bfb5314974a97f787d017ff6ac9d0046083f28665fcf96f0cef80c'),
  ('conductor', 'eec6b92999a4ae9b168305eb535d0f444353894b6a0f491b5c9443b5a0ce04d4');

INSERT INTO public.members (slot_no, name, department) VALUES
  (1, 'Dr. Abdul Rasheed K', 'Commerce'),
  (2, 'Prof. Muhammed Ashraf P', 'Commerce'),
  (3, 'Dr. Shameer V', 'Commerce'),
  (4, 'Dr. Faisal T P', 'English'),
  (5, 'Prof. Anil Kumar M', 'English'),
  (6, 'Dr. Haris Mohammed', 'English'),
  (7, 'Dr. Sudheer Babu K', 'Malayalam'),
  (8, 'Prof. Rajeevan P V', 'Malayalam'),
  (9, 'Dr. Abdul Latheef C', 'Arabic'),
  (10, 'Dr. Mustafa Hudawi', 'Arabic'),
  (11, 'Prof. Noushad A', 'Arabic'),
  (12, 'Dr. Jabir Hussain', 'Economics'),
  (13, 'Prof. Saleem K K', 'Economics'),
  (14, 'Dr. Prakashan E', 'Mathematics'),
  (15, 'Prof. Ismail C P', 'Mathematics'),
  (16, 'Dr. Shafeeq Ahammed', 'Physics'),
  (17, 'Prof. Vinod Kumar T', 'Physics'),
  (18, 'Dr. Nizar M', 'Chemistry'),
  (19, 'Dr. Sajith K', 'Chemistry'),
  (20, 'Prof. Riyas P', 'Chemistry'),
  (21, 'Dr. Mohammed Kunhi', 'Botany'),
  (22, 'Dr. Satheesan K', 'Botany'),
  (23, 'Dr. Aboobacker Siddique', 'Zoology'),
  (24, 'Prof. Hashim V M', 'Zoology'),
  (25, 'Dr. Navas K', 'Computer Science'),
  (26, 'Prof. Shibin Raj', 'Computer Science'),
  (27, 'Prof. Afsal Rahman', 'Computer Science'),
  (28, 'Dr. Ummer Farooq', 'History'),
  (29, 'Prof. Gopalakrishnan N', 'History'),
  (30, 'Dr. Shihab K', 'Hindi'),
  (31, 'Prof. Rafeeque M', 'Hindi'),
  (32, 'Dr. Jaleel P', 'Statistics'),
  (33, 'Prof. Muneer Ali', 'Statistics'),
  (34, 'Dr. Suhail C', 'Physical Education'),
  (35, 'Prof. Ajmal Hussain', 'Library Science'),
  (36, 'Dr. Ibrahim Kutty', 'Psychology');

INSERT INTO public.payatt_months (month, payatt_date, venue) VALUES
  ('2026-11-01', '2026-11-28', 'College Seminar Hall');

-- Each Payattu event = one recipient with its own collection ledger
CREATE TABLE public.payatt_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  event_no smallint NOT NULL DEFAULT 1 CHECK (event_no IN (1, 2)),
  selection_type text NOT NULL CHECK (selection_type IN ('priority', 'lottery')),
  recipient_member_id uuid REFERENCES public.members(id),
  priority_reason text CHECK (priority_reason IS NULL OR priority_reason IN ('health', 'marriage', 'house', 'other')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, event_no)
);
CREATE UNIQUE INDEX payatt_events_month_recipient_uniq
  ON public.payatt_events (month, recipient_member_id) WHERE recipient_member_id IS NOT NULL;

GRANT SELECT ON public.payatt_events TO anon, authenticated;
GRANT ALL ON public.payatt_events TO service_role;
ALTER TABLE public.payatt_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payattu events are public" ON public.payatt_events FOR SELECT TO anon, authenticated USING (true);

-- Contributions now belong to a specific recipient's event
ALTER TABLE public.contributions ADD COLUMN event_id uuid REFERENCES public.payatt_events(id) ON DELETE RESTRICT;
CREATE INDEX contributions_event_idx ON public.contributions (event_id);
CREATE UNIQUE INDEX contributions_one_per_member_event
  ON public.contributions (event_id, member_id) WHERE event_id IS NOT NULL AND status <> 'rejected';

-- Member logins (username + password), server-only
CREATE TABLE public.member_accounts (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username = lower(username)),
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  session_version integer NOT NULL DEFAULT 1,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.member_accounts TO service_role;
ALTER TABLE public.member_accounts ENABLE ROW LEVEL SECURITY;

-- Old fixed two-conductor + split-payout model is retired
COMMENT ON COLUMN public.payatt_months.conductor1_id IS 'DEPRECATED: replaced by payatt_events.recipient_member_id';
COMMENT ON COLUMN public.payatt_months.conductor1_reason IS 'DEPRECATED: replaced by payatt_events.priority_reason';
COMMENT ON COLUMN public.payatt_months.conductor1_payout IS 'DEPRECATED: totals are now the sum of contributions per event';
COMMENT ON COLUMN public.payatt_months.conductor2_id IS 'DEPRECATED: replaced by payatt_events.recipient_member_id';
COMMENT ON COLUMN public.payatt_months.conductor2_payout IS 'DEPRECATED: totals are now the sum of contributions per event';

-- Month announcement defaults + joint tea menu
ALTER TABLE public.payatt_months ALTER COLUMN venue SET DEFAULT 'കോളേജ് കഫറ്റീരിയ (College Cafeteria)';
ALTER TABLE public.payatt_months ADD COLUMN event_time text DEFAULT '3:30 PM (ക്ലാസ്സ് സമയത്തിന് ശേഷം / After Class Hours)';
ALTER TABLE public.payatt_months ADD COLUMN tea_menu text[] NOT NULL DEFAULT '{}';

-- Each desk recipient's optional Malayalam appeal
ALTER TABLE public.payatt_events ADD COLUMN appeal_note text;
ALTER TABLE public.payatt_events DROP CONSTRAINT payatt_events_priority_reason_check;
ALTER TABLE public.payatt_events ADD CONSTRAINT payatt_events_priority_reason_check
  CHECK (priority_reason IS NULL OR priority_reason IN ('health', 'marriage', 'house', 'debt', 'other'));

-- Cash or UPI
ALTER TABLE public.contributions ADD COLUMN payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cash', 'upi'));

-- Confidential priority requests (server-only)
CREATE TABLE public.priority_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('health', 'marriage', 'house', 'debt', 'other')),
  preferred_month date,
  amount_needed integer CHECK (amount_needed IS NULL OR amount_needed >= 0),
  details text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'declined', 'withdrawn')),
  assigned_month date,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX priority_requests_member_idx ON public.priority_requests (member_id);
GRANT ALL ON public.priority_requests TO service_role;
ALTER TABLE public.priority_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.tea_parties IS 'DEPRECATED: replaced by payatt_months.tea_menu and the Host Desk';

-- Live Lucky Wheel
ALTER TABLE public.payatt_months ADD COLUMN draw_at timestamptz;

-- One live spin per lottery desk; the first member to spin claims the row.
CREATE TABLE public.live_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.payatt_events(id) ON DELETE CASCADE,
  month date NOT NULL,
  event_no smallint NOT NULL,
  spun_by_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  spun_by_name text NOT NULL,
  candidate_ids uuid[] NOT NULL,
  candidate_names text[] NOT NULL,
  winner_index integer NOT NULL,
  winner_member_id uuid NOT NULL REFERENCES public.members(id),
  turns smallint NOT NULL DEFAULT 7,
  duration_ms integer NOT NULL DEFAULT 7000,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_draws_month_idx ON public.live_draws (month);
GRANT SELECT ON public.live_draws TO anon, authenticated;
GRANT ALL ON public.live_draws TO service_role;
ALTER TABLE public.live_draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live draw results are public" ON public.live_draws FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_draws;