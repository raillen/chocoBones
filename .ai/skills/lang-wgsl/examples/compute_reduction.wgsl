struct Uniforms {
    elementCount: u32,
    stride: u32,
};

@group(0) @binding(0) var<uniform> config: Uniforms;
@group(0) @binding(1) var<storage, read_write> data: array<u32>;

var<workgroup> sharedData: array<u32, 64>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index < config.elementCount) {
        sharedData[local_id.x] = data[index];
    } else {
        sharedData[local_id.x] = 0u;
    }
    workgroupBarrier();

    if (local_id.x == 0u) {
        var sum: u32 = 0u;
        for (var i: u32 = 0u; i < 64u; i = i + 1u) {
            sum = sum + sharedData[i];
        }
        data[0] = sum;
    }
}\n