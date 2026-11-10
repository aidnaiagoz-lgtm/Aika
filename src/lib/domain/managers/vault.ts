import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Менеджер паролінің шифрланған көшірмесі (CEO көруі үшін). AES-256-GCM.
 * Кілт — PASSWORD_VIEW_KEY (base64, 32 байт). Ол қойылмаса — серверлік DATABASE_URL-ден HKDF арқылы
 * шығарылады (тек серверде бар құпия). DATABASE_URL ауысса, ескі көшірмелер оқылмайды — менеджер келесі
 * кіргенде пароль қайта сақталады.
 */
function key(): Buffer | null {
  const raw = process.env.PASSWORD_VIEW_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    return k.length === 32 ? k : null;
  }
  const db = process.env.DATABASE_URL;
  if (!db) return null;
  return Buffer.from(hkdfSync("sha256", db, "automax-password-view", "v1", 32));
}

export const vaultEnabled = () => key() !== null;

export function sealPassword(plain: string): string | null {
  const k = key();
  if (!k) return null;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function openPassword(sealed: string | null | undefined): string | null {
  const k = key();
  if (!k || !sealed) return null;
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
