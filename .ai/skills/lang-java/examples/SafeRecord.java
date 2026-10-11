public record SafeRecord(String id, int value) {
    public SafeRecord {
        java.util.Objects.requireNonNull(id, "id cannot be null");
    }
}
