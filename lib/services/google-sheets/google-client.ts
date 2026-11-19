import 'server-only';
import {googleAccount} from './google-account';
import {createSign} from 'node:crypto';
import {BadRequestException} from '@/lib/http';
let cached:{token:string;expires:number;identity:string}|undefined;
async function accessToken(){
 const connected=await googleAccount.accessToken();if(connected)return connected;
 const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!email||!key)throw new BadRequestException('Google service account is not configured on the server');
 const identity=email+key;
 if(cached&&cached.identity===identity&&cached.expires>Date.now()+60000)return cached.token;
 const now=Math.floor(Date.now()/1000),encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const data=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:email,scope:'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const assertion=data+'.'+createSign('RSA-SHA256').update(data).sign(key,'base64url');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(20000)});
 const body=await response.json();if(!response.ok||!body.access_token)throw new BadRequestException('Google service account authentication failed. Check server credentials.');
 cached={token:body.access_token,expires:Date.now()+Number(body.expires_in)*1000,identity};return cached.token;
}
export class GoogleSheetsClient{
 async request(path:string,init:RequestInit={}){
  const token=await accessToken();
  for(let attempt=0;attempt<4;attempt++){
   const response=await fetch('https://'+path,{...init,headers:{...init.headers,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
   if(response.ok)return response.json();
   if((response.status===429||response.status>=500)&&attempt<3){const delay=Number(response.headers.get('Retry-After'));await new Promise(r=>setTimeout(r,Number.isFinite(delay)&&delay>0?Math.min(delay*1000,10000):500*2**attempt));continue;}
   if(response.status===401)throw new BadRequestException('Google authorization is no longer valid. Remove and reconnect the account in Configuration → Google Account.');
   if(response.status===403)throw new BadRequestException('Google denied access. Enable Sheets/Drive APIs and ensure the connected account can edit this spreadsheet; for service accounts, share the spreadsheet with that email.');
   if(response.status===404)throw new BadRequestException('Spreadsheet was deleted or the connected Google account cannot access it.');
   throw new BadRequestException(`Google API request failed (${response.status}). Retry later or check the spreadsheet and tab.`);
  }
 }
 async validate(spreadsheetId:string,tabName:string){
  const result=await this.request(`sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`);
  const tab=result.sheets?.find((s:any)=>s.properties.title===tabName);
  if(!tab)throw new BadRequestException(`Tab "${tabName}" was not found. Use the exact tab name.`);
  return {sheet_id:tab.properties.sheetId};
 }
 async revision(spreadsheetId:string){return this.request(`www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=version,modifiedTime&supportsAllDrives=true`);}
}
