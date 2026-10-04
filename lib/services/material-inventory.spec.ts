import {describe,it,expect,vi} from 'vitest';
import {MaterialInventory} from './material-inventory';
const id='11111111-1111-4111-8111-111111111111';
const entry={kind:'received',material_id:id,mutation_id:id,date:'2026-09-01',quantity:2,reference:''};
describe('Material inventory',()=>{
 it('rejects invalid quantities, dates and manual usage before writing',async()=>{
  const db={query:vi.fn().mockResolvedValue([{id}]),transaction:vi.fn()};const inventory=new MaterialInventory(db as any);
  for(const patch of [{quantity:-1},{quantity:0},{quantity:NaN},{quantity:'2'},{quantity:1.12345},{date:'2026-02-30'},{kind:'used'},{kind:'unknown'}])await expect(inventory.create(id,{...entry,...patch},id)).rejects.toThrow();
  expect(db.transaction).not.toHaveBeenCalled();
 });
 it('rejects other projects and invalid months',async()=>{
  const db={query:vi.fn().mockResolvedValue([])};const inventory=new MaterialInventory(db as any);
  await expect(inventory.list(id,'2026-13')).rejects.toThrow('month');expect(db.query).not.toHaveBeenCalled();
  await expect(inventory.list(id,'2026-09')).rejects.toThrow('Service Delivery');
 });
 it('returns a repeated stock receipt without adding it again',async()=>{
  const query=vi.fn().mockResolvedValueOnce([{id}]).mockResolvedValueOnce([{id,...entry,actor_id:id}]);
  const inventory=new MaterialInventory({query:vi.fn().mockResolvedValue([{id}]),transaction:fn=>fn({query})} as any);
  expect(await inventory.create(id,entry,id)).toEqual({id});expect(query).toHaveBeenCalledTimes(2);
 });
 it('prevents resetting opening stock after another entry',async()=>{
  const query=vi.fn().mockResolvedValueOnce([{id}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{id}]);
  const inventory=new MaterialInventory({query:vi.fn().mockResolvedValue([{id}]),transaction:fn=>fn({query})} as any);
  await expect(inventory.create(id,{...entry,kind:'opening'},id)).rejects.toThrow('first entry');
 });
});
