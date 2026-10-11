# TLS Configuration Security Guide

Transport Layer Security (TLS) encrypts data in transit. Misconfigured TLS can expose data to Man-In-The-Middle (MITM) attacks.

## 1. Protocol Versions
- **Disable SSLv2, SSLv3, TLS 1.0, and TLS 1.1**. These are obsolete and vulnerable to various attacks (POODLE, BEAST, CRIME).
- **Require TLS 1.2 at a minimum.**
- **Enable TLS 1.3** if supported by your infrastructure (it is faster and more secure).

## 2. Cipher Suites
A cipher suite is a set of algorithms that help secure a network connection.
- **Disable weak ciphers:** Remove support for DES, 3DES, RC4, MD5, and anon (anonymous) ciphers.
- **Prioritize Forward Secrecy (FS):** Ensure your server prioritizes cipher suites that use Ephemeral Elliptic Curve Diffie-Hellman (ECDHE). This ensures that if the server's private key is compromised in the future, past recorded traffic cannot be decrypted.
- **Prioritize AEAD (Authenticated Encryption with Associated Data):** Use GCM or Poly1305 over CBC mode ciphers.

*Recommended TLS 1.2 Cipher Suites:*
- `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`
- `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`
- `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256`

## 3. Certificate Management
- **Key Size:** Use RSA keys of at least 2048 bits, or ECDSA (e.g., secp256r1/P-256).
- **Signature Algorithm:** Ensure the certificate is signed with SHA-256 or better. Never use SHA-1.
- **Validity Period:** Keep certificate lifespans short (e.g., 90 days, automated via Let's Encrypt).
- **Complete Chain:** Ensure the server sends the intermediate certificates along with the leaf certificate so clients can build the trust chain.

## 4. HTTP Strict Transport Security (HSTS)
HSTS instructs browsers to *only* communicate with the server over HTTPS, preventing protocol downgrade attacks.
- Enable HSTS via the HTTP response header:
  `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- This should be configured on the load balancer, CDN, or reverse proxy.
