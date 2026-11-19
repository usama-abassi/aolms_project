import 'server-only';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {db,type Database} from '@/lib/db';
import {type Actor} from '@/lib/auth';
import {BadRequestException,ForbiddenException,ConflictException} from '@/lib/http';
import {encryptGoogleToken,decryptGoogleToken} from './oauth-crypto';
const scopes=['openid','email','https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive.metadata.readonly'];
const hash=(s:string)=>createHash('sha256').update(s).digest('base64url');
export const googleStateCookie='aolms_google_oauth_state';
export function googleOAuthSettings(){
 const client=process.env.GOOGLE_OAUTH_CLIENT_ID,secret=process.env.GOOGLE_OAUTH_CLIENT_SECRET,redirect=process.env.GOOGLE_OAUTH_REDIRECT_URI;
 if(!client||!secret||!redirect)throw new BadRequestException('Google sign-in is not set up on the server. Ask an administrator to configure Google OAuth.');
 let url:URL;try{url=new URL(redirect);}catch{throw new BadRequestException('Invalid Google OAuth callback configuration');}
 if(url.pathname!=='/api/google-account/callback'||url.search||url.hash||url.username||url.password||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new BadRequestException('Google OAuth requires a registered HTTPS callback URL (HTTP is allowed for localhost)');
 encryptGoogleToken('configuration-check');
 return {client,secret,redirect,origin:url.origin};
}
async function tokenRequest(body:URLSearchParams){
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body,signal:AbortSignal.timeout(20000)});
 const value=await response.json().catch(()=>({}));
 if(!response.ok||!value.access_token)throw new BadRequestException(value.error==='invalid_grant'?'Google authorization expired or was revoked. Reconnect the Google account.':'Google authorization failed. Please try connecting again.');
 return value;
}
async function revoke(token:string){try{const response=await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',body:new URLSearchParams({token}),signal:AbortSignal.timeout(15000)});return response.ok;}catch{return false;}}
export class GoogleAccountService{
 constructor(private database:Database=db){}
 private lock(tx:Database){return tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['google-oauth-account']);}
 private async manager(tx:Database,userId:string){const [profile]=await tx.query('SELECT role,is_active FROM profiles WHERE id=$1',[userId]);if(!profile?.is_active||!['admin','controller'].includes(profile.role))throw new ForbiddenException('Google connection requires an active administrator or controller');return profile;}
 async status(actor:Actor){
  let ready=true;try{googleOAuthSettings();}catch{ready=false;}
  const [account]=await this.database.query('SELECT enabled,email,connected_by,connected_at FROM google_oauth_connection WHERE id=1');
  return {ready,connected:!!account?.enabled,email:account?.enabled?account.email:null,connected_at:account?.enabled?account.connected_at:null,can_remove:!!account?.enabled&&(account.connected_by===actor.userId||actor.role==='admin'),service_account_active:!account&&!!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL};
 }
 async start(actor:Actor){
  const settings=googleOAuthSettings(),state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  await this.database.transaction(async tx=>{
   await this.lock(tx);await this.manager(tx,actor.userId);
   const [current]=await tx.query('SELECT enabled,connected_by,version FROM google_oauth_connection WHERE id=1');
   if(current?.enabled)throw new ConflictException('Remove the connected Google account before connecting another.');
   await tx.query('DELETE FROM google_oauth_states WHERE expires_at<=now()');
   await tx.query(`INSERT INTO google_oauth_states(state_hash,user_id,verifier_ciphertext,connection_version,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')`,[hash(state),actor.userId,encryptGoogleToken(verifier),current?.version||0]);
  });
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:settings.client,redirect_uri:settings.redirect,response_type:'code',scope:scopes.join(' '),access_type:'offline',prompt:'consent select_account',state,code_challenge:hash(verifier),code_challenge_method:'S256'}).toString();return {url:url.toString(),state};
 }
 async complete(state:string,cookie:string,code:string|null,denied:boolean){
  if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!/^[A-Za-z0-9_-]{43}$/.test(cookie)||!timingSafeEqual(Buffer.from(state),Buffer.from(cookie)))throw new BadRequestException('Google authorization state is invalid. Start connecting again.');
  const [pending]=await this.database.query('DELETE FROM google_oauth_states WHERE state_hash=$1 AND expires_at>now() RETURNING *',[hash(state)]);
  if(!pending)throw new BadRequestException('Google authorization expired or has already been used. Start again.');
  if(denied)return 'cancelled';if(!code)throw new BadRequestException('Google authorization code is missing');
  const settings=googleOAuthSettings();
  return this.database.transaction(async tx=>{
   await this.lock(tx);await this.manager(tx,pending.user_id);
   const [current]=await tx.query('SELECT version FROM google_oauth_connection WHERE id=1');
   if((current?.version||0)!==pending.connection_version)throw new ConflictException('Google connection changed during sign-in. Start again.');
   const tokens=await tokenRequest(new URLSearchParams({client_id:settings.client,client_secret:settings.secret,code,code_verifier:decryptGoogleToken(pending.verifier_ciphertext),redirect_uri:settings.redirect,grant_type:'authorization_code'}));
   try{
    const granted=new Set(String(tokens.scope||'').split(' '));if(!scopes.filter(s=>s.startsWith('https://')).every(s=>granted.has(s)))throw new BadRequestException('Grant both Google Sheets and Drive metadata permissions to connect');
    if(!tokens.refresh_token)throw new BadRequestException('Google did not grant background access. Reconnect and approve the requested permissions.');
    const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)}),identity=await response.json();
    if(!response.ok||identity.email_verified!==true||typeof identity.email!=='string'||typeof identity.sub!=='string')throw new BadRequestException('Google account identity could not be verified');
    await tx.query(`INSERT INTO google_oauth_connection(id,enabled,email,google_subject,refresh_token_ciphertext,access_token_ciphertext,access_token_expires_at,connected_by,connected_at,version) VALUES(1,true,$1,$2,$3,$4,$5,$6,now(),1) ON CONFLICT(id) DO UPDATE SET enabled=true,email=EXCLUDED.email,google_subject=EXCLUDED.google_subject,refresh_token_ciphertext=EXCLUDED.refresh_token_ciphertext,access_token_ciphertext=EXCLUDED.access_token_ciphertext,access_token_expires_at=EXCLUDED.access_token_expires_at,connected_by=EXCLUDED.connected_by,connected_at=now(),version=google_oauth_connection.version+1`,[identity.email,identity.sub,encryptGoogleToken(tokens.refresh_token),encryptGoogleToken(tokens.access_token),new Date(Date.now()+Number(tokens.expires_in||3600)*1000),pending.user_id]);
    await tx.query('DELETE FROM google_oauth_states');return 'connected';
   }catch(error){await revoke(tokens.refresh_token||tokens.access_token);throw error;}
  });
 }
 async accessToken():Promise<string|null>{
  return this.database.transaction(async tx=>{
   await this.lock(tx);
   const [account]=await tx.query('SELECT * FROM google_oauth_connection WHERE id=1');
   if(!account)return null;
   if(!account.enabled||!account.refresh_token_ciphertext)throw new BadRequestException('No Google account is connected. Connect one in Configuration → Google Account.');
   await this.manager(tx,account.connected_by);
   if(account.access_token_ciphertext&&new Date(account.access_token_expires_at).getTime()>Date.now()+60000)return decryptGoogleToken(account.access_token_ciphertext);
   const settings=googleOAuthSettings(),tokens=await tokenRequest(new URLSearchParams({client_id:settings.client,client_secret:settings.secret,refresh_token:decryptGoogleToken(account.refresh_token_ciphertext),grant_type:'refresh_token'}));
   await tx.query('UPDATE google_oauth_connection SET access_token_ciphertext=$1,access_token_expires_at=$2,refresh_token_ciphertext=$3 WHERE id=1',[encryptGoogleToken(tokens.access_token),new Date(Date.now()+Number(tokens.expires_in||3600)*1000),tokens.refresh_token?encryptGoogleToken(tokens.refresh_token):account.refresh_token_ciphertext]);return tokens.access_token;
  });
 }
 async remove(actor:Actor){
  return this.database.transaction(async tx=>{
   await this.lock(tx);const manager=await this.manager(tx,actor.userId);const [account]=await tx.query('SELECT * FROM google_oauth_connection WHERE id=1');
   if(account?.enabled&&account.connected_by!==actor.userId&&manager.role!=='admin')throw new ForbiddenException('Only the account connector or an administrator can remove this Google account');
   let revoked=true;if(account?.enabled&&account.refresh_token_ciphertext){try{revoked=await revoke(decryptGoogleToken(account.refresh_token_ciphertext));}catch{revoked=false;}}
   await tx.query(`INSERT INTO google_oauth_connection(id,enabled,version) VALUES(1,false,1) ON CONFLICT(id) DO UPDATE SET enabled=false,email=NULL,google_subject=NULL,refresh_token_ciphertext=NULL,access_token_ciphertext=NULL,access_token_expires_at=NULL,connected_by=NULL,connected_at=NULL,version=google_oauth_connection.version+1`);
   await tx.query('DELETE FROM google_oauth_states');return {removed:true,revoked};
  });
 }
}
export const googleAccount=new GoogleAccountService();
