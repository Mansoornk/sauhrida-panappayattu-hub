import { describe, expect, it } from "vitest";
import {
  buildPassbook,
  drawAtFromIST,
  drawAtToIST,
  liveDrawPhase,
  liveSpinProblem,
  canSpinWheel,
  cycleMonthNumber,
  cycleMonths,
  describeMonthMode,
  eventsNeedingDraw,
  eventTotal,
  maxEventsForMonth,
  passwordProblem,
  suggestUsername,
  validateMonthEvents,
  isValidAmount,
  isValidUtr,
  toCsvWithBom,
  wheelCandidates,
  wheelDayFor,
  buildWhatsAppInvite,
  deskLabel,
} from "./payatt-rules";

describe("contribution amount", () => {
  it("rejects anything below ₹2,500", () => {
    expect(isValidAmount(2499)).toBe(false);
  });
  it("accepts exactly ₹2,500 and has no upper limit", () => {
    expect(isValidAmount(2500)).toBe(true);
    expect(isValidAmount(250000)).toBe(true);
  });
});

describe("UTR number", () => {
  it("is optional", () => {
    expect(isValidUtr("")).toBe(true);
    expect(isValidUtr(null)).toBe(true);
  });
  it("must be exactly 12 digits when given", () => {
    expect(isValidUtr("123456789012")).toBe(true);
    expect(isValidUtr("12345678901")).toBe(false);
    expect(isValidUtr("12345678901a")).toBe(false);
  });
});

describe("spinning wheel lock", () => {
  it("opens 3 days before the Payattu date", () => {
    expect(wheelDayFor("2026-12-01")).toBe("2026-11-28");
  });
  it("lets the Admin spin only 2–3 days before the Payattu", () => {
    const base = { role: "admin" as const, payattDate: "2026-11-28", override: false };
    expect(canSpinWheel({ ...base, today: "2026-11-25" })).toBe(true);
    expect(canSpinWheel({ ...base, today: "2026-11-26" })).toBe(true);
    expect(canSpinWheel({ ...base, today: "2026-11-24" })).toBe(false);
    expect(canSpinWheel({ ...base, today: "2026-11-27" })).toBe(false);
    expect(canSpinWheel({ ...base, today: "2026-11-28" })).toBe(false);
  });
  it("never lets Members or Conductors spin, even on the right day", () => {
    const base = { payattDate: "2026-11-28", today: "2026-11-26", override: true };
    expect(canSpinWheel({ ...base, role: "member" })).toBe(false);
    expect(canSpinWheel({ ...base, role: "conductor" })).toBe(false);
  });
  it("Admin test override unlocks on any day", () => {
    expect(
      canSpinWheel({ role: "admin", payattDate: "2026-11-28", today: "2026-11-01", override: true }),
    ).toBe(true);
  });
});

describe("wheel candidates", () => {
  const members = [
    { id: "a", has_conducted: false },
    { id: "b", has_conducted: true },
    { id: "c", has_conducted: false },
  ];
  it("only includes verified members who have not conducted", () => {
    const contributions = [
      { member_id: "a", month: "2026-11-01", amount: 2500, status: "verified" },
      { member_id: "b", month: "2026-11-01", amount: 2500, status: "verified" },
      { member_id: "c", month: "2026-11-01", amount: 2500, status: "pending" },
    ];
    expect(wheelCandidates(members, contributions).map((m) => m.id)).toEqual(["a"]);
  });
});

describe("independent recipient ledgers (no 50/50 split)", () => {
  const contributions = [
    { member_id: "a", event_id: "e1", month: "2026-11-01", amount: 3000, status: "verified", published: true },
    { member_id: "a", event_id: "e2", month: "2026-11-01", amount: 5000, status: "verified", published: true },
    { member_id: "b", event_id: "e1", month: "2026-11-01", amount: 2500, status: "verified", published: true },
    { member_id: "c", event_id: "e2", month: "2026-11-01", amount: 2500, status: "verified", published: false },
    { member_id: "c", event_id: "e1", month: "2026-11-01", amount: 9000, status: "pending", published: false },
  ];
  it("each recipient's total is only what members gave to that recipient", () => {
    expect(eventTotal("e1", contributions)).toBe(5500);
    expect(eventTotal("e2", contributions)).toBe(5000);
  });
  it("desk totals include verified drafts but never pending entries", () => {
    expect(eventTotal("e2", contributions, { publicOnly: false })).toBe(7500);
    expect(eventTotal("e1", contributions, { publicOnly: false })).toBe(5500);
  });
});

