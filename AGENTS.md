# Agent Instructions

- Start every change by first writing or updating the necessary automated tests, and ensure the overall test coverage never drops below 90%.
- After making changes that affect the frontend, always run the following commands before finishing the task:
  - `npm run format --prefix front`
  - `npm run lint --prefix front`
  - `npm run type-check --prefix front`
- After making changes that affect the API, always run the following commands before finishing the task:
  - `npm run format --prefix api`
  - `npm run lint --prefix api`
  - `npm run type-check --prefix api`
- Include the results of these commands in the final report.
