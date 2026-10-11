# GLSL Numerical Stability Reference
1. **Division Guard**: `float safeDiv = num / max(denom, 1e-6);`
2. **BRDF Clamping**: Always clamp NdotL and NdotV: `max(dot(N, L), 0.0)`.\n