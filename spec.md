# Gaming Clock

## Overview

App allows user to create backlogs, lists
and calculate how long to beat that list of games.

For example:
- How long to beat ALL Final Fantasy games?
- How long to beat my favorite latest releases?

There are two important use cases for this web app:

1. Estimate how long to beat a list of games, for busy people

The cool feature would be that the user can select approximately the days
of the week available to play and how many hours they can play, so we can give
the user a realistic estimate of when they would finish the games they want.

Some people with jobs and busy lives may want to know this, so they can plan cool
gaming sessions without worrying about taking forever to do something or not.


2. Estimate how long to beat a series of games, or a wishlist of games

Some people get really into a new series, or they never finished a series of games from their childhood, and now they have access to them. This is really powerful, because a lot of people make lists of games they want to beat in the year, or they want to beat an entire series like Dragon Quest, which is very long, and planning this can be daunting, because you don't know exactly how long it's going to take.

This web app aims to solve this as well.

## Goal

Your goal reading this spec is to generate a comprehensive implementation plan, split in phases, with very small atomic incremental tasks that can be distributed among a team of AI agents.

We are going to use the `superpowers` skills to generate this plan.

**Override**: I want you to save the plan and tasks in a Markdown file in the root, do not use worktrees, do not use but (GitButler).

The document can and should be as long as necessary, with all the needed context, without missing any requirements from this specification file.

You should create an AGENTS.md file, with instructions regarding:

- What the project is
- What the goals are
- Instructions to update the task list when a task is completed, and stage and commit the changes using conventional commits and pure git CLI
  - This way, we can stop and resume the development with AI agents at any time
- Instructions to, for each new library or feature added, update SKILL.md file in the respective directory on how to read, edit and update the code that lives in that directory

## Features

For the MVP, we won't have account creation and storage, but we should make everything modular and functional to the point that we can add this easily in the future.

For the MVP, the user needs to be able to:

- Search and add games to lists
  - Game metadata comes from IGDB and How Long To Beat (HLTB) provides the time to complete the game
- Create multiple lists
- Show the total time to beat for the list, total time for all lists
- Calendar/time scheduling feature:
  - The user will select the days of the week they plan on playing and the number of hours available per day (or for all days the same, for easier usage, have both options)
  - App must explain well that this is an estimation to help the person plan
- Generate calendar with play sessions
  - Display it in the web app
  - Allow adding to services like Google Calendar (ical)
  - Schedule the games in the list until completion, in sessions at the days and times the user specified, with the duration the user specified
  - User can choose the algorithm: play games sequentially, one after the other, or alternating between games for diversity and less fatigue

## Backend

### Stack

* Python 3.14
  * Linting: ruff
  * Typing: ty
  * Requests: httpx
* Task runner: Justfile
* API: FastAPI
* Data models and schema: Pydantic
* Tests: Pytest with all optimizations like xdist, Polyfactory factories for the Pydantic models to generate mock data
* Docker Compose

We should use Github Actions to perform all checks and tests.

We should use Prek as pre-commit replacement, and add the checks for both backend and frontend.

### Data sources

#### How Long To Beat

Check existing code in this codebase for usage.

#### IGDB

For MVP, just mock the data with fake values using Polyfactory from the Pydantic model that models the response from this API.

## Frontend

### Stack

* Bun
  * biomejs
* Vite + Preact (lightweight)
* Tailwind CSS for styling

### Design

Completely ignore whats already here in the codebase regarding frontend. We'll completely rewrite it.

#### Aesthetics

Make this a very simple, minimal website.
The focus is to get a completely working MVP from this spec, and later we'll worry about styling and make the website beautiful.
Spend the least amount of time thinking about this, actually, let's go with just the raw elements, the only important thing is layout and functionality. CSS and styling comes later.
