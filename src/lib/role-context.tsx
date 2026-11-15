import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "./payatt-rules";

type Session = { role: "admin"; token: string; exp: number };
export type MemberSession = { token: string; exp: number; memberId: string; name: string; mustChange: boolean };

type RoleContextValue = {
  role: Role;
  token: string | null;
  ready: boolean;
  setSession: (s: Session) => void;
  logout: () => void;
  /** Signed-in member (username + password), independent of the staff PIN session. */
  member: MemberSession | null;
  setMember: (s: MemberSession) => void;
  logoutMember: () => void;
  /** Token that unlocks the main pages: the Admin's, or a member's once they've set their own password. */
  viewerToken: string | null;
};

const KEY = "payatt-desk-session";
const MEMBER_KEY = "payatt-member-session";
const RoleContext = createContext<RoleContextValue | null>(null);

function load<T extends { exp: number }>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as T;
    if (s.exp > Date.now()) return s;
  } catch {
    // fall through
  }
  localStorage.removeItem(key);
  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [member, setMemberState] = useState<MemberSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const staff = load<Session>(KEY);
    // Old Conductor PIN sessions are no longer valid: conductors now sign in as members.
    if (staff && staff.role !== "admin") localStorage.removeItem(KEY);
    setSessionState(staff?.role === "admin" ? staff : null);
    setMemberState(load<MemberSession>(MEMBER_KEY));
    setReady(true);
  }, []);

  const setSession = useCallback((s: Session) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    setSessionState(s);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setSessionState(null);
  }, []);

  const setMember = useCallback((s: MemberSession) => {
    localStorage.setItem(MEMBER_KEY, JSON.stringify(s));
    setMemberState(s);
  }, []);

  const logoutMember = useCallback(() => {
    localStorage.removeItem(MEMBER_KEY);
    setMemberState(null);
  }, []);

  return (
    <RoleContext.Provider
      value={{
        role: session?.role ?? "member",
        token: session?.token ?? null,
        ready,
        setSession,
        logout,
        member,
        setMember,
        logoutMember,
        viewerToken: session?.token ?? (member && !member.mustChange ? member.token : null),
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
