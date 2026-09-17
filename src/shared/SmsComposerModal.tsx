import { MessageSquare, Send, X } from 'lucide-react';
import type { SmsLanguage } from './sms';

export type SmsDraft = { recipientName:string; recipientPhone:string; message:string; title:string };

export function SmsComposerModal({draft,setDraft,onClose,onSend,sending=false,cancelLabel='Cancel',language,onLanguageChange}:{draft:SmsDraft;setDraft:(draft:SmsDraft)=>void;onClose:()=>void;onSend:()=>void;sending?:boolean;cancelLabel?:string;language?:SmsLanguage;onLanguageChange?:(language:SmsLanguage)=>void}){
  return <div className="salary-modal-overlay" onClick={onClose}>
    <div className="salary-modal" style={{width:'min(620px,94vw)'}} onClick={event=>event.stopPropagation()}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><h3 style={{display:'flex',alignItems:'center',gap:7,margin:0}}><MessageSquare size={18}/> Review SMS</h3><button className="outline mini-action" onClick={onClose} aria-label="Close"><X size={16}/></button></div>
      <p style={{color:'#64748b',fontSize:13}}>Review and edit the recipient or message before sending through TeliGateway.</p>
      <div className="simple-form">
        {language&&onLanguageChange&&<label>Message Language<select value={language} onChange={e=>onLanguageChange(e.target.value as SmsLanguage)}><option value="english">English</option><option value="kannada">ಕನ್ನಡ</option><option value="both">English + ಕನ್ನಡ</option></select></label>}
        <label>Recipient Name<input value={draft.recipientName} onChange={e=>setDraft({...draft,recipientName:e.target.value})}/></label>
        <label>Mobile Number<input value={draft.recipientPhone} onChange={e=>setDraft({...draft,recipientPhone:e.target.value})}/></label>
        <label>Message<textarea rows={7} value={draft.message} onChange={e=>setDraft({...draft,message:e.target.value})}/></label>
      </div>
      <div className="salary-modal-actions"><button className="outline" onClick={onClose}>{cancelLabel}</button><button className="primary" disabled={sending||!draft.recipientPhone.trim()||!draft.message.trim()} onClick={onSend}><Send size={14}/> {sending?'Queueing...':'Send SMS'}</button></div>
    </div>
  </div>;
}
