import {describe,it,expect} from 'vitest'
import {bounds,boundary,currentRegion,parseClipboard,clipboardText,clipboardHtml,pasteRange,validatedValue,MAX_BULK_CELLS} from '@/components/portal/features/controller/components/spreadsheet-selection'

describe('shared Controller spreadsheet operations',()=>{
 it('round trips Excel TSV, quoted newlines, tabs, quotes, blanks and string identifiers',()=>{
  const values=[['00001234567890123456789',' SN001 ','a\tb'],['line\nsecond','say "yes"','']]
  expect(parseClipboard(clipboardText(values))).toEqual(values)
  expect(parseClipboard('0001\t0002\r\n0003\t\r\n')).toEqual([['0001','0002'],['0003','']])
  expect(parseClipboard('')).toEqual([['']])
  expect(()=>parseClipboard('"unterminated')).toThrow('unclosed')
 })
 it('provides escaped Excel HTML with an explicit text format',()=>{
  const html=clipboardHtml([['00012345678901234567890','<script>&"']])
  expect(html).toContain('mso-number-format:')
  expect(html).toContain('00012345678901234567890')
  expect(html).toContain('&lt;script&gt;&amp;&quot;')
  expect(html).not.toContain('<script>')
 })
 it('expands a single destination, tiles patterns and fills selected blank cells',()=>{
  const range={anchor:{row:2,col:1},end:{row:2,col:1}}
  expect(pasteRange(range,[['a','b'],['c','d']],5)).toEqual([{row:2,col:1,value:'a'},{row:2,col:2,value:'b'},{row:3,col:1,value:'c'},{row:3,col:2,value:'d'}])
  const selected={anchor:{row:3,col:2},end:{row:1,col:1}}
  expect(bounds(selected)).toEqual({top:1,bottom:3,left:1,right:2})
  expect(pasteRange(selected,[['']],5)).toHaveLength(6)
  expect(pasteRange(selected,[['left','right']],5).map(c=>c.value)).toEqual(['left','right','left','right','left','right'])
 })
 it('rejects mismatched destinations, column overflow and excessive operations',()=>{
  expect(()=>pasteRange({anchor:{row:0,col:0},end:{row:2,col:0}},[['a'],['b']],4)).toThrow('whole repetitions')
  expect(()=>pasteRange({anchor:{row:0,col:3},end:{row:0,col:3}},[['a','b']],4)).toThrow('last column')
  expect(()=>pasteRange({anchor:{row:0,col:0},end:{row:MAX_BULK_CELLS,col:0}},[['a']],4)).toThrow('at most')
 })
 it('jumps across contiguous data, gaps and empty rows to the table boundary',()=>{
  const values=['A','B','','','C','D','']
  const read=(row:number)=>values[row]
  expect(boundary({row:0,col:0},'ArrowDown',7,1,read).row).toBe(1)
  expect(boundary({row:1,col:0},'ArrowDown',7,1,read).row).toBe(4)
  expect(boundary({row:2,col:0},'ArrowDown',7,1,read).row).toBe(4)
  expect(boundary({row:5,col:0},'ArrowDown',7,1,read).row).toBe(6)
  expect(boundary({row:4,col:0},'ArrowUp',7,1,read).row).toBe(1)
  expect(boundary({row:0,col:0},'ArrowUp',7,1,read).row).toBe(0)
 })
 it('finds the current data region without crossing empty separators',()=>{
  const values=[['a','b','','x'],['c','d','','y'],['','','',''],['q','','','']]
  const read=(r:number,c:number)=>values[r][c]
  expect(bounds(currentRegion({row:0,col:0},4,4,read))).toEqual({top:0,bottom:1,left:0,right:1})
 })
 it('validates dropdown names and IDs, blocks ambiguous teams and protected fields',()=>{
  const field={key:'team',label:'Team',type:'technician'},teams=[{id:'1',full_name:'Ahmed'},{id:'2',full_name:'Ali'}]
  expect(validatedValue(field,' Ahmed ',teams)).toBe('1')
  expect(validatedValue(field,'1',teams)).toBe('1')
  expect(validatedValue(field,'',teams)).toBe('')
  expect(()=>validatedValue(field,'unknown',teams)).toThrow('valid')
  expect(()=>validatedValue(field,'Ahmed',[...teams,{id:'3',full_name:'Ahmed'}])).toThrow('unambiguous')
  expect(()=>validatedValue({...field,readOnly:true},'',teams)).toThrow('read-only')
  expect(()=>validatedValue({key:'status',label:'Status',options:['Resolved']},'Invalid',[])).toThrow('allowed')
 })
})
