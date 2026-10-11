# CSS Performance Reference
1. **Compositor Animate**: Only transition transform and opacity to prevent layout/repaint cycles.
2. **Cascade Layers**: Define `@layer reset, base, components, utilities` to control specificity predictably.\n