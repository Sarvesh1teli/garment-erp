import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Factory, IndianRupee, Printer, Save, Scissors, ShieldAlert, StopCircle, Users, X } from 'lucide-react';
import type { CompanySettings } from '../modules/settings/SettingsPage';
import { printPage, savePdf, API_BASE_URL } from './utils';
import { QRCodeSVG } from 'qrcode.react';
import type { Html5Qrcode } from 'html5-qrcode';

export function BarcodeImage({value,width,height,fontSize,displayValue}:{value:string;width?:number;height?:number;fontSize?:number;displayValue?:boolean}){
  const size=Math.max(width||2,1)*15;
  return <div className="barcode-image-wrap" style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:2}}>
    <QRCodeSVG value={value} size={size} level="M" includeMargin={false}/>
    {displayValue!==false&&<span style={{fontSize:fontSize||8,fontFamily:'monospace',color:'#333',wordBreak:'break-all',textAlign:'center'}}>{value}</span>}
  </div>;
}

export function playBeepSound(){
  try{
    const AudioContextClass=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    if(!AudioContextClass)return;
    const ctx=new AudioContextClass();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(880,ctx.currentTime);
    gain.gain.setValueAtTime(0.3,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime+0.15);
  }catch(e){
    console.error('Audio beep failed',e);
  }
}

export function BarcodeScannerModal({onScan,onClose}:{onScan:(code:string)=>void;onClose:()=>void}){
  const [value,setValue]=useState('');
  const [cameraOpen,setCameraOpen]=useState(false);
  const [cameraError,setCameraError]=useState('');
  const [insecure,setInsecure]=useState(false);
  const [lastScan,setLastScan]=useState('');
  const inputRef=useRef<HTMLInputElement>(null);
  const scannerRef=useRef<Html5Qrcode|null>(null);
  const readerIdRef=useRef(`barcode-reader-${Math.random().toString(36).slice(2)}`);
  const lastScanTimeRef=useRef<{code:string;time:number}|null>(null);

  useEffect(()=>{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      setInsecure(true);
      setCameraError('Camera is blocked because this page is not HTTPS. Open the app over HTTPS to scan with the camera. You can type the QR code manually below.');
    }
  },[]);

  const stopCamera=useCallback(async()=>{
    const scanner=scannerRef.current;
    scannerRef.current=null;
    if(scanner){try{await scanner.stop();scanner.clear()}catch{}}
    setCameraOpen(false);
    setCameraError('');
    if(inputRef.current)inputRef.current.focus();
  },[]);

  useEffect(()=>()=>{const s=scannerRef.current;scannerRef.current=null;if(s){s.stop().catch(()=>undefined);s.clear()}},[]);

  const handleSubmit=()=>{
    const code=value.trim();
    if(code){
      playBeepSound();
      setLastScan(`✓ Scanned: ${code} (+1)`);
      onScan(code);
      setValue('');
    }
  };

  const startCamera=async()=>{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      setInsecure(true);
      setCameraError('Camera is blocked on this connection. Open the app over HTTPS to scan with the camera.');
      return;
    }
    setInsecure(false);
    setCameraError('');
    setCameraOpen(true);
    try{
      const{Html5Qrcode}=await import('html5-qrcode');
      const scanner=new Html5Qrcode(readerIdRef.current,{verbose:false,useBarCodeDetectorIfSupported:true});
      scannerRef.current=scanner;
      const config={
        fps:15,
        qrbox:(vw:number,vh:number)=>({
          width:Math.min(360,Math.round(vw*0.9)),
          height:Math.min(320,Math.round(vh*0.75))
        })
      };
      const onScanSuccess=(decodedText:string)=>{
        const code=decodedText.trim();
        const now=Date.now();
        if(lastScanTimeRef.current&&lastScanTimeRef.current.code===code&&(now-lastScanTimeRef.current.time<1500)){
          return; // Ignore duplicate scan within 1.5s
        }
        lastScanTimeRef.current={code,time:now};
        playBeepSound();
        setLastScan(`✓ Scanned: ${code} (+1)`);
        onScan(code);
      };
      try{
        await scanner.start({facingMode:'environment'},config,onScanSuccess,()=>undefined);
      }catch{
        try{
          await scanner.start({facingMode:'user'},config,onScanSuccess,()=>undefined);
        }catch{
          const cameras=await Html5Qrcode.getCameras();
          if(cameras && cameras.length>0){
            await scanner.start(cameras[0].id,config,onScanSuccess,()=>undefined);
          }else{
            throw new Error('No video camera detected on this device.');
          }
        }
      }
    }catch(error){
      const msg=error instanceof Error?error.message:'Camera unavailable.';
      setCameraError(msg.includes('NotAllowedError')||msg.toLowerCase().includes('permission')
        ?'Camera permission was denied. Allow camera access in browser/system settings and try again.'
        :msg);
      setCameraOpen(false);
    }
  };

  return <div className="stock-modal-overlay" onClick={()=>{stopCamera();onClose()}}><article className="card measurement-form entry-modal barcode-scanner-modal" onClick={e=>e.stopPropagation()}>
  <div className="form-title"><div><h2><Camera size={18}/> Scan Barcode / QR Code</h2><p>Camera remains active for continuous scanning with BEEP sound audio feedback.</p></div><button className="outline mini-action" onClick={()=>{stopCamera();onClose()}}><X size={16}/></button></div>
  <div className="scanner-body">
    <div className="scanner-input-row">
      <div className="scanner-input-wrap">
        <input ref={inputRef} className="barcode-scan-input" value={value} placeholder="Paste QR code data or type and press Enter" autoFocus onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleSubmit()}}}/>
      </div>
      <button className="primary scanner-cam-btn" onClick={()=>void startCamera()} disabled={cameraOpen}><Camera size={16}/> {cameraOpen?'Camera Active':'Open Camera'}</button>
    </div>
    {insecure&&<div className="scanner-insecure-warning"><ShieldAlert size={14}/><div><strong>Camera needs HTTPS.</strong><br/>1. First install the certificate: <a href={`${API_BASE_URL}/cert.pem`} target="_blank" rel="noreferrer">Download cert.pem</a> — install it as trusted CA on your phone.<br/>2. Then open <strong>https://{window.location.hostname}:5173</strong><br/><span style={{color:'#81908b'}}>Camera works only on HTTPS. You can type QR codes manually below.</span></div></div>}
    {lastScan&&<div className="scanner-flash" style={{background:'#10b981',color:'#ffffff',fontWeight:700,fontSize:'14px',padding:'10px 16px',borderRadius:'8px',boxShadow:'0 4px 12px rgba(16,185,129,0.3)'}}>{lastScan}</div>}
    {cameraOpen&&<div className="scanner-active">
      <div id={readerIdRef.current} className="scanner-viewport"/>
      <div className="scanner-controls"><span className="scanner-hint">Hold tag inside square. Plays BEEP! & adds +1 per tag (1.5s cooldown).</span><button className="danger-btn" onClick={()=>void stopCamera()}><StopCircle size={14}/> Stop / Done</button></div>
    </div>}
    {cameraError&&!cameraOpen&&<div className="scanner-error"><p>{cameraError}</p></div>}
  </div>
  </article></div>}

