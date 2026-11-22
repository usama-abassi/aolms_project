import {expect,it,vi} from 'vitest';
import {ServiceAssurance} from './service-assurance';
const id='11111111-1111-4111-8111-111111111111';
const actor={userId:id,role:'controller'};
const body={id,project_id:id,mutation_id:id,base_version:null,values:{team:'Habib',date:'2026-09-01'}};
it('saves an unmatched Sheet Team as text without making an assignment',async()=>{
 const query=vi.fn(async(sql:string,args?:any[])=>{
  if(sql.includes('FROM projects'))return [{id}];
  if(sql.startsWith('INSERT INTO service_assurance_rows'))return [{id,project_id:id,version:1,technician_id:args![2],raw_values:JSON.parse(args![3])}];
  return [];
 });
 const db:any={query,transaction:async(fn:any)=>fn(db)};
 const service=new ServiceAssurance(db);
 await expect(service.save(body,actor,{sheetImport:true})).resolves.toMatchObject({record:{team:'Habib',technician_id:null}});
 await expect(service.save(body,actor)).rejects.toThrow('uuid');
});
