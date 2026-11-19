import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({query:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{query:state.query,transaction:async(fn:any)=>fn({query:state.query})}}));
vi.mock('./sheet-reader',()=>({SheetReader:class{read=state.read;}}));
import {stageProposals} from './proposal-gateway';
const config={id:'configuration',spreadsheet_id:'sheet',tab_name:'October',month_key:'2026-10',code:'SERVICE_ASSURANCE'};
const proposal={id:'proposal',record_id:'record',base_values:{ticket_number:'old'},proposed_values:{ticket_number:'new',work_date:'2026-10-10'}};
let mapped:boolean,pending:any[];
beforeEach(()=>{vi.clearAllMocks();mapped=true;pending=[proposal];state.query.mockImplementation(async(sql:string)=>{if(sql.includes('SELECT record_id FROM'))return mapped?[{record_id:'record'}]:[];if(sql.startsWith('SELECT * FROM sheet_sync_proposals'))return pending;if(sql.includes("status='superseded'"))pending=[];return [];});state.read.mockResolvedValue({sheetId:7,idColumn:2,columns:[{key:'ticket_number',index:0},{key:'work_date',index:1}],rows:[]});});
function google(existing:string[][]=[]){return {request:vi.fn(async(path:string)=>path.includes('/values/')&&!path.includes(':append')?{values:existing}:path.includes('?fields=sheets.properties')?{sheets:[{properties:{title:'__AOLMS_Proposals'}}]}:{})};}
describe('coordinated outbound gateway',()=>{
 it('stages existing-record edits without writing controller cells',async()=>{const g=google();await stageProposals(config,g as any);const writes=g.request.mock.calls.filter(c=>c[0].includes(':append'));expect(writes).toHaveLength(1);expect(writes[0][0]).toContain('__AOLMS_Proposals');expect(g.request.mock.calls.some(c=>c[0].endsWith(':batchUpdate'))).toBe(false);});
 it('does not duplicate previously staged entries after a lost acknowledgement',async()=>{const g=google([['proposal:ticket_number'],['proposal:work_date']]);await stageProposals(config,g as any);expect(g.request.mock.calls.some(c=>c[0].includes(':append'))).toBe(false);});
 it('appends a new UUID record and verifies it before recording the mapping',async()=>{mapped=false;state.read.mockResolvedValueOnce({sheetId:7,idColumn:2,columns:[{key:'ticket_number',index:0},{key:'work_date',index:1}],rows:[]}).mockResolvedValueOnce({rows:[{id:'record',values:proposal.proposed_values}]});const g=google();await stageProposals(config,g as any);expect(g.request.mock.calls.some(c=>c[0].endsWith(':batchUpdate'))).toBe(true);expect(state.query.mock.calls.some(c=>c[0].includes('INSERT INTO sheet_sync_records'))).toBe(true);});
 it('does not append when a matching remote row appears concurrently',async()=>{mapped=false;state.read.mockResolvedValue({sheetId:7,idColumn:2,columns:[],rows:[{id:'record',values:proposal.proposed_values}]});const g=google();await expect(stageProposals(config,g as any)).rejects.toThrow('matching Sheet row');expect(g.request.mock.calls.some(c=>c[0].endsWith(':batchUpdate'))).toBe(false);});
});
