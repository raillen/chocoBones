# Example: Mutual TLS (mTLS) Configuration in Nginx

Standard TLS only authenticates the server to the client. Mutual TLS (mTLS) requires the client to also present a valid certificate to the server. This is the gold standard for Zero Trust network security and securing internal microservice-to-microservice communication.

## Nginx Configuration

In this example, Nginx acts as a reverse proxy for an internal API. It requires clients to present a certificate signed by the internal Certificate Authority (CA).

```nginx
server {
    listen 443 ssl;
    server_name api.internal.mycompany.com;

    # 1. Server Certificate (Standard TLS)
    ssl_certificate /etc/nginx/certs/api_server.crt;
    ssl_certificate_key /etc/nginx/certs/api_server.key;

    # TLS Settings (Restrict to TLS 1.2 and 1.3)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256";

    # 2. Client Certificate Validation (mTLS)
    
    # Path to the internal CA certificate that signs the client certs
    ssl_client_certificate /etc/nginx/certs/internal_ca.crt;
    
    # Check if the client cert has been revoked
    # ssl_crl /etc/nginx/certs/crl.pem; 

    # Require the client to provide a valid certificate
    ssl_verify_client on;
    
    # Verification depth (how many intermediate CAs to check)
    ssl_verify_depth 2;

    location / {
        # 3. Pass verification status to the backend application
        # The backend can optionally check the Subject DN (e.g., if the cert belongs to 'billing-service')
        proxy_set_header X-SSL-Client-Verify $ssl_client_verify;
        proxy_set_header X-SSL-Client-Subject-DN $ssl_client_s_dn;
        proxy_set_header X-SSL-Client-Issuer-DN $ssl_client_i_dn;
        
        proxy_pass http://localhost:8080;
    }
}
```

## How the Connection Works
1. Client connects to `api.internal.mycompany.com:443`.
2. Nginx presents `api_server.crt`. The client verifies it.
3. Nginx demands a client certificate (`CertificateRequest`).
4. The client presents its certificate (`client.crt`).
5. Nginx verifies that `client.crt` was signed by `internal_ca.crt`.
   - If invalid or missing, Nginx terminates the connection with `400 Bad Request (No required SSL certificate was sent)`.
6. If valid, the request is forwarded to `localhost:8080`.
