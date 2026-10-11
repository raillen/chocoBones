# Example: Secure JWT Validation

JSON Web Tokens (JWT) must be validated strictly to prevent attackers from forging tokens.

## ❌ Vulnerable Validation (Python/PyJWT)

```python
import jwt

def verify_token(token):
    try:
        # BAD: No algorithm specified, vulnerable to "alg: none" or algorithm confusion attacks.
        # BAD: Does not verify audience or issuer.
        # BAD: Secret is hardcoded and weak.
        payload = jwt.decode(token, "secret", verify=False) 
        return payload
    except jwt.PyJWTError:
        return None
```

## ✅ Secure Validation (Python/PyJWT)

```python
import jwt
import os

# The secret should be loaded from a secure environment variable or Key Management System
JWT_SECRET = os.environ.get("JWT_SECRET_KEY")
EXPECTED_ISSUER = "https://auth.mycompany.com"
EXPECTED_AUDIENCE = "https://api.mycompany.com"

def verify_token_secure(token):
    if not JWT_SECRET:
        raise RuntimeError("JWT Secret is not configured.")

    try:
        # GOOD: Explicitly define allowed algorithms (e.g., HS256 for symmetric, RS256 for asymmetric).
        # GOOD: Validates expiration (exp) automatically by PyJWT.
        # GOOD: Validates issuer (iss) and audience (aud).
        payload = jwt.decode(
            token,
            key=JWT_SECRET,
            algorithms=["HS256"],
            issuer=EXPECTED_ISSUER,
            audience=EXPECTED_AUDIENCE,
            options={
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": True
            }
        )
        return payload
    except jwt.ExpiredSignatureError:
        print("Token has expired.")
        return None
    except jwt.InvalidIssuerError:
        print("Invalid token issuer.")
        return None
    except jwt.InvalidAudienceError:
        print("Invalid token audience.")
        return None
    except jwt.PyJWTError as e:
        print(f"Invalid token: {e}")
        return None
```
