# SQL Safety Checklist
- [ ] All queries use parameter placeholders (no string concatenation).
- [ ] No SELECT * in production code.
- [ ] Migrations are transactional and reversible.
- [ ] Foreign keys and indexes configured for relation keys.
- [ ] EXPLAIN ANALYZE verified for slow query prevention.\n