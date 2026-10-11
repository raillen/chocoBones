import kotlinx.coroutines.*

suspend fun computeSafely(data: List<Int>): Int = coroutineScope {
    data.sum()
}
