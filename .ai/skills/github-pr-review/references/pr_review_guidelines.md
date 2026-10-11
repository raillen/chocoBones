# PR Review Guidelines

## Purpose of Code Review
Code reviews are for sharing knowledge, ensuring code quality, catching bugs early, and maintaining consistency. They are *not* for proving who is the smartest developer.

## Reviewer Responsibilities
1. **Timeliness**: Aim to review PRs within 24 hours. If you are too busy, let the author know immediately.
2. **Understand the Goal**: Read the PR description and associated issues before looking at the code.
3. **High-Level First**: Look at the architecture, design patterns, and overall logic before nitpicking formatting.
4. **Constructive Tone**: Be polite, objective, and empathetic. Critique the *code*, not the *author*.
5. **Ask Questions**: Instead of saying "This is wrong", ask "What happens if this input is null?". It promotes discussion.

## What to Look For
- **Correctness**: Does the code do what it's supposed to do?
- **Security**: Are there vulnerabilities? (e.g., SQL injection, exposed secrets, unvalidated inputs).
- **Performance**: Are there obvious bottlenecks? (e.g., N+1 queries, unnecessary loops).
- **Readability**: Are variables named well? Is the logic easy to follow?
- **Testing**: Are there sufficient unit/integration tests? Do they test edge cases?

## Approvals vs. Requests for Change
- **Approve**: Code is good to go. Minor nits can be left as non-blocking comments.
- **Request Changes**: There are blocking issues (bugs, architecture flaws) that must be addressed before merging.
- **Comment**: You have questions or suggestions but aren't blocking the merge.
