# Sprint 2 account/session proposal — superseded

Bryan authorized updating the normative contract and continuing implementation.
The current design and behavior are documented in
[SPEC-002-CONTRACTS.md section 10](./SPEC-002-CONTRACTS.md).

The final design preserves the existing Bearer-only transport and Dante's
synchronous getAccessToken API. It does not introduce the extra session header
considered in the initial discussion draft.

See [the implementation handoff](../testing/S2-AUTH-SESSION-HANDOFF.md) for
observed tests, integration responsibilities and live acceptance still pending.
