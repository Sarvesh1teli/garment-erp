import type { Invoice } from './types';
import type { SmsLanguage } from './sms';
import { GarmentSmsAction } from './GarmentSmsAction';
export function GarmentInvoiceSmsButton({invoice,companyName}:{invoice:Invoice;companyName:string}){
  const text=(lang:SmsLanguage)=>{
    const items=invoice.items?.length?invoice.items:[{garment:invoice.product,size:'',qty:invoice.qty}];
    const list=items.slice(0,3).map(i=>`${i.garment}${i.size?` (${i.size})`:''} x ${i.qty} ${invoice.unit||'PCS'}`).join(', ');
    const more=Math.max(0,items.length-3);
    const en=`${companyName}: Invoice ${invoice.invoiceNo}, ${invoice.invoiceDate}. Items: ${list}${more?`, +${more} more items`:''}. Total Rs.${invoice.totalAmount.toFixed(2)}. Thank you.`;
    const kn=`${companyName}: ಬಿಲ್ ${invoice.invoiceNo}, ${invoice.invoiceDate}. ಉತ್ಪನ್ನಗಳು: ${list}${more?`, ಇನ್ನೂ ${more} ಉತ್ಪನ್ನಗಳು`:''}. ಒಟ್ಟು ರೂ.${invoice.totalAmount.toFixed(2)}. ಧನ್ಯವಾದಗಳು.`;
    return lang==='kannada'?kn:lang==='both'?en+'\n\n'+kn:en;
  };
 return <GarmentSmsAction referenceType="invoice" referenceId={invoice.invoiceNo} name={invoice.customer} phone={invoice.customerPhone} format={text}/>;
}
