<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Staff roles use PIN login, not user accounts: `loginStaff` checks a SHA-256 hash in `role_pins` (service-role only) and returns an HMAC-signed token (`PAYATT_SESSION_SECRET`); every privileged server function re-verifies it via `requireRole`. Why: faculty share two PINs, no sign-up.
- Members sign in with admin-issued username + PBKDF2 password in `member_accounts` (service-role only); member tokens are HMAC-signed with a session version, and `requireMember` blocks everything except password change while `must_change_password` is true. Why: forced first-login reset is enforced server-side, not just by the UI redirect.
- Each Payattu Desk is one `payatt_events` row; contributions reference `event_id` and every total is computed per event, never pooled. Why: each recipient has a strictly separate ledger.
- Confidential data (`priority_requests`, `member_accounts`) has RLS on with no policies and is read only through server functions. Why: only the member and the Admin may see it.
- All writes go through server functions in `src/lib/payatt.functions.ts` using the admin client; public reads use a publishable client whose RLS only exposes verified + published contributions. Why: the browser never holds write access.
- Business rules (min amount, UTR, wheel lock, eligibility, passbook, CSV BOM) live in pure `src/lib/payatt-rules.ts` with tests beside it. Why: client and server share one source of truth.
- Installable via manifest only (no service worker). Why: offline was not requested.
