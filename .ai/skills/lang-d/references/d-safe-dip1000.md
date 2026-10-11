# Dlang DIP1000 & Safe Model Reference

1. **DIP1000 Semantics**: Adds scope pointer rules to the D language. A `scope` pointer cannot be returned from a function or assigned to a global or heap-allocated reference.
2. **@trusted Rules**: `@trusted` should be applied to minimal single-expression wrapper functions that assert preconditions before performing C FFI or hardware calls.
