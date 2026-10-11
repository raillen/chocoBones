# Comprehensive PR Description Example

## Description
This PR introduces the new Redis-based caching layer for the `UserProfile` fetching service. Previously, we queried the PostgreSQL database on every load, leading to significant latency during peak hours (averaging 400ms). By implementing a read-through cache with Redis, we've reduced p95 latency to ~30ms.

## Related Issues
Fixes #234 - High latency on user profile load
Resolves #235 - Implement Redis caching

## Type of Change
- [ ] Bug fix
- [x] New feature (Performance enhancement)
- [ ] Breaking change
- [ ] Documentation update

## Changes Proposed
- Added `RedisCacheProvider` implementing the `ICacheProvider` interface.
- Updated `UserProfileService` to check the cache before hitting the DB.
- Added cache invalidation logic in `UserProfileService.updateProfile()`.
- Added mock Redis tests in `UserProfileServiceTest.java`.

## Testing Performed
- Unit tests run locally (`./gradlew test`) - 100% pass.
- Deployed to staging environment.
- Ran Apache JMeter load tests against staging: observed database queries drop by 80% under 100 concurrent users.

## Checklist
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have added tests that prove my fix is effective or that my feature works
