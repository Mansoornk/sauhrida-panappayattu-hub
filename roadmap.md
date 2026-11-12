# Roadmap

Payattu update (member logins, separate recipient ledgers, flexible months, past-cycle entry):

- [x] Database: Payattu events, contributions per event, member logins
- [x] Shared rules + server side + rule checks
- [x] Member sign-in + forced change-password screen
- [x] Member dashboard (all recipients, type, totals; my contributions per recipient)
- [x] Pool, Pay, Draw, Tea, Statement pages on the per-recipient model
- [x] Desk: Manage Past & Current Payattu Cycles (events + contribution sheets)
- [x] Desk: member login management (create / reset temporary passwords)

Full brief (Nov 9):

- [x] Rename "Payattu 1/2" to "Payattu Desk 1/2" (പയറ്റ് ഡെസ്ക് 1/2) everywhere
- [x] Month defaults: venue College Cafeteria, time 3:30 PM; Announcements Corner on home page
- [x] Wheel opens 2–3 days before the event (was: day before); excludes priority desk + already received
- [x] Confidential Priority Request Form for members + Admin review desk
- [x] Host Desk for the month's recipients: Malayalam appeal note with template chips, WhatsApp group/personal invite (no menu), optional tea menu builder
- [x] Home page: expandable "☕ ഇന്നത്തെ ചായസൽക്കാര വിഭവങ്ങൾ" when a menu is chosen
- [x] Payment method Cash / UPI on contributions; "Verify & Publish Ledger" wording
- [x] Passbook shows date per entry; password change in Profile Settings
- [ ] Offline-ready app (published site only) — waiting on user: needs confirmation, adds a background cache
- [ ] End-to-end check in the preview

Live Lucky Wheel (Nov 11):

- [ ] Admin sets a draw date & time per month; homepage countdown "അടുത്ത നറുക്കെടുപ്പ് സമയം"
- [ ] 1-minute alert popup + chime for signed-in members, "Join Live Draw Now"
- [ ] Live Wheel Arena: spin unlocks at draw time; first member to spin locks it for everyone; synced spin on all screens; winner saved to the desk and shown on home
- [ ] Two lottery desks: Spin 1 for Desk 1, winner removed, then Spin 2 for Desk 2

Migration into this project (Nov 12):

- [x] App, pages, rules and data structure moved; 36 members and November month seeded
- [x] Member sign-in, forced password change and contribution with receipt checked end to end
- [ ] Import existing records — waiting on user: CSV exports from the old app's Cloud database
- [ ] Admin/Conductor PIN sign-in check — waiting on user (PINs unchanged from the old app)
