# Title: NullPointerException in AuthController when OAuth token expires

## Description
When a user's OAuth token expires during an active session, any subsequent request to the `/api/v1/profile` endpoint results in a `NullPointerException` rather than returning a proper `401 Unauthorized` response.

## Steps to Reproduce
1. Log in via Google OAuth.
2. Wait for the access token to expire (or manually revoke it in the database).
3. Attempt to fetch the profile by sending a GET request to `/api/v1/profile`.
4. Observe the 500 Internal Server Error response.

## Expected Behavior
The API should return a `401 Unauthorized` status code with a JSON body indicating the token has expired, prompting the client to refresh the token.

## Actual Behavior
The API returns a `500 Internal Server Error`. The server logs show a `NullPointerException` at `AuthController.java:142` because it attempts to read `token.getScopes()` on a null object.

## Environment
- OS: Ubuntu 22.04
- App Version: v2.4.1
- Java: OpenJDK 17

## Logs
```java
java.lang.NullPointerException: Cannot invoke "Token.getScopes()" because "token" is null
    at com.example.api.AuthController.getProfile(AuthController.java:142)
    ...
```
