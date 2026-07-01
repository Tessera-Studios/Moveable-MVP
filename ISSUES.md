# Issues

This is a list of issues that need to be addressed before the MVP is ready for launch.

- [x] UI: Last 7 days, after completing a day, the day that was completed is not highlighted
- [x] UI: When patient records form check video, it does not show up on the Provider "Patient details" page
- [x] Feature: Providers should be able to categorize patients by main focus area (shoulder, back, legs, etc). This should be a dropdown list with a search field, that allows new entries other than the defaults.
- [x] Feature: Providers should be able to export multiple patient records at a time, grouping them by main focus area.
- [x] Feature: Ensure each video has a max file size of 15 MB, and duration of 20 seconds.
- [x] Bug: Able to see provider dashboard as a patient by changing the URL to /patient
- [x] Issue: Can not export a patient record as PDF.
- [x] Feature: Provider should be able to record a "Form Check" video for patients as well.
- [x] Feature: Templates should not include any videos, nor provider notes, just the structure. Similarly, sessions assigned to a patient should "clone" from a template, not overwrite it.
- [x] Bug: Provider can't update patient focus area due to RLS — `users` table policy allows `SELECT` by provider on their patients but not `UPDATE`. The client-side action succeeds optimistically but the DB write is silently rejected.

- [x] Feature: Have the camera start facing the patient, not the user, if possible.
- [x] Adjustment: Make sets and reps fields be text inputs instead of numbers, but validate them as numbers
- [x] Adjustment: Make the "Edit" button bigger and easier to click.
- [x] Feature: Patients clicking on their "Exercise" should show the exercise information including the video in a modal.