describe("passbook", () => {
  it("separates paid per recipient and counts received from the member's own Payattu", () => {
    const events = [
      { id: "oct", month: "2026-10-01", event_no: 1, recipient_member_id: "a" },
      { id: "nov1", month: "2026-11-01", event_no: 1, recipient_member_id: "b" },
      { id: "nov2", month: "2026-11-01", event_no: 2, recipient_member_id: null },
    ];
    const contributions = [
      { member_id: "b", event_id: "oct", month: "2026-10-01", amount: 4000, status: "verified", published: true },
      { member_id: "c", event_id: "oct", month: "2026-10-01", amount: 2500, status: "verified", published: true },
      { member_id: "a", event_id: "nov1", month: "2026-11-01", amount: 3000, status: "verified", published: true },
      { member_id: "a", event_id: "nov2", month: "2026-11-01", amount: 2500, status: "verified", published: false },
    ];
    const pb = buildPassbook("a", contributions, events);
    expect(pb.rows.map((r) => r.event_id)).toEqual(["oct", "nov1"]);
    expect(pb.totalPaid).toBe(3000);
    expect(pb.totalReceived).toBe(6500);
    expect(pb.net).toBe(-3500);
  });
});

describe("Payattu timeline", () => {
  it("October is Month 1 and November is Month 2", () => {
    expect(cycleMonthNumber("2026-10-01")).toBe(1);
    expect(cycleMonthNumber("2026-11-01")).toBe(2);
    expect(cycleMonthNumber("2027-01-01")).toBe(4);
  });
  it("October allows one Payattu, November onwards two, before October none", () => {
    expect(maxEventsForMonth("2026-10-01")).toBe(1);
    expect(maxEventsForMonth("2026-11-01")).toBe(2);
    expect(maxEventsForMonth("2026-09-01")).toBe(0);
  });
  it("lists months from October onwards, newest first", () => {
    expect(cycleMonths("2026-12-01")).toEqual(["2026-12-01", "2026-11-01", "2026-10-01"]);
  });
});

describe("flexible monthly allocation", () => {
  const ev = (event_no: number, selection_type: string, recipient_member_id: string | null = null) => ({
    month: "2026-11-01",
    event_no,
    selection_type,
    recipient_member_id,
  });
  it("allows 1+1, 2 Priority, 2 Lottery and a single Payattu", () => {
    expect(validateMonthEvents("2026-11-01", [ev(1, "priority"), ev(2, "lottery")])).toBeNull();
    expect(validateMonthEvents("2026-11-01", [ev(1, "priority"), ev(2, "priority")])).toBeNull();
    expect(validateMonthEvents("2026-11-01", [ev(1, "lottery"), ev(2, "lottery")])).toBeNull();
    expect(validateMonthEvents("2026-11-01", [ev(1, "lottery")])).toBeNull();
  });
  it("rejects a second Payattu in October", () => {
    expect(
      validateMonthEvents("2026-10-01", [ev(1, "priority"), ev(2, "lottery")]),
    ).not.toBeNull();
  });
  it("rejects the same recipient for both Payattu events", () => {
    expect(validateMonthEvents("2026-11-01", [ev(1, "priority", "x"), ev(2, "lottery", "x")])).not.toBeNull();
  });
  it("disables the draw for priority-only months", () => {
    expect(eventsNeedingDraw([ev(1, "priority", "x"), ev(2, "priority", "y")])).toHaveLength(0);
    expect(eventsNeedingDraw([ev(1, "lottery"), ev(2, "lottery")]).map((e) => e.event_no)).toEqual([1, 2]);
  });
  it("describes the month's mode", () => {
    expect(describeMonthMode([ev(1, "priority"), ev(2, "priority")])).toBe("2 Priority + 0 Lottery");
    expect(describeMonthMode([ev(1, "priority")])).toBe("Single Payattu · Priority");
  });
});

describe("member logins", () => {
  it("suggests a username from the name and slot", () => {
    expect(suggestUsername("Dr. Ismail Olayikkara", 1)).toBe("ismail01");
    expect(suggestUsername("Mr.Jaleel K", 12)).toBe("jaleel12");
  });
  it("requires new passwords of 8+ characters with letters and numbers", () => {
    expect(passwordProblem("abc123")).not.toBeNull();
    expect(passwordProblem("abcdefgh")).not.toBeNull();
    expect(passwordProblem("sauhrida26")).toBeNull();
  });
});

