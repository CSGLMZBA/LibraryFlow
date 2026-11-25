# Orwell - Sprint 2 and Sprint 3 Planning

## Owner

- Owner: Carlos Gabriel Martinez Bazaldua
- Agent: Orwell
- Date: 2026-11-18

## Summary

Created the execution plans and specifications for the remaining platform
work. Sprint 2 makes publisher access controlled and production-ready. Sprint
3 completes all in-scope platform features and is the absolute completion gate.

## Documents Created

- `docs/sprints/SPRINT-002.md`
- `docs/sprints/SPRINT-003.md`
- `docs/specs/SPEC-002.md`
- `docs/specs/SPEC-003.md`
- `docs/testing/S2-ACCEPTANCE-REGISTER.md`
- `docs/testing/S3-ACCEPTANCE-REGISTER.md`
- `docs/user_stories/REA/US-REA-021-FollowPublishers.md`

## Documents Updated

- Product backlog
- Publisher application and approval stories
- Publisher removal story
- Agent starter instructions
- README documentation links

## Security Requirement

Public registration is prohibited from assigning `publisher` status.
Publisher status requires an existing reader account, a pending publisher
application, and an administrator approval recorded server-side.

## Team Plan

The plan minimizes feature dependencies by assigning most persistence,
presentation, infrastructure, and verification work as independent bounded
packages. Shared contracts and explicit integration handoffs remain mandatory.

## Agent Instruction Notice

All agents working on Sprint 2 or Sprint 3 must reread:

- `docs/agent-prompts/Starter.md`
- the applicable sprint document
- the applicable specification
- relevant user stories
- `docs/user_stories/FIELD_RULES.md`
- recent agent logs

All work must use English for documentation and user-facing text.
