# SQL Indexing & Transaction Reference
1. **Composite Indexes**: Align column order with equality filters first, followed by range filters.
2. **Transaction Isolation**: Use READ COMMITTED for general OLTP; SERIALIZABLE for financial ledgers.\n