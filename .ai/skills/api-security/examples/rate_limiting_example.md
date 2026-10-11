# Example: API Rate Limiting

Rate limiting is crucial for preventing DoS attacks and brute-forcing.

## ✅ Secure Example (Node.js/Express with express-rate-limit)

```javascript
const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();

// 1. General Rate Limiter (Applied to all routes)
// Limits each IP to 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes'
  }
});

// Apply the general rate limiting middleware to all requests
app.use(generalLimiter);

// 2. Strict Rate Limiter for Sensitive Endpoints (e.g., Login)
// Limits each IP to 5 failed login attempts per hour
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // start blocking after 5 requests
  message: {
    error: 'Too many login attempts from this IP, please try again after an hour'
  },
  // We only want to consume a rate limit token if the login fails.
  // A successful login shouldn't lock you out.
  skipSuccessfulRequests: true
});

// Apply strict rate limiting only to the login route
app.post('/api/v1/auth/login', loginLimiter, (req, res) => {
    // ... authentication logic ...
});
```

### Key Considerations:
1.  **Trust Proxy**: If your app is behind a reverse proxy (e.g., Nginx, AWS ELB, Cloudflare), you must configure Express to trust the proxy so it reads the correct client IP from the `X-Forwarded-For` header. Otherwise, all requests appear to come from the proxy's IP, and the proxy will be rate-limited!
    `app.set('trust proxy', 1);`
2.  **Distributed State**: For horizontal scaling (multiple instances of your API), do not use the default memory store for rate limiting. Use a centralized store like Redis (`rate-limit-redis`).
