import assert from "node:assert/strict";
import { test } from "node:test";
import { CloudPublisherApplicationService } from "../../apps/backend/src/services/cloud-publisher-application-service.ts";

function fakeFirestore() {
  let records = new Map();
  let sequence = 0;
  let running = Promise.resolve();
  let failCollection = "";
  function snapshot(ref, source) {
    const data = source.get(ref.path);
    return {id: ref.id, exists: data !== undefined, data: () => structuredClone(data)};
  }
  function query(collection, field, value, source) {
    const docs = [...source].filter(([path, data]) =>
      path.startsWith(`${collection}/`) && data[field] === value)
      .map(([path]) => snapshot({path, id: path.slice(collection.length + 1)}, source));
    return {docs};
  }
  const db = {
    failWritesTo(value) { failCollection = value; },
    collection(name) {
      return {
        doc(id = `generated-${++sequence}`) {
          return {id, path: `${name}/${id}`, async get() { return snapshot({id, path: `${name}/${id}`}, records); }};
        },
        where(field, op, value) {
          assert.equal(op, "==");
          return {collection: name, field, value, async get() { return query(name, field, value, records); }};
        },
      };
    },
    runTransaction(operation) {
      const task = running.then(async () => {
        const staged = structuredClone(records);
        const tx = {
          async get(ref) {
            return ref.path ? snapshot(ref, staged) : query(ref.collection, ref.field, ref.value, staged);
          },
          set(ref, data) {
            if (ref.path.startsWith(`${failCollection}/`)) throw new Error("storage write failed");
            staged.set(ref.path, structuredClone(data));
          },
          create(ref, data) {
            if (ref.path.startsWith(`${failCollection}/`)) throw new Error("storage write failed");
            assert.equal(staged.has(ref.path), false);
            staged.set(ref.path, structuredClone(data));
          },
        };
        const result = await operation(tx);
        records = staged;
        return result;
      });
      running = task.then(() => undefined, () => undefined);
      return task;
    },
    values(collection) {
      return [...records].filter(([path]) => path.startsWith(`${collection}/`))
        .map(([, data]) => structuredClone(data));
    },
  };
  return db;
}

const dto = {publisherName: "Publisher", legalRepresentativeName: "Representative",
  independentPublisher: true, publisherEmail: "publisher@example.com"};
const start = Date.parse("2026-11-25T00:00:00.000Z");

test("cloud application persists across service instances and serializes duplicate submissions", async () => {
  const db = fakeFirestore();
  const first = new CloudPublisherApplicationService(() => db, () => start);
  const second = new CloudPublisherApplicationService(() => db, () => start);
  const outcomes = await Promise.allSettled([first.submitApplication("alice", dto), second.submitApplication("alice", dto)]);
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.find(result => result.status === "rejected").reason.message, "DUPLICATE_ACTIVE_APPLICATION");
  assert.equal((await second.getMyApplications("alice")).length, 1);
  assert.equal((await second.getMyApplications("bob")).length, 0);
  assert.equal(db.values("publisherApplicationAudit").length, 1);
});

test("cloud withdrawal and rejection compare revisions and commit audit and notification atomically", async () => {
  const db = fakeFirestore();
  const service = new CloudPublisherApplicationService(() => db, () => start);
  const application = await service.submitApplication("alice", dto);
  await assert.rejects(service.withdrawApplication(application.id, "bob", 1), {message: "FORBIDDEN"});
  await assert.rejects(service.rejectApplication(application.id, "mod", "Incomplete", 2), {name: "ApplicationRevisionConflictError"});
  db.failWritesTo("notifications");
  await assert.rejects(service.rejectApplication(application.id, "mod", "Incomplete", 1), {name: "PublisherApplicationStoreError"});
  assert.equal((await service.getMyApplications("alice"))[0].status, "pending");
  assert.equal(db.values("publisherApplicationAudit").length, 1);
  db.failWritesTo("");
  const outcomes = await Promise.allSettled([
    service.withdrawApplication(application.id, "alice", 1),
    service.rejectApplication(application.id, "mod", "Incomplete", 1),
  ]);
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  const saved = (await service.getMyApplications("alice"))[0];
  assert.equal(saved.revision, 2);
  assert.equal(db.values("publisherApplicationAudit").length, 2);
  assert.equal(db.values("notifications").length, saved.status === "rejected" ? 1 : 0);
});

