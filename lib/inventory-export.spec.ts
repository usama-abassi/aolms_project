import {describe,it,expect} from 'vitest';
import {read,CFB} from 'xlsx';
import {exportInventory} from './inventory-export';
import template from './inventory-export-template.json';
import {inventoryQuantityLabel,inventoryStep,inventoryItemLabel} from './inventory-units';

describe('Inventory units and monthly Excel export',()=>{
 it('uses whole pieces and decimal meter lengths with clear labels',()=>{
  for(const unit of ['piece','Pieces','pcs','EA','Each',' Piece/s ']){
   expect(inventoryStep(unit)).toBe(1);expect(inventoryQuantityLabel(unit)).toBe('Quantity(Piece/s)');
  }
  for(const unit of ['Meter','m','metres']){
   expect(inventoryStep(unit)).toBe(0.0001);expect(inventoryQuantityLabel(unit)).toBe('Length(Meter)');
  }
  expect(inventoryItemLabel({item_code:'0012',name:'Cable'})).toBe('0012 - Cable');
 });
 it('exports supplied monthly balances, literal codes, all materials and template formatting',()=>{
  const cable={item_code:'10000276',name:'Cable4F,SM,Outdoor(4F/Tube),GPON',unit:'Meter',opening:10.125,used:2,received:5,faulty:1,remaining:12.125};
  const piece={item_code:'000001',name:'=A1 & <item>',unit:'piece',opening:3,used:1,received:0,faulty:0,remaining:2};
  const bytes=exportInventory('2026-09',[piece,cable]);
  const book=read(bytes,{type:'array',cellStyles:true}),sheet=book.Sheets['Dashboard 2026'];
  expect(sheet.A1.v).toContain('September 2026');
  expect([2,3,4,5,6,7,8,9].map(r=>sheet[`A${r}`].v)).toEqual(['Item No','Unite','Materials','Start of the Month Count','Used Materials','Received Materials','Faulty Materials','Remain Materials']);
  expect(sheet.B2.v).toBe(cable.item_code);expect(sheet.C2.v).toBe('000001');
  expect(sheet.C4.v).toBe(piece.name);expect(sheet.C4.f).toBeUndefined();
  expect([5,6,7,8,9].map(r=>sheet[`B${r}`].v)).toEqual([10.125,2,5,1,12.125]);
  expect(sheet.B9.f).toBe('B5+B7-B6-B8');expect(sheet.C9.v).toBe(2);
  expect(sheet['!cols']?.[0].width).toBeCloseTo(16.1296,3);
  const zip=CFB.read(bytes,{type:'array'});
  const part=(path:string)=>new TextDecoder().decode(CFB.find(zip,zip.FullPaths[0]+path).content);
  expect(part('xl/styles.xml')).toBe(template.styles);
  expect(part('xl/theme/theme1.xml')).toBe(template.theme);
  expect(part('xl/worksheets/sheet1.xml')).not.toContain('#REF!');
  expect(()=>exportInventory('2026-13',[cable])).toThrow('valid month');
 });
});
