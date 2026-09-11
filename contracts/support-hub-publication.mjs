/**
 * Transport-independent contract for publishing approved DocStudio output to the
 * CareMetric Support Hub. This module deliberately performs no network or
 * storage access.
 */

export const SUPPORT_HUB_PUBLICATION_SCHEMA =
  "caremetric.support-hub.publication.v1";

export const REGISTERED_SUPPORT_HUB_PRODUCTS = Object.freeze([
  "breathe",
  "carebase",
  "caremetric-emr",
  "caremetric-go",
  "caremetric-intel",
  "pennsync",
]);

const PRODUCT_SLUGS = new Set(REGISTERED_SUPPORT_HUB_PRODUCTS);
const CONTENT_KINDS = new Set(["article", "video"]);
const ACCESS_LEVELS = new Set(["public", "customer", "staff"]);
const AUDIENCES = new Set(["all", "customer", "customer-admin", "manager"]);
const SHA256 = /^[a-f0-9]{64}$/;
// Match the Hub's immutable content keys and monotonic source-version contract.
const CONTENT_KEY = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SOURCE_VERSION = /^docstudio-v([1-9]\d{0,14})$/;
const LOCALE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

const SENSITIVE_TEXT_PATTERNS = [
  { pattern: /https?:\/\/|www\./i, reason: "web URLs are not permitted" },
  { pattern: /heygen/i, reason: "renderer/provider details are not permitted" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, reason: "email addresses are not permitted" },
  { pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/, reason: "phone numbers are not permitted" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, reason: "SSN-shaped values are not permitted" },
  { pattern: /\b(?:date of birth|dob|medical record number|mrn|social security(?: number)?|ssn)\b/i, reason: "PHI identifier labels are not permitted" },
  { pattern: /\b(?:patient|member|client)\s+(?:name|id|identifier|record number|account number)\b/i, reason: "person/record identifier labels are not permitted" },
  { pattern: /\b(?:diagnosis|medication|prescription|clinical note)\s*:/i, reason: "clinical-value labels are not permitted" },
  { pattern: UUID, reason: "record-shaped UUIDs are not permitted" },
  { pattern: /<[^>]+>/, reason: "HTML is not permitted in catalog text" },
];

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function assertPlainObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be a plain object");
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(path, "must be a plain object");
  }
}

function assertExactKeys(value, allowedKeys, path) {
  assertPlainObject(value, path);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknown.length > 0) {
    fail(path, `contains forbidden or unknown field(s): ${unknown.join(", ")}`);
  }
}

function assertString(value, path, { min = 1, max, pattern } = {}) {
  if (typeof value !== "string") fail(path, "must be a string");
  if (value !== value.trim()) fail(path, "must not have leading or trailing whitespace");
  if (value.length < min) fail(path, `must contain at least ${min} character(s)`);
  if (max !== undefined && value.length > max) fail(path, `must contain at most ${max} character(s)`);
  if (pattern && !pattern.test(value)) fail(path, "has an invalid format");
  if (/\p{Cc}/u.test(value)) fail(path, "must not contain control characters");
  return value;
}

function assertEnum(value, choices, path) {
  if (typeof value !== "string" || !choices.has(value)) {
    fail(path, `must be one of: ${[...choices].join(", ")}`);
  }
  return value;
}

function assertPositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(path, "must be a positive safe integer");
  }
  return value;
}

function assertSha256(value, path) {
  return assertString(value, path, { min: 64, max: 64, pattern: SHA256 });
}

function assertSafeCatalogText(value, path, limits) {
  const text = assertString(value, path, limits);
  for (const { pattern, reason } of SENSITIVE_TEXT_PATTERNS) {
    if (pattern.test(text)) fail(path, reason);
  }
  return text;
}

function assertIsoInstant(value, path) {
  const instant = assertString(value, path, { pattern: ISO_INSTANT });
  const timestamp = Date.parse(instant);
  if (!Number.isFinite(timestamp)) fail(path, "must be a valid UTC instant");

  const canonicalInput = instant.includes(".")
    ? instant.replace(/\.(\d{1,3})Z$/, (_, digits) => `.${digits.padEnd(3, "0")}Z`)
    : instant.replace("Z", ".000Z");
  if (new Date(timestamp).toISOString() !== canonicalInput) {
    fail(path, "must be a real calendar instant");
  }
  return instant;
}

function validateSource(source) {
  assertExactKeys(source, ["content_key", "version"], "source");
  const contentKey = assertString(source.content_key, "source.content_key", {
      min: 3,
      max: 120,
      pattern: CONTENT_KEY,
    });
  const version = assertString(source.version, "source.version", {
      max: 80,
      pattern: SOURCE_VERSION,
    });
  if (UUID.test(contentKey) || UUID.test(version)) {
    fail("source", "must not contain record-shaped UUIDs");
  }
  return {
    content_key: contentKey,
    version,
  };
}

function validateContent(content) {
  assertExactKeys(
    content,
    ["kind", "title", "summary", "locale", "access_level"],
    "content",
  );

  return {
    kind: assertEnum(content.kind, CONTENT_KINDS, "content.kind"),
    title: assertSafeCatalogText(content.title, "content.title", { min: 2, max: 180 }),
    summary: assertSafeCatalogText(content.summary, "content.summary", { min: 1, max: 500 }),
    locale: assertString(content.locale, "content.locale", { min: 2, max: 16, pattern: LOCALE }),
    access_level: assertEnum(content.access_level, ACCESS_LEVELS, "content.access_level"),
  };
}

