# CareMetric Support Hub publication contract

This directory defines DocStudio's first-party, transport-independent handoff to
the CareMetric Support Hub. It is a source/export contract, not a public API and
not a deployment target.

The v1 contract exports only:

- approved, human-attested PHI-free catalog metadata;
- one content-addressed article or MP4 artifact (SHA-256 plus size/type);
- optional content-addressed caption and transcript artifacts; and
- one or more placements for products already registered in the Support Hub.

`source_system` is always `docstudio`. DocStudio is an authoring source and is
never treated as a customer product. The v1 product allowlist mirrors the
registered Support Hub products at contract creation: `breathe`, `carebase`,
`caremetric-emr`, `caremetric-go`, `caremetric-intel`, and `pennsync`. A new slug
must be registered in the Hub first, then added here in a reviewed contract
change.

## Security boundary

The manifest contains no asset URL, Supabase storage path, HeyGen/provider value,
credential, user identifier, tenant/organization identifier, or application
record identifier. Unknown fields fail closed. Catalog title and summary are
checked for common URL, contact, record-ID, and PHI-shaped patterns. That scan is
defense in depth; it does not replace the required human editorial and PHI review
attestations.

Artifact bytes are intentionally absent. A future authenticated, first-party Hub
importer must receive the bytes through a private channel, verify every SHA-256,
store one Hub-controlled object, and attach that single object to all requested
product placements. The Hub must remain authoritative for product registration,
authorization, publication, playback sessions, and audit records.

Until that importer and private asset-ingest path exist, this contract must not
be used to mark content as published or to expose source storage objects.

Run the contract tests from the repository root:

```bash
npm run test:support-hub-contract
```
