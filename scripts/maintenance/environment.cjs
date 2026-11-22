const path=require('node:path');

require('dotenv').config({path:path.resolve(__dirname,'../../.env.local'),quiet:true});
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const url=new URL(process.env.DATABASE_URL);
process.env.DB_HOST=url.hostname;
process.env.DB_PORT=url.port||'5432';
process.env.DB_USERNAME=decodeURIComponent(url.username);
process.env.DB_PASSWORD=decodeURIComponent(url.password);
process.env.DB_DATABASE=url.pathname.slice(1)||'postgres';
