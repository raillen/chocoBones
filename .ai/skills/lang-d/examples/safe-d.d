module examples.safe_d;

import std.stdio : writeln;

@safe pure nothrow @nogc
int sumSlice(scope const(int)[] values) {
    int total = 0;
    foreach (v; values) {
        total += v;
    }
    return total;
}

@safe void main() {
    static immutable int[3] data = [1, 2, 3];
    int res = sumSlice(data[]);
    writeln("Sum: ", res);
}
