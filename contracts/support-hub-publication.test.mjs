import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupportHubPublicationManifest,
  serializeSupportHubPublicationManifest,
} from "./support-hub-publication.mjs";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

function validVideoInput() {
  return {
    source: {
      content_key: "shared.invite-team-member",
      version: "docstudio-v7",
    },
    content: {
      kind: "video",
      title: "Invite a team member",
      summary: "A reusable administrator walkthrough for inviting a team member.",
      locale: "en-US",
      access_level: "customer",
    },
    artifact: {
      sha256: A,
      media_type: "video/mp4",
      byte_length: 845219,
      duration_ms: 92000,
      captions_sha256: B,
      transcript_sha256: C,
    },
    governance: {
      review_state: "approved",
      phi_review: "passed",
      approved_at: "2026-09-07T16:30:00Z",
      policy_version: "docstudio-phi-free-v1",
    },
    placements: [
      {
        product_slug: "caremetric-emr",
        audience: ["customer-admin"],
        route_pattern: "/admin/team/**",
      },
      {
        product_slug: "breathe",
        audience: ["customer-admin"],
        route_pattern: "/team/**",
      },
    ],
  };
}

test("builds one content-addressed video artifact for multiple product placements", () => {
  const manifest = buildSupportHubPublicationManifest(validVideoInput());

  assert.equal(manifest.schema_version, "caremetric.support-hub.publication.v1");
  assert.equal(manifest.source_system, "docstudio");
  assert.deepEqual(
    manifest.placements.map(({ product_slug }) => product_slug),
    ["breathe", "caremetric-emr"],
  );
  assert.equal(manifest.artifact.sha256, A);
  assert.equal(JSON.stringify(manifest).match(new RegExp(A, "g")).length, 1);
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.placements));
});

test("serialized manifests expose no URL, storage location, renderer, or identity metadata", () => {
  const serialized = serializeSupportHubPublicationManifest(validVideoInput());

  for (const forbidden of [
    "http://",
    "https://",
    "heygen",
    "storage_path",
    "public_url",
    "renderer_job_id",
    "organization_id",
    "tenant_id",
    "user_id",
    "record_id",
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("rejects DocStudio and unknown customer product slugs", () => {
  for (const product_slug of ["docstudio", "app-studio", "unknown-product"]) {
    const input = validVideoInput();
    input.placements[0].product_slug = product_slug;
    assert.throws(
      () => buildSupportHubPublicationManifest(input),
      /must be a registered Support Hub product/,
    );
  }
});

test("rejects extra source, tenant, user, record, and URL fields", () => {
  const cases = [
    ["manifest", (input) => { input.tenant_id = "tenant-1"; }],
    ["source", (input) => { input.source.organization_id = "org-1"; }],
    ["content", (input) => { input.content.target_url = "https://example.test"; }],
    ["artifact", (input) => { input.artifact.public_url = "https://example.test/video.mp4"; }],
    ["governance", (input) => { input.governance.approved_by = "user-1"; }],
    ["placement", (input) => { input.placements[0].record_id = "record-1"; }],
  ];

  for (const [name, mutate] of cases) {
    const input = validVideoInput();
    mutate(input);
    assert.throws(
      () => buildSupportHubPublicationManifest(input),
      /forbidden or unknown field/,
      name,
    );
  }
});

test("rejects provider URLs and high-risk PHI-shaped catalog text", () => {
  const values = [
    "Watch at https://app.heygen.com/video/secret",
    "Email patient@example.com for details",
    "Call 877-521-2890 for details",
    "Patient ID: 12345",
    "DOB instructions",
    "Clinical note: example text",
    "Record 123e4567-e89b-12d3-a456-426614174000",
  ];

  for (const value of values) {
    const input = validVideoInput();
    input.content.summary = value;
    assert.throws(() => buildSupportHubPublicationManifest(input), TypeError, value);
  }
});

test("requires completed editorial and PHI review attestations", () => {
  const notApproved = validVideoInput();
  notApproved.governance.review_state = "review";
  assert.throws(() => buildSupportHubPublicationManifest(notApproved), /must be approved/);

  const phiNotReviewed = validVideoInput();
  phiNotReviewed.governance.phi_review = "pending";
  assert.throws(() => buildSupportHubPublicationManifest(phiNotReviewed), /must be passed/);

  const wrongPolicy = validVideoInput();
  wrongPolicy.governance.policy_version = "legacy";
  assert.throws(
    () => buildSupportHubPublicationManifest(wrongPolicy),
    /must be docstudio-phi-free-v1/,
  );

  const impossibleDate = validVideoInput();
  impossibleDate.governance.approved_at = "2026-02-31T16:30:00Z";
  assert.throws(
    () => buildSupportHubPublicationManifest(impossibleDate),
    /must be a real calendar instant/,
  );
});

test("accepts only static, non-record route context", () => {
  for (const route_pattern of [
    "https://app.example.test/admin",
    "/patients/12345",
    "/patients/123e4567-e89b-12d3-a456-426614174000",
    "/patients/:patientId",
    "/admin?tenant=one",
    "/admin#record",
    "/../admin",
    "/admin//team",
    "/admin/*/team",
  ]) {
    const input = validVideoInput();
    input.placements[0].route_pattern = route_pattern;
    assert.throws(() => buildSupportHubPublicationManifest(input), TypeError, route_pattern);
  }
});

test("rejects duplicate product placements instead of duplicating an artifact", () => {
  const input = validVideoInput();
  input.placements[1].product_slug = "caremetric-emr";
  assert.throws(
    () => buildSupportHubPublicationManifest(input),
    /at most one placement per product/,
  );
});

test("supports approved Markdown articles without video-only metadata", () => {
  const input = validVideoInput();
  input.content.kind = "article";
  input.artifact = {
    sha256: A,
    media_type: "text/markdown",
    byte_length: 4821,
  };

  const manifest = buildSupportHubPublicationManifest(input);
  assert.equal(manifest.content.kind, "article");
  assert.deepEqual(manifest.artifact, input.artifact);
});

test("public exports require the all audience", () => {
  const input = validVideoInput();
  input.content.access_level = "public";
  assert.throws(
    () => buildSupportHubPublicationManifest(input),
    /public content must target only the all audience/,
  );
});
