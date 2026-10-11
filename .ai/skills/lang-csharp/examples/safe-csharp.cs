using System;
using System.Threading;
using System.Threading.Tasks;

public static class SafeProcessor {
    public static async Task ProcessAsync(ReadOnlyMemory<byte> data, CancellationToken ct = default) {
        ct.ThrowIfCancellationRequested();
        await Task.Yield();
    }
}
