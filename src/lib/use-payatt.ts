import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { snapshotQuery, type PayattEvent, type PayattMonth } from "./queries";
import { useRole } from "./role-context";
import { addMonths, cycleMonths, CYCLE_START_MONTH, eventTotal, monthKeyOf, todayIST } from "./payatt-rules";

/** Signed-in snapshot. Only rendered inside the signed-in app shell, so a viewer token is always present. */
export function useSnapshot() {
  const { viewerToken } = useRole();
  return useSuspenseQuery(snapshotQuery(viewerToken)).data;
}

/** The current calendar month's Payatt, or the most recent one. */
export function useActiveMonth(): { monthKey: string; month: PayattMonth | null; today: string } {
  const { months } = useSnapshot();
  return useMemo(() => {
    const today = todayIST();
    const current = monthKeyOf(today);
    const month = months.find((m) => m.month === current) ?? months[0] ?? null;
    return { monthKey: month?.month ?? current, month, today };
  }, [months]);
}

/** Every member ever on the roster (including those who left a slot), so past ledgers keep their names. */
export function useMemberMap() {
  const { allMembers } = useSnapshot();
  return useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers]);
}

/** Payattu events of one month, in Payattu-number order. */
export function useMonthEvents(monthKey: string): PayattEvent[] {
  const { events } = useSnapshot();
  return useMemo(
    () => events.filter((e) => e.month === monthKey).sort((a, b) => a.event_no - b.event_no),
    [events, monthKey],
  );
}

/** Published total collected by each recipient, keyed by event id. */
export function useEventTotals(): Map<string, number> {
  const { events, contributions } = useSnapshot();
  return useMemo(() => new Map(events.map((e) => [e.id, eventTotal(e.id, contributions)])), [events, contributions]);
}

/** Every month of the scheme from October up to next month (newest first). */
export function useCycleMonthOptions(): string[] {
  const { months } = useSnapshot();
  return useMemo(() => {
    const next = addMonths(monthKeyOf(todayIST()), 1);
    const latest = months.reduce((a, m) => (m.month > a ? m.month : a), next);
    return cycleMonths(latest < CYCLE_START_MONTH ? CYCLE_START_MONTH : latest);
  }, [months]);
}
