import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {generateKeyPairSync} from 'node:crypto';
vi.mock('./google-account',()=>({googleAccount:{accessToken:vi.fn(async()=>null)}}));
import {GoogleSheetsClient} from './google-client';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
beforeEach(()=>{vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL','test@example.com');vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',privateKey.export({type:'pkcs8',format:'pem'}).toString());});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function mockGoogle(status:number,data:unknown){const fetch=vi.fn(async(url:string)=>url.includes('oauth2.googleapis.com')?Response.json({access_token:'secret-token',expires_in:3600}):Response.json(data,{status}));vi.stubGlobal('fetch',fetch);return fetch;}
describe('Google service account access',()=>{
 it('selects the exact tab and does not expose credentials in the result',async()=>{mockGoogle(200,{sheets:[{properties:{title:'October',sheetId:12}}]});expect(await new GoogleSheetsClient().validate('spreadsheet','October')).toEqual({sheet_id:12});});
 it('rejects differently named or missing tabs',async()=>{mockGoogle(200,{sheets:[{properties:{title:'october',sheetId:12}}]});await expect(new GoogleSheetsClient().validate('spreadsheet','October')).rejects.toThrow('exact tab name');});
 it('reports sharing permission errors',async()=>{mockGoogle(403,{});await expect(new GoogleSheetsClient().validate('spreadsheet','October')).rejects.toThrow('share the spreadsheet');});
 it('reports deleted or inaccessible spreadsheets',async()=>{mockGoogle(404,{});await expect(new GoogleSheetsClient().validate('spreadsheet','October')).rejects.toThrow('deleted');});
 it('requires server-side credentials',async()=>{vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY','');await expect(new GoogleSheetsClient().validate('spreadsheet','October')).rejects.toThrow('not configured');});
});
