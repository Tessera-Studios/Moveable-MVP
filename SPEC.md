# Move AbleMVP Specification

Note: Refer to @README.md for concept of the service.

The MVP for Move Able is a progressive web application, designed mobile first, to demonstrate and outline the concept of the service, as a functional prototype.

## Tech Stack

The MVP will be built using the following technologies:

- React + Next.js (Frontend & Backend, with Server Components)
- Typescript (Language)
- Supabase (Database, Authentication, Storage)

## Key Entities

- Providers (Physiotherapists, Doctors, etc)
- Patients: Those seeking care.
- Sessions: A series of exercises that are assigned to a patient.
- Exercises: The exercises that are assigned to patients.
- Videos: The videos that are assigned to patients and linked to exercises.

## Entity Relationships

Providers can:

- Invite patients to join with a one time code, and remove them.
- Record videos of patients and share with them as exercises.
- Create, view, replace and delete videos and exercises for a patient.
- View their list of patients, and statistics about each patient.
- View the average statistics of their patients.
- Assign notes to patients for the doctor’s reference.
- Export patient statistics as a PDF.

Patients can:

- Use an invite code to join under a Provider.
- View exercises assigned to them, and the related videos.
- Change the order of exercises in a session, and begin the session
- Mark a session as complete, and provide feedback

Sessions are:

- A series of exercises that are assigned to a patient.
- Sessions reset daily, and patients are encouraged to complete the entire session.
- Contains a daily streak gamification factor, which is incremented once a session is completed.

Exercises are:

- The exercises that are assigned to patients.
- Exercises are made up of:
  - Exercise Name
  - Number of sets for the exercise
  - Number of reps for the exercise
  - A video of the patient performing the exercise.

Videos are:

- Videos of the patient performing an exercise or mobility movement.
- Can be optionally linked to an exercise.
- Videos are recorded of a patient, and only shared with that patient.
- Providers may record videos of patients, for patients directly in app.
- Patients may record videos of themselves, and share with their provider.

## Application Screens

The application will have the following screens:

- Login / Sign Up
- Provider View
  - Provider Dashboard
  - Profile
  - Patient Program Control (Exercise, Sessions, Notes)
  - Record patient
- Patient View
  - Patient Dashboard
  - Patient Program View (Exercise, Sessions, Notes)
  - Record patient
  - Profile
  - Progress: (Daily streak, Completed sessions, Average stats)
