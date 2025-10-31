# Agent Instructions

- Start every change by first writing or updating the necessary automated tests, and ensure the overall test coverage never drops below 90%.
- After making changes within this API package, run the following commands before finishing the task:
  - `npm run format --prefix api`
  - `npm run lint --prefix api`
  - `npm run type-check --prefix api`
- Include the results of these commands in the final report whenever the API is modified.
