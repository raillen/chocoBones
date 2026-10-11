# GraphQL Security & DataLoader Reference
1. **DataLoader Lifecycle**: Instantiate DataLoader instances per-request to prevent cross-request cache leakage.
2. **Query Complexity**: Assign costs to fields (1 for scalar, 5 for list) and reject queries above threshold.\n