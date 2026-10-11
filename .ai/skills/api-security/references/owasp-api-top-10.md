# OWASP API Security Top 10

APIs have unique vulnerabilities compared to traditional web applications. This is a summary of the most critical API risks.

## API1: Broken Object Level Authorization (BOLA / IDOR)
- **Description**: APIs tend to expose endpoints that handle object identifiers (e.g., `/api/user/123/financials`). BOLA occurs when the server does not verify if the logged-in user has permission to access the requested object `123`.
- **Mitigation**: Implement authorization checks for *every* API endpoint that accesses a data object based on the user's role and policies.

## API2: Broken Authentication
- **Description**: Authentication mechanisms are implemented incorrectly, allowing attackers to compromise passwords, keys, or session tokens.
- **Mitigation**: Use standard authentication frameworks (e.g., OAuth 2.0). Implement rate limiting, CAPTCHA, and account lockout to prevent credential stuffing.

## API3: Broken Object Property Level Authorization
- **Description**: Combining Mass Assignment and Excessive Data Exposure. An API might allow an attacker to update fields they shouldn't (e.g., `is_admin=true`) or return sensitive data the user shouldn't see.
- **Mitigation**: Never use `bind` to mass-assign client input directly to internal data models. Explicitly define which properties can be updated and read by specific roles.

## API4: Unrestricted Resource Consumption
- **Description**: APIs that do not restrict the size or number of resources requested by the client, leading to Denial of Service (DoS) and increased operational costs.
- **Mitigation**: Implement rate limiting. Limit payload sizes, execution timeouts, and pagination (e.g., `limit=50`).

## API5: Broken Function Level Authorization
- **Description**: Complex access control policies with different hierarchies can lead to authorization flaws. An attacker accesses administrative functions by guessing the endpoint (e.g., changing `GET /api/v1/users` to `DELETE /api/v1/users`).
- **Mitigation**: Ensure all administrative functions are strictly protected by RBAC logic and deny access by default.

## API6: Unrestricted Access to Sensitive Business Flows
- **Description**: Attackers automate flows (like buying limited tickets or posting spam) because the API lacks protection against bots.
- **Mitigation**: Identify sensitive flows and protect them with CAPTCHAs, biometric verification, or advanced bot detection.

## API7: Server Side Request Forgery (SSRF)
- **Description**: The API fetches a remote resource based on user input without validating the URL. An attacker can force the server to connect to internal services (e.g., AWS Metadata service at `169.254.169.254`).
- **Mitigation**: Validate all client-provided URLs against a strict allowlist. Disable HTTP redirections on internal network requests.

## API8: Security Misconfiguration
- **Description**: Insecure default configurations, open cloud storage, misconfigured HTTP headers, unnecessary HTTP methods, or verbose error messages containing stack traces.
- **Mitigation**: Automate infrastructure hardening. Ensure CORS is strictly configured. Return generic error messages.

## API9: Improper Inventory Management
- **Description**: Running older, unpatched API versions (e.g., `v1` left running while `v2` is production) or exposing shadow APIs.
- **Mitigation**: Maintain strict API documentation (e.g., OpenAPI/Swagger). Deprecate and remove old versions promptly.

## API10: Unsafe Consumption of APIs
- **Description**: Trusting data returned by third-party APIs without validation. If the third-party API is compromised, your API is compromised.
- **Mitigation**: Treat all data from third-party APIs as untrusted. Sanitize and validate before processing.
