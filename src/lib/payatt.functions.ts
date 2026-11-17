import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  generateTempPassword,
  hashPassword,
  hashPin,
  requireRole,
  signMemberToken,
  signToken,
  verifyMemberToken,
  verifyPassword,
  verifyToken,
} from "./session.server";
import {
  conductorDeskEvents,
  cycleMonthNumber,
  slotProblem,
  DEFAULT_TIME,
  DEFAULT_VENUE,
  monthKeyOf,
  TEA_MENU_IDS,
  isValidUsername,
  MIN_CONTRIBUTION,
  passwordProblem,
  suggestUsername,
  todayIST,
  validateMonthEvents,
  wheelCandidates,
  liveSpinProblem,
  LIVE_SPIN_MS,
} from "./payatt-rules";

const monthKey = z.string().regex(/^\d{4}-\d{2}-01$/, "Invalid month");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const tokenSchema = z.string().min(10).max(2000);
/** Receipt links are short-lived so access ends soon after a desk is reassigned. */
const SCREENSHOT_URL_TTL_S = 120;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/* ---------------- Signed-in snapshot ---------------- */

/** Everything on the main pages. Only signed-in members (after their first password change) and the Admin see it. */
export const getSnapshot = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    await requireViewer(sb, data.token);
    const [members, months, events, contributions, tea, draws] = await Promise.all([
      sb
        .from("members")
        .select("id, slot_no, name, department, has_conducted, conducted_month, removed_at")
        .order("slot_no"),
      sb
        .from("payatt_months")
        .select("id, month, payatt_date, venue, event_time, draw_at, tea_menu, wheel_override, ledger_published, published_at")
        .order("month", { ascending: false }),
      sb.from("payatt_events").select("*").order("month", { ascending: false }).order("event_no"),
      sb
        .from("contributions")
        .select("id, member_id, event_id, month, amount, status, published, created_at")
        .eq("status", "verified")
        .eq("published", true),
      sb.from("tea_parties").select("*").order("party_date", { ascending: false }),
      sb.from("live_draws").select("*").order("started_at", { ascending: false }).limit(48),
    ]);
    fail(draws.error);
    fail(members.error);
    fail(months.error);
    fail(events.error);
    fail(contributions.error);
    fail(tea.error);
    return {
      allMembers: members.data ?? [],
      months: months.data ?? [],
      events: events.data ?? [],
      contributions: contributions.data ?? [],
      teaParties: tea.data ?? [],
      liveDraws: draws.data ?? [],
      serverNow: Date.now(),
    };
  });

export const loginStaff = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ role: z.literal("admin"), pin: z.string().regex(/^\d{4,8}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row, error } = await sb
      .from("role_pins")
      .select("pin_hash")
      .eq("role", data.role)
      .maybeSingle();
    fail(error);
    const hash = await hashPin(data.role, data.pin);
    if (!row || row.pin_hash !== hash) {
      await new Promise((r) => setTimeout(r, 600));
      return { ok: false as const, error: "Incorrect PIN" };
    }
    const { token, exp } = await signToken(data.role, row.pin_hash);
    return { ok: true as const, token, exp, role: data.role };
  });

/* ---------------- Member logins ---------------- */

type AdminClient = Awaited<ReturnType<typeof admin>>;

/** Verifies a member token against the account's current session version. */
async function requireMember(sb: AdminClient, token: string | undefined, opts: { allowMustChange?: boolean } = {}) {
  const t = await verifyMemberToken(token);
  if (!t) throw new Error("Please sign in again.");
  const { data: acc, error } = await sb
    .from("member_accounts")
    .select("member_id, username, session_version, must_change_password, password_hash, password_salt")
    .eq("member_id", t.memberId)
    .maybeSingle();
  fail(error);
  if (!acc || acc.session_version !== t.version) throw new Error("Please sign in again.");
  if (acc.must_change_password && !opts.allowMustChange)
    throw new Error("Please change your temporary password first.");
  return acc;
}

/** A signed-in viewer: the Admin (PIN) or a member who has set their own password. */
async function requireViewer(sb: AdminClient, token: string) {
  if ((await verifyToken(token)) === "admin") return { kind: "admin" as const, memberId: null };
  const acc = await requireMember(sb, token);
  return { kind: "member" as const, memberId: acc.member_id };
}

/** The desks a member conducts (they are the recipient), this month or later. */
async function myConductorEvents(sb: AdminClient, memberId: string) {
  const { data, error } = await sb.from("payatt_events").select("*").eq("recipient_member_id", memberId);
  fail(error);
  return conductorDeskEvents(data ?? [], memberId, todayIST());
}

