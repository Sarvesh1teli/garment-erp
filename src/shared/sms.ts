import type { CompanySettings } from "../modules/settings/SettingsPage";

import { API_BASE_URL, getStoredTenantId } from "./utils";

export type SmsLanguage = "english" | "kannada" | "both";

export async function sendSmsViaGateway({
  recipientName,
  recipientPhone,
  message,
  referenceType = "manual",
  referenceId = "",
}: {
  recipientName: string;
  recipientPhone: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": getStoredTenantId() },
      body: JSON.stringify({
        recipientName,
        recipientPhone,
        message,
        referenceType,
        referenceId,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to enqueue SMS");
    return { ok: true, message: data.message || "SMS queued successfully for delivery via TeliGateway!" };
  } catch (err: any) {
    return { ok: false, message: err.message || "Could not connect to SMS server" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SALARY SLIP TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
export function formatSalarySms({
  employeeName,
  from,
  to,
  gross,
  recover,
  roundOffAdjustment = 0,
  netPayable,
  mode,
  companyName = "Your Business",
  language = "english",
}: {
  employeeName: string;
  from: string;
  to: string;
  gross: number;
  recover: number;
  roundOffAdjustment?: number;
  netPayable: number;
  mode: string;
  companyName?: string;
  language?: SmsLanguage;
}): string {
  const g = gross.toLocaleString("en-IN");
  const r = recover.toLocaleString("en-IN");
  const ro = roundOffAdjustment.toLocaleString("en-IN", { signDisplay: "always" });
  const n = netPayable.toLocaleString("en-IN");

  const roundText = roundOffAdjustment ? `, Round Off: Rs.${ro}` : '';
  const roundTextKn = roundOffAdjustment ? `, ರೌಂಡ್ ಆಫ್: ರೂ.${ro}` : '';
  const en = `Dear ${employeeName}, your salary for ${from} to ${to} is generated. Gross: Rs.${g}, Adv Deducted: Rs.${r}${roundText}, Net Paid: Rs.${n} via ${mode}. - ${companyName}`;
  const kn = `ಆತ್ಮೀಯ ${employeeName}, ${from} ರಿಂದ ${to} ರವರೆಗಿನ ನಿಮ್ಮ ವೇತನ: ಒಟ್ಟು: ರೂ.${g}, ಮುಂಗಡ ಕಡಿತ: ರೂ.${r}${roundTextKn}, ನಿವ್ವಳ ಪಾವತಿ: ರೂ.${n} (${mode} ಮೂಲಕ). - ${companyName}`;

  if (language === "kannada") return kn;
  if (language === "both") return `${en}\n\n[ಕನ್ನಡ ವಿವರ]:\n${kn}`;
  return en;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STOCK OUT / DISPATCH TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
export function formatStockOutSms({
  partyName,
  date,
  garment,
  size,
  count,
  challanNo,
  companyName = "Your Business",
  language = "english",
}: {
  partyName: string;
  date: string;
  garment: string;
  size: string;
  count: number;
  challanNo?: string;
  companyName?: string;
  language?: SmsLanguage;
}): string {
  const ref = challanNo ? ` (Ref #${challanNo})` : "";
  const en = `Dear ${partyName}, ${count} pcs ${garment} (Size ${size}) has been dispatched/issued${ref} from ${companyName} on ${date}. - ${companyName}`;
  const kn = `ಆತ್ಮೀಯ ${partyName}, ${count} ಸಂಖ್ಯೆಯ ${garment} (ಅಳತೆ ${size}) ${companyName} ನಿಂದ ದಿನಾಂಕ ${date} ರಂದು ರವಾನಿಸಲಾಗಿದೆ. - ${companyName}`;

  if (language === "kannada") return kn;
  if (language === "both") return `${en}\n\n[ಕನ್ನಡ ವಿವರ]:\n${kn}`;
  return en;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INVOICE & PAYMENT RECEIPT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
export function formatPaymentReceiptSms({
  customerName,
  receiptId,
  invoiceNo,
  amount,
  mode,
  companyName = "Your Business",
  language = "english",
}: {
  customerName: string;
  receiptId: string;
  invoiceNo: string;
  amount: number;
  mode: string;
  companyName?: string;
  language?: SmsLanguage;
}): string {
  const amt = amount.toLocaleString("en-IN");
  const en = `Dear ${customerName}, Payment of Rs.${amt} received against Inv #${invoiceNo} (Receipt #${receiptId}) via ${mode}. Thank you! - ${companyName}`;
  const kn = `ಆತ್ಮೀಯ ${customerName}, ಇನ್‌ವಾಯ್ಸ್ #${invoiceNo} ಗಾಗಿ ರೂ.${amt} ಪಾವತಿ (${mode} ಮೂಲಕ) ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ರಸೀದಿ #${receiptId}. ಧನ್ಯವಾದಗಳು! - ${companyName}`;

  if (language === "kannada") return kn;
  if (language === "both") return `${en}\n\n[ಕನ್ನಡ ವಿವರ]:\n${kn}`;
  return en;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. UNIFORM ORDER STATUS TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
export function formatOrderStatusSms({
  schoolName,
  orderRef,
  status,
  totalQty,
  totalAmount,
  deliveryDate,
  remarks,
  companyName = "Your Business",
  language = "english",
}: {
  schoolName: string;
  orderRef: string;
  status: string;
  totalQty?: number;
  totalAmount?: number;
  deliveryDate?: string;
  remarks?: string;
  companyName?: string;
  language?: SmsLanguage;
}): string {
  let enStatus = status.toUpperCase();
  let knStatus = "ಸ್ವೀಕರಿಸಲಾಗಿದೆ";
  if (status === "Accepted") knStatus = "ಅಂಗೀಕರಿಸಲಾಗಿದೆ";
  if (status === "Quoted") knStatus = "ಕೊಟೇಶನ್ ಕಳುಹಿಸಲಾಗಿದೆ";
  if (status === "In Production") knStatus = "ಉತ್ಪಾದನೆಯಲ್ಲಿದೆ";
  if (status === "Dispatched") knStatus = "ರವಾನಿಸಲಾಗಿದೆ";
  if (status === "Delivered") knStatus = "ವಿತರಿಸಲಾಗಿದೆ";
  if (status === "Cancelled") knStatus = "ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ";

  const en = `Dear ${schoolName}, Uniform Order #${orderRef} (${totalQty || 0} pcs) status is ${enStatus}.${deliveryDate ? ` Delivery by: ${deliveryDate}.` : ""} - ${companyName}`;
  const kn = `ಆತ್ಮೀಯ ${schoolName}, ಸಮವಸ್ತ್ರ ಆರ್ಡರ್ #${orderRef} (${totalQty || 0} ತುಂಡುಗಳು) ಸ್ಥಿತಿ: ${knStatus}.${deliveryDate ? ` ನಿಗದಿತ ದಿನಾಂಕ: ${deliveryDate}.` : ""} - ${companyName}`;

  if (language === "kannada") return kn;
  if (language === "both") return `${en}\n\n[ಕನ್ನಡ]:\n${kn}`;
  return en;
}
