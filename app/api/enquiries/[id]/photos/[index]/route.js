import { isLoggedIn } from '@/lib/auth';
import { one } from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(_request,{params}) {
  if(!(await isLoggedIn())) return new Response('Unauthorized',{status:401});
  const p=await params; const id=Number(p.id), index=Number(p.index);
  if(!Number.isSafeInteger(id)||id<1||!Number.isInteger(index)||index<0||index>2) return new Response('Not found',{status:404});
  const row=await one('SELECT photos -> $2::int AS photo FROM enquiries WHERE id=$1',[id,index]);
  if(!row?.photo) return new Response('Not found',{status:404});
  return new Response(Buffer.from(row.photo.data,'base64'),{headers:{'Content-Type':row.photo.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
