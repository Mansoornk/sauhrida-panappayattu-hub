import { queryOptions } from "@tanstack/react-query";
import { getConductorDesk, getDeskData, getMyDashboard, getSnapshot, listMemberAccounts } from "./payatt.functions";

/** Every cached copy of the signed-in snapshot (one per session token). */
export const SNAPSHOT_KEY = ["snapshot"] as const;

async function fetchSnapshot(token: string) {
  const snap = await getSnapshot({ data: { token } });
  return {
    ...snap,
    /** Members currently holding one of the 36 slots (allMembers also keeps those who left). */
    members: snap.allMembers.filter((m) => !m.removed_at),
    // Rough server-minus-device clock offset so countdowns agree across phones.
    clockOffset: snap.serverNow - Date.now(),
  };
}

export const snapshotQuery = (token: string | null) =>
  queryOptions({
    queryKey: [...SNAPSHOT_KEY, token],
    queryFn: () => fetchSnapshot(token!),
    staleTime: 30_000,
    retry: false,
  });

export const deskDataQuery = (token: string | null, month: string) =>
  queryOptions({
    queryKey: ["desk", token, month],
    queryFn: () => getDeskData({ data: { token: token!, month } }),
    enabled: !!token,
  });

export const conductorDeskQuery = (memberToken: string | null) =>
  queryOptions({
    queryKey: ["conductor-desk", memberToken],
    queryFn: () => getConductorDesk({ data: { member_token: memberToken! } }),
    enabled: !!memberToken,
  });

export const myDashboardQuery = (memberToken: string | null) =>
  queryOptions({
    queryKey: ["my-dashboard", memberToken],
    queryFn: () => getMyDashboard({ data: { token: memberToken! } }),
    enabled: !!memberToken,
    retry: false,
  });

export const memberAccountsQuery = (token: string | null) =>
  queryOptions({
    queryKey: ["member-accounts", token],
    queryFn: () => listMemberAccounts({ data: { token: token! } }),
    enabled: !!token,
  });

export type Snapshot = Awaited<ReturnType<typeof fetchSnapshot>>;
export type Member = Snapshot["allMembers"][number];
export type PayattMonth = Snapshot["months"][number];
export type PayattEvent = Snapshot["events"][number];
export type PublicContribution = Snapshot["contributions"][number];
export type TeaParty = Snapshot["teaParties"][number];
export type DeskData = Awaited<ReturnType<typeof getDeskData>>;
export type DeskContribution = DeskData["contributions"][number];
export type ConductorDesk = Awaited<ReturnType<typeof getConductorDesk>>;
export type MyDashboard = Awaited<ReturnType<typeof getMyDashboard>>;
export type LiveDraw = Snapshot["liveDraws"][number];
