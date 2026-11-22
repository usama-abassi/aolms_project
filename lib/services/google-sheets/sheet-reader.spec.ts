import {describe,it,expect,vi} from 'vitest';
import {SheetReader} from './sheet-reader';
import {controllerFields} from '../service-delivery/model';
const location=(index:number)=>({dimensionRange:{sheetId:7,dimension:'COLUMNS',startIndex:index,endIndex:index+1}});
function google(headers:string[],metadata:any[]){return {request:vi.fn(async(path:string,init?:RequestInit)=>{if(path.endsWith(':batchUpdate')){const requests=JSON.parse(String(init?.body)).requests;for(const r of requests)if(r.createDeveloperMetadata)metadata.push(r.createDeveloperMetadata.developerMetadata);return {};}return path.endsWith('developerMetadata:search')?{matchedDeveloperMetadata:metadata.map(developerMetadata=>({developerMetadata}))}:path.includes('/values/')?{values:[headers,['42','2026-10-10','row-id']]}:{sheets:[{properties:{title:'October',sheetId:7,gridProperties:{columnCount:3}}}]};})};}
const idColumn={metadataKey:'aolms_record_id',location:location(2)};
describe('stable Google column identities',()=>{
 it('retries a changed revision and uses the rows from the stable read',async()=>{
  const mock=google(['Date','','__aolms_record_id'],[idColumn,{metadataKey:'aolms_column',metadataValue:JSON.stringify({id:'date-id',key:'work_date'}),location:location(0)}]);
  const request=mock.request.getMockImplementation()!;
  const revisions=['1','2','2','2'];
  let reads=0;
  mock.request.mockImplementation((path,init)=>{
   if(path.startsWith('www.googleapis.com/'))return Promise.resolve({version:revisions.shift()} as any);
   if(path.includes('/values/'))return Promise.resolve({values:[['Date','','__aolms_record_id'],[String(++reads),'','row-id']]} as any);
   return request(path,init);
  });
  const sheet=await new SheetReader(mock as any).read('sheet','October',[],false);
  expect(sheet.rows[0].values.work_date).toBe('2');
  expect(reads).toBe(2);
 });
 it('maps each Remarks column in the Service Delivery template to its own field',async()=>{
  const headers=Array<string>(45).fill('');
  for(const index of [15,24,43])headers[index]='Remarks';
  headers[44]='__aolms_record_id';
  const mock=google(headers,[{...idColumn,location:location(44)}]);
  const sheet=await new SheetReader(mock as any).read('sheet','October',controllerFields,false);
  expect(sheet.columns.map(column=>column.key)).toEqual(['controller_remarks','action_remarks','final_remarks']);
 });
 it('keeps an ambiguous Remarks header as a custom column outside template positions',async()=>{
  const mock=google(['Remarks','','__aolms_record_id'],[idColumn]);
  const sheet=await new SheetReader(mock as any).read('sheet','October',controllerFields,false);
  expect(sheet.columns[0]).toMatchObject({label:'Remarks',key:expect.stringMatching(/^sheet_\w+$/)});
  expect(sheet.rows[0].values[sheet.columns[0].key]).toBe('42');
 });
 it('gives an extra Date header a custom key and preserves the existing Date mapping',async()=>{
  const mock=google(['Date','Date','__aolms_record_id'],[idColumn,{metadataKey:'aolms_column',metadataValue:JSON.stringify({id:'date-id',key:'work_date'}),location:location(1)}]);
  const sheet=await new SheetReader(mock as any).read('sheet','October',[{key:'work_date',label:'Date'}],false);
  expect(sheet.columns.map(column=>column.key)).toEqual([expect.stringMatching(/^sheet_\w+$/),'work_date']);
 });
 it('keeps internal keys when headers are renamed or reordered',async()=>{const mock=google(['Renamed ticket','Renamed date','__aolms_record_id'],[idColumn,{metadataKey:'aolms_column',metadataValue:JSON.stringify({id:'ticket-id',key:'ticket_number'}),location:location(0)},{metadataKey:'aolms_column',metadataValue:JSON.stringify({id:'date-id',key:'work_date'}),location:location(1)}]);const sheet=await new SheetReader(mock as any).read('sheet','October',[],false);expect(sheet.columns.map(c=>[c.id,c.key,c.label,c.index])).toEqual([['ticket-id','ticket_number','Renamed ticket',0],['date-id','work_date','Renamed date',1]]);expect(mock.request.mock.calls.some(c=>c[0].endsWith(':batchUpdate'))).toBe(false);});
 it('gives new custom columns stable UUID metadata without rewriting their values',async()=>{const mock=google(['New detail','Date','__aolms_record_id'],[idColumn]);const sheet=await new SheetReader(mock as any).read('sheet','October',[{key:'work_date',label:'Date'}]);expect(sheet.columns[0].key).toMatch(/^sheet_[a-f0-9]{32}$/);expect(sheet.columns[1].key).toBe('work_date');expect(mock.request.mock.calls.some(c=>c[0].endsWith(':batchUpdate'))).toBe(true);});
 it('fails closed if an established identity column is removed',async()=>{const mock=google(['Date'],[]);await expect(new SheetReader(mock as any).read('sheet','October',[],false)).rejects.toThrow('Identity review');expect(mock.request.mock.calls.some(c=>c[0].endsWith(':batchUpdate'))).toBe(false);});
 it('rejects duplicate column metadata before importing records',async()=>{const metadata={metadataKey:'aolms_column',metadataValue:JSON.stringify({id:'same-id',key:'same-key'}),location:location(0)};const mock=google(['Date','Team'],[idColumn,metadata,metadata]);await expect(new SheetReader(mock as any).read('sheet','October',[],false)).rejects.toThrow('Duplicate');});
});