function validateArtifact(artifact, kind) {
  assertExactKeys(
    artifact,
    ["sha256", "media_type", "byte_length", "duration_ms", "captions_sha256", "transcript_sha256"],
    "artifact",
  );

  const expectedMediaType = kind === "video" ? "video/mp4" : "text/markdown";
  if (artifact.media_type !== expectedMediaType) {
    fail("artifact.media_type", `must be ${expectedMediaType} for ${kind} content`);
  }

  const result = {
    sha256: assertSha256(artifact.sha256, "artifact.sha256"),
    media_type: expectedMediaType,
    byte_length: assertPositiveInteger(artifact.byte_length, "artifact.byte_length"),
  };

  if (kind === "video") {
    result.duration_ms = assertPositiveInteger(artifact.duration_ms, "artifact.duration_ms");
    if (result.duration_ms > 86_400_000) fail("artifact.duration_ms", "must be at most 24 hours");
    result.captions_sha256 = assertSha256(artifact.captions_sha256, "artifact.captions_sha256");
    result.transcript_sha256 = assertSha256(artifact.transcript_sha256, "artifact.transcript_sha256");

    const hashes = [result.sha256, result.captions_sha256, result.transcript_sha256].filter(Boolean);
    if (new Set(hashes).size !== hashes.length) {
      fail("artifact", "primary, caption, and transcript hashes must be distinct");
    }
  } else if (
    artifact.duration_ms !== undefined ||
    artifact.captions_sha256 !== undefined ||
    artifact.transcript_sha256 !== undefined
  ) {
    fail("artifact", "video-only fields are not permitted for article content");
  }

  return result;
}

function validateGovernance(governance) {
  assertExactKeys(
    governance,
    ["review_state", "phi_review", "approved_at", "policy_version"],
    "governance",
  );

  if (governance.review_state !== "approved") {
    fail("governance.review_state", "must be approved");
  }
  if (governance.phi_review !== "passed") {
    fail("governance.phi_review", "must be passed");
  }
  if (governance.policy_version !== "docstudio-phi-free-v1") {
    fail("governance.policy_version", "must be docstudio-phi-free-v1");
  }

  return {
    review_state: "approved",
    phi_review: "passed",
    approved_at: assertIsoInstant(governance.approved_at, "governance.approved_at"),
    policy_version: "docstudio-phi-free-v1",
  };
}

function validateRoutePattern(value, path) {
  if (value === null) return null;
  const route = assertString(value, path, { max: 160 });
  if (!route.startsWith("/") || route.includes("//")) {
    fail(path, "must be an absolute application path");
  }
  if (!/^\/[A-Za-z0-9._/-]*(?:\/\*\*)?$/.test(route)) {
    fail(path, "must be a static path with only an optional trailing /** wildcard");
  }
  if (route.includes("..") || UUID.test(route) || route.split("/").some((part) => /^\d+$/.test(part))) {
    fail(path, "must not contain traversal or record-shaped path segments");
  }
  return route;
}

function validatePlacement(placement, index, accessLevel) {
  const path = `placements[${index}]`;
  assertExactKeys(placement, ["product_slug", "audience", "route_pattern"], path);

  if (!PRODUCT_SLUGS.has(placement.product_slug)) {
    fail(
      `${path}.product_slug`,
      `must be a registered Support Hub product: ${REGISTERED_SUPPORT_HUB_PRODUCTS.join(", ")}`,
    );
  }
  if (!Array.isArray(placement.audience) || placement.audience.length === 0) {
    fail(`${path}.audience`, "must be a non-empty array");
  }

  const audience = placement.audience.map((value, audienceIndex) =>
    assertEnum(value, AUDIENCES, `${path}.audience[${audienceIndex}]`),
  );
  if (new Set(audience).size !== audience.length) {
    fail(`${path}.audience`, "must not contain duplicates");
  }
  if (audience.includes("all") && audience.length > 1) {
    fail(`${path}.audience`, "all cannot be combined with another audience");
  }
  if (accessLevel === "public" && (audience.length !== 1 || audience[0] !== "all")) {
    fail(`${path}.audience`, "public content must target only the all audience");
  }

  return {
    product_slug: placement.product_slug,
    audience: [...audience].sort(),
    route_pattern: validateRoutePattern(placement.route_pattern, `${path}.route_pattern`),
  };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Builds a closed, JSON-safe publication manifest. Artifact bytes are supplied
 * separately to a trusted first-party importer and verified against sha256.
 */
export function buildSupportHubPublicationManifest(input) {
  assertExactKeys(input, ["source", "content", "artifact", "governance", "placements"], "manifest input");

  const source = validateSource(input.source);
  const content = validateContent(input.content);
  const artifact = validateArtifact(input.artifact, content.kind);
  const governance = validateGovernance(input.governance);

  if (!Array.isArray(input.placements) || input.placements.length === 0) {
    fail("placements", "must be a non-empty array");
  }
  if (input.placements.length > REGISTERED_SUPPORT_HUB_PRODUCTS.length) {
    fail("placements", "cannot contain more entries than the registered product set");
  }

  const placements = input.placements.map((placement, index) =>
    validatePlacement(placement, index, content.access_level),
  );
  const productSlugs = placements.map((placement) => placement.product_slug);
  if (new Set(productSlugs).size !== productSlugs.length) {
    fail("placements", "must contain at most one placement per product");
  }
  placements.sort((left, right) => left.product_slug.localeCompare(right.product_slug));

  return deepFreeze({
    schema_version: SUPPORT_HUB_PUBLICATION_SCHEMA,
    source_system: "docstudio",
    source,
    content,
    artifact,
    governance,
    placements,
  });
}

export function serializeSupportHubPublicationManifest(input) {
  return `${JSON.stringify(buildSupportHubPublicationManifest(input), null, 2)}\n`;
}
