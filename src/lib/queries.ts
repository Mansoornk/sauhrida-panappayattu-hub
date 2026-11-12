import { queryOptions } from "@tanstack/react-query";
import { getDeskData, getMyDashboard, getPublicSnapshot, listMemberAccounts } from "./payatt.functions";

export const publicSnapshotQuery = queryOptions({
  queryKey: ["public-snapshot"],
  queryFn: async () => {
    const snap = await getPublicSnapshot();
    // Rough server-minus-device clock offset so countdowns agree across phones.
    return { ...snap, clockOffset: snap.serverNow - Date.now() };
  },
  staleTime: 30_000,
});

export const deskDataQuery = (token: string | null, month: string) =>
  queryOptions({
    queryKey: ["desk", token, month],
    queryFn: () => getDeskData({ data: { token: token!, month } }),
    enabled: !!token,
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

export type PublicSnapshot = Awaited<ReturnType<typeof getPublicSnapshot>> & { clockOffset: number };
export type Member = PublicSnapshot["members"][number];
export type PayattMonth = PublicSnapshot["months"][number];
export type PayattEvent = PublicSnapshot["events"][number];
export type PublicContribution = PublicSnapshot["contributions"][number];
export type TeaParty = PublicSnapshot["teaParties"][number];
export type DeskData = Awaited<ReturnType<typeof getDeskData>>;
export type DeskContribution = DeskData["contributions"][number];
export type MyDashboard = Awaited<ReturnType<typeof getMyDashboard>>;
export type LiveDraw = PublicSnapshot["liveDraws"][number];
