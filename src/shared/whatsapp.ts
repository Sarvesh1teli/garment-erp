import type { Invoice, InvoicePayment } from "./types";
import type { CompanySettings } from "../modules/settings/SettingsPage";

export function cleanPhoneForWhatsApp(phone: string): string {
  let cleaned = (phone || "").replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  // If 10 digits (standard Indian number), prefix 91
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
}

export function openWhatsApp({ phone, message }: { phone?: string; message: string }) {
  const cleanedPhone = cleanPhoneForWhatsApp(phone || "");
  const encodedText = encodeURIComponent(message);
  let url = `https://wa.me/?text=${encodedText}`;
  if (cleanedPhone) {
    url = `https://wa.me/${cleanedPhone}?text=${encodedText}`;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function formatOrderWhatsAppMessage(
  order: any,
  overrideStatus?: string,
  extraRemarks?: string,
  companyName: string = "Your Business"
): string {
  const status = overrideStatus || order.status || "Received";
  const orderRef = order.orderNo || order.schoolOrderId || order.id || "N/A";
  const schoolName = order.schoolName || order.customer || "Valued School / Customer";
  
  const statusEmoji: Record<string, string> = {
    Received: "🟡 RECEIVED",
    Accepted: "🟢 ACCEPTED",
    Quoted: "💰 QUOTATION SENT",
    "In Production": "✂️ IN PRODUCTION",
    Dispatched: "🚚 DISPATCHED",
    Delivered: "✅ DELIVERED",
    Cancelled: "❌ CANCELLED",
  };

  const statusHeader = statusEmoji[status] || `📋 ${status.toUpperCase()}`;

  let itemsList = "";
  if (Array.isArray(order.items) && order.items.length > 0) {
    itemsList = order.items
      .map((item: any) => `• ${item.dressColour || item.item || "Uniform"} (${item.size || "Standard"}): ${item.quantity || item.qty} pcs`)
      .join("\n");
  } else if (order.itemsSummary) {
    itemsList = `• ${order.itemsSummary}`;
  } else {
    itemsList = `• ${order.totalItemsCount || 0} pcs Uniform Order`;
  }

  const amountText = order.totalAmount && order.totalAmount > 0 
    ? `Rs. ${Number(order.totalAmount).toLocaleString("en-IN")}` 
    : "Pending Quotation";

  let statusDetails = "";
  if (status === "Accepted") {
    statusDetails = `📅 *Target Delivery Date:* ${order.requiredDeliveryDate || "As agreed"}\n🧵 Fabric cutting & stitching initiated.`;
  } else if (status === "Quoted") {
    statusDetails = `💰 *Quoted Amount:* ${amountText}\n📌 Please review & approve in School ERP.`;
  } else if (status === "In Production") {
    statusDetails = `✂️ *Production Progress:* Uniforms are in cutting & stitching line.`;
  } else if (status === "Dispatched") {
    statusDetails = `🚚 *Dispatch Notice:* Items have been packed and dispatched via courier.`;
  } else if (status === "Delivered") {
    statusDetails = `✅ *Delivery Completed:* Items have been delivered. Please verify size & count.`;
  } else if (status === "Cancelled") {
    statusDetails = `❌ *Reason:* ${extraRemarks || order.remarks || "Order could not be processed."}`;
  }

  return `*${companyName.toUpperCase()} - UNIFORM ORDER UPDATE* 🧵
━━━━━━━━━━━━━━━━━━━━━
🏫 *School:* ${schoolName}
📦 *Order Ref:* #${orderRef}
📊 *Status:* ${statusHeader}

👗 *Items Breakdown:*
${itemsList}

📊 *Total Quantity:* ${order.totalItemsCount || order.totalQuantity || "N/A"} pcs
💰 *Total Amount:* ${amountText}
${statusDetails ? `\n${statusDetails}\n` : ""}
━━━━━━━━━━━━━━━━━━━━━
_Powered by ${companyName} Garment ERP_`;
}

export function formatInvoiceWhatsAppMessage(invoice: Invoice, company?: CompanySettings): string {
  const compName = company?.name || "Your Business";
  const cgst = ((invoice.taxableAmount || 0) * (invoice.cgst || 0)) / 100;
  const sgst = ((invoice.taxableAmount || 0) * (invoice.sgst || 0)) / 100;
  const totalGst = cgst + sgst;

  let breakdownText = "";
  if (invoice.items && invoice.items.length > 0) {
    const activeItems = invoice.items.filter(i => i.qty > 0);
    if (activeItems.length > 0) {
      breakdownText = `• *Items Breakdown:*\n` +
        activeItems.map(i => `   ▫ ${i.garment} (${i.size}) × ${i.qty} pcs @ Rs. ${i.rate}`).join("\n") + "\n";
    }
  }

  return `*TAX INVOICE* 🧾
*${compName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━
📄 *Invoice No:* ${invoice.invoiceNo}
📅 *Date:* ${invoice.invoiceDate}
👤 *Billed To:* ${invoice.customer}
${invoice.customerPhone ? `📱 *Mobile:* ${invoice.customerPhone}\n` : ""}${invoice.customerAddress ? `📍 *Address:* ${invoice.customerAddress}\n` : ""}
📦 *Product Details:*
• *Product:* ${invoice.product}
• *Total Quantity:* ${invoice.qty} ${invoice.unit || "PCS"}
• *Rate:* Rs. ${Number(invoice.rate).toLocaleString("en-IN")}
${breakdownText}• *Taxable Value:* Rs. ${Number(invoice.taxableAmount).toLocaleString("en-IN")}
${totalGst > 0 ? `• *GST:* Rs. ${Number(totalGst).toLocaleString("en-IN")}\n` : ""}💰 *TOTAL INVOICE AMOUNT:* *Rs. ${Number(invoice.totalAmount).toLocaleString("en-IN")}*
📊 *Status:* ${invoice.status || "Pending"}

━━━━━━━━━━━━━━━━━━━━━
_Thank you for your business!_
_${compName} · Support: ${company?.phone || "9880306309"}_`;
}

export function formatPaymentReceiptWhatsAppMessage(
  payment: InvoicePayment,
  invoice?: Invoice,
  company?: CompanySettings
): string {
  const compName = company?.name || "Your Business";
  const invTotal = invoice ? `\n📄 *Invoice Total:* Rs. ${Number(invoice.totalAmount).toLocaleString("en-IN")}` : "";

  return `*PAYMENT RECEIPT* 💳
*${compName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━
🧾 *Receipt ID:* ${payment.id}
📅 *Date:* ${payment.date}
👤 *Customer / School:* ${payment.customer}
📄 *Against Invoice:* ${payment.invoiceNo}
💵 *Payment Mode:* ${payment.mode}
💰 *AMOUNT RECEIVED:* *Rs. ${Number(payment.amount).toLocaleString("en-IN")}*${invTotal}
${payment.reference && payment.reference !== "-" ? `🔖 *Ref / Cheque / UTR:* ${payment.reference}\n` : ""}${payment.remarks && payment.remarks !== "-" ? `📝 *Remarks:* ${payment.remarks}\n` : ""}
✅ *Payment received with thanks!*
━━━━━━━━━━━━━━━━━━━━━
_${compName} · Support: ${company?.phone || "9880306309"}_`;
}
