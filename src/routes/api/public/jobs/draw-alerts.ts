import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { LIVE_ALERT_MS } from "@/lib/payatt-rules";

const ALERT_TITLE = "🔔 സൗഹൃദ പണപ്പയറ്റ്";
const ALERT_BODY = "ഭാഗ്യചക്ര നറുക്കെടുപ്പ് 1 മിനിറ്റിനകം ആരംഭിക്കുന്നു! ഇപ്പോൾ തന്നെ പങ്കെടുക്കൂ.";

/** Runs every minute: one minute before a scheduled live draw, notifies every subscribed phone once. */
export const Route = createFileRoute("/api/public/jobs/draw-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
        const { sendPush } = await import("@/lib/web-push.server");
        const now = Date.now();
        // Fire in the minute before the draw (cron runs on minute boundaries; draws are set to whole minutes).
        const { data: due, error } = await sb
          .from("payatt_months")
          .select("id, month, draw_at")
          .is("draw_alert_sent_at", null)
          .gt("draw_at", new Date(now).toISOString())
          .lte("draw_at", new Date(now + LIVE_ALERT_MS + 30_000).toISOString());
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let sent = 0;
        for (const m of due ?? []) {
          const { data: pending } = await sb
            .from("payatt_events")
            .select("id")
            .eq("month", m.month)
            .eq("selection_type", "lottery")
            .is("recipient_member_id", null)
            .limit(1);
          // Claim the alert first so overlapping runs never double-send.
          const claim = await sb
            .from("payatt_months")
            .update({ draw_alert_sent_at: new Date().toISOString() })
            .eq("id", m.id)
            .is("draw_alert_sent_at", null)
            .select("id");
          if (!claim.data?.length || !pending?.length) continue;

          const { data: subs } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth");
          const origin = new URL(request.url).origin;
          const results = await Promise.allSettled(
            (subs ?? []).map(async (s) => {
              const status = await sendPush(
                s,
                { title: ALERT_TITLE, body: ALERT_BODY, url: "/draw" },
                { subject: origin.startsWith("https://") ? origin : "https://sauhrida-november-hub.lovable.app", ttlSeconds: 120 },
              );
              if (status === 404 || status === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
              else if (status < 300) {
                sent++;
                await sb.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", s.id);
              }
            }),
          );
          void results;
        }
        return Response.json({ ok: true, months: due?.length ?? 0, sent });
      },
    },
  },
});
