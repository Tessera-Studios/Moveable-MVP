# Issues

This is a list of issues that need to be addressed before the MVP is ready for launch.

- [x] UI: Editing a session is a blank page.
- [x] UI: There's no way to save an exercise without saving the session.
- [x] UI: When a session is saved, editing doesn't work, but the patient can see the session, but not the exercises themselves.

- [x] UI: The edit session page shows a blank screen.
  - Root causes: (1) `updateSessionTemplate` never persisted `patient_id` changes; (2) if the Phase 5 migration (`20260617000002_phase5_multimedia.sql`) is not yet applied, the `video_id` column is absent and the query fails silently, triggering `notFound()` which renders a blank/minimal page with no custom `not-found.tsx`. Fixed: added `patient_id` to the update and a fallback query that omits video fields when the primary query errors.

- [ ] UI: The % badge on the provider's patients screen does not match what shows for the same patient on the provider dashboard.