export function Title({title,copy}:{title:string,copy:string}){return <div className="welcome"><div><p>GARMENT PRODUCTION ERP</p><h1>{title}</h1><span>{copy}</span></div></div>}
export function Stats({values,className}:{values:string[][];className?:string}){const icons=[<Users/>,<Scissors/>,<IndianRupee/>,<AlertTriangle/>];return <div className={'metrics'+(className?` ${className}`:'')}>{values.map((v,i)=><Metric key={v[0]} title={v[0]} value={v[1]} note={v[2]} icon={icons[i]} tone={['blue','purple','green','orange'][i]}/>)}</div>}
export function Table({title,copy,headers,rows,actions,paged=false,total,action}:{title:string;copy:string;headers:string[];rows:string[][];actions?:(row:string[])=>React.ReactNode;paged?:boolean;total?:string;action?:React.ReactNode}){
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(5);

  const filtered=useMemo(()=>{
    if(!search.trim())return rows;
    const q=search.toLowerCase();
    return rows.filter(r=>r.some(x=>String(x).toLowerCase().includes(q)));
  },[rows,search]);

  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const safePage=Math.min(page,pageCount);
  const visible=paged?filtered.slice((safePage-1)*pageSize,safePage*pageSize):filtered;
  useEffect(()=>{setPage(current=>Math.min(current,pageCount))},[pageCount]);

  return <article className="card jobs module-table"><div className="cardhead"><div><h2>{title}</h2><p>{copy}</p></div><div className="cardhead-actions"><input className="smallsearch" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search..."/>{action&&action}</div></div><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}{actions&&<th>ACTIONS</th>}</tr></thead><tbody>{visible.map((r:string[],idx:number)=><tr key={r[0]?`${r[0]}-${idx}`:idx}>{r.map((x:string,i:number)=>x.startsWith('data:image/')?<td key={i}><img className="table-thumb" src={x} alt=""/></td>:<td key={i}>{i===0?<strong>{x}</strong>:['Present','Completed','In Progress','Pending','Leave'].includes(x)?<span className={'status '+x.toLowerCase().replace(' ','-')}>{x}</span>:x}</td>)}{actions&&<td>{actions(r)}</td>}</tr>)}</tbody></table>{!visible.length&&<div className="empty-row">No records found</div>}{paged&&<div className="table-footer paginated-footer"><span>Showing {filtered.length?((safePage-1)*pageSize)+1:0}-{Math.min(safePage*pageSize,filtered.length)} of {filtered.length} entries{total?` · ${total}`:''}</span><div className="pager"><label>Rows<select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button className="outline" disabled={safePage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button><span>Page {safePage} / {pageCount}</span><button className="outline" disabled={safePage===pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))}>Next</button></div></div>}</article>;
}
export function Placeholder({title}:{title:string}){return <section className="content"><Title title={title} copy="This module is planned for the next implementation phase."/><article className="card empty"><Factory/><h2>{title}</h2><p>The module shell is ready.</p></article></section>}
export function Metric({title,value,note,icon,tone}:{title:string,value:string,note:string,icon:React.ReactNode,tone:string}){return <article className="metric"><div className={'metricicon '+tone}>{icon}</div><div><span>{title}</span><strong>{value}</strong><small>{note}</small></div></article>}
export function CompanyPrintHeader({company}:{company:CompanySettings}){return <div className="doc-company company-print-header clean-header">{company.logo&&<img className="company-logo-left" src={company.logo} alt="Garment logo"/>}<div className="garment-text"><h2>{company.name||'Teli Apparels'}</h2>{company.address&&<p>{company.address}</p>}<p>{company.gst&&`GSTIN: ${company.gst}`}{company.gst&&company.phone?' | ':''}{company.phone&&`Phone: ${company.phone}`}</p></div></div>}
export function CompanyReceiptHeader({company}:{company:CompanySettings}){return <div className="full-row receipt-company company-receipt-header">{company.logo&&<img src={company.logo} alt="Garment logo"/>}<div><strong>{company.name||'Garment'}</strong><span>{company.gst&&`GST / GT: ${company.gst}`}{company.gst&&company.phone?' | ':''}{company.phone&&`Phone: ${company.phone}`}</span>{company.address&&<small>{company.address}</small>}</div></div>}
export function SalaryPrintHeader({company}:{company:CompanySettings}){return <div className="doc-company company-print-header salary-print-header"><div className="salary-left-logo">{company.logo&&<img className="salary-garment-logo" src={company.logo} alt="Teli Apparels logo"/>}</div><div className="salary-garment-text"><h2>{company.name||'Garment Name'}</h2>{company.address&&<p>{company.address}</p>}<p>{company.gst&&`GSTIN: ${company.gst}`}{company.gst&&company.phone?' | ':''}{company.phone&&`Phone: ${company.phone}`}</p></div></div>}
export function GarmentPrintHeader({company,garment}:{company:CompanySettings;garment?:string}){return <div className="doc-company company-print-header garment-print-header clean-header">{company.logo&&<img className="company-logo-left" src={company.logo} alt="Garment logo"/>}<div className="garment-text"><h2>{company.name||garment||'Teli Apparels'}</h2>{company.address&&<p>{company.address}</p>}<p>{company.gst&&`GSTIN: ${company.gst}`}{company.gst&&company.phone?' | ':''}{company.phone&&`Phone: ${company.phone}`}</p></div></div>}
export function SalaryPrintFooter(){return <div className="salary-print-footer"><img className="footer-threadflow-logo" src="./threadflow-logo.png" alt="ThreadFlow logo"/><div className="footer-text"><span>Powered by <strong>Teli Threadflow</strong></span><span>Contact: 9880306309</span></div></div>}
export function PrintPreview({doc,onClose,extra}:{doc:React.ReactNode;onClose:()=>void;extra?:React.ReactNode}){return <div className="print-preview-overlay"><div className="print-preview-shell invoice-preview"><div className="preview-actions"><button className="primary" onClick={printPage}><Printer size={16}/> Print</button><button className="outline" onClick={()=>savePdf()}><Save size={16}/> Save PDF</button>{extra}<button className="outline" onClick={onClose}>Cancel</button></div>{doc}</div></div>}
