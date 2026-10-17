// Disposable local Supabase only. No .env files or production credentials are loaded.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const { TEST_SUPABASE_URL:url, TEST_SUPABASE_ANON_KEY:anon, TEST_SUPABASE_SERVICE_ROLE_KEY:secret }=process.env;
if(!url || !anon || !secret || !["localhost","127.0.0.1","[::1]"].includes(new URL(url).hostname)) {
  console.error("NOT RUN: provide TEST_SUPABASE_URL (loopback only), TEST_SUPABASE_ANON_KEY and TEST_SUPABASE_SERVICE_ROLE_KEY for a disposable local stack.");
  process.exit(2);
}
const client=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=client(secret), users=[], paths=[];
const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
const denied=r=>assert.ok(r.error,"Unauthorized operation unexpectedly succeeded");
try {
  for(let i=0;i<2;i++) {
    const email=`rls-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";
    const id=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user.id;
    const u={id,db:client(anon)};users.push(u);
    ok(await u.db.auth.signInWithPassword({email,password}));
    u.visit={id:randomUUID(),user_id:id,city_name:"Fixture",country:"Test",continent:"Europe",latitude:1,longitude:2,overall_rating:4,personal_rating:4,culture_rating:null,architecture_rating:null,food_rating:null,date_from:null,date_to:null};
    u.list={id:randomUUID(),user_id:id,title:"Fixture",position:0};
    u.wish={id:randomUUID(),user_id:id,city_name:"Fixture",country:"Test",continent:"Europe",latitude:3,longitude:4};
    u.entry={id:randomUUID(),user_id:id,list_id:u.list.id,visit_id:u.visit.id,position:0};
    for(const [table,row] of [["visits",u.visit],["personal_lists",u.list],["wishlist_cities",u.wish],["personal_list_cities",u.entry]]) ok(await u.db.from(table).insert(row));
    u.path=`${id}/${u.visit.id}/fixture.png`;
    ok(await u.db.storage.from("visit-photos").upload(u.path,new Uint8Array([137,80,78,71,13,10,26,10]),{contentType:"image/png"}));paths.push(u.path);
    u.photo={id:randomUUID(),user_id:id,visit_id:u.visit.id,storage_path:u.path};
    ok(await u.db.from("visit_photographs").insert(u.photo));
  }
  for(const [a,b] of [[users[0],users[1]],[users[1],users[0]]]) {
    for(const [table,row,change] of [
      ["profiles",{id:b.id},{display_name:"forbidden"}], ["visits",b.visit,{note:"forbidden"}],
      ["wishlist_cities",b.wish,{city_name:"forbidden"}], ["personal_lists",b.list,{title:"forbidden"}],
      ["personal_list_cities",b.entry,{position:42}], ["visit_photographs",b.photo,{storage_path:`${b.id}/${b.visit.id}/changed.png`}]
    ]) {
      assert.deepEqual(ok(await a.db.from(table).select("id").eq("id",row.id)),[],`${table} cross read`);
      assert.deepEqual(ok(await a.db.from(table).update(change).eq("id",row.id).select("id")),[],`${table} cross update`);
      assert.deepEqual(ok(await a.db.from(table).delete().eq("id",row.id).select("id")),[],`${table} cross delete`);
      denied(await a.db.from(table).insert({...row,id:table==="profiles"?b.id:randomUUID()}));
      assert.equal(ok(await b.db.from(table).select("id").eq("id",row.id)).length,1,`${table} own fixture missing`);
    }
    denied(await a.db.rpc("replace_personal_list_cities",{target_list_id:b.list.id,ordered_visit_ids:[]}));
    denied(await a.db.rpc("replace_personal_list_cities",{target_list_id:a.list.id,ordered_visit_ids:[b.visit.id]}));
    for(const path of [`${b.id}/${b.visit.id}/foreign.png`,`${a.id}/${b.visit.id}/unrelated.png`,`${a.id}/${a.visit.id}/../escape.png`]) {
      denied(await a.db.from("visit_photographs").insert({user_id:a.id,visit_id:a.visit.id,storage_path:path}));
    }
    denied(await a.db.from("visit_photographs").insert({user_id:a.id,visit_id:b.visit.id,storage_path:`${a.id}/${b.visit.id}/wrong.png`}));
    denied(await a.db.storage.from("visit-photos").download(b.path));
    await a.db.storage.from("visit-photos").remove([b.path]);
    ok(await b.db.storage.from("visit-photos").download(b.path));
    denied(await a.db.storage.from("visit-photos").upload(`${a.id}/${b.visit.id}/wrong.png`,new Uint8Array([1]),{contentType:"image/png"}));
    denied(await a.db.storage.from("visit-photos").update(b.path,new Uint8Array([2]),{contentType:"image/png"}));
    denied(await a.db.functions.invoke("delete-visit",{body:{visit_id:b.visit.id}}));
    denied(await a.db.functions.invoke("delete-visit",{body:{visit_id:"invalid"}}));
    assert.equal(ok(await b.db.from("visits").select("id").eq("id",b.visit.id)).length,1);
  }
  const anonymous=client(anon);
  denied(await anonymous.rpc("replace_personal_list_cities",{target_list_id:users[0].list.id,ordered_visit_ids:[]}));
  denied(await anonymous.functions.invoke("delete-account",{body:{user_id:users[0].id}}));
  for(const u of users) ok(await u.db.rpc("replace_personal_list_cities",{target_list_id:u.list.id,ordered_visit_ids:[u.visit.id]}));
  assert.equal(ok(await users[0].db.functions.invoke("delete-visit",{body:{visit_id:users[0].visit.id}})).deleted,true);
  assert.deepEqual(ok(await admin.from("visit_photographs").select("id").eq("visit_id",users[0].visit.id)),[]);
  denied(await admin.storage.from("visit-photos").download(users[0].path));
  // A misleading body must never change the verified caller's deletion target.
  assert.equal(ok(await users[1].db.functions.invoke("delete-account",{body:{user_id:users[0].id}})).deleted,true);
  users[1].deleted=true;
  ok(await admin.auth.admin.getUserById(users[0].id));
  for(const table of ["profiles","visits","visit_photographs","wishlist_cities","personal_lists","personal_list_cities"]) {
    assert.deepEqual(ok(await admin.from(table).select("id").eq(table==="profiles"?"id":"user_id",users[1].id)),[]);
  }
  denied(await admin.storage.from("visit-photos").download(users[1].path));
  console.log("PASS: two-way table isolation, RPC, storage ownership and rejected deletion requests.");
} finally {
  // Cleanup only this run's fixtures, on the strictly loopback stack.
  if(paths.length) ok(await admin.storage.from("visit-photos").remove(paths));
  for(const user of users) if(!user.deleted) ok(await admin.auth.admin.deleteUser(user.id));
}
