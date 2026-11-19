import 'server-only';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {BadRequestException} from '@/lib/http';
function key(){const value=Buffer.from(process.env.GOOGLE_OAUTH_ENCRYPTION_KEY||'','base64');if(value.length!==32)throw new BadRequestException('Google authorization encryption is not configured on the server');return value;}
export function encryptGoogleToken(value:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(v=>v.toString('base64url')).join('.');}
export function decryptGoogleToken(value:string){try{const parts=value.split('.');if(parts.length!==3)throw new Error();const [iv,tag,data]=parts.map(v=>Buffer.from(v,'base64url'));const cipher=createDecipheriv('aes-256-gcm',key(),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');}catch{throw new BadRequestException('Google authorization could not be read. Reconnect the Google account or check the server encryption key.');}}
