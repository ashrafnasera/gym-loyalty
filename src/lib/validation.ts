import { z } from "zod";

export const uuidSchema = z.string().uuid();

/** يزيل كل شيء إلا الأرقام و + في البداية، لتوحيد شكل رقم الواتساب كمفتاح تطابق. */
export function normalizeWhatsapp(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export const checkinBodySchema = z.object({
  gymId: uuidSchema,
  name: z.string().trim().min(2, "الاسم قصير جداً").max(100).optional(),
  whatsapp: z
    .string()
    .trim()
    .min(7, "رقم واتساب غير صالح")
    .max(20, "رقم واتساب غير صالح")
    .optional(),
  subscriptionEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ يجب أن تكون YYYY-MM-DD")
    .optional()
    .nullable(),
});

export const redeemBodySchema = z.object({
  gymId: uuidSchema,
  rewardId: uuidSchema,
});
