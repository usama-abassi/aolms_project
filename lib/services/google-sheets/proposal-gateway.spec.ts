import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({query:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{query:state.query,transaction:async(fn:any)=>fn({query:state.query})}}));
vi.mock('./sheet-reader',()=>({SheetReader:class{read=state.read;}}));
import {applyOutboundChanges} from './proposal-gateway';
const config={id:'configuration',spreadsheet_id:'sheet',tab_name:'October',month_key:'2026-10',code:'SERVICE_ASSURANCE'};
const proposal={id:'proposal',status:'pending',record_id:'record',base_values:{ticket_number:'old'},proposed_values:{ticket_number:'new',work_date:'2026-10-10'}};
let mapped:boolean,pending:any[];
beforeEach(()=>{vi.clearAllMocks();mapped=true;pending=[proposal];state.query.mockImplementation(async(sql:string)=>{if(sql.includes('JOIN sheet_sync_records'))return mapped?pending.map(p=>({...p,current_values:p.proposed_values,remote_values:p.base_values})):[];if(sql.includes('SELECT record_id FROM'))return mapped?[{record_id:'record'}]:[];if(sql.startsWith('SELECT * FROM sheet_sync_proposals'))return pending;if(sql.includes("status='superseded'"))pending=[];return [];});state.read.mockResolvedValue({sheetId:7,idColumn:2,columns:[{key:'ticket_number',index:0},{key:'work_date',index:1}],rows:[]});});
function google(existing:string[][]=[]){return {request:vi.fn(async(path:string)=>path.includes('/values/')&&!path.includes(':append')?{values:existing}:path.includes('?fields=sheets.properties')?{sheets:[{properties:{title:'__AOLMS_Proposals'}}]}:{})};}
describe('coordinated outbound gateway',()=>{
 it('writes only the edited cell on the matching controller row',async()=>{
  state.read.mockResolvedValue({sheetId:7,columns:[{key:'ticket_number',index:2}],rows:[{id:'record',index:4,values:{ticket_number:'old'}}]});
  pending=[{...proposal,proposed_values:{ticket_number:'new'}}];
  const g=google();
  await expect(applyOutboundChanges(config,g as any)).resolves.toBe(1);
  expect(JSON.parse((g.request.mock.calls as any)[0][1].body).requests).toEqual([{updateCells:{start:{sheetId:7,rowIndex:4,columnIndex:2},rows:[{values:[{userEnteredValue:{stringValue:'new'}}]}],fields:'userEnteredValue'}}]);
 });
 it('preserves a changed Sheet cell',async()=>{
  state.read.mockResolvedValue({sheetId:7,columns:[{key:'ticket_number',index:2}],rows:[{id:'record',index:4,values:{ticket_number:'changed in Sheets'}}]});
  const g=google();
  await expect(applyOutboundChanges(config,g as any)).resolves.toBe(0);
  expect(g.request).not.toHaveBeenCalled();
 });
 it('appends a new UUID record and verifies it before recording the mapping',async()=>{mapped=false;state.read.mockResolvedValueOnce({sheetId:7,idColumn:2,columns:[{key:'ticket_number',index:0},{key:'work_date',index:1}],rows:[]}).mockResolvedValueOnce({rows:[{id:'record',values:proposal.proposed_values}]});const g=google();await applyOutboundChanges(config,g as any);expect(g.request.mock.calls.some(c=>c[0].endsWith(':batchUpdate'))).toBe(true);expect(state.query.mock.calls.some(c=>c[0].includes('INSERT INTO sheet_sync_records'))).toBe(true);});
 it('does not append when a matching remote row appears concurrently',async()=>{mapped=false;state.read.mockResolvedValue({sheetId:7,idColumn:2,columns:[],rows:[{id:'record',values:proposal.proposed_values}]});const g=google();await expect(applyOutboundChanges(config,g as any)).rejects.toThrow('matching Sheet row');expect(g.request.mock.calls.some(c=>c[0].endsWith(':batchUpdate'))).toBe(false);});
});
