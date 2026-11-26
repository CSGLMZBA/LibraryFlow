import assert from "node:assert/strict";
import {test} from "node:test";
import {FirestoreNotificationInbox} from "../../apps/backend/src/services/notification-inbox.ts";
import {createNotificationRouter} from "../../apps/backend/src/routes/notification-routes.ts";
import {createNotificationInboxService} from "../../apps/frontend/src/services/notification-inbox-service.ts";

function fakeFirestore() {
  const records = new Map([
    ["one", {userId:"alice", type:"account_restored", message:"Restored", read:false, createdAt:"2026-11-25T10:00:00Z"}],
    ["two", {userId:"bob", type:"ban_changed", message:"Private", read:false, createdAt:"2026-11-25T11:00:00Z"}],
  ]);
  return {
    records,
    collection(name) {
      assert.equal(name,"notifications");
      return {
        where(field,op,uid) {
          assert.equal(field,"userId"); assert.equal(op,"==");
          return {limit(n) {return {async get() {
            return {docs:[...records].filter(([,v])=>v.userId===uid).slice(0,n).map(([id,v])=>({id,data:()=>({...v})}))};
          }};}};
        },
        doc(id) {return {id};},
      };
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          const value=records.get(ref.id);
          return {exists:!!value,data:()=>value && {...value}};
        },
        update(ref, patch) {records.set(ref.id,{...records.get(ref.id),...patch});},
      });
    },
  };
}
function dispatch(router,method,url,token) {
  return new Promise((resolve,reject)=>{
    const res={locals:{},headers:{},statusCode:200,setHeader(key,value){this.headers[key]=value;},
      status(code){this.statusCode=code;return this;},json(body){this.body=body;resolve(this);return this;}};
    router.handle({method,url,headers:token?{authorization:`Bearer ${token}`}:{},body:{}},res,
      error=>reject(error??new Error("Route not handled")));
  });
}
const verify=async token => ["alice","bob"].includes(token)?{uid:token,role:"reader"}:null;

test("inbox queries only the verified recipient and marks only their records read",async()=>{
  const db=fakeFirestore();
  const router=createNotificationRouter(verify,new FirestoreNotificationInbox(()=>db));
  assert.equal((await dispatch(router,"GET","/")).statusCode,401);
  const alice=await dispatch(router,"GET","/?uid=bob","alice");
  assert.equal(alice.statusCode,200);
  assert.equal(alice.headers["Cache-Control"],"no-store");
  assert.deepEqual(alice.body.data.map(n=>n.id),["one"]);
  const denied=await dispatch(router,"POST","/two/read","alice");
  assert.equal(denied.statusCode,404);
  assert.equal(db.records.get("two").read,false);
  assert.equal((await dispatch(router,"POST","/one/read","alice")).statusCode,200);
  assert.equal((await dispatch(router,"POST","/one/read","alice")).statusCode,200);
  assert.equal(db.records.get("one").read,true);
});

test("inbox errors fail explicitly without disclosing private backend details",async()=>{
  const router=createNotificationRouter(verify,{async list(){throw new Error("private provider details");},async markRead(){throw new Error("private provider details");}});
  const result=await dispatch(router,"GET","/","alice");
  assert.equal(result.statusCode,503);
  assert.equal(result.body.error.code,"NOTIFICATIONS_UNAVAILABLE");
  assert.equal(JSON.stringify(result.body).includes("private provider details"),false);
});

test("frontend sends a verified bearer, supports mark-read, and surfaces failures",async()=>{
  const calls=[];
  const auth={async getCurrentSession(){return {user:{id:"alice"}};},getAccessToken(){return "token";}};
  const transport=async(url,init)=>{
    calls.push({url,init});
    return new Response(JSON.stringify({success:true,data:init.method==="GET"?[]:{read:true}}));
  };
  const inbox=createNotificationInboxService(auth,"https://api.example/",transport);
  assert.deepEqual(await inbox.list("alice"),[]);
  assert.deepEqual(await inbox.markRead("alice","notice 1"),{read:true});
  assert.equal(calls[0].init.headers.Authorization,"Bearer token");
  assert.equal(calls[0].init.cache,"no-store");
  assert.equal(calls[1].url,"https://api.example/api/v1/notifications/notice%201/read");
  const unavailable=createNotificationInboxService(auth,"https://api.example",async()=>{throw new Error("offline");});
  await assert.rejects(unavailable.list("alice"),{code:"NOTIFICATIONS_UNAVAILABLE"});
  const anonymous=createNotificationInboxService({async getCurrentSession(){},getAccessToken(){return null;}},"",transport);
  await assert.rejects(anonymous.list("alice"),{code:"AUTH_REQUIRED"});
  await assert.rejects(inbox.list("bob"),{code:"AUTH_REQUIRED"});
  await assert.rejects(inbox.markRead("bob","notice 1"),{code:"AUTH_REQUIRED"});
  assert.equal(calls.length, 2, "A changed account must not send an inbox request.");
  const staleToken=createNotificationInboxService({async getCurrentSession(){return null;},getAccessToken(){return "old-token";}},"",transport);
  await assert.rejects(staleToken.list("alice"),{code:"AUTH_REQUIRED"});
  assert.equal(calls.length, 2);

  let resolveSession;
  const delayed=createNotificationInboxService({
    getCurrentSession(){return new Promise(resolve=>{resolveSession=resolve;});},
    getAccessToken(){return "bob-token";},
  },"",transport);
  const pending=delayed.list("alice");
  resolveSession({user:{id:"bob"}});
  await assert.rejects(pending,{code:"AUTH_REQUIRED"});
  assert.equal(calls.length, 2, "A session switched during verification must not send a request.");
});
