import { useCommerce } from './CommerceContext';
import { displayDate } from './dateDisplay';
import type { Invoice } from './types';
import { smsText, type SmsLanguage } from './sms';
import { GarmentSmsAction } from './GarmentSmsAction';
export function GarmentInvoiceSmsButton({invoice,companyName}:{invoice:Invoice;companyName:string}){
  const commerce=useCommerce();
  const payments=(commerce?.payments||[]).filter(row=>row.invoiceNo===invoice.invoiceNo);
  const paid=payments.reduce((sum,row)=>sum+Number(row.amount||0),0);
  const discount=payments.reduce((sum,row)=>sum+Number(row.discount||0),0);
  const pending=Math.max(0,invoice.totalAmount-paid-discount);
  const text=(lang:SmsLanguage)=>{
    const items=invoice.items?.length?invoice.items:[{garment:invoice.product,size:'',qty:invoice.qty}];
    const list=items.slice(0,3).map(i=>`${i.garment}${i.size?` (${i.size})`:''} x ${i.qty} ${invoice.unit||'PCS'}`).join(', ');
    const more=Math.max(0,items.length-3);
    const en=`${companyName}: Invoice ${invoice.invoiceNo}, ${displayDate(invoice.invoiceDate)}. Items: ${list}${more?`, +${more} more items`:''}. Total Rs.${invoice.totalAmount.toFixed(2)}. Paid Rs.${paid.toFixed(2)}. Pending Rs.${pending.toFixed(2)}. Thank you.`;
    const kn=`${companyName}: ಬಿಲ್ ${invoice.invoiceNo}, ${displayDate(invoice.invoiceDate)}. ಉತ್ಪನ್ನಗಳು: ${list}${more?`, ಇನ್ನೂ ${more} ಉತ್ಪನ್ನಗಳು`:''}. ಒಟ್ಟು ರೂ.${invoice.totalAmount.toFixed(2)}. ಪಾವತಿ ರೂ.${paid.toFixed(2)}. ಬಾಕಿ ರೂ.${pending.toFixed(2)}. ಧನ್ಯವಾದಗಳು.`;
    const hi=`${companyName}: बिल ${invoice.invoiceNo}, ${displayDate(invoice.invoiceDate)}. वस्तुएं: ${list}${more?`, और ${more} वस्तुएं`:''}. कुल रु.${invoice.totalAmount.toFixed(2)}. भुगतान रु.${paid.toFixed(2)}. बाकी रु.${pending.toFixed(2)}. धन्यवाद.`;
    return smsText(lang,en,kn,hi);
  };
 return <GarmentSmsAction referenceType="invoice" referenceId={invoice.invoiceNo} name={invoice.customer} phone={invoice.customerPhone} format={text}/>;
}
