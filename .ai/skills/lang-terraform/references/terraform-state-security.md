# Terraform Security Reference
1. **Remote Backend**: Always configure S3/GCS backend with DynamoDB/KMS locking.
2. **Sensitive Variables**: Mark secrets with `sensitive = true` to prevent console exposure.\n