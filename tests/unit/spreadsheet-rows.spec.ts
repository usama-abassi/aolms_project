import {describe,it,expect} from 'vitest';
import {hasCellData,withEmptyRow,gridDestination,gridPage} from '../../components/portal/features/controller/components/spreadsheet-rows';

describe('Spreadsheet placeholders and navigation',()=>{
 const blank=()=>({id:'new',values:{text:''},saved:false});
 const stored=(row:ReturnType<typeof blank>)=>row.saved;
 it('starts empty, reuses one placeholder, promotes typing and removes cleared unsaved rows',()=>{
  const initial=withEmptyRow([],stored,blank);
  expect(initial).toHaveLength(1);
  expect(withEmptyRow(initial,stored,blank)[0]).toBe(initial[0]);
  const typed=withEmptyRow(initial,stored,()=>({...blank(),id:'next'}),{new:{text:'a'}});
  expect(typed.map(r=>r.id)).toEqual(['new','next']);
  expect(withEmptyRow(typed,stored,blank,{},'new').map(r=>r.id)).toEqual(['new']);
  expect(hasCellData({text:' \n'})).toBe(false);
 });
 it('retains existing blank records and preserves populated drafts',()=>{
  const saved={...blank(),id:'saved',saved:true};
  const draft={...blank(),id:'draft',values:{text:'123'}};
  expect(withEmptyRow([saved,draft],stored,blank).map(r=>r.id)).toEqual(['saved','draft','new']);
 });
 it('does not create pages for placeholders at exact multiples of 25',()=>{
  expect(gridPage(0,0)).toBe(0);
  expect(gridPage(25,25)).toBe(0);
  expect(gridPage(25,26)).toBe(1);
  expect(gridPage(50,50)).toBe(1);
 });
 it('moves in all directions and wraps only Tab at column boundaries',()=>{
  expect(gridDestination(1,1,'ArrowRight',false,3)).toEqual({row:1,col:2});
  expect(gridDestination(1,1,'ArrowLeft',false,3)).toEqual({row:1,col:0});
  expect(gridDestination(1,1,'ArrowDown',false,3)).toEqual({row:2,col:1});
  expect(gridDestination(1,1,'ArrowUp',false,3)).toEqual({row:0,col:1});
  expect(gridDestination(1,2,'Tab',false,3)).toEqual({row:2,col:0});
  expect(gridDestination(1,0,'Tab',true,3)).toEqual({row:0,col:2});
  expect(gridDestination(1,1,'Enter',true,3)).toEqual({row:0,col:1});
  expect(gridDestination(0,0,'ArrowLeft',false,3)).toBeNull();
  expect(gridDestination(0,0,'ArrowUp',false,3)).toBeNull();
  expect(gridDestination(0,2,'ArrowRight',false,3)).toBeNull();
  expect(gridDestination(0,0,'Tab',true,3)).toBeNull();
 });
});
