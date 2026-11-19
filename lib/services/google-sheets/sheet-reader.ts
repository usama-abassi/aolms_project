import 'server-only';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException} from '@/lib/http';
import {GoogleSheetsClient} from './google-client';
import {type SyncColumn} from './sync-model';
export type SheetSnapshot={sheetId:number;idColumn:number;columns:SyncColumn[];rows:Array<{index:number;id:string;values:Record<string,string>}>;identify:(assignments:Array<{index:number;id:string}>)=>Promise<void>};
export class SheetReader{
 constructor(private google=new GoogleSheetsClient()){}
 async read(id:string,tabName:string,known:Array<{key:string;label:string}>,allowInitialize=true,depth=0):Promise<SheetSnapshot>{
  if(depth>3)throw new ConflictException('Identity review: repeated column changes during identifier setup. Retry after reviewing the tab.');
  const base=`sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`;
  const revisionPath=`www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=version&supportsAllDrives=true`;
  const started=await this.google.request(revisionPath);
  let doc=await this.google.request(base+'?fields=sheets.properties,developerMetadata');
  const tab=doc.sheets?.find((s:any)=>s.properties.title===tabName)?.properties;
  if(!tab)throw new BadRequestException('Configured Google Sheet tab was not found');
  const loadMetadata=async()=>{const result=await this.google.request(base+'/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:'aolms_record_id'}},{developerMetadataLookup:{metadataKey:'aolms_column'}}]})});return (result.matchedDeveloperMetadata||[]).map((m:any)=>m.developerMetadata);};
  let entries=await loadMetadata();
  const metadata=()=>entries;
  let idColumn=metadata().find((m:any)=>m.metadataKey==='aolms_record_id'&&m.location?.dimensionRange?.sheetId===tab.sheetId)?.location.dimensionRange.startIndex;
  const batch=(requests:any[])=>this.google.request(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests})});
  if(idColumn===undefined){
   if(!allowInitialize)throw new BadRequestException('Identity review: the stable record ID column was removed. Restore it before synchronizing.');
   idColumn=tab.gridProperties.columnCount;
   await batch([{appendDimension:{sheetId:tab.sheetId,dimension:'COLUMNS',length:1}},
    {updateDimensionProperties:{range:{sheetId:tab.sheetId,dimension:'COLUMNS',startIndex:idColumn,endIndex:idColumn+1},properties:{hiddenByUser:true},fields:'hiddenByUser'}},
    {updateCells:{start:{sheetId:tab.sheetId,rowIndex:0,columnIndex:idColumn},rows:[{values:[{userEnteredValue:{stringValue:'__aolms_record_id'}}]}],fields:'userEnteredValue'}},
    {addProtectedRange:{protectedRange:{range:{sheetId:tab.sheetId,startColumnIndex:idColumn,endColumnIndex:idColumn+1},description:'AOLMS stable record identifiers — do not modify',warningOnly:true}}},
    {createDeveloperMetadata:{developerMetadata:{metadataKey:'aolms_record_id',visibility:'DOCUMENT',location:{dimensionRange:{sheetId:tab.sheetId,dimension:'COLUMNS',startIndex:idColumn,endIndex:idColumn+1}}}}}]);
   return this.read(id,tabName,known,false,depth+1);
  }
  const quoted="'"+tabName.replace(/'/g,"''")+"'";
  const result=await this.google.request(base+'/values/'+encodeURIComponent(quoted)+'?valueRenderOption=FORMATTED_VALUE');
  const values:string[][]=(result.values||[]).map((r:any[])=>r.map(v=>String(v??'')));
  const finished=await this.google.request(revisionPath);
  if(String(started.version)!==String(finished.version))throw new ConflictException('Sheet changed while reading its columns and records. Retry with a consistent snapshot.');
  const headers=values[0]||[];
  const columns:SyncColumn[]=[],requests:any[]=[];
  const normal=(v:string)=>v.trim().toLowerCase();
  for(let i=0;i<headers.length;i++){
   if(i===idColumn||!headers[i].trim())continue;
   const matches=metadata().filter((m:any)=>m.metadataKey==='aolms_column'&&m.location?.dimensionRange?.sheetId===tab.sheetId&&m.location.dimensionRange.startIndex===i);
   if(matches.length>1)throw new BadRequestException('Duplicate column synchronization identifiers require review');
   let mapping:any;
   if(matches.length){try{mapping=JSON.parse(matches[0].metadataValue);}catch{throw new BadRequestException('Invalid column synchronization identifier');}}
   else{
    const matched=known.filter(f=>normal(f.label)===normal(headers[i])||normal(f.key)===normal(headers[i]));
    if(matched.length>1)throw new BadRequestException('Ambiguous column header: '+headers[i]);
    const columnId=randomUUID();mapping={id:columnId,key:matched[0]?.key||'sheet_'+columnId.replace(/-/g,'')};
    requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:'aolms_column',metadataValue:JSON.stringify(mapping),visibility:'DOCUMENT',location:{dimensionRange:{sheetId:tab.sheetId,dimension:'COLUMNS',startIndex:i,endIndex:i+1}}}}});
   }
   if(typeof mapping.id!=='string'||typeof mapping.key!=='string'||columns.some(c=>c.id===mapping.id||c.key===mapping.key))throw new BadRequestException('Duplicate or invalid column identity. Review the sheet before synchronizing.');
   columns.push({id:mapping.id,key:mapping.key,label:headers[i],index:i,active:true});
  }
  if(requests.length){
   await batch(requests);
   const verified=await this.read(id,tabName,known,false,depth+1);
   if(JSON.stringify(verified.columns)!==JSON.stringify(columns))throw new ConflictException('Identity review: column structure changed during identifier setup. Review the column metadata before retrying.');
   return verified;
  }
  return {sheetId:tab.sheetId,idColumn,columns,rows:values.slice(1).map((r,i)=>({index:i+1,id:r[idColumn]||'',values:Object.fromEntries(columns.map(c=>[c.key,r[c.index]||'']))})).filter(r=>Object.values(r.values).some(v=>v.trim())),
   identify:async(assignments:Array<{index:number;id:string}>)=>{if(assignments.length)await batch(assignments.map(a=>({updateCells:{start:{sheetId:tab.sheetId,rowIndex:a.index,columnIndex:idColumn},rows:[{values:[{userEnteredValue:{stringValue:a.id}}]}],fields:'userEnteredValue'}})));}};
 }
}
