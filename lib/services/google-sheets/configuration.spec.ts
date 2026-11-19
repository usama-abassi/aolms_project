import {describe,it,expect,vi} from 'vitest';
import {parseConfiguration,SheetConfigurations} from './configuration';
const input={project_id:'a1234567-1234-4123-8123-123456789012',month:'2026-10',sheet_url:'https://docs.google.com/spreadsheets/d/abc_123/edit#gid=0',tab_name:'October'};
describe('sheet configurations',()=>{
 it('normalizes monthly keys and URLs while retaining exact tab names',()=>{expect(parseConfiguration(input)).toMatchObject({month:'2026-10-01',spreadsheet_id:'abc_123',tab_name:'October'});});
 it('rejects invalid URLs and months before writes',()=>{for(const sheet_url of ['https://evil.com/spreadsheets/d/abc/edit','http://docs.google.com/spreadsheets/d/abc/edit','https://docs.google.com.evil.com/spreadsheets/d/abc/edit','garbage'])expect(()=>parseConfiguration({...input,sheet_url})).toThrow();for(const month of ['2026-13','2026-00','2026-1',''])expect(()=>parseConfiguration({...input,month})).toThrow();expect(()=>parseConfiguration({...input,tab_name:''})).toThrow();});
 it('turns database uniqueness violations into a clear duplicate error',async()=>{const db={transaction:vi.fn().mockRejectedValue({code:'23505'})};await expect(new SheetConfigurations(db as any).save(input,{userId:input.project_id,role:'controller'})).rejects.toThrow('already has');});
 it('does not overwrite concurrent configuration edits',async()=>{const query=vi.fn(async(sql:string)=>sql.includes('SELECT id FROM projects')?[{id:input.project_id}]:[]);const db={transaction:(fn:any)=>fn({query})};await expect(new SheetConfigurations(db as any).save({...input,id:input.project_id,version:1},{userId:input.project_id,role:'controller'})).rejects.toThrow('changed');expect(query.mock.calls.find(c=>c[0].startsWith('UPDATE'))?.[0]).toContain('AND version=$7');});
});
