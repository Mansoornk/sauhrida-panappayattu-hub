// Server-only: Admin PIN hashing, signed tokens and member passwords.
const enc = new TextEncoder();

export type StaffRole = "admin";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function hashPin(role: StaffRole, pin: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${role}:${pin}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env["PAYATT_SESSION_SECRET"];
  if (!secret) throw new Error("Session secret is not configured");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signToken(role: StaffRole): Promise<{ token: string; exp: number }> {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = b64url(enc.encode(JSON.stringify({ role, exp })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return { token: `${payload}.${b64url(sig)}`, exp };
}

export async function verifyToken(token: string | undefined | null): Promise<StaffRole | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    fromB64url(sig) as BufferSource,
    enc.encode(payload),
  );
  if (!ok) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      role: StaffRole;
      exp: number;
    };
    if (data.exp < Date.now()) return null;
    if (data.role !== "admin") return null;
    return data.role;
  } catch {
    return null;
  }
}

/* ---------------- Member passwords & sessions ---------------- */

const PBKDF2_ITERATIONS = 100_000; // Workers' WebCrypto cap

export async function hashPassword(password: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? fromB64url(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return { hash: b64url(new Uint8Array(bits)), salt: b64url(salt) };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

/** Easy-to-read temporary password: 5 letters + 3 digits, e.g. "kpmwt482". */
export function generateTempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  bytes.forEach((b, i) => {
    out += i < 5 ? letters[b % letters.length] : digits[b % digits.length];
  });
  return out;
}

const MEMBER_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function signMemberToken(memberId: string, version: number): Promise<{ token: string; exp: number }> {
  const exp = Date.now() + MEMBER_TOKEN_TTL_MS;
  const payload = b64url(enc.encode(JSON.stringify({ role: "member", mid: memberId, v: version, exp })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return { token: `${payload}.${b64url(sig)}`, exp };
}

/** Returns the member id and session version if the signature and expiry are valid. */
export async function verifyMemberToken(
  token: string | undefined | null,
): Promise<{ memberId: string; version: number } | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig) as BufferSource, enc.encode(payload));
  if (!ok) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      role: string;
      mid: string;
      v: number;
      exp: number;
    };
    if (data.role !== "member" || data.exp < Date.now() || typeof data.mid !== "string") return null;
    return { memberId: data.mid, version: data.v };
  } catch {
    return null;
  }
}

export async function requireRole(token: string | undefined, allowed: StaffRole[]): Promise<StaffRole> {
  const role = await verifyToken(token);
  if (!role || !allowed.includes(role)) {
    throw new Error("Your desk session has expired. Please log in again.");
  }
  return role;
}
