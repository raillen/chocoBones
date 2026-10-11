actor Counter {
    private var count: Int = 0
    func increment() -> Int {
        count += 1
        return count
    }
}
