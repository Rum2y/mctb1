import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const dir=await mkdtemp(`${tmpdir()}/mctb-test-`);
process.env.PGLITE_DIR=dir;
delete process.env.DATABASE_URL;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_PHONE_NUMBER;
process.env.OWNER_ALERTS='off';
const { query,one }=await import('../lib/db.js');
const { handleMissedCall,sendManualReply,handleInboundSms }=await import('../lib/textback.js');
const { getEnquiry,intakeState,submitIntake,updateEnquiry,enquiryStats,listEnquiries }=await import('../lib/enquiries.js');
const { intakeFields,dateField }=await import('../lib/enquiry-validation.js');
const { unansweredReplies,monthStats }=await import('../lib/stats.js');
function form(){const f=new FormData();for(const [k,v] of Object.entries({customer_name:'Test customer',job_type:'Bathroom renovation',area:'Edmonton',callback_time:'Tuesday evening',description:'Replace shower',permission:'on'}))f.set(k,v);return f;}
let e;
test('enquiry workflow with real local PostgreSQL engine',async t=>{
 await t.test('eligible missed call sends private intake link; retry creates no duplicate',async()=>{
  const result=await handleMissedCall({callSid:'CAsim-one',caller:'7805550199'});assert.equal(result.texted,true);
  e=await one('SELECT * FROM enquiries WHERE phone=$1',['+17805550199']);assert.ok(e);assert.equal(e.is_test,true);assert.equal(e.token.length,32);
  const message=await one("SELECT body FROM messages WHERE kind='auto'");assert.ok(message.body.includes(`/enquiry/${e.token}`));
  await handleMissedCall({callSid:'CAsim-one',caller:'7805550199'});assert.equal((await one('SELECT count(*)::int AS n FROM enquiries')).n,1);
 });
 await t.test('test traffic is excluded from live counters',async()=>{
  assert.equal((await enquiryStats()).waiting,0);assert.equal((await monthStats()).texted,0);assert.equal((await listEnquiries('test')).length,1);
 });
 await t.test('validated photo submission is atomic and cannot overwrite on replay',async()=>{
  const f=form();f.append('photos',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'job.png');
  const fields=await intakeFields(f);assert.equal(fields.photos.length,1);
  assert.ok(await submitIntake(e.token,fields));assert.equal(await submitIntake(e.token,{...fields,name:'Overwrite'}),null);
  const saved=await getEnquiry(e.id);assert.equal(saved.customer_name,'Test customer');assert.equal(saved.photo_count,1);assert.ok((await intakeState(e.token)).submitted_at);
 });
 await t.test('reject invalid upload, consent and dates',async()=>{
  const f=form();f.append('photos',new Blob(['<script>'],{type:'image/png'}),'bad.png');await assert.rejects(()=>intakeFields(f),/JPEG/);
  const missing=form();missing.delete('permission');await assert.rejects(()=>intakeFields(missing),/confirm/);
  const date=new FormData();date.set('date','2026-02-30');assert.throws(()=>dateField(date,'date'),/valid/);
  const many=form();for(let i=0;i<4;i++)many.append('photos',new Blob(['x'],{type:'image/png'}),'x.png');await assert.rejects(()=>intakeFields(many),/3 photos/);
 });
 await t.test('quote due reminder and stale-edit protection',async()=>{
  await query('UPDATE enquiries SET is_test=false WHERE id=$1',[e.id]);
  let current=await getEnquiry(e.id);
  const update={stage:'quote_due',quoteDue:'2020-01-01',bookingDate:null,notes:'Measure first',awaiting:false};
  assert.ok(await updateEnquiry(e.id,current.version,update));assert.equal(await updateEnquiry(e.id,current.version,update),null);
  assert.equal((await enquiryStats()).due,1);assert.equal((await listEnquiries('due')).length,1);
  current=await getEnquiry(e.id);await assert.rejects(()=>updateEnquiry(e.id,current.version,{...update,quoteDue:null}),/date/);
 });
 await t.test('customer reply returns enquiry to owner queue and failed reply stays pending',async()=>{
  await handleInboundSms({from:e.phone,body:'When can you call?'});assert.equal((await getEnquiry(e.id)).awaiting_owner,true);
  await query("INSERT INTO messages(phone,direction,kind,body,status,created_at) VALUES ($1,'out','manual','Failed response','failed',now()+interval '1 second')",[e.phone]);
  assert.equal((await unansweredReplies()).length,1);
  await sendManualReply(e.phone,'Tomorrow afternoon');assert.equal((await getEnquiry(e.id)).awaiting_owner,false);
 });
 await t.test('only explicit booking creates booked count and clears quote reminder',async()=>{
  const current=await getEnquiry(e.id);
  await updateEnquiry(e.id,current.version,{stage:'booked',quoteDue:null,bookingDate:'2027-01-12',notes:'Agreed by phone',awaiting:true});
  const stats=await enquiryStats();assert.equal(stats.booked,1);assert.equal(stats.due,0);assert.equal(stats.waiting,0);
  assert.equal((await listEnquiries('booked')).length,1);
 });
 await t.test('expired and invalid tokens cannot submit',async()=>{
  assert.equal(await intakeState('bad'),null);await query("UPDATE enquiries SET expires_at=now()-interval '1 day' WHERE id=$1",[e.id]);assert.equal(await intakeState(e.token),null);assert.equal(await submitIntake(e.token,await intakeFields(form())),null);
 });
});
test.after(async()=>{await rm(dir,{recursive:true,force:true});});
