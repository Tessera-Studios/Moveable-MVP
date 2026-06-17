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
- Session progress is reset daily, and patients are encouraged to complete the entire session.
- Contains a daily streak gamification factor, which is incremented once a session is completed.
- Each patient typically has a single session, that the provider assigns to them.
- Sessions can have videos attached to them.
- Optional: Notes written by the provider for the patient.

Streaks are:

- A daily streak is incremented once a session is completed.
- The streak is displayed on the patient dashboard.
- History of the days the patient completes exercises, and how much, is kept.
- For now, streaks are only broken and reset when a patient misses a day.

Exercises are:

- The exercises that are assigned to patients.
- Exercises are made up of:
  - Exercise Name
  - Number of sets for the exercise
  - Number of reps for the exercise
  - A video of the patient performing the exercise.
  - Optional: Notes written by the provider for the patient.
- Patients can also record subsequent videos of themselves attached to specific exercises.

Videos are:

- Videos of the patient performing an exercise or mobility movement.
- Must be linked to an exercise or a session.
- Videos are recorded of a patient, and only shared with that patient.
- Providers may record videos of patients, for patients directly in app.
- Patients may record videos of themselves, and share with their provider.

i.e: A session, or an exercise, can have multiple videos attached to it.

Statistics refer to:

- Since enrollment, how many sessions have the patient completed on a day to day basis.
- How many of the exercises in a session has been completed.
- Feedback from the patient, primarily regarding the ease and pain of completing the session or with exercises.

Notes:

There are two types of notes:

- Provider only notes, that are only visible to the provider.
- Patient notes, that providers can make, and share with the patient as part of exercise.

Chat:

Chat is a simple async message log.

## Application Screens

The application will have the following screens:

- Login / Sign Up
- Provider View
  - Provider Dashboard
  - Profile
  - Patient Program Control (Exercise, Sessions, Notes)
  - Record patient
  - Chat
  - Patient onboarding
- Patient View
  - Patient Dashboard
  - Patient Program View (Exercise, Sessions, Notes)
  - Record patient
  - Profile
  - Progress: (Daily streak, Completed sessions, Average stats)
  - Chat

## Screen Components

### Login / Sign Up

Offers a login or sign up, where a user can log in as either a provider or a patient.

For now, anyone can sign up as a provider, however in the future, providers will be required to sign up with a valid license, validated by the admin.

### Provider View

#### Provider Dashboard

Provides a dashboard for the provider, where they can:

- View their list of patients.
  - View the patient’s name, and the number of sessions completed.
  - View the average stats for the patient.
  - View the daily streak for the patient.
  - View the video for the patient.
- View their list of exercises.
  - View the exercise name, and the number of sets and reps.
  - View the video for the exercise.

#### Patient Program Control

Provides a dashboard for the patient, where they can:

- Create, read, update, and delete sessions and exercises.
- Add provider only notes for the patient.

#### Record patient

Allows the provider to record a video of the patient, and share it with the patient.

#### Chat

Allows the provider to see their list of patients, and engage in one on one chats with them, with support for multimedia.

#### Patient onboarding

Allows the provider to generate a one time code and share with the patient, for the patient to join the platform under the provider.

### Patient View

#### Patient Dashboard

Provides a dashboard for the patient, where they can:

- See how much progress they have made on their current session.
- View the session name, and current uncompleted exercises.
- See the name of their provider.

#### Patient Program View

Provides a dashboard for the patient, where they can:

- View the session name, and the related exercises.
- View the video for the session.
- View their list of exercises.
  - View the exercise name, and the number of sets and reps.
  - View the video for the exercise.

#### Session Screen

Provides a screen for the patient to view a session, and the related exercises.

Patients can begin a session, and the session progress will reset daily, and they are encouraged to complete the entire session.
The daily streak will be incremented once a session is completed.

After a session, patient can provide feedback on the session, by marking it as complete, and filling in a mini form, about:

1. How easy was the session (1-5).
2. How painful was the session (1-5).

#### Record patient

Allows the patient to record a video of themselves, and share it with their provider.
Patients can also attach additional videos to their session or exercises.

#### Profile

Provides a profile for the patient, where they can:

- View their name.
- View their email.
- View their phone number.
- View their address.
- View their notes patient only notes.
- View their list of videos.
- View their list of exercises.

#### Progress Screen

Provides a progress screen for the patient, where they can:

- View their daily streak.
- View their completed sessions.
- View their average stats.

#### Chat

Allows the patient to chat with their provider.

