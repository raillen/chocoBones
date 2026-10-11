# HLSL Binding & Alignment Reference
1. **Packing Rule**: Constant buffer members cannot straddle 16-byte boundaries.
2. **Explicit Space**: Always define `space0` or named spaces for bindless resources.\n