test("cloud submission audit failure rolls back the application and guard", async () => {
  const db = fakeFirestore();
  const service = new CloudPublisherApplicationService(() => db, () => start);
  db.failWritesTo("publisherApplicationAudit");
  await assert.rejects(service.submitApplication("alice", dto), {name: "PublisherApplicationStoreError"});
  assert.equal(db.values("publisherApplications").length, 0);
  assert.equal(db.values("publisherApplicationGuards").length, 0);
  db.failWritesTo("");
  assert.equal((await service.submitApplication("alice", dto)).status, "pending");
});

test("approval of an unknown application is reported as not found", async () => {
  const service = new CloudPublisherApplicationService(() => fakeFirestore(), () => start, fakeRoles());
  await assert.rejects(service.approveApplication("id", "moderator"), {message: "APPLICATION_NOT_FOUND"});
});

test("cloud expiration is transactional and repeated reads send one notification", async () => {
  const db = fakeFirestore();
  let time = start;
  const service = new CloudPublisherApplicationService(() => db, () => time);
  const application = await service.submitApplication("alice", dto);
  time = Date.parse(application.expiresAt);
  const results = await Promise.all([service.getMyApplications("alice"), service.getMyApplications("alice")]);
  assert.ok(results.every(list => list[0].status === "expired" && list[0].revision === 2));
  assert.equal(db.values("notifications").length, 1);
  assert.equal(db.values("publisherApplicationAudit").length, 2);
  assert.equal((await service.submitApplication("alice", dto)).status, "pending");
});

function fakeRoles(initial = {}) {
  const roles = new Map(Object.entries(initial));
  const calls = [];
  let failSets = 0;
  return {
    roles, calls,
    failNextSets(count = 1) { failSets = count; },
    async getRole(uid) {
      if (!roles.has(uid)) throw Object.assign(new Error("missing"), {code: "auth/user-not-found"});
      return roles.get(uid);
    },
    async setRole(uid, role, allowed) {
      calls.push([uid, role]);
      if (failSets > 0) { failSets--; throw new Error("provider unavailable"); }
      if (!allowed.includes(roles.get(uid))) throw new Error("INVALID_STATE");
      roles.set(uid, role);
    },
  };
}

test("approval records decision, audit, notice and role once, and completes the role change", async () => {
  const db = fakeFirestore();
  const roles = fakeRoles({alice: "reader"});
  const service = new CloudPublisherApplicationService(() => db, () => start, roles);
  const application = await service.submitApplication("alice", dto);
  await assert.rejects(service.approveApplication(application.id, "mod", 2), {name: "ApplicationRevisionConflictError"});
  assert.equal(roles.roles.get("alice"), "reader");
  const approved = await service.approveApplication(application.id, "mod", 1);
  assert.equal(approved.status, "approved");
  assert.equal(roles.roles.get("alice"), "publisher");
  assert.equal(db.values("publisherRoleChanges")[0].status, "completed");
  assert.equal(db.values("notifications").filter(n => n.type === "publisher_application_approved").length, 1);
  await assert.rejects(service.approveApplication(application.id, "mod", 2), {message: "INVALID_STATE"});
  await assert.rejects(service.submitApplication("alice", dto), {message: "DUPLICATE_ACTIVE_APPLICATION"});
});

