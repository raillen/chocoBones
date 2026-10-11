# Structured Logging and Observability

## 1. Why Structured Logging?
Traditional plain-text logs are designed for humans to read. Structured logs (like JSON) are designed for machines to search and analyze, while still being viewable by humans.
- **Searchability**: Easily filter by fields like `user_id`, `request_id`, or `latency`.
- **Consistency**: Standardized fields across all services.

## 2. Core Principles
- **Never use `print()` in production code.** Always use a configured logger.
- **Log Context, Not Just Strings**: Instead of `logger.info(f"User {user_id} logged in")`, use `logger.info("User logged in", extra={"user_id": user_id})`.
- **Appropriate Log Levels**:
  - `DEBUG`: Tracing execution flow, variable values (dev/staging mostly).
  - `INFO`: Normal, expected application events (startup, incoming request, job finished).
  - `WARNING`: Unexpected events that the system can recover from (e.g., retrying an API call).
  - `ERROR`: Events that prevent an operation from succeeding (e.g., DB write failed).
  - `CRITICAL`: Events requiring immediate human intervention.

## 3. Distributed Tracing
- For microservices or complex asynchronous flows, use OpenTelemetry to generate traces.
- Pass a `Trace-Id` across service boundaries and include it in all log entries related to that request.
