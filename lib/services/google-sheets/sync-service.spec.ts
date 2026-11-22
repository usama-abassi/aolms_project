import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({query:vi.fn(),read:vi.fn(),revision:vi.fn(),save:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{query:state.query,transaction:async(fn:any)=>fn({query:state.query,transaction:async(inner:any)=>inner({query:state.query})})}}));
vi.mock('./google-client',()=>({GoogleSheetsClient:class{revision=state.revision;}}));
vi.mock('./sheet-reader',()=>({SheetReader:class{read=state.read;}}));
vi.mock('../service-delivery/service',()=>({ServiceDelivery:class{saveOrder=state.save;}}));
import {SheetSyncService} from './sync-service';
import {orderValues} from '../service-delivery/model';
const id='a1234567-1234-4123-8123-123456789012',project='b1234567-1234-4123-8123-123456789012';
const values={work_date:'2026-10-10',ticket_number:'T1',actioned:'Open'};
const record={id,project_id:project,version:1,work_date:'2026-10-10',spreadsheet_fields:{delivery:values}};
const columns=Object.keys(values).map((key,index)=>({id:key,key,index,label:key,active:true}));
const config={id:'c1234567-1234-4123-8123-123456789012',code:'SERVICE_ASSURANCE',project_id:project,month_key:'2026-10',spreadsheet_id:'sheet',tab_name:'October',columns,remote_revision:'1'};
let snapshots:any[],currentVersion:number;
beforeEach(()=>{
 vi.clearAllMocks();currentVersion=1;snapshots=[{record_id:id,remote_values:values,last_local_values:orderValues(record)}];
 state.revision.mockResolvedValue({version:'2'});state.save.mockResolvedValue({...record,version:2});
 state.read.mockResolvedValue({columns,rows:[{id,index:1,values:{...values,actioned:'Delivered'}}],identify:vi.fn()});
 state.query.mockImplementation(async(sql:string)=>{
  if(sql.includes('FROM assurance_tickets t'))return [record];
  if(sql.startsWith('SELECT * FROM sheet_sync_records'))return snapshots;
  if(sql.includes('SELECT id,project_id,version'))return [{id,project_id:project,version:currentVersion}];
  return [];
 });
});
const run=()=> (new SheetSyncService() as any).process(config,{userId:id,role:'controller'});
describe('incremental synchronization',()=>{
 it('skips unchanged historical spreadsheets without reading cells',async()=>{state.revision.mockResolvedValue({version:'1'});await expect(run()).resolves.toMatchObject({status:'unchanged',records:0});expect(state.read).not.toHaveBeenCalled();expect(state.save).not.toHaveBeenCalled();});
 it('updates only changed records through the existing workflow service',async()=>{await expect(run()).resolves.toMatchObject({records:1});expect(state.save).toHaveBeenCalledOnce();expect(state.save.mock.calls[0][0]).toMatchObject({id,project_id:project,base_version:1,values:{actioned:'Delivered'}});});
 it('imports unmatched Team text and continues saving other records',async()=>{
  const other='d1234567-1234-4123-8123-123456789012';
  state.read.mockResolvedValue({columns,rows:[{id,index:1,values:{...values,technician_id:'Habib'}},{id:other,index:2,values:{...values,ticket_number:'T2'}}],identify:vi.fn()});
  const query=state.query.getMockImplementation()!;
  state.query.mockImplementation((sql:string,args?:any[])=>sql.includes('SELECT id,project_id,version')&&args?.[0]===other?Promise.resolve([]):query(sql));
  await expect(run()).resolves.toMatchObject({records:2});
  expect(state.save.mock.calls[0]).toMatchObject([{id,values:{technician_id:'Habib'}},{role:'controller'},{sheetImport:true}]);
 });
 it('imports a shortened controller Date as a full date from the configured year',async()=>{
  state.read.mockResolvedValue({columns,rows:[{id,index:1,values:{...values,work_date:'1-Oct'}}],identify:vi.fn()});
  await expect(run()).resolves.toMatchObject({records:1});
  expect(state.save.mock.calls[0][0]).toMatchObject({values:{work_date:'2026-10-01'}});
 });
 it('matches the same record after sorting or inserting Sheet rows',async()=>{state.read.mockResolvedValue({columns,rows:[{id,index:99,values:{...values,actioned:'Delivered'}}],identify:vi.fn()});await run();expect(state.save.mock.calls[0][0]).toMatchObject({id,base_version:1});});
 it('retains records missing from Sheets and marks only their mapping',async()=>{state.read.mockResolvedValue({columns,rows:[],identify:vi.fn()});await expect(run()).resolves.toMatchObject({missing_preserved:1});expect(state.save).not.toHaveBeenCalled();expect(state.query.mock.calls.some(c=>c[0].startsWith('DELETE'))).toBe(false);expect(state.query.mock.calls.some(c=>c[0].includes('remote_deleted=true'))).toBe(true);});
 it('rejects duplicate stable row IDs before importing',async()=>{state.read.mockResolvedValue({columns,rows:[{id,index:1,values},{id,index:2,values}],identify:vi.fn()});await expect(run()).rejects.toThrow('Duplicate');expect(state.save).not.toHaveBeenCalled();});
 it('does not overwrite a simultaneous controller save',async()=>{currentVersion=2;await expect(run()).rejects.toThrow('edited this row');expect(state.save).not.toHaveBeenCalled();});
 it('does not import unchanged remote records again',async()=>{state.read.mockResolvedValue({columns,rows:[{id,index:1,values}],identify:vi.fn()});await expect(run()).resolves.toMatchObject({records:0});expect(state.save).not.toHaveBeenCalled();});
});
