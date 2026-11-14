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
- [x] Import existing records (members, months, desks, payments, tea party, member usernames)
- [ ] Admin/Conductor PIN sign-in check — waiting on user (PINs unchanged from the old app)

Live draw alerts + Conductor Desk (Nov 13):

- [ ] Draw alerts toggle (profile + top bar): phone notification 60 s before draw, tap opens Live Wheel
- [ ] Background alert sender runs every minute and notifies subscribed members
- [ ] Foreground popup with bell chime + pulsing "Join Live Draw Now"
- [ ] Spin 2 unlocks 15 s after Spin 1; winners on home board + WhatsApp invite
- [ ] Remove Conductor PIN login; members who are this month's Desk 1/2 recipient get a "Conductor Desk" tab
- [ ] Conductor sees/enters/verifies only their own desk; Admin keeps both
- [ ] One-click Verify + Add Contribution (min ₹2,500) inside the conductor's desk

Member roster + sign-in gate (Nov 13):

- [ ] Admin Desk: remove a member from a slot (1–36)
- [ ] Admin Desk: "Add New Member" into a chosen slot with name, department, phone, username, temporary password
- [ ] Slot order reflected in member lists, passbooks and wheel
- [ ] Signed-out home is a welcome page about സൗഹൃദ പണപ്പയറ്റ് with a "Sign In (ലോഗിൻ ചെയ്യുക)" button; all pool, desk, tea, draw, directory and passbook info only after sign-in

App name + messages (Nov 13):

- [x] Installed app name "സൗഹൃദ പണപ്പയറ്റ്" (manifest name/short name/description, iOS title, page title)
- [x] Passbook title "എന്റെ പയറ്റ് പുസ്തകം" + description "സൗഹൃദ പണപ്പയറ്റ് - വ്യക്തിഗത കണക്കുവിവരങ്ങൾ"
- [x] Login-details WhatsApp message in the new Malayalam format with the passbook link
- [x] Invitation WhatsApp message: Malayalam title, no "pay separately"/minimum lines, "☕ മലബാർ ചായസൽക്കാരം", both hosts on one line

Recipient cards (Nov 14):

- [x] Pool recipient cards: hide priority reason; subtitle "Department of [Department]"

Cycles + defaults (Nov 14):

- [ ] Unlimited months: "+ Add New Month / Cycle" in Cycles and month picker, Month N counter
- [ ] Default time "03:45 PM (ക്ലാസ്സ് സമയത്തിന് ശേഷം)"
- [ ] Default venue "സർ സയ്യിദ് കോളേജ് കഫറ്റീരിയ (Sir Syed College Cafeteria)"
