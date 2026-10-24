import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { SmsComposerModal, type SmsDraft } from './SmsComposerModal';
import { sendSmsViaGateway, type SmsLanguage } from './sms';
import { garmentSmsRequest } from './garmentSmsApi';

export function GarmentSmsAction({referenceType,referenceId,name,phone,format}:{referenceType:string;referenceId:string;name:string;phone?:string;format:(language:SmsLanguage)=>string}){
 const [draft,setDraft]=useState<SmsDraft|null>(null),[language,setLanguage]=useState<SmsLanguage>('english');
 const [sending,setSending]=useState(false),[notice,setNotice]=useState(''),[status,setStatus]=useState('');
 useEffect(()=>{let alive=true;setStatus('');setNotice('');setDraft(null);
  garmentSmsRequest('/api/v1/sms-settings').then(data=>{if(!alive)return;if(['english','kannada','both'].includes(data.language))setLanguage(data.language);const job=data.recentJobs?.find((j:{reference?:string})=>j.reference===`${referenceType}:${referenceId}`);if(job)setStatus(job.status);}).catch(()=>{});
  return()=>{alive=false;};
 },[referenceType,referenceId]);
 const send=async()=>{if(!draft)return;setSending(true);setNotice('');
  const result=await sendSmsViaGateway({...draft,referenceType,referenceId});setSending(false);setNotice(result.message);
  if(result.ok){setStatus('QUEUED');setDraft(null);}
 };
 return <><button type="button" className="outline" disabled={Boolean(status)} onClick={()=>setDraft({recipientName:name,recipientPhone:phone&&phone!=='-'?phone:'',message:format(language),title:referenceId})}><MessageSquare size={14}/>{status?`SMS ${status.toLowerCase().replace(/_/g,' ')}`:'Send SMS'}</button>
 {notice&&<small role="status">{notice}</small>}
 {draft&&<SmsComposerModal draft={draft} setDraft={setDraft} onClose={()=>setDraft(null)} onSend={send} sending={sending} notice={notice} language={language} onLanguageChange={lang=>{setLanguage(lang);setDraft({...draft,message:format(lang)});}}/>}
 </>;
}
