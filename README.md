# EXCO - Exam Conductor

![exco logo](/repo-images/logo_192x192.png "Exco Logo")

## Description

This MERN-stack based application allows teachers create, conduct, manage MCQ-based remote exams with ease, and lets students to participate in them. This was made as a part of one of my courses in undergrad, with the idea being emerged from remote academic activities during lockdown.

## Features

* For Teachers
    * Create/Edit exams specifying title, desc, time window, duration
    * Publish scores
    * View exam list/history
    * Add/Edit/Delete questions to exams
    * Specify text, points, max attempts to each question with the capability of unlimited attempts
    * Specify as many options for each question, with single or multiple correct answers
    * **Markdown support** for question text and exam description
    * View submissions from students under each exam
    * Open each student's submission and view attempted answers
    * Automatic and instant grading of submissions
    * Generate and download gradesheets in CSV or HTML format
    * Share the exam to students just by copying the link
* For Students
    * Will be shown statuses like "Too early", "Too late", or solid duration depending on window & provided duration
    * Participate in exam by one click
    * View remaining time as countdown timer
    * Select the question option choices and submit to attempt
    * Answerscript view will automatically vanish when duration ends
    * View results (attempted options, correct options, and scores) when teacher publishes score

![teacher action samples](/repo-images/collage_1.png "Teacher Action Samples")

![student action samples](/repo-images/collage_2.png "Student Action Samples")

## Technical Aspects

Even though the backend is built on ExpressJS, I made a microframework on top ExpressJS called **express-extend**. Sole purpose was to easily compose route-attached controller functions with JWT authentication guarding, request input (url param, query param, body value) validation and conversion with help of **Typescript decorators**.

An excerpt from the backend codebase:

```typescript
export class AnswerService {

    // ...

    @onRoute('/api/exam/:id/attempt/:qid', 'PATCH')
    @needsAuth()
    async attemptQuestion(
        @jwtValue('id')                                                       studentID:  string,
        @jwtValue('role')                                                     role:       number,
        @urlParam('id',        true, { convertTo: Str, validate: IsMongoID }) examID:     string,
        @urlParam('qid',       true, { convertTo: Str, validate: IsMongoID }) questionID: string,
        @bodyValue('provided', true, { validate: IsNumberArray })             provided:   number[]
    ) {
        // ...
    }

    // ...
}
```

The gradesheet generation system runs on a **separate worker thread** in order to not exhaust the main thread.

I decided to not use mongoose in this project in order to gain some raw control over database queries. So, I did made my own small custom middleware for mongodb.

Please note that as this project was intended for demo showcasing, this doesn't come with email verification on registration feature.

## Running (On Local Machine)

In the local machine configuration, the react pages are served using the same server the backend api run on. As for such, the react build output directory is copied upon build. You don't have to manually copy/move it, the provided does it automatically for you.

Run the build script first (only needed to be run once):

```bash
./build.ps1 # If you're on Windows

# Or

./build.sh # If you're on Linux
```

You must specify these global variables:

* ``DB_URL`` specifying url to a running MongoDB instance. If the instance is on localhost, prefer writing ``0.0.0.0`` instead of ``localhost`` to avoid MongoClient connection errors.
* ``DB_NAME`` specifying the name of the database, will get created if not exists.
* ``JWT_SECRET`` specifying the JWT secret string.
* ``PORT`` specifying the port to run the server on.

Then run the server:

```bash
./run.ps1 # If you're on Windows

# Or

./run.sh # If you're on Linux
```


## Running (On Docker)

Dockerfiles are provided for both backend and frontend in their respective directories.

The YAML for docker compose is configured to have 3 images: frontend (nginx server for serving react pages), backend (express server running on node for the backend API), mongodb (for persistent database)

A sample ``.env`` file is provided with example environment variables

Just simply trigger compose on the root of repository:

```bash
$ docker-compose up
```

Or if you're a background person:

```bash
$ docker-compose up -d
```

UI is based on [Ant Design](https://ant.design/) components.