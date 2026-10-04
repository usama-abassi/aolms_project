import fields from './assurance-fields.json';
export const protectedGridFields=new Set(['controller_id','sla_from_creation','kpi_status']);

// Strict parsing avoids Date.parse's locale-dependent dates and rollover of invalid days.
export function gridDate(raw:string,withTime:boolean):string|null{
 const value=raw.trim();
 const iso=value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/);
 const dayFirst=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
 if(!iso&&!dayFirst)return null;
 const match=(iso||dayFirst)!;
 const y=Number(iso?match[1]:match[3]),m=Number(match[2]),d=Number(iso?match[3]:match[1]);
 const h=Number(match[4]||0),minute=Number(match[5]||0),s=Number(match[6]||0);
 if(y<1000||y>9999||m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate()||h>23||minute>59||s>59)return null;
 if(!withTime&&match[4]!==undefined)return null;
 const day=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 if(!withTime)return day;
 const parsed=Date.parse(`${day}T${String(h).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(s).padStart(2,'0')}${iso?.[7]?'.'+iso[7]:''}${iso?.[8]||'+03:00'}`);
 return Number.isFinite(parsed)?new Date(parsed).toISOString():null;
}
export function normalizeGrid(raw:Record<string,string>,technicians:Array<{id:string;full_name:string}>,old?:Record<string,any>){
 const values:Record<string,string|null>={},errors:Record<string,string>={};
 for(const field of fields){
  if(protectedGridFields.has(field.key))continue;
  const text=raw[field.key]??'',trimmed=text.trim();
  let value:string|null=trimmed||null;
  if(trimmed&&field.options){
   const matches=field.options.filter(option=>option.toLowerCase()===trimmed.toLowerCase());
   if(matches.length===1)value=matches[0];else errors[field.key]=`Unrecognized ${field.label}. Your text is saved as a draft.`;
  }
  if(trimmed&&(field.type==='date'||field.type==='datetime-local')){
   value=gridDate(text,field.type==='datetime-local');
   if(value===null)errors[field.key]='Use YYYY-MM-DD or DD/MM/YYYY, with HH:mm for time (Bahrain). Your typed text is preserved.';
  }
  if(field.type==='technician'&&trimmed){
   const matches=technicians.filter(t=>t.id===trimmed||t.full_name.trim().toLowerCase()===trimmed.toLowerCase());
   if(matches.length===1)value=matches[0].id;
   else if(old?.technician_id===trimmed)value=trimmed;
   else errors[field.key]=matches.length?'More than one technician has this name. Enter the technician ID.':'Team does not match an active technician.';
  }
  values[field.key]=value;
 }
 for(const key of ['work_date','ticket_number','status'])if(!raw[key]?.trim())errors[key]='Required field. Your text is saved as a draft.';
 if(values.creation_datetime&&values.close_datetime&&Date.parse(values.close_datetime)<Date.parse(values.creation_datetime))errors.close_datetime='Close Date/Time must follow Creationdate/time.';
 // Existing automated values remain authoritative; never accept a client override.
 values.kpi_status=old?.kpi_status??null;
 return {values,errors};
}
