# Terraform Policy Checklist
- [ ] Remote backend with state locking and encryption.
- [ ] Providers and Terraform versions pinned.
- [ ] No wildcard actions in IAM policies.
- [ ] No open ingress (0.0.0.0/0) on port 22/3389.
- [ ] All variables have explicit type and description.
- [ ] Checkov/tfsec security scan clean.\n