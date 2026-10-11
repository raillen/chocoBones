# Pull Request Best Practices

## Branching Strategy
- Branch from `main`.
- Use descriptive branch names (e.g., `feat/user-auth`, `bugfix/login-crash`, `docs/api-update`).

## Commits
- Keep commits atomic and logically separated.
- Write clear, imperative commit messages (e.g., "Add user authentication module", not "added auth").
- Squash noisy, WIP commits before opening the PR.

## The Pull Request
1. **Descriptive Title**: The title should accurately summarize the PR's purpose. It often becomes the squash-merge commit message.
2. **Detailed Description**: Explain *what* changed and *why*.
3. **Link Issues**: Use closing keywords (e.g., `Fixes #42`, `Resolves #101`) so GitHub automatically closes the issue upon merge.
4. **Scope**: Keep PRs small and focused. A PR should do one thing well. If it's too large (>500 lines of logic), consider splitting it into smaller PRs.
5. **Draft PRs**: Open a Draft PR if you want early feedback or if CI tests need to run before the code is fully finished.

## Review Readiness
Before requesting review:
- Ensure CI is passing.
- Ensure test coverage has not dropped (add tests for your new code!).
- Self-review your diff first to catch obvious mistakes, leftover debug statements, or typos.