test("a role provider failure keeps the recorded decision and a retry completes it exactly once", async () => {
  const db = fakeFirestore();
  const roles = fakeRoles({alice: "reader"});
  const service = new CloudPublisherApplicationService(() => db, () => start, roles);
  const application = await service.submitApplication("alice", dto);
  roles.failNextSets();
  await assert.rejects(service.approveApplication(application.id, "mod", 1), {name: "RoleSyncPendingError"});
  assert.equal(roles.roles.get("alice"), "reader");
  assert.equal(db.values("publisherRoleChanges")[0].status, "pending");
  const retried = await service.approveApplication(application.id, "mod", 1);
  assert.equal(retried.status, "approved");
  assert.equal(roles.roles.get("alice"), "publisher");
  assert.equal(db.values("publisherRoleChanges")[0].status, "completed");
  assert.equal(db.values("notifications").length, 1);
  assert.equal(db.values("publisherApplicationAudit").filter(a => a.action === "approved").length, 1);
});

test("approval never changes a moderator and rolls back if its records cannot be written", async () => {
  const db = fakeFirestore();
  const roles = fakeRoles({alice: "reader", mod2: "moderator"});
  const service = new CloudPublisherApplicationService(() => db, () => start, roles);
  const moderatorApplication = await service.submitApplication("mod2", dto);
  await assert.rejects(service.approveApplication(moderatorApplication.id, "mod", 1), {message: "INVALID_STATE"});
  assert.equal(roles.roles.get("mod2"), "moderator");
  assert.equal((await service.getMyApplications("mod2"))[0].status, "pending");
  const application = await service.submitApplication("alice", dto);
  db.failWritesTo("notifications");
  await assert.rejects(service.approveApplication(application.id, "mod", 1), {name: "PublisherApplicationStoreError"});
  assert.equal(roles.roles.get("alice"), "reader");
  assert.equal(roles.calls.length, 0);
  assert.equal((await service.getMyApplications("alice"))[0].status, "pending");
  assert.equal(db.values("publisherRoleChanges").length, 0);
});

test("competing approval and rejection of one revision produce a single decision", async () => {
  const db = fakeFirestore();
  const roles = fakeRoles({alice: "reader"});
  const service = new CloudPublisherApplicationService(() => db, () => start, roles);
  const application = await service.submitApplication("alice", dto);
  const outcomes = await Promise.allSettled([
    service.approveApplication(application.id, "mod", 1),
    service.rejectApplication(application.id, "mod", "No", 1),
  ]);
  assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1);
  const saved = (await service.getMyApplications("alice"))[0];
  assert.equal(saved.revision, 2);
  assert.equal(roles.roles.get("alice"), saved.status === "approved" ? "publisher" : "reader");
});

test("revocation removes the role, releases the application, notifies, and retries safely", async () => {
  const db = fakeFirestore();
  const roles = fakeRoles({alice: "reader"});
  const service = new CloudPublisherApplicationService(() => db, () => start, roles);
  const application = await service.submitApplication("alice", dto);
  await service.approveApplication(application.id, "mod", 1);
  roles.failNextSets();
  await assert.rejects(service.revokePublisher("alice", "mod", " Policy breach "), {name: "RoleSyncPendingError"});
  assert.equal(roles.roles.get("alice"), "publisher");
  await service.revokePublisher("alice", "mod", "Policy breach");
  assert.equal(roles.roles.get("alice"), "reader");
  const [saved] = await service.getMyApplications("alice");
  assert.ok(saved.revokedAt);
  assert.equal(db.values("notifications").filter(n => n.type === "publisher_revoked").length, 1);
  assert.equal(db.values("publisherApplicationAudit").filter(a => a.action === "publisher_revoked").length, 1);
  assert.equal((await service.submitApplication("alice", dto)).status, "pending");
  await assert.rejects(service.revokePublisher("alice", "mod", "Again"), {message: "INVALID_STATE"});
  await assert.rejects(service.revokePublisher("alice", "mod", "  "), /decisionReason/);
  await assert.rejects(service.revokePublisher("ghost", "mod", "Reason"), {message: "INVALID_STATE"});
});

test("revocation never demotes a moderator", async () => {
  const roles = fakeRoles({boss: "moderator"});
  const service = new CloudPublisherApplicationService(() => fakeFirestore(), () => start, roles);
  await assert.rejects(service.revokePublisher("boss", "mod", "Reason"), {message: "INVALID_STATE"});
  assert.equal(roles.roles.get("boss"), "moderator");
});