describe("Excel export", () => {
  it("starts with a UTF-8 BOM", () => {
    expect(toCsvWithBom(["പേര്"], [["x"]]).charCodeAt(0)).toBe(0xfeff);
  });
});

describe("desk names", () => {
  it("uses Payattu Desk 1 / 2 in English and Malayalam", () => {
    expect(deskLabel(2)).toEqual({ en: "Payattu Desk 2", ml: "പയറ്റ് ഡെസ്ക് 2" });
  });
});

describe("WhatsApp invitation", () => {
  const base = {
    monthLabel: "November 2026",
    dateLabel: "28 Nov 2026",
    time: null,
    venue: null,
    hosts: [
      { desk: 1, name: "Dr. A", type: "priority", appeal: "സഹായം പ്രതീക്ഷിക്കുന്നു" },
      { desk: 2, name: "Dr. B", type: "lottery", appeal: null },
    ],
    link: "https://example.app",
  };
  it("defaults to 3:30 PM at the College Cafeteria", () => {
    const text = buildWhatsAppInvite(base);
    expect(text).toContain("3:30 PM");
    expect(text).toContain("College Cafeteria");
  });
  it("includes both co-hosts, the appeal and the app link", () => {
    const text = buildWhatsAppInvite(base);
    expect(text).toContain("Dr. A");
    expect(text).toContain("Dr. B");
    expect(text).toContain("സഹായം പ്രതീക്ഷിക്കുന്നു");
    expect(text).toContain("https://example.app");
  });
  it("never includes the tea menu", () => {
    const text = buildWhatsAppInvite(base);
    expect(text).not.toMatch(/menu|porotta|sulaimani|പൊറോട്ട|സുലൈമാനി/i);
  });
});

describe("Live lucky wheel", () => {
  const drawAt = drawAtFromIST("2026-12-23", "15:30");
  const at = new Date(drawAt).getTime();
  const d1 = { id: "e1", month: "2026-12-01", event_no: 1, selection_type: "lottery", recipient_member_id: null };
  const d2 = { id: "e2", month: "2026-12-01", event_no: 2, selection_type: "lottery", recipient_member_id: null };

  it("stores the admin's India time as the right instant", () => {
    expect(drawAt).toBe("2026-12-23T10:00:00.000Z");
    expect(drawAtToIST(drawAt)).toEqual({ date: "2026-12-23", time: "15:30" });
  });

  it("alerts members exactly in the last 60 seconds", () => {
    const base = { drawAt, events: [d1], draws: [] };
    expect(liveDrawPhase({ ...base, now: at - 61_000 }).phase).toBe("countdown");
    expect(liveDrawPhase({ ...base, now: at - 60_000 }).phase).toBe("alert");
    expect(liveDrawPhase({ ...base, now: at }).phase).toBe("open");
  });

  it("keeps the spin locked before the scheduled time", () => {
    expect(liveSpinProblem({ now: at - 1000, drawAt, events: [d1], draws: [], eventId: "e1" })).toBe(
      "The live draw hasn't started yet",
    );
    expect(liveSpinProblem({ now: at, drawAt, events: [d1], draws: [], eventId: "e1" })).toBeNull();
  });

  it("locks the wheel for everyone once the first member spins", () => {
    const draws = [{ event_id: "e1", started_at: new Date(at + 1000).toISOString(), duration_ms: 7000 }];
    expect(liveSpinProblem({ now: at + 2000, drawAt, events: [d1, d2], draws, eventId: "e1" })).toBe(
      "The wheel is already spinning",
    );
    expect(liveDrawPhase({ now: at + 2000, drawAt, events: [d1, d2], draws }).phase).toBe("spinning");
  });

  it("opens Spin 2 for Desk 2 only after Spin 1 finishes, and never Desk 2 first", () => {
    expect(liveSpinProblem({ now: at, drawAt, events: [d1, d2], draws: [], eventId: "e2" })).toBe(
      "Spin Payattu Desk 1 first",
    );
    const won = { ...d1, recipient_member_id: "m9" };
    const draws = [{ event_id: "e1", started_at: new Date(at).toISOString(), duration_ms: 7000 }];
    const after = liveDrawPhase({ now: at + 7000, drawAt, events: [won, d2], draws });
    expect(after.phase).toBe("open");
    expect(after.target?.id).toBe("e2");
  });

  it("is done when every lottery desk has a winner", () => {
    const won = { ...d1, recipient_member_id: "m9" };
    expect(liveDrawPhase({ now: at, drawAt, events: [won], draws: [] }).phase).toBe("done");
  });
});
