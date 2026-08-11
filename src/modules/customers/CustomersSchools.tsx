import { useEffect, useState } from 'react';
import type React from 'react';
import { Eye, Factory, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Table } from '../../shared/ui';
import type { DressVersion, School } from '../../shared/types';
import { assetUrl, uploadSchoolMedia } from '../../shared/api';

const academicYear=()=>{const d=new Date();const y=d.getFullYear();return d.getMonth()>=3?`${y}-${String(y+1).slice(2)}`:`${y-1}-${String(y).slice(2)}`};
const activeDress=(s:School):DressVersion=>s.dressVersions[s.dressVersions.length-1]||{id:'',year:'',note:'',date:'',boysPhotos:[],girlsPhotos:[]};

export function CustomersSchools({customers,setCustomers,schools,setSchools}:{customers:string[][];setCustomers:React.Dispatch<React.SetStateAction<string[][]>>;schools:School[];setSchools:React.Dispatch<React.SetStateAction<School[]>>}){
  const nextSchoolId=()=>{const max=schools.reduce((m,s)=>{const match=s.id.match(/SCH-(\d+)$/);return match?Math.max(m,Number(match[1])):m},0);return `SCH-${String(max+1).padStart(3,'0')}`};
  const [tab,setTab]=useState<'customers'|'schools'>('customers');
  const [showCustomerForm,setShowCustomerForm]=useState(false);
  const [showSchoolForm,setShowSchoolForm]=useState(false);
  const [photoView,setPhotoView]=useState<School|null>(null);
  const [viewCustomer,setViewCustomer]=useState<string[]|null>(null);
  const [viewSchool,setViewSchool]=useState<School|null>(null);
  const [versionView,setVersionView]=useState<{schoolName:string;version:DressVersion}|null>(null);
  const [toast,setToast]=useState('');
  const [customerSearch,setCustomerSearch]=useState('');
  const [customerType,setCustomerType]=useState('All');
  const [customerStatus,setCustomerStatus]=useState('All');
  const [schoolSearch,setSchoolSearch]=useState('');
  const [schoolStatus,setSchoolStatus]=useState('All');
  const [customerForm,setCustomerForm]=useState({name:'',type:'Retail',phone:'',location:'',status:'Active'});
  const [schoolForm,setSchoolForm]=useState({name:'',contact:'',phone:'',location:'',uniform:'',status:'Active',logo:'',boysPhotos:[] as string[],girlsPhotos:[] as string[],versionYear:academicYear(),versionNote:'',versionAction:'new' as 'new'|'update'});
  const [mediaSchoolId,setMediaSchoolId]=useState(nextSchoolId);
  const [editCustomerId,setEditCustomerId]=useState<string|null>(null);
  const [editSchoolId,setEditSchoolId]=useState<string|null>(null);
  const [menuPos,setMenuPos]=useState<{key:string;x:number;y:number}|null>(null);
  useEffect(()=>{const close=()=>setMenuPos(null);window.addEventListener('click',close);return()=>window.removeEventListener('click',close)},[]);
  const emptySchoolForm=()=>setSchoolForm({name:'',contact:'',phone:'',location:'',uniform:'',status:'Active',logo:'',boysPhotos:[],girlsPhotos:[],versionYear:academicYear(),versionNote:'',versionAction:'new'});
  const customerRows=customers.filter(c=>c.join(' ').toLowerCase().includes(customerSearch.toLowerCase())&&(customerType==='All'||c[2]===customerType)&&(customerStatus==='All'||c[5]===customerStatus));
  const schoolRows=schools.filter(s=>[s.id,s.name,s.contact,s.phone,s.location,s.uniform,s.status].join(' ').toLowerCase().includes(schoolSearch.toLowerCase())&&(schoolStatus==='All'||s.status===schoolStatus));
  const uploadSchoolLogo=async(file?:File)=>{if(!file)return;try{const url=await uploadSchoolMedia(file,mediaSchoolId,'school-logo');setSchoolForm(current=>({...current,logo:url}))}catch(error){setToast(error instanceof Error?error.message:'Logo upload failed')}};
  const uploadPhotos=async(key:'boysPhotos'|'girlsPhotos',files?:FileList|null)=>{if(!files||!files.length)return;try{const category=key==='boysPhotos'?'boys-dress':'girls-dress';const urls=await Promise.all(Array.from(files).map(file=>uploadSchoolMedia(file,mediaSchoolId,category)));setSchoolForm(current=>({...current,[key]:[...current[key],...urls]}))}catch(error){setToast(error instanceof Error?error.message:'Photo upload failed')}};
  const removePhoto=(key:'boysPhotos'|'girlsPhotos',index:number)=>setSchoolForm(current=>({...current,[key]:current[key].filter((_,i)=>i!==index)}));
  const startEditCustomer=(row:string[])=>{setCustomerForm({name:row[1],type:row[2],phone:row[3],location:row[4],status:row[5]});setEditCustomerId(row[0]);setShowCustomerForm(true)};
  const closeCustomerForm=()=>{setShowCustomerForm(false);setEditCustomerId(null);setCustomerForm({name:'',type:'Retail',phone:'',location:'',status:'Active'})};
  const startEditSchool=(s:School)=>{const active=activeDress(s);setMediaSchoolId(s.id);setSchoolForm({name:s.name,contact:s.contact,phone:s.phone,location:s.location,uniform:s.uniform,status:s.status,logo:s.logo,boysPhotos:[...active.boysPhotos],girlsPhotos:[...active.girlsPhotos],versionYear:academicYear(),versionNote:'',versionAction:'new'});setEditSchoolId(s.id);setShowSchoolForm(true)};
  const closeSchoolForm=()=>{setShowSchoolForm(false);setEditSchoolId(null);emptySchoolForm()};
  const saveCustomer=()=>{if(!customerForm.name.trim())return;const id=editCustomerId||`CUS-${String(customers.length+1).padStart(3,'0')}`;const row=[id,customerForm.name.trim(),customerForm.type,customerForm.phone||'-',customerForm.location||'-',customerForm.status];if(editCustomerId){setCustomers(current=>current.map(c=>c[0]===editCustomerId?row:c))}else{setCustomers(current=>[row,...current])}setCustomerForm({name:'',type:'Retail',phone:'',location:'',status:'Active'});setEditCustomerId(null);setShowCustomerForm(false);setToast(`${row[1]} ${editCustomerId?'updated':'saved'} successfully`);window.setTimeout(()=>setToast(''),2500)};
  const saveSchool=()=>{if(!schoolForm.name.trim())return;const today=new Date().toISOString().slice(0,10);const year=schoolForm.versionYear.trim()||academicYear();const note=schoolForm.versionNote.trim();const base={name:schoolForm.name.trim(),contact:schoolForm.contact||'-',phone:schoolForm.phone||'-',location:schoolForm.location||'-',uniform:schoolForm.uniform||'-',status:schoolForm.status,logo:schoolForm.logo};if(editSchoolId){const id=editSchoolId;setSchools(current=>current.map(s=>{if(s.id!==id)return s;if(schoolForm.versionAction==='new'){return{...s,...base,dressVersions:[...s.dressVersions,{id:`DV-${Date.now()}`,year,note,date:today,boysPhotos:[...schoolForm.boysPhotos],girlsPhotos:[...schoolForm.girlsPhotos]}]}}return{...s,...base,dressVersions:s.dressVersions.map((v,i)=>i===s.dressVersions.length-1?{...v,year,note,boysPhotos:[...schoolForm.boysPhotos],girlsPhotos:[...schoolForm.girlsPhotos]}:v)}}))}else{setSchools(current=>[{id:mediaSchoolId,...base,dressVersions:[{id:`DV-${Date.now()}`,year,note,date:today,boysPhotos:[...schoolForm.boysPhotos],girlsPhotos:[...schoolForm.girlsPhotos]}]},...current])}emptySchoolForm();setMediaSchoolId(nextSchoolId());setEditSchoolId(null);setShowSchoolForm(false);setToast(`${schoolForm.name.trim()} ${editSchoolId?'updated':'saved'} successfully`);window.setTimeout(()=>setToast(''),2500)};
  const deleteCustomer=(id:string)=>{const name=customers.find(c=>c[0]===id)?.[1]||'Customer';setCustomers(current=>current.filter(c=>c[0]!==id));setToast(`${name} deleted`);window.setTimeout(()=>setToast(''),2500)};
  const deleteSchool=(id:string)=>{const name=schools.find(s=>s.id===id)?.name||'School';setSchools(current=>current.filter(s=>s.id!==id));setToast(`${name} deleted`);window.setTimeout(()=>setToast(''),2500)};
  const photoPreview=(key:'boysPhotos'|'girlsPhotos')=>schoolForm[key].length?<div className="photo-preview-list">{schoolForm[key].map((p,i)=><div key={i}><img src={assetUrl(p)} alt=""/><button className="mini-remove" onClick={()=>removePhoto(key,i)}>×</button></div>)}</div>:null;
  const dressPhotoGroup=(title:string,photos:string[],empty:string,alt:string)=>(<div className="photo-group"><h3>{title}<small>{photos.length}</small></h3>{photos.length?<div className="photo-grid">{photos.map((p,i)=><img key={i} src={assetUrl(p)} alt={alt}/>)}</div>:<p className="photo-empty">{empty}</p>}</div>);
  const ActionMenu=({rowKey,onView,onEdit,onDelete}:{rowKey:string;onView:()=>void;onEdit:()=>void;onDelete:()=>void})=>{
    const open=menuPos?.key===rowKey;
    return <div className="action-menu"><button className="action-menu-btn" title="Actions" onClick={e=>{e.stopPropagation();if(open){setMenuPos(null)}else{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuPos({key:rowKey,x:Math.min(r.right-132,window.innerWidth-150),y:r.bottom+5})}}}>⋯</button>{open&&<div className="action-menu-drop" style={{left:menuPos.x,top:menuPos.y}} onClick={e=>e.stopPropagation()}><button onClick={()=>{onView();setMenuPos(null)}}><Eye size={14}/> View</button><button onClick={()=>{onEdit();setMenuPos(null)}}><Pencil size={14}/> Edit</button><button className="danger" onClick={()=>{onDelete();setMenuPos(null)}}><Trash2 size={14}/> Delete</button></div>}</div>;
  };
  return <section className="content">
    <div className="measurement-tabs wage-tabs"><button className={tab==='customers'?'active':''} onClick={()=>setTab('customers')}><Users size={16}/><span>Customers<small>{customers.length} records</small></span></button><button className={tab==='schools'?'active':''} onClick={()=>setTab('schools')}><Factory size={16}/><span>Schools<small>{schools.length} institutions</small></span></button></div>
    {tab==='customers'&&<><div className="filterbar salary-filter"><label>Search<input value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Zudio, Redflame, phone"/></label><label>Type<select value={customerType} onChange={e=>setCustomerType(e.target.value)}><option>All</option><option>Retail</option><option>Corporate</option></select></label><label>Status<select value={customerStatus} onChange={e=>setCustomerStatus(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label><button className="primary" onClick={()=>{setEditCustomerId(null);setCustomerForm({name:'',type:'Retail',phone:'',location:'',status:'Active'});setShowCustomerForm(true)}}><Plus size={16}/> Add customer</button></div>{showCustomerForm&&<div className="stock-modal-overlay"><article className="card measurement-form entry-modal" onClick={e=>e.stopPropagation()}><div className="form-title"><div><h2>{editCustomerId?'Edit customer':'Add customer'}</h2><p>Create retail or corporate customer details.</p></div><button className="outline" onClick={closeCustomerForm}>Close</button></div><div className="form-grid"><label>Customer name<input value={customerForm.name} onChange={e=>setCustomerForm({...customerForm,name:e.target.value})} placeholder="Zudio, Redflame"/></label><label>Type<select value={customerForm.type} onChange={e=>setCustomerForm({...customerForm,type:e.target.value})}><option>Retail</option><option>Corporate</option></select></label><label>Phone<input value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})} placeholder="Mobile / phone"/></label><label>Location<input value={customerForm.location} onChange={e=>setCustomerForm({...customerForm,location:e.target.value})} placeholder="City or area"/></label><label>Status<select value={customerForm.status} onChange={e=>setCustomerForm({...customerForm,status:e.target.value})}><option>Active</option><option>Inactive</option></select></label></div><div className="form-actions"><button className="outline" onClick={closeCustomerForm}>Cancel</button><button className="primary" onClick={saveCustomer}><Plus size={16}/> {editCustomerId?'Update customer':'Save customer'}</button></div></article></div>}<Table title="Customer list" copy="Customer records used for orders and billing" headers={['CUSTOMER ID','CUSTOMER','TYPE','PHONE','LOCATION','STATUS']} rows={customerRows} actions={r=><ActionMenu rowKey={'cus-'+r[0]} onView={()=>setViewCustomer(r)} onEdit={()=>startEditCustomer(r)} onDelete={()=>deleteCustomer(r[0])}/>}/>{viewCustomer&&<div className="stock-modal-overlay" onClick={()=>setViewCustomer(null)}><div className="card detail-modal" onClick={e=>e.stopPropagation()}><div className="cardhead"><div><h2>{viewCustomer[1]}</h2><p>{viewCustomer[0]} · Customer details</p></div><button className="outline" onClick={()=>setViewCustomer(null)}>Close</button></div><div className="detail-grid"><div><span>Customer ID</span><strong>{viewCustomer[0]}</strong></div><div><span>Type</span><strong>{viewCustomer[2]}</strong></div><div><span>Phone</span><strong>{viewCustomer[3]}</strong></div><div><span>Location</span><strong>{viewCustomer[4]}</strong></div><div><span>Status</span><strong>{viewCustomer[5]}</strong></div></div></div></div>}</>}
    {tab==='schools'&&<>
      <div className="filterbar salary-filter"><label>Search<input value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)} placeholder="School, contact, phone"/></label><label>Status<select value={schoolStatus} onChange={e=>setSchoolStatus(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label><button className="primary" onClick={()=>{setEditSchoolId(null);setMediaSchoolId(nextSchoolId());emptySchoolForm();setShowSchoolForm(true)}}><Plus size={16}/> Add school</button></div>
      {showSchoolForm&&<div className="stock-modal-overlay"><article className="card measurement-form entry-modal" onClick={e=>e.stopPropagation()}>
        <div className="form-title"><div><h2>{editSchoolId?'Edit school':'Add school'}</h2><p>Add school details with logo and dress photos.</p></div><button className="outline" onClick={closeSchoolForm}>Close</button></div>
        <div className="form-grid">
          <label>School name<input value={schoolForm.name} onChange={e=>setSchoolForm({...schoolForm,name:e.target.value})} placeholder="Enter school name"/></label>
          <label>Contact person<input value={schoolForm.contact} onChange={e=>setSchoolForm({...schoolForm,contact:e.target.value})} placeholder="Principal / admin contact"/></label>
          <label>Phone<input value={schoolForm.phone} onChange={e=>setSchoolForm({...schoolForm,phone:e.target.value})} placeholder="School phone"/></label>
          <label>Location<input value={schoolForm.location} onChange={e=>setSchoolForm({...schoolForm,location:e.target.value})} placeholder="City or area"/></label>
          <label>Uniform type<input value={schoolForm.uniform} onChange={e=>setSchoolForm({...schoolForm,uniform:e.target.value})} placeholder="Uniform set, sports uniform"/></label>
          <label>Status<select value={schoolForm.status} onChange={e=>setSchoolForm({...schoolForm,status:e.target.value})}><option>Active</option><option>Inactive</option></select></label>
        </div>
        <div className="garment-heading"><div><h3>Dress photos</h3><p>Upload current dress photos. For a design change choose 'Save as new version' to keep history.</p></div></div>
        <div className="form-grid">
          <label className="logo-upload">School logo<input type="file" accept="image/*" onChange={e=>uploadSchoolLogo(e.target.files?.[0])}/><span>{schoolForm.logo?'Logo selected':'Upload school logo'}</span></label>
          {schoolForm.logo&&<div className="logo-preview"><img src={assetUrl(schoolForm.logo)} alt="School logo preview"/><button className="outline" onClick={()=>setSchoolForm({...schoolForm,logo:''})}>Remove</button></div>}
          <label>Dress version year<input value={schoolForm.versionYear} onChange={e=>setSchoolForm({...schoolForm,versionYear:e.target.value})} placeholder="e.g. 2025-26"/></label>
          <label>Change note<input value={schoolForm.versionNote} onChange={e=>setSchoolForm({...schoolForm,versionNote:e.target.value})} placeholder="e.g. collar style changed"/></label>
          {editSchoolId&&<label>Save as<select value={schoolForm.versionAction} onChange={e=>setSchoolForm({...schoolForm,versionAction:e.target.value as 'new'|'update'})}><option value="new">New version (keep history)</option><option value="update">Update current version</option></select></label>}
          <label className="logo-upload">Boys dress photos<input type="file" accept="image/*" multiple onChange={e=>uploadPhotos('boysPhotos',e.target.files)}/><span>{schoolForm.boysPhotos.length?`${schoolForm.boysPhotos.length} photo${schoolForm.boysPhotos.length>1?'s':''} selected`:'Upload boys dress photos'}</span></label>
          {photoPreview('boysPhotos')}
          <label className="logo-upload">Girls dress photos<input type="file" accept="image/*" multiple onChange={e=>uploadPhotos('girlsPhotos',e.target.files)}/><span>{schoolForm.girlsPhotos.length?`${schoolForm.girlsPhotos.length} photo${schoolForm.girlsPhotos.length>1?'s':''} selected`:'Upload girls dress photos'}</span></label>
          {photoPreview('girlsPhotos')}
        </div>
        <div className="form-actions"><button className="outline" onClick={closeSchoolForm}>Cancel</button><button className="primary" onClick={saveSchool}><Plus size={16}/> {editSchoolId?'Update school':'Save school'}</button></div>
      </article></div>}
      <article className="card jobs module-table">
        <div className="cardhead"><div><h2>School list</h2><p>School details for measurements and uniform orders</p></div><input className="smallsearch" placeholder="Search..."/></div>
        <table>
          <thead><tr><th>SCHOOL ID</th><th>SCHOOL</th><th>CONTACT</th><th>PHONE</th><th>LOCATION</th><th>STATUS</th><th>PHOTO DETAILS</th><th>ACTIONS</th></tr></thead>
          <tbody>{schoolRows.map(s=><tr key={s.id}>
            <td><strong>{s.id}</strong></td>
            <td><div className="school-cell">{s.logo&&<img className="table-thumb" src={assetUrl(s.logo)} alt=""/>}<span>{s.name}</span></div></td>
            <td>{s.contact}</td>
            <td>{s.phone}</td>
            <td>{s.location}</td>
            <td><span className={'status '+s.status.toLowerCase()}>{s.status}</span></td>
            <td><button className="outline mini-action" onClick={()=>setPhotoView(s)}>Details</button></td>
            <td><div className="action-menu"><ActionMenu rowKey={'sch-'+s.id} onView={()=>setViewSchool(s)} onEdit={()=>startEditSchool(s)} onDelete={()=>deleteSchool(s.id)}/></div></td>
          </tr>)}</tbody>
        </table>
      </article>
      {photoView&&<div className="stock-modal-overlay" onClick={()=>setPhotoView(null)}>
        <div className="card photo-modal" onClick={e=>e.stopPropagation()}>
          <div className="cardhead"><div><h2>{photoView.name}</h2><p>{photoView.id} · Current uniform photos</p></div><button className="outline" onClick={()=>setPhotoView(null)}>Close</button></div>
          <div className="photo-group"><h3>School logo</h3>{photoView.logo?<img className="photo-item" src={assetUrl(photoView.logo)} alt="School logo"/>:<p className="photo-empty">No logo uploaded</p>}</div>
          {dressPhotoGroup('Current boys dress photos',activeDress(photoView).boysPhotos,'No boys dress photos uploaded','Boys dress photo')}
          {dressPhotoGroup('Current girls dress photos',activeDress(photoView).girlsPhotos,'No girls dress photos uploaded','Girls dress photo')}
        </div>
      </div>}
      {viewSchool&&<div className="stock-modal-overlay" onClick={()=>setViewSchool(null)}>
        <div className="card detail-modal" onClick={e=>e.stopPropagation()}>
          <div className="cardhead"><div><h2>{viewSchool.name}</h2><p>{viewSchool.id} · School details</p></div><button className="outline" onClick={()=>setViewSchool(null)}>Close</button></div>
          <div className="detail-grid">
            <div><span>School ID</span><strong>{viewSchool.id}</strong></div>
            <div><span>Contact person</span><strong>{viewSchool.contact}</strong></div>
            <div><span>Phone</span><strong>{viewSchool.phone}</strong></div>
            <div><span>Location</span><strong>{viewSchool.location}</strong></div>
            <div><span>Uniform type</span><strong>{viewSchool.uniform}</strong></div>
            <div><span>Status</span><strong>{viewSchool.status}</strong></div>
          </div>
          <div className="photo-group"><h3>School logo</h3>{viewSchool.logo?<img className="photo-item" src={assetUrl(viewSchool.logo)} alt="School logo"/>:<p className="photo-empty">No logo uploaded</p>}</div>
          {dressPhotoGroup('Current boys dress photos',activeDress(viewSchool).boysPhotos,'No boys dress photos uploaded','Boys dress photo')}
          {dressPhotoGroup('Current girls dress photos',activeDress(viewSchool).girlsPhotos,'No girls dress photos uploaded','Girls dress photo')}
          <div className="photo-group"><h3>Dress version history<small>{viewSchool.dressVersions.length}</small></h3>
            <div className="version-list">{[...viewSchool.dressVersions].reverse().map((v,i)=>(
              <div key={v.id} className={'version-row'+(i===0?' current':'')}>
                <div className="version-meta"><strong>{v.year}</strong><span>{v.date}{v.note?` · ${v.note}`:''}</span></div>
                {i===0&&<em>Current</em>}
                <button className="outline mini-action" onClick={()=>setVersionView({schoolName:viewSchool.name,version:v})}>View photos</button>
              </div>
            ))}</div>
          </div>
        </div>
      </div>}
      {versionView&&<div className="stock-modal-overlay" onClick={()=>setVersionView(null)}>
        <div className="card photo-modal" onClick={e=>e.stopPropagation()}>
          <div className="cardhead"><div><h2>{versionView.schoolName} · {versionView.version.year}</h2><p>Changed on {versionView.version.date}{versionView.version.note?` · ${versionView.version.note}`:''}</p></div><button className="outline" onClick={()=>setVersionView(null)}>Close</button></div>
          {dressPhotoGroup('Boys dress photos',versionView.version.boysPhotos,'No boys dress photos in this version','Boys dress photo')}
          {dressPhotoGroup('Girls dress photos',versionView.version.girlsPhotos,'No girls dress photos in this version','Girls dress photo')}
        </div>
      </div>}
    </>}
    {toast&&<div className="toast"><span className="toast-dot"></span>{toast}</div>}
  </section>
}
