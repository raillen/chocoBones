# Dlang Safety Checklist

- [ ] All public modules have `safe:` declared or individual functions annotated with `@safe`.
- [ ] Compiler flag `-preview=dip1000` is active in dub build options.
- [ ] No unreviewed `@trusted` functions exist without registration in `.prumo/escape-hatches.json`.
- [ ] Multi-threaded data sharing strictly uses `shared` types or message passing (`std.concurrency`).