export const loginMember = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ username: z.string().trim().toLowerCase().min(3).max(30), password: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: acc, error } = await sb
      .from("member_accounts")
      .select("member_id, password_hash, password_salt, session_version, must_change_password, members(name, removed_at)")
      .eq("username", data.username)
      .maybeSingle();
    fail(error);
    const removed = !!(acc?.members as { removed_at: string | null } | null)?.removed_at;
    const ok = acc && !removed ? await verifyPassword(data.password, acc.password_salt, acc.password_hash) : false;
    if (!acc || !ok) {
      await new Promise((r) => setTimeout(r, 600));
      return { ok: false as const, error: "Incorrect username or password" };
    }
    await sb.from("member_accounts").update({ last_login_at: new Date().toISOString() }).eq("member_id", acc.member_id);
    const { token, exp } = await signMemberToken(acc.member_id, acc.session_version);
    return {
      ok: true as const,
      token,
      exp,
      memberId: acc.member_id,
      name: (acc.members as { name: string } | null)?.name ?? "",
      mustChange: acc.must_change_password,
    };
  });

export const changeMemberPassword = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: tokenSchema, current: z.string().min(1).max(100), next: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const acc = await requireMember(sb, data.token, { allowMustChange: true });
    if (!(await verifyPassword(data.current, acc.password_salt, acc.password_hash)))
      throw new Error("Your current password is incorrect");
    const problem = passwordProblem(data.next);
    if (problem) throw new Error(problem);
    if (data.next === data.current) throw new Error("Choose a password different from the temporary one");
    const { hash, salt } = await hashPassword(data.next);
    const version = acc.session_version + 1;
    const { error } = await sb
      .from("member_accounts")
      .update({
        password_hash: hash,
        password_salt: salt,
        must_change_password: false,
        session_version: version,
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", acc.member_id);
    fail(error);
    const { token, exp } = await signMemberToken(acc.member_id, version);
    return { ok: true, token, exp };
  });

/** The signed-in member's own contributions, including ones still pending or unpublished. */
export const getMyDashboard = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const acc = await requireMember(sb, data.token);
    const { data: rows, error } = await sb
      .from("contributions")
      .select("id, event_id, month, amount, status, published, utr, payment_method, created_at")
      .eq("member_id", acc.member_id)
      .order("created_at", { ascending: false });
    fail(error);
    const reqs = await sb
      .from("priority_requests")
      .select("id, reason, preferred_month, amount_needed, details, status, assigned_month, admin_note, created_at")
      .eq("member_id", acc.member_id)
      .order("created_at", { ascending: false });
    fail(reqs.error);
    return {
      memberId: acc.member_id,
      username: acc.username,
      contributions: rows ?? [],
      priorityRequests: reqs.data ?? [],
    };
  });

export const listMemberAccounts = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("member_accounts")
      .select("member_id, username, must_change_password, last_login_at, updated_at");
    fail(error);
    return rows ?? [];
  });

/** Creates logins for members without one, or resets existing ones to a new temporary password. */
export const issueMemberCredentials = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        member_ids: z.array(z.string().uuid()).min(1).max(40),
        username: z.string().trim().toLowerCase().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    if (data.username && !isValidUsername(data.username))
      throw new Error("Username: 3–30 lowercase letters, numbers, dot or underscore");
    const sb = await admin();
    const [members, accounts] = await Promise.all([
      sb.from("members").select("id, slot_no, name").in("id", data.member_ids).is("removed_at", null),
      sb.from("member_accounts").select("member_id, username, session_version"),
    ]);
    fail(members.error);
    fail(accounts.error);
    const byMember = new Map((accounts.data ?? []).map((a) => [a.member_id, a]));
    const taken = new Set((accounts.data ?? []).map((a) => a.username));
    const issued: { member_id: string; name: string; username: string; temp_password: string; reset: boolean }[] = [];
    const now = new Date().toISOString();

    for (const m of members.data ?? []) {
      const temp = generateTempPassword();
      const { hash, salt } = await hashPassword(temp);
      const existing = byMember.get(m.id);
      if (existing) {
        const { error } = await sb
          .from("member_accounts")
          .update({
            password_hash: hash,
            password_salt: salt,
            must_change_password: true,
            session_version: existing.session_version + 1,
            updated_at: now,
          })
          .eq("member_id", m.id);
        fail(error);
        issued.push({ member_id: m.id, name: m.name, username: existing.username, temp_password: temp, reset: true });
      } else {
        let username = (data.member_ids.length === 1 && data.username) || suggestUsername(m.name, m.slot_no);
        if (taken.has(username)) {
          if (data.username) throw new Error(`Username "${username}" is already taken`);
          let i = 2;
          while (taken.has(`${username}${i}`)) i++;
          username = `${username}${i}`;
        }
        taken.add(username);
        const { error } = await sb.from("member_accounts").insert({
          member_id: m.id,
          username,
          password_hash: hash,
          password_salt: salt,
          must_change_password: true,
        });
        fail(error);
        issued.push({ member_id: m.id, name: m.name, username, temp_password: temp, reset: false });
      }
    }
    return { issued };
  });

/* ---------------- Contributions ---------------- */

