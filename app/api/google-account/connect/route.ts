import {authenticate} from '@/lib/auth';
import {HttpException} from '@/lib/http';
import {googleAccount,googleOAuthSettings,googleStateCookie} from '@/lib/services/google-sheets/google-account';
export async function POST(request:Request){
 try{
  const actor=await authenticate(request,['admin','controller']);
  const {url,state}=await googleAccount.start(actor);
  return Response.json({url},{headers:{'Cache-Control':'no-store','Set-Cookie':`${googleStateCookie}=${state}; HttpOnly; SameSite=Lax; Path=/api/google-account; Max-Age=600${new URL(googleOAuthSettings().redirect).protocol==='https:'?'; Secure':''}`}});
 }catch(error){return Response.json({message:error instanceof HttpException?error.message:'Google connection could not start. Check server setup and try again.'},{status:error instanceof HttpException?error.status:500,headers:{'Cache-Control':'no-store'}});}
}
