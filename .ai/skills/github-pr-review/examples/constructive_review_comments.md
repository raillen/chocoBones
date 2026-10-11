# Constructive PR Review Comments

This document demonstrates the difference between poor review comments and constructive review comments.

## Example 1: Spotting a potential bug
**Bad:**
> You forgot to check for null here. This will crash.

**Good:**
> What happens if `userProfile` is null here? Should we add an early return or an Optional wrapper to prevent a potential `NullPointerException`?

## Example 2: Suggesting a performance improvement
**Bad:**
> This loop is terrible. Use a Map.

**Good:**
> Since we are doing lookups inside this loop, the time complexity is O(N^2). If we load the `userIds` into a `HashSet` beforehand, we can reduce this to O(N). What do you think?

## Example 3: Naming conventions
**Bad:**
> Rename `flag` to `isRetryEnabled`.

**Good:**
> The variable name `flag` is a bit generic. How about `isRetryEnabled` to make it clearer what it controls? (Nit, feel free to ignore if you disagree).

## Example 4: Missing tests
**Bad:**
> Where are the tests?

**Good:**
> The logic for calculating the discount seems complex and critical. Could we add a couple of unit tests covering the edge cases (e.g., negative amounts, 0% discount)?

## Example 5: Praising good code
Code review isn't just about finding flaws!

**Good:**
> I really like how you refactored this class to use the Strategy pattern. It makes the code much cleaner and easier to test. Great job!