const contributionInput = z.object({
  event_id: z.string().uuid(),
  member_id: z.string().uuid().optional(),
  amount: z.number().int().min(MIN_CONTRIBUTION, `Minimum contribution is ₹${MIN_CONTRIBUTION}`),
  utr: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "UTR must be exactly 12 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  screenshot: z
    .object({
      base64: z.string().max(400_000),
      type: z.enum(["image/jpeg", "image/png", "image/webp"]),
    })
    .optional(),
  note: z.string().trim().max(300).optional(),
  payment_method: z.enum(["cash", "upi"]).optional(),
  token: tokenSchema.optional(),
  member_token: tokenSchema.optional(),
  /** A conductor entering a cash/UPI payment for someone else into their own desk. */
  as_conductor: z.boolean().optional(),
});

export const submitContribution = createServerFn({ method: "POST" })
  .inputValidator((d) => contributionInput.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const role = data.token ? await requireRole(data.token, ["admin"]) : null;
    let memberId: string;
    let enteredBy: "admin" | "conductor" | null = role;
    if (role) {
      if (!data.member_id) throw new Error("Choose the member");
      memberId = data.member_id;
    } else if (data.as_conductor) {
      const acc = await requireMember(sb, data.member_token);
      const mine = await myConductorEvents(sb, acc.member_id);
      if (!mine.some((e) => e.id === data.event_id)) throw new Error("You can only add entries to your own Payattu Desk");
      if (!data.member_id) throw new Error("Choose the member");
      memberId = data.member_id;
      enteredBy = "conductor";
    } else {
      const acc = await requireMember(sb, data.member_token);
      memberId = acc.member_id;
    }

    const { data: ev, error: evErr } = await sb
      .from("payatt_events")
      .select("id, month, recipient_member_id")
      .eq("id", data.event_id)
      .maybeSingle();
    fail(evErr);
    if (!ev) throw new Error("This Payattu no longer exists");
    const { data: giver } = await sb.from("members").select("removed_at").eq("id", memberId).maybeSingle();
    if (!giver || giver.removed_at) throw new Error("This member is no longer on the roster");
    if (ev.recipient_member_id === memberId)
      throw new Error("The recipient doesn't contribute to their own Payattu");

    const { data: dup } = await sb
      .from("contributions")
      .select("id")
      .eq("event_id", ev.id)
      .eq("member_id", memberId)
      .neq("status", "rejected")
      .maybeSingle();
    if (dup) throw new Error("A contribution to this recipient is already recorded. Ask the desk's Conductor to correct it.");

    let screenshot_path: string | null = null;
    if (data.screenshot) {
      const bytes = Uint8Array.from(atob(data.screenshot.base64), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 250_000) throw new Error("Screenshot is too large");
      const ext = data.screenshot.type.split("/")[1];
      screenshot_path = `${ev.month.slice(0, 7)}/${memberId}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage
        .from("payment-screenshots")
        .upload(screenshot_path, bytes, { contentType: data.screenshot.type });
      fail(up.error);
    }

    const staff = enteredBy !== null;
    const { error } = await sb.from("contributions").insert({
      member_id: memberId,
      event_id: ev.id,
      month: ev.month,
      amount: data.amount,
      utr: data.utr ?? null,
      payment_method: data.payment_method ?? (data.utr ? "upi" : null),
      screenshot_path,
      note: data.note || null,
      entered_by: enteredBy ?? "member",
      status: staff ? "verified" : "pending",
      verified_by: enteredBy,
      verified_at: staff ? new Date().toISOString() : null,
      published: false,
    });
    fail(error);
    return { ok: true, status: staff ? "verified" : "pending" };
  });

/* ---------------- Admin desk ---------------- */

export const getDeskData = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, month: monthKey }).parse(d))
  .handler(async ({ data }) => {
    const role = await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const [monthRows, allVerified] = await Promise.all([
      sb.from("contributions").select("*").eq("month", data.month).order("created_at", { ascending: false }),
      sb.from("contributions").select("member_id, month, amount, status").eq("status", "verified"),
    ]);
    fail(monthRows.error);
    fail(allVerified.error);
    const rows = await Promise.all(
      (monthRows.data ?? []).map(async (r) => {
        let screenshot_url: string | null = null;
        if (r.screenshot_path) {
          const s = await sb.storage.from("payment-screenshots").createSignedUrl(r.screenshot_path, SCREENSHOT_URL_TTL_S);
          screenshot_url = s.data?.signedUrl ?? null;
        }
        return { ...r, screenshot_url };
      }),
    );
    return { role, contributions: rows, allVerified: allVerified.data ?? [] };
  });

export const reviewContribution = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema.optional(),
        member_token: tokenSchema.optional(),
        id: z.string().uuid(),
        action: z.enum(["verify", "reject", "delete"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const isAdmin = data.token ? (await requireRole(data.token, ["admin"])) === "admin" : false;
    // Authenticate before touching the record so callers can't probe which entries exist.
    const acc = isAdmin ? null : await requireMember(sb, data.member_token);
    const mine = acc ? await myConductorEvents(sb, acc.member_id) : [];
    const { data: existing } = await sb
      .from("contributions")
      .select("published, event_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!isAdmin && (!existing || !mine.some((e) => e.id === existing.event_id)))
      throw new Error("This entry belongs to another Payattu Desk");
    if (!existing) throw new Error("This entry no longer exists");
    if (!isAdmin) {
      if (data.action === "delete") throw new Error("Only the Admin can delete entries");
      if (existing.published) throw new Error("This entry is already published. Only the Admin can change it.");
    }
    if (data.action === "delete") {
      const { error } = await sb.from("contributions").delete().eq("id", data.id);
      fail(error);
      return { ok: true };
    }
    const { error } = await sb
      .from("contributions")
      .update({
        status: data.action === "verify" ? "verified" : "rejected",
        verified_by: isAdmin ? "admin" : "conductor",
        verified_at: new Date().toISOString(),
        published: data.action === "verify" ? existing.published : false,
      })
      .eq("id", data.id);
    fail(error);
    return { ok: true };
  });

/* ---------------- Conductor desk (a member running their own desk) ---------------- */

/** The signed-in member's own desk(s) and every entry made to them. Other desks are never returned. */
export const getConductorDesk = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ member_token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const acc = await requireMember(sb, data.member_token);
    const events = await myConductorEvents(sb, acc.member_id);
    if (events.length === 0) return { events: [], contributions: [] };
    const { data: rows, error } = await sb
      .from("contributions")
      .select("id, member_id, event_id, month, amount, status, published, utr, payment_method, note, entered_by, screenshot_path, created_at")
      .in(
        "event_id",
        events.map((e) => e.id),
      )
      .order("created_at", { ascending: false });
    fail(error);
    const contributions = await Promise.all(
      (rows ?? []).map(async ({ screenshot_path, ...r }) => {
        let screenshot_url: string | null = null;
        if (screenshot_path) {
          const s = await sb.storage.from("payment-screenshots").createSignedUrl(screenshot_path, SCREENSHOT_URL_TTL_S);
          screenshot_url = s.data?.signedUrl ?? null;
        }
        return { ...r, screenshot_url };
      }),
    );
    return { events, contributions };
  });

export const publishLedger = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: tokenSchema, month: monthKey, include_pending: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    if (data.include_pending) {
      const v = await sb
        .from("contributions")
        .update({ status: "verified", verified_by: "admin", verified_at: new Date().toISOString() })
        .eq("month", data.month)
        .eq("status", "pending");
      fail(v.error);
    }
    const upd = await sb
      .from("contributions")
      .update({ published: true })
      .eq("month", data.month)
      .eq("status", "verified")
      .select("id");
    fail(upd.error);
    const m = await sb
      .from("payatt_months")
      .update({ ledger_published: true, published_at: new Date().toISOString() })
      .eq("month", data.month);
    fail(m.error);
    return { ok: true, count: upd.data?.length ?? 0 };
  });

/* ---------------- Payattu cycles (admin) ---------------- */

async function syncConducted(sb: AdminClient, month: string, previous: (string | null)[], next: (string | null)[]) {
  const removed = previous.filter((id): id is string => !!id && !next.includes(id));
  const added = next.filter((id): id is string => !!id);
  if (removed.length) {
    const { data: still } = await sb.from("payatt_events").select("recipient_member_id").in("recipient_member_id", removed);
    const stillRecipients = new Set((still ?? []).map((r) => r.recipient_member_id));
    const clear = removed.filter((id) => !stillRecipients.has(id));
    if (clear.length)
      await sb
        .from("members")
        .update({ has_conducted: false, conducted_month: null })
        .in("id", clear)
        .eq("conducted_month", month);
  }
  if (added.length) {
    await sb.from("members").update({ has_conducted: true, conducted_month: month }).in("id", added);
  }
}

export const saveMonth = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        month: monthKey,
        payatt_date: dateStr,
        venue: z.string().trim().max(120).optional().nullable(),
        event_time: z.string().trim().max(120).optional().nullable(),
        draw_at: z.string().datetime({ offset: true }).optional().nullable(),
        wheel_override: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    if (data.draw_at && new Date(data.draw_at).getTime() > new Date(`${data.payatt_date}T23:59:59+05:30`).getTime())
      throw new Error("The live draw must be on or before the Payattu date");
    if (cycleMonthNumber(data.month) < 1) throw new Error("The Payattu timeline starts in October 2026");
    if (cycleMonthNumber(data.month) > 120) throw new Error("Pick a month within the next few years");
    if (monthKeyOf(data.payatt_date) !== data.month) throw new Error("The Payattu date must be in the same month");
    const sb = await admin();
    const { error } = await sb.from("payatt_months").upsert(
      {
        month: data.month,
        payatt_date: data.payatt_date,
        venue: data.venue || DEFAULT_VENUE,
        ...(data.event_time !== undefined ? { event_time: data.event_time || DEFAULT_TIME } : {}),
        ...(data.draw_at !== undefined ? { draw_at: data.draw_at, draw_alert_sent_at: null } : {}),
        wheel_override: data.wheel_override,
      },
      { onConflict: "month" },
    );
    fail(error);
    return { ok: true };
  });

export const saveEvent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        id: z.string().uuid().optional(),
        month: monthKey,
        event_no: z.number().int().min(1).max(2),
        selection_type: z.enum(["priority", "lottery"]),
        recipient_member_id: z.string().uuid().nullable(),
        priority_reason: z.enum(["health", "marriage", "house", "debt", "other"]).nullable(),
        notes: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const { data: monthRow } = await sb.from("payatt_months").select("id").eq("month", data.month).maybeSingle();
    if (!monthRow) throw new Error("Save the month's Payatt date first");
    const { data: existing, error } = await sb.from("payatt_events").select("*").eq("month", data.month);
    fail(error);
    const prev = (existing ?? []).find((e) => e.id === data.id) ?? null;
    if (data.id && !prev) throw new Error("This Payattu no longer exists");
    const row = {
      month: data.month,
      event_no: data.event_no,
      selection_type: data.selection_type,
      recipient_member_id: data.recipient_member_id,
      priority_reason: data.selection_type === "priority" ? data.priority_reason : null,
      notes: data.notes || null,
    };
    const next = [...(existing ?? []).filter((e) => e.id !== data.id), row];
    const problem = validateMonthEvents(data.month, next);
    if (problem) throw new Error(problem);
    if (row.recipient_member_id && row.recipient_member_id !== prev?.recipient_member_id) {
      const { data: rm } = await sb.from("members").select("removed_at").eq("id", row.recipient_member_id).maybeSingle();
      if (!rm || rm.removed_at) throw new Error("This member is no longer on the roster");
    }
    if (row.recipient_member_id) {
      const { data: paidIn } = await sb
        .from("contributions")
        .select("id")
        .eq("event_id", data.id ?? "00000000-0000-0000-0000-000000000000")
        .eq("member_id", row.recipient_member_id)
        .neq("status", "rejected")
        .limit(1);
      if (paidIn?.length) throw new Error("This member already contributed to this Payattu, so can't be its recipient");
    }
    const res = data.id
      ? await sb.from("payatt_events").update(row).eq("id", data.id)
      : await sb.from("payatt_events").insert(row);
    fail(res.error);
    if (data.id && prev?.recipient_member_id !== row.recipient_member_id) {
      // Admin changed a drawn winner by hand: retire that live-draw record so the desk can be re-drawn.
      await sb.from("live_draws").delete().eq("event_id", data.id);
    }
    await syncConducted(sb, data.month, [prev?.recipient_member_id ?? null], [row.recipient_member_id]);
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const { data: ev } = await sb.from("payatt_events").select("*").eq("id", data.id).maybeSingle();
    if (!ev) return { ok: true };
    const { count } = await sb
      .from("contributions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.id);
    if (count) throw new Error("Clear this Payattu's contribution sheet before removing it");
    const { error } = await sb.from("payatt_events").delete().eq("id", data.id);
    fail(error);
    await syncConducted(sb, ev.month, [ev.recipient_member_id], []);
    return { ok: true };
  });

/** Admin's member-wise entry sheet for one recipient. Empty amount removes that member's entry. */
export const saveContributionSheet = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        event_id: z.string().uuid(),
        entries: z
          .array(
            z.object({
              member_id: z.string().uuid(),
              amount: z
                .number()
                .int()
                .min(MIN_CONTRIBUTION, `Each amount must be at least ₹${MIN_CONTRIBUTION}`)
                .nullable(),
            }),
          )
          .max(40),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const { data: ev } = await sb.from("payatt_events").select("*").eq("id", data.event_id).maybeSingle();
    if (!ev) throw new Error("This Payattu no longer exists");
    const { data: existing, error } = await sb
      .from("contributions")
      .select("id, member_id, amount, status")
      .eq("event_id", ev.id)
      .neq("status", "rejected");
    fail(error);
    const byMember = new Map((existing ?? []).map((c) => [c.member_id, c]));
    const now = new Date().toISOString();
    let saved = 0;
    let removed = 0;
    for (const e of data.entries) {
      if (e.member_id === ev.recipient_member_id) continue;
      const cur = byMember.get(e.member_id);
      if (e.amount == null) {
        if (cur) {
          const r = await sb.from("contributions").delete().eq("id", cur.id);
          fail(r.error);
          removed++;
        }
        continue;
      }
      if (cur) {
        if (cur.amount === e.amount && cur.status === "verified") continue;
        const r = await sb
          .from("contributions")
          .update({ amount: e.amount, status: "verified", verified_by: "admin", verified_at: now })
          .eq("id", cur.id);
        fail(r.error);
      } else {
        const r = await sb.from("contributions").insert({
          member_id: e.member_id,
          event_id: ev.id,
          month: ev.month,
          amount: e.amount,
          entered_by: "admin",
          status: "verified",
          verified_by: "admin",
          verified_at: now,
          published: false,
        });
        fail(r.error);
      }
      saved++;
    }
    return { ok: true, saved, removed };
  });

export const updateMember = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        id: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
        department: z.string().trim().min(2).max(60),
        phone: z.string().trim().max(20).optional().nullable(),
        slot_no: z.number().int().optional(),
        has_conducted: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    if (data.slot_no !== undefined) {
      const { data: others } = await sb.from("members").select("slot_no").is("removed_at", null).neq("id", data.id);
      const problem = slotProblem(data.slot_no, (others ?? []).map((m) => m.slot_no));
      if (problem) throw new Error(problem);
    }
    const { error } = await sb
      .from("members")
      .update({
        name: data.name,
        department: data.department,
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.slot_no !== undefined ? { slot_no: data.slot_no } : {}),
        has_conducted: data.has_conducted,
        ...(data.has_conducted ? {} : { conducted_month: null }),
      })
      .eq("id", data.id);
    fail(error);
    return { ok: true };
  });

export const saveTeaParty = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        id: z.string().uuid().optional(),
        party_date: dateStr,
        party_time: z.string().trim().max(20).optional().nullable(),
        title: z.string().trim().min(2).max(100),
        venue: z.string().trim().max(120).optional().nullable(),
        host_member_id: z.string().uuid().optional().nullable(),
        menu: z.string().trim().max(500).optional().nullable(),
        notes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const { token: _t, id, ...row } = data;
    const clean = {
      ...row,
      party_time: row.party_time || null,
      venue: row.venue || null,
      host_member_id: row.host_member_id || null,
      menu: row.menu || null,
      notes: row.notes || null,
    };
    const { error } = id
      ? await sb.from("tea_parties").update(clean).eq("id", id)
      : await sb.from("tea_parties").insert(clean);
    fail(error);
    return { ok: true };
  });

export const deleteTeaParty = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const { error } = await sb.from("tea_parties").delete().eq("id", data.id);
    fail(error);
    return { ok: true };
  });

export const changePin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        role: z.literal("admin"),
        pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const pinHash = await hashPin(data.role, data.pin);
    const { error } = await sb
      .from("role_pins")
      .update({ pin_hash: pinHash, updated_at: new Date().toISOString() })
      .eq("role", data.role);
    fail(error);
    // Every earlier Admin session is now revoked; hand this device a fresh one.
    const { token, exp } = await signToken(data.role, pinHash);
    return { ok: true, token, exp, role: data.role };
  });


/* ---------------- Host Desk (the month's recipients) ---------------- */

/** A desk recipient (or the Admin) sets their Malayalam appeal and the joint tea menu. */
export const saveHostDesk = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema.optional(),
        member_token: tokenSchema.optional(),
        month: monthKey,
        event_id: z.string().uuid().optional(),
        appeal_note: z.string().trim().max(800).nullable().optional(),
        tea_menu: z.array(z.string().max(40)).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const role = data.token ? await verifyToken(data.token) : null;
    const isAdmin = role === "admin";
    const { data: events, error } = await sb
      .from("payatt_events")
      .select("id, recipient_member_id")
      .eq("month", data.month);
    fail(error);
    let memberId: string | null = null;
    if (!isAdmin) {
      const acc = await requireMember(sb, data.member_token);
      memberId = acc.member_id;
      if (!(events ?? []).some((e) => e.recipient_member_id === memberId))
        throw new Error("Only this month's Payattu Desk hosts can edit the Host Desk");
    }
    if (data.appeal_note !== undefined) {
      if (!data.event_id) throw new Error("Choose the desk");
      const ev = (events ?? []).find((e) => e.id === data.event_id);
      if (!ev) throw new Error("This Payattu Desk no longer exists");
      if (!isAdmin && ev.recipient_member_id !== memberId) throw new Error("You can only edit your own appeal");
      const r = await sb.from("payatt_events").update({ appeal_note: data.appeal_note || null }).eq("id", ev.id);
      fail(r.error);
    }
    if (data.tea_menu !== undefined) {
      const menu = [...new Set(data.tea_menu)].filter((id) => TEA_MENU_IDS.has(id));
      const r = await sb.from("payatt_months").update({ tea_menu: menu }).eq("month", data.month);
      fail(r.error);
    }
    return { ok: true };
  });

/* ---------------- Confidential priority requests ---------------- */

const reasonEnum = z.enum(["health", "marriage", "house", "debt", "other"]);

export const submitPriorityRequest = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        member_token: tokenSchema,
        reason: reasonEnum,
        preferred_month: monthKey.nullable().optional(),
        amount_needed: z.number().int().min(0).max(100_000_000).nullable().optional(),
        details: z.string().trim().max(1500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const acc = await requireMember(sb, data.member_token);
    const { data: open } = await sb
      .from("priority_requests")
      .select("id")
      .eq("member_id", acc.member_id)
      .in("status", ["submitted", "under_review"]);
    if ((open ?? []).length >= 2) throw new Error("You already have requests waiting for review");
    const { error } = await sb.from("priority_requests").insert({
      member_id: acc.member_id,
      reason: data.reason,
      preferred_month: data.preferred_month ?? null,
      amount_needed: data.amount_needed ?? null,
      details: data.details || null,
    });
    fail(error);
    return { ok: true };
  });

export const withdrawPriorityRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ member_token: tokenSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const acc = await requireMember(sb, data.member_token);
    const { error } = await sb
      .from("priority_requests")
      .update({ status: "withdrawn", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("member_id", acc.member_id)
      .in("status", ["submitted", "under_review"]);
    fail(error);
    return { ok: true };
  });

export const listPriorityRequests = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("priority_requests")
      .select("*")
      .order("created_at", { ascending: true });
    fail(error);
    return rows ?? [];
  });

export const reviewPriorityRequest = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        id: z.string().uuid(),
        status: z.enum(["submitted", "under_review", "approved", "declined"]),
        assigned_month: monthKey.nullable().optional(),
        admin_note: z.string().trim().max(800).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    if (data.status === "approved" && !data.assigned_month) throw new Error("Choose the month for this priority slot");
    if (data.assigned_month && cycleMonthNumber(data.assigned_month) < 1)
      throw new Error("The Payattu timeline starts in October 2026");
    const sb = await admin();
    const { error } = await sb
      .from("priority_requests")
      .update({
        status: data.status,
        assigned_month: data.status === "approved" ? (data.assigned_month ?? null) : null,
        admin_note: data.admin_note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    fail(error);
    return { ok: true };
  });

/* ---------------- Live lucky wheel ---------------- */

/**
 * "Spin the Wheel" in the live arena. The first caller claims the desk's single
 * live_draws row (unique per desk); everyone else gets told who spun first.
 * The server picks the winner so every screen animates to the same result.
 */
export const startLiveSpin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    let spunBy: { id: string | null; name: string };
    if (await verifyMemberToken(data.token)) {
      const acc = await requireMember(sb, data.token);
      const { data: me } = await sb.from("members").select("id, name").eq("id", acc.member_id).single();
      spunBy = { id: acc.member_id, name: me?.name ?? acc.username };
    } else {
      await requireRole(data.token, ["admin"]);
      spunBy = { id: null, name: "Admin" };
    }

    const { data: ev } = await sb.from("payatt_events").select("*").eq("id", data.event_id).maybeSingle();
    if (!ev) throw new Error("This Payattu no longer exists");
    const [monthRes, eventsRes, drawsRes, membersRes, verifiedRes] = await Promise.all([
      sb.from("payatt_months").select("*").eq("month", ev.month).maybeSingle(),
      sb.from("payatt_events").select("*").eq("month", ev.month),
      sb.from("live_draws").select("*").eq("month", ev.month),
      sb.from("members").select("id, name, slot_no, has_conducted").is("removed_at", null).order("slot_no"),
      sb.from("contributions").select("member_id, month, amount, status").eq("status", "verified"),
    ]);
    const m = monthRes.data;
    if (!m) throw new Error("Set up this month's Payattu first");
    const events = eventsRes.data ?? [];
    const draws = drawsRes.data ?? [];
    const problem = liveSpinProblem({
      now: Date.now(),
      drawAt: m.draw_at,
      override: m.wheel_override,
      events,
      draws,
      eventId: ev.id,
    });
    if (problem) {
      const existing = draws.find((d) => d.event_id === ev.id);
      return { ok: false as const, error: existing ? `ചക്രം കറക്കിയത്: ${existing.spun_by_name}` : problem };
    }

    const candidates = wheelCandidates(
      membersRes.data ?? [],
      verifiedRes.data ?? [],
      events.map((e) => e.recipient_member_id),
    );
    if (candidates.length === 0) throw new Error("No eligible members are left on the wheel");
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const winnerIndex = rand[0]! % candidates.length;
    const winner = candidates[winnerIndex]!;

    const ins = await sb
      .from("live_draws")
      .insert({
        event_id: ev.id,
        month: ev.month,
        event_no: ev.event_no,
        spun_by_member_id: spunBy.id,
        spun_by_name: spunBy.name,
        candidate_ids: candidates.map((c) => c.id),
        candidate_names: candidates.map((c) => c.name),
        winner_index: winnerIndex,
        winner_member_id: winner.id,
        duration_ms: LIVE_SPIN_MS,
      })
      .select("*")
      .single();
    if (ins.error) {
      if (ins.error.code === "23505") {
        const { data: first } = await sb.from("live_draws").select("spun_by_name").eq("event_id", ev.id).maybeSingle();
        return { ok: false as const, error: `ചക്രം കറക്കിയത്: ${first?.spun_by_name ?? "another member"}` };
      }
      fail(ins.error);
    }
    const upd = await sb
      .from("payatt_events")
      .update({ recipient_member_id: winner.id })
      .eq("id", ev.id)
      .is("recipient_member_id", null);
    fail(upd.error);
    await syncConducted(sb, ev.month, [], [winner.id]);
    return { ok: true as const, draw: ins.data! };
  });

/** Names currently on the live wheel for a month (signed-in viewers only). */
export const getLiveRoster = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, month: monthKey }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    await requireViewer(sb, data.token);
    const [membersRes, verifiedRes, eventsRes] = await Promise.all([
      sb.from("members").select("id, name, slot_no, has_conducted").is("removed_at", null).order("slot_no"),
      sb.from("contributions").select("member_id, month, amount, status").eq("status", "verified"),
      sb.from("payatt_events").select("recipient_member_id").eq("month", data.month),
    ]);
    fail(membersRes.error);
    return wheelCandidates(
      membersRes.data ?? [],
      verifiedRes.data ?? [],
      (eventsRes.data ?? []).map((e) => e.recipient_member_id),
    ).map((m) => ({ id: m.id, label: m.name }));
  });

/* ---------------- 36-slot roster (admin) ---------------- */

/** Puts a new faculty member into a free slot and issues their login. */
export const addMember = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        slot_no: z.number().int(),
        name: z.string().trim().min(2).max(80),
        department: z.string().trim().min(2).max(60),
        phone: z.string().trim().max(20).optional().nullable(),
        username: z.string().trim().toLowerCase(),
        temp_password: z.string().min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    if (!isValidUsername(data.username)) throw new Error("Username: 3–30 lowercase letters, numbers, dot or underscore");
    const pwProblem = passwordProblem(data.temp_password);
    if (pwProblem) throw new Error(`Temporary password: ${pwProblem.toLowerCase()}`);
    const sb = await admin();
    const [active, taken] = await Promise.all([
      sb.from("members").select("slot_no").is("removed_at", null),
      sb.from("member_accounts").select("member_id").eq("username", data.username).maybeSingle(),
    ]);
    fail(active.error);
    const problem = slotProblem(data.slot_no, (active.data ?? []).map((m) => m.slot_no));
    if (problem) throw new Error(problem);
    if (taken.data) throw new Error(`Username "${data.username}" is already taken`);
    const ins = await sb
      .from("members")
      .insert({ slot_no: data.slot_no, name: data.name, department: data.department, phone: data.phone || null })
      .select("id")
      .single();
    if (ins.error?.code === "23505") throw new Error(`Slot ${data.slot_no} is already taken`);
    fail(ins.error);
    if (!ins.data) throw new Error("Could not add the member");
    const { hash, salt } = await hashPassword(data.temp_password);
    const acc = await sb.from("member_accounts").insert({
      member_id: ins.data.id,
      username: data.username,
      password_hash: hash,
      password_salt: salt,
      must_change_password: true,
    });
    if (acc.error) {
      await sb.from("members").delete().eq("id", ins.data.id);
      fail(acc.error);
    }
    return { ok: true, member_id: ins.data.id, name: data.name, username: data.username, temp_password: data.temp_password };
  });

/** Frees a slot. The member's past payments and Payattu stay in every ledger; their login stops working. */
export const removeMember = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireRole(data.token, ["admin"]);
    const sb = await admin();
    const { data: open } = await sb
      .from("payatt_events")
      .select("id")
      .eq("recipient_member_id", data.id)
      .gte("month", monthKeyOf(todayIST()))
      .limit(1);
    if (open?.length) throw new Error("This member is a recipient this month or later. Change that desk first.");
    const { error } = await sb
      .from("members")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("removed_at", null);
    fail(error);
    const { data: acc } = await sb.from("member_accounts").select("session_version").eq("member_id", data.id).maybeSingle();
    if (acc) {
      await sb
        .from("member_accounts")
        .update({ session_version: acc.session_version + 1, updated_at: new Date().toISOString() })
        .eq("member_id", data.id);
    }
    await sb.from("push_subscriptions").delete().eq("member_id", data.id);
    return { ok: true };
  });

/* ---------------- Draw alerts on phones ---------------- */

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getVapidKeys } = await import("./web-push.server");
  return { publicKey: (await getVapidKeys()).publicKey };
});

const pushSubscription = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, subscription: pushSubscription }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const viewer = await requireViewer(sb, data.token);
    const { data: existing, error: findError } = await sb
      .from("push_subscriptions")
      .select("id, member_id, p256dh, auth")
      .eq("endpoint", data.subscription.endpoint)
      .maybeSingle();
    fail(findError);
    if (existing) {
      // Only the same browser (which holds the same keys) may move an existing subscription to
      // another signer-in, e.g. a shared phone. Anyone else can't overwrite it.
      const sameOwner = existing.member_id === viewer.memberId;
      const sameDevice =
        existing.p256dh === data.subscription.keys.p256dh && existing.auth === data.subscription.keys.auth;
      if (!sameOwner && !sameDevice) throw new Error("This alert subscription belongs to another device");
      const { error } = await sb
        .from("push_subscriptions")
        .update({
          p256dh: data.subscription.keys.p256dh,
          auth: data.subscription.keys.auth,
          member_id: viewer.memberId,
        })
        .eq("id", existing.id);
      fail(error);
      return { ok: true };
    }
    const { error } = await sb.from("push_subscriptions").insert({
      endpoint: data.subscription.endpoint,
      p256dh: data.subscription.keys.p256dh,
      auth: data.subscription.keys.auth,
      member_id: viewer.memberId,
    });
    fail(error);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, endpoint: z.string().url().max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const viewer = await requireViewer(sb, data.token);
    // Only remove the signed-in person's own subscription.
    const base = sb.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    const { error } = await (viewer.memberId ? base.eq("member_id", viewer.memberId) : base.is("member_id", null));
    fail(error);
    return { ok: true };
  });
