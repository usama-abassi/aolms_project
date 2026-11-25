'use client';
import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import Link from 'next/link';
import {supabase,temporaryAuth} from '@/lib/supabase-browser';
import {Button} from '../../components/Button';
import {Input} from '../../components/Input';

function PasswordPanel({title,children}:{title:string;children:ReactNode}){
 return <section className="mx-auto my-8 max-w-md space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
  <h1 className="text-h3 font-semibold">{title}</h1>{children}
 </section>;
}
const linkStyle='text-sm text-primary-700 underline dark:text-primary-300';
const generic='If the address is registered, an email with a reset link will arrive shortly. Check your spam folder too.';
export function ForgotPassword(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||sent)return;
  setBusy(true);setError('');
  try{
   if(!supabase)throw new Error();
   await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:new URL('/reset-password',window.location.origin).href});
   setSent(true);
  }catch{setError('Could not send a reset request right now. Please wait a moment and try again.');}
  finally{setBusy(false);}
 }
 return <PasswordPanel title="Forgot password">
  {sent?<p role="status">{generic}</p>:<form onSubmit={submit} className="space-y-4">
   <p className="text-sm text-neutral-600 dark:text-neutral-300">Enter the email you use to sign in to AOLMS.</p>
   <Input label="Email address" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/>
   {error&&<p role="alert">{error}</p>}
   <Button type="submit" isLoading={busy}>Send reset link</Button>
  </form>}
  <Link href="/login" className={linkStyle}>Back to sign in</Link>
 </PasswordPanel>;
}

export function PasswordForm({recovery=false}:{recovery?:boolean}){
 const session=useRef<Promise<{auth:NonNullable<ReturnType<typeof temporaryAuth>>;userId:string}|null>|null>(null);
 const [linkState,setLinkState]=useState<'checking'|'ready'|'invalid'>(recovery?'checking':'ready');
 const [old,setOld]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{
  if(!recovery)return;
  if(!session.current){
   session.current=(async()=>{
    const hash=new URLSearchParams(window.location.hash.slice(1));
    const access_token=hash.get('access_token'),refresh_token=hash.get('refresh_token');
    if(window.location.hash)window.history.replaceState(window.history.state,'',window.location.pathname);
    if(hash.get('type')!=='recovery'||!access_token||!refresh_token)return null;
    const auth=temporaryAuth();if(!auth)return null;
    const {data,error}=await auth.setSession({access_token,refresh_token});
    return error||!data.session||!data.user?null:{auth,userId:data.user.id};
   })();
  }
  let active=true;
  void session.current.then(result=>{if(active)setLinkState(result?'ready':'invalid');}).catch(()=>{if(active)setLinkState('invalid');});
  return ()=>{active=false;};
 },[recovery]);
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||done)return;
  setError('');
  if(next.length<8||new TextEncoder().encode(next).length>72){setError('Use at least 8 characters and no more than 72 bytes.');return;}
  if(next!==confirm){setError('The new passwords do not match.');return;}
  if(!recovery&&next===old){setError('Choose a password different from your current one.');return;}
  setBusy(true);
  try{
   let auth:NonNullable<ReturnType<typeof temporaryAuth>>;
   if(recovery){
    const link=await session.current;
    if(!link)throw new Error('Request a new password reset link.');
    auth=link.auth;
   }else{
    const user=(await supabase?.auth.getUser())?.data.user;
    const verifier=temporaryAuth();
    if(!user?.email||!verifier)throw new Error('Please sign in again.');
    const {data,error}=await verifier.signInWithPassword({email:user.email,password:old});
    if(error||data.user?.id!==user.id)throw new Error('Could not verify your current password. Check it and try again.');
    auth=verifier;
   }
   const {data,error}=await auth.updateUser({password:next,...(!recovery?{current_password:old}:{})});
   if(error){
    if(!recovery)await auth.signOut({scope:'local'});
    throw error;
   }
   setOld('');setNext('');setConfirm('');setDone(true);
   await auth.signOut({scope:'global'});
   session.current=null;
   const current=(await supabase?.auth.getSession())?.data.session;
   if(current?.user.id===data.user?.id)await supabase?.auth.signOut({scope:'local'});
  }catch(e){setError(e instanceof Error?e.message:'Could not update the password. Please try again.');}
  finally{setBusy(false);}
 }
 return <PasswordPanel title={recovery?'Reset password':'Change password'}>
  {done?<><p role="status">Password updated. Sign in with your new password.</p><Link href="/login" className={linkStyle}>Sign in</Link></>:
   linkState==='checking'?<p role="status">Validating your reset link…</p>:
   linkState==='invalid'?<><p role="alert">This reset link is invalid or expired.</p><Link href="/forgot-password" className={linkStyle}>Request a new link</Link></>:
   <form onSubmit={submit} className="space-y-4">
    {!recovery&&<Input label="Current password" type="password" autoComplete="current-password" value={old} onChange={e=>setOld(e.target.value)} required/>}
    <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." minLength={8} value={next} onChange={e=>setNext(e.target.value)} required/>
    <Input label="Confirm new password" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} required/>
    {error&&<p role="alert">{error}</p>}
    <Button type="submit" isLoading={busy}>{recovery?'Reset password':'Change password'}</Button>
   </form>}
 </PasswordPanel>;
}
