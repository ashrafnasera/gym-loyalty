import "server-only";
import crypto from "node:crypto";

/**
 * جلسة العضو (Member Session)
 * -----------------------------------------------------------------------
 * الأعضاء لا يستخدمون Supabase Auth في الـ MVP (لا كلمة مرور، لا إيميل).
 * بدلاً من ذلك، بعد أول تسجيل ناجح، نضع كوكي httpOnly موقّعة بـ HMAC
 * تحمل member_id + gym_id. هذا يمنع أي طرف من "التخمين" أو تزوير هوية
 * عضو آخر عبر localStorage، وفي نفس الوقت بسيط بما يكفي لاستبداله لاحقاً
 * بتدفق OTP عبر WhatsApp دون تغيير شكل باقي النظام: يكفي أن تصدر
 * الخطوة الجديدة (التحقق من OTP) نفس نوع الكوكي بدل استدعاء
 * signMemberSession مباشرة من نموذج التسجيل.
 *
 * الصيغة: base64url(payloadJSON) + "." + base64url(hmacSha256(payloadJSON))
 */

const COOKIE_PREFIX = "gl_member_";

type MemberSessionPayload = {
  memberId: string;
  gymId: string;
  issuedAt: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET غير مضبوط أو قصير جداً. ولّده بالأمر: openssl rand -base64 32"
    );
  }
  return secret;
}

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLength), "base64");
}

export function cookieNameForGym(gymId: string): string {
  return `${COOKIE_PREFIX}${gymId}`;
}

export function signMemberSession(payload: MemberSessionPayload): string {
  const json = JSON.stringify(payload);
  const payloadB64 = base64url(Buffer.from(json, "utf8"));
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest();
  const sigB64 = base64url(signature);
  return `${payloadB64}.${sigB64}`;
}

export function verifyMemberSession(
  token: string | undefined | null
): MemberSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  const expectedSig = base64url(
    crypto.createHmac("sha256", getSecret()).update(payloadB64).digest()
  );

  const sigBuf = base64urlDecode(sigB64);
  const expectedBuf = base64urlDecode(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const json = base64urlDecode(payloadB64).toString("utf8");
    const payload = JSON.parse(json) as MemberSessionPayload;
    if (
      typeof payload.memberId !== "string" ||
      typeof payload.gymId !== "string" ||
      typeof payload.issuedAt !== "number"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export const MEMBER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // سنة
