// Server-only Web Push (RFC 8291 payload encryption + RFC 8292 VAPID) on WebCrypto.
// The VAPID key pair is derived from the VAPID_SEED secret, so no key files are stored.
const enc = new TextEncoder();

/* ---------- P-256 point math (only used once per worker to derive the public key) ---------- */
const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const GX = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n;
const GY = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n;
type Pt = { x: bigint; y: bigint } | null;
const mod = (a: bigint, m = P) => ((a % m) + m) % m;
function inv(a: bigint): bigint {
  let r = 1n, b = mod(a), e = P - 2n;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % P;
    b = (b * b) % P;
    e >>= 1n;
  }
  return r;
}
function add(p: Pt, q: Pt): Pt {
  if (!p) return q;
  if (!q) return p;
  if (p.x === q.x && mod(p.y + q.y) === 0n) return null;
  const l = p.x === q.x ? mod(3n * p.x * p.x - 3n) * inv(2n * p.y) : mod(q.y - p.y) * inv(q.x - p.x);
  const x = mod(l * l - p.x - q.x);
  return { x, y: mod(l * (p.x - x) - p.y) };
}
function mul(k: bigint): Pt {
  let r: Pt = null, a: Pt = { x: GX, y: GY };
  while (k > 0n) {
    if (k & 1n) r = add(r, a);
    a = add(a, a);
    k >>= 1n;
  }
  return r;
}
const toBytes32 = (n: bigint) => Uint8Array.from(n.toString(16).padStart(64, "0").match(/../g)!.map((h) => parseInt(h, 16)));
const toBig = (b: Uint8Array) => BigInt("0x" + [...b].map((x) => x.toString(16).padStart(2, "0")).join(""));

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

type Vapid = { publicKey: string; d: Uint8Array; x: Uint8Array; y: Uint8Array };
let cached: { seed: string; keys: Vapid } | null = null;

/** VAPID key pair derived from a secret seed. Same seed → same keys. */
export async function vapidKeysFromSeed(seed: string): Promise<Vapid> {
  if (cached?.seed === seed) return cached.keys;
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`payatt-vapid:${seed}`)));
  const dNum = (toBig(h) % (N - 1n)) + 1n;
  const pub = mul(dNum)!;
  const d = toBytes32(dNum), x = toBytes32(pub.x), y = toBytes32(pub.y);
  const keys = { publicKey: b64url(concat(Uint8Array.of(4), x, y)), d, x, y };
  cached = { seed, keys };
  return keys;
}

export async function getVapidKeys(): Promise<Vapid> {
  const seed = process.env["VAPID_SEED"];
  if (!seed) throw new Error("Phone alerts are not configured");
  return vapidKeysFromSeed(seed);
}

async function vapidAuthHeader(endpoint: string, keys: Vapid, subject: string): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: b64url(keys.d), x: b64url(keys.x), y: b64url(keys.y), ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

/** RFC 8291 "aes128gcm" body for one subscription. */
export async function encryptPayload(payload: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPublic = fromB64url(p256dh);
  const authSecret = fromB64url(auth);
  const eph = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, Uint8Array.of(1)));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), Uint8Array.of(1)))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), Uint8Array.of(1)))).slice(0, 12);
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aes, concat(enc.encode(payload), Uint8Array.of(2)) as BufferSource),
  );
  const rs = Uint8Array.of(0, 0, 16, 0); // 4096
  return concat(salt, rs, Uint8Array.of(asPublic.length), asPublic, cipher);
}

export type PushTarget = { endpoint: string; p256dh: string | null; auth: string | null };

/** Sends one notification. Returns the push service's HTTP status (404/410 = subscription gone). */
export async function sendPush(
  sub: PushTarget,
  message: { title: string; body: string; url: string },
  opts: { subject: string; ttlSeconds?: number },
): Promise<number> {
  const keys = await getVapidKeys();
  const headers: Record<string, string> = {
    Authorization: await vapidAuthHeader(sub.endpoint, keys, opts.subject),
    TTL: String(opts.ttlSeconds ?? 120),
    Urgency: "high",
    Topic: "live-draw",
  };
  let body: Uint8Array | undefined;
  if (sub.p256dh && sub.auth) {
    body = await encryptPayload(JSON.stringify(message), sub.p256dh, sub.auth);
    headers["Content-Encoding"] = "aes128gcm";
    headers["Content-Type"] = "application/octet-stream";
  }
  const res = await fetch(sub.endpoint, { method: "POST", headers, body: (body ?? null) as BodyInit | null });
  return res.status;
}
