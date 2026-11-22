import assert from "node:assert/strict";
import { test } from "node:test";

import {
  publisherApplicationRepository,
} from "../../apps/backend/src/repositories/publisher-application-repository.ts";
import {
  publisherApplicationService,
} from "../../apps/backend/src/services/publisher-application-service.ts";
import {
  notificationRepository,
} from "../../apps/backend/src/repositories/notification-repository.ts";

const validApplication = {
  publisherName: "Northstar Publishing",
  legalRepresentativeName: "Juan Carlos Zuniga Alfaro",
  independentPublisher: true,
  publisherEmail: "northstar@example.com",
  website: "https://northstar.example.com",
};

test("S2-AC-001: reader submits a valid application", async () => {
  const before = Date.now();
  const application = await publisherApplicationService.submitApplication(
    "reader-s2-ac-001",
    validApplication,
  );
  const after = Date.now();

  assert.equal(application.status, "pending");
  assert.equal(application.revision, 1);

  const expiresAt = new Date(application.expiresAt).getTime();
  const expectedMinimum = before + 30 * 24 * 60 * 60 * 1000;
  const expectedMaximum = after + 30 * 24 * 60 * 60 * 1000;
  assert.ok(expiresAt >= expectedMinimum);
  assert.ok(expiresAt <= expectedMaximum);

  const stored = await publisherApplicationRepository.findById(application.id);
  assert.deepEqual(stored, application);
});

test("S2-AC-001: a pending application prevents a duplicate submission", async () => {
  await publisherApplicationService.submitApplication(
    "reader-s2-duplicate",
    validApplication,
  );

  await assert.rejects(
    () =>
      publisherApplicationService.submitApplication(
        "reader-s2-duplicate",
        validApplication,
      ),
    /DUPLICATE_ACTIVE_APPLICATION/,
  );
});

test("S2-AC-001: applicant withdraws pending application and resubmits", async () => {
  const application = await publisherApplicationService.submitApplication(
    "reader-s2-withdraw",
    validApplication,
  );

  const withdrawn = await publisherApplicationService.withdrawApplication(
    application.id,
    "reader-s2-withdraw",
  );
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(withdrawn.revision, 2);

  const replacement =
    await publisherApplicationService.submitApplication(
      "reader-s2-withdraw",
      {
        ...validApplication,
        publisherName: "Northstar Publishing 2",
      },
    );
  assert.equal(replacement.status, "pending");
  assert.equal(replacement.revision, 1);
});

test("S2-AC-002: moderator approves a pending application", async () => {
  const application = await publisherApplicationService.submitApplication(
    "reader-s2-approved",
    validApplication,
  );

  const approved = await publisherApplicationService.approveApplication(
    application.id,
    "moderator-s2-001",
  );

  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewerUid, "moderator-s2-001");
  assert.equal(approved.revision, 2);
  assert.ok(approved.reviewedAt);

  const notifications =
    await notificationRepository.findByUserId("reader-s2-approved");
  assert.ok(
    notifications.some(
      (notification) =>
        notification.type === "publisher_application_approved",
    ),
  );
});

test("S2-AC-003: moderator rejects with reason and rejects missing reason", async () => {
  const application = await publisherApplicationService.submitApplication(
    "reader-s2-rejected",
    validApplication,
  );

  await assert.rejects(
    () =>
      publisherApplicationService.rejectApplication(
        application.id,
        "moderator-s2-002",
        " ",
      ),
    /decisionReason/,
  );

  const rejected = await publisherApplicationService.rejectApplication(
    application.id,
    "moderator-s2-002",
    "The publisher identity could not be verified.",
  );

  assert.equal(rejected.status, "rejected");
  assert.equal(
    rejected.decisionReason,
    "The publisher identity could not be verified.",
  );
  assert.equal(rejected.revision, 2);

  const notifications =
    await notificationRepository.findByUserId("reader-s2-rejected");
  assert.ok(
    notifications.some(
      (notification) =>
        notification.type === "publisher_application_rejected",
    ),
  );
});
