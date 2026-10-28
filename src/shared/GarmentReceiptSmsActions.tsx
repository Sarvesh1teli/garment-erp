import type { Invoice, InvoicePayment, SalaryPayment } from './types';
import { formatSalarySms, formatPaymentReceiptSms } from './sms';
import { useCommerce } from './CommerceContext';
import { paymentBalanceHistory, paymentReceiptNumber } from './paymentReceipts';
import { GarmentSmsAction } from './GarmentSmsAction';
export function SalarySmsAction({payment,name,phone,companyName}:{payment:SalaryPayment;name:string;phone?:string;companyName:string}){
 return <GarmentSmsAction referenceType="salary" referenceId={payment.id} name={name} phone={phone} format={language=>formatSalarySms({employeeName:name,from:payment.from,to:payment.to,gross:payment.gross,recover:payment.recover,roundOffAdjustment:payment.roundOffAdjustment,netPayable:payment.netPayable,mode:payment.mode,companyName,language})}/>;
}
export function PaymentSmsAction({payment,invoice,companyName}:{payment:InvoicePayment;invoice?:Invoice;companyName:string}){
 const commerce=useCommerce();const history=invoice?paymentBalanceHistory(invoice,commerce?.payments||[payment]).find(row=>row.payment.id===payment.id):undefined;
 return <GarmentSmsAction referenceType="payment_receipt" referenceId={payment.id} name={payment.customer} phone={invoice?.customerPhone} format={language=>formatPaymentReceiptSms({customerName:payment.customer,receiptId:paymentReceiptNumber(payment),invoiceNo:payment.invoiceNo,amount:payment.amount,billedAmount:invoice?.totalAmount,balanceAfter:history?.balanceAfter,discount:payment.discount,mode:payment.mode,companyName,language})}/>;
}
