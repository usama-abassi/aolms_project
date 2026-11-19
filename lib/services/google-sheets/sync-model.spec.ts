import {describe,it,expect} from 'vitest';
import {mergeCells,recordMonth,sameValues} from './sync-model';
describe('incremental sheet conflict planning',()=>{
 it('gives conflicting remote cell changes priority while retaining unrelated local edits',()=>{expect(mergeCells({a:'base',b:'base'},{a:'local',b:'local'},{a:'sheet',b:'base'})).toEqual({merged:{a:'sheet',b:'local'},proposed:{b:'local'},conflicts:['a']});});
 it('preserves historical values for removed columns',()=>{expect(mergeCells({old:'history'},{old:'history'},{}).merged).toEqual({old:'history'});});
 it('detects unchanged values independently of column order',()=>{expect(sameValues({a:'1',b:'2'},{b:'2',a:'1'})).toBe(true);});
 it('uses the actual controller date rather than current month',()=>{expect(recordMonth('2025-02-12')).toBe('2025-02');expect(recordMonth('12/02/2025')).toBe('2025-02');expect(recordMonth('')).toBeNull();});
});
