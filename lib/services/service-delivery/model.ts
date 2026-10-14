import reference from './reference.json';
export const controllerFields=reference.controller;
export const responseFields=reference.response;
export const deliveryTemplate=reference.delivery;
export type Values=Record<string,string>;
export const norm=(value:unknown)=>String(value??'').trim().toLowerCase();
export const responseTotals:Record<string,string[]>={BQ:['M','Y','AO','AZ'],BR:['T','AH','AT','H'],BS:['N','Z'],BT:['O','AC'],BU:['AJ','V'],BV:['L','X','AL','AX']};
export function calculateResponse(values:Values):Values {const result={...values};for(const [key,inputs]of Object.entries(responseTotals))result[key]=String(inputs.reduce((sum,k)=>sum+(Number(values[k])||0),0));return result;}
export function orderValues(t:any):Values {
 const f=t.spreadsheet_fields||{},d=f.delivery||{};
 const values=Object.fromEntries(controllerFields.map(x=>[x.key,String(d[x.key]??({order_type:f.wbs_type,connection_type:f.wbs_connection_type,nce_sn:f.new_ont_sn,actioned:t.status==='Resolved'?'Delivered':t.status,controller:t.controller_name}[x.key as string]??t[x.key]??''))]));
 if(!d.work_date&&t.work_date instanceof Date)values.work_date=t.work_date.toISOString().slice(0,10);
 return values;
}
export function responseValues(s:any,t:any):Values {
 const o=orderValues(t);
 const values={A:s?.submitted_at?new Date(s.submitted_at).toISOString():'',B:'',C:t.technician_name||'',D:o.ticket_number,E:s?(s.response_order_type??''):o.order_type,F:o.package,G:s?(s.response_connection_type??''):o.connection_type,BB:s?.new_cpe_sn||'',BG:s?.remarks||'',...s?.delivery_fields};
 return calculateResponse(values);
}
export function compare(a:unknown,b:unknown,submitted:boolean){return !submitted?'Pending Submission':norm(a)&&norm(a)===norm(b)?'Correct':'Issue';}
export function auditOrder(t:any,submissions:any[],inventory:any[]){
 const o=orderValues(t),submitted=submissions.filter(s=>s.submitted_at&&['submitted','locked'].includes(s.status));
 const s=submitted.find(s=>s.technician_id===t.technician_id)||submitted[0];
 const r=s?responseValues(s,t):{};
 const orderType=compare(o.order_type,r.E,!!s),closeType=compare(o.connection_type,r.G,!!s);
 const issues:string[]=[];
 if(!s)issues.push('Pending Submission');else {if(orderType==='Issue')issues.push('Order Type Issue');if(closeType==='Issue')issues.push('Close Type Issue');}
 if(norm(o.actioned)!=='delivered')issues.push('Actioned is not Delivered');
 if(submitted.length>1&&!submitted.some(s=>s.technician_id===t.technician_id))issues.push('Multiple submitted responses require review');
 const requiresOnt=['new','upgrade','new (provide)','new (provide) with fttr','new with fttr'].includes(norm(o.order_type));
 const matches=inventory.filter(i=>norm(i.serial_number)===norm(o.nce_sn));
 let ontStatus=requiresOnt?'Pending validation':'Not applicable',poNumber='',ont:any=null;
 if(requiresOnt&&orderType==='Correct'){
  ontStatus=!o.nce_sn.trim()?'Missing Nce SN':!matches.length?'Serial not found':matches.length>1?'Ambiguous serial':!String(matches[0].po_number??'').trim()?'Missing PO Number':'Correct';
  if(ontStatus==='Correct'){ont=matches[0];poNumber=String(ont.po_number).trim();}else issues.push('ONT Lookup Issue: '+ontStatus);
 }
 const material=ont&&String(ont.item_code)==='10000646'?{code:'10000646',description:'F50 ONT V166a-20,English',quantity:1}:null;
 const mappingIssues:string[]=[];
 if(material)mappingIssues.push('Row 4 has no quantity column for material 10000646');
 // Customer explicitly confirmed the workbook's formula mappings, including BP/BW/BJ.
 // Preserve arithmetic semantics: serial text cannot silently become a zero quantity.
 if(s&&['BC','BD','BH','BI'].some(k=>r[k]?.trim()&&!Number.isFinite(Number(r[k]))))issues.push('Customer BJ formula cannot sum nonnumeric AP serial values');
 return {id:t.id,order:o,technician:t.technician_name||'',submission:s||null,response:r,submitted:!!s,orderType,closeType,ontStatus,poNumber,material,issues,mappingIssues,ready:!issues.length&&!mappingIssues.length,internalOrderType:orderType==='Correct'?o.order_type.trim():'',externalOrderType:orderType==='Correct'?o.order_type.trim():''};
}
export type AuditOrder=ReturnType<typeof auditOrder>;
// Verified by the response-column references and matching material descriptions, not row offsets.
const direct:Record<number,string>={5:'AD',6:'AE',7:'AF',8:'AG',9:'AC',11:'BQ',13:'BU',14:'AS',15:'AP',16:'AM',17:'AQ',19:'BV',20:'P',21:'J',23:'BS',24:'R',28:'BN',31:'BR',58:'BG',59:'BO',62:'BC',63:'BD',64:'BH',65:'BI',69:'BO'};
export function deliveryRow(a:AuditOrder){
 const row:(string|number)[]=Array(75).fill(''),r=a.response;
 for(const index of [10,12,18,22,27,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57])row[index]='-';
 for(const [index,key]of Object.entries(direct)){const value=r[key]??'';row[Number(index)]=value.trim()&&responseFields.find(f=>f.key===key)?.type==='number'?Number(value):value;}
 // Form timestamps are displayed in Bahrain, matching the Controller spreadsheet.
 row[0]=a.submission?.submitted_at?new Date(a.submission.submitted_at).getTime()/86400000+25569+3/24:'';
 row[1]=r.C||a.technician;row[2]=a.order.ticket_number;row[3]=a.internalOrderType;row[4]=a.order.connection_type;row[30]=a.poNumber;
 const sum=(keys:string[])=>keys.reduce((n,k)=>n+(Number(r[k])||0),0);
 row[61]=['BC','BD','BH','BI'].some(k=>r[k]?.trim()&&!Number.isFinite(Number(r[k])))?'#VALUE!':sum(['BC','BD','BH','BI']);
 row[66]=sum(['S','AA','AR','BA']);row[67]=sum(['BJ','BK','BL','BM']);row[68]=sum(['Q','AB','AN','AY']);row[74]=sum(['K','W','AK','AW']);
 return row;
}
