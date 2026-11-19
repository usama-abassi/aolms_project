import {describe,it,expect,vi} from 'vitest';
import {Database} from './db';
describe('nested synchronization transactions',()=>{
 it('uses a savepoint on the same connection',async()=>{const query=vi.fn().mockResolvedValue({rows:[]}),database=new Database({query} as any);await database.transaction(async inner=>{expect(inner).toBe(database);await inner.query('SELECT 1');});expect(query.mock.calls.map(c=>c[0].split(' ')[0])).toEqual(['SAVEPOINT','SELECT','RELEASE']);});
 it('rolls back the nested work before propagating an error',async()=>{const query=vi.fn().mockResolvedValue({rows:[]}),database=new Database({query} as any);await expect(database.transaction(async()=>{throw new Error('conflict');})).rejects.toThrow('conflict');expect(query.mock.calls.map(c=>c[0].split(' ')[0])).toEqual(['SAVEPOINT','ROLLBACK','RELEASE']);});
});
