/**
 * chocoBones TypeScript WebGPU Shaders (WGSL)
 * Shaders para renderização 2D acelerada e Compute Shader de deformação MLS.
 */

export const WGSL_SPRITE_SHADER = `
struct Uniforms {
    u_matrix: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = uniforms.u_matrix * vec4<f32>(in.position, 0.0, 1.0);
    out.uv = in.uv;
    out.color = in.color;
    return out;
}

@group(0) @binding(1) var t_diffuse: texture_2d<f32>;
@group(0) @binding(2) var s_diffuse: sampler;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let tex_color = textureSample(t_diffuse, s_diffuse, in.uv);
    return tex_color * in.color;
}
`;

export const WGSL_MLS_COMPUTE_SHADER = `
struct Pin {
    pos: vec2<f32>,
    delta: vec2<f32>,
    locked: u32,
    _pad: u32,
};

struct MlsParams {
    strength: f32,
    pin_count: u32,
    _pad0: u32,
    _pad1: u32,
};

@group(0) @binding(0) var<storage, read> in_vertices: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> out_vertices: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> pins: array<Pin>;
@group(0) @binding(3) var<uniform> params: MlsParams;

@compute @workgroup_size(64)
fn cs_mls_deform(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= arrayLength(&in_vertices)) {
        return;
    }

    let v = in_vertices[idx];
    let total_w = 0.0;
    var pc = vec2<f32>(0.0, 0.0);
    var qc = vec2<f32>(0.0, 0.0);

    for (var i: u32 = 0u; i < params.pin_count; i = i + 1u) {
        let pin = pins[i];
        var d = vec2<f32>(0.0, 0.0);
        if (pin.locked == 0u) {
            d = pin.delta;
        }
        let diff = v - pin.pos;
        var d2 = dot(diff, diff);
        d2 = max(d2, 0.001);
        let w = 1.0 / (d2 * d2);
        let q = pin.pos + d;
        pc = pc + w * pin.pos;
        qc = qc + w * q;
        total_w = total_w + w;
    }

    if (total_w < 1e-9) {
        out_vertices[idx] = v;
        return;
    }
    pc = pc / total_w;
    qc = qc / total_w;

    var cos_sum = 0.0;
    var sin_sum = 0.0;
    for (var j: u32 = 0u; j < params.pin_count; j = j + 1u) {
        let pin = pins[j];
        var d = vec2<f32>(0.0, 0.0);
        if (pin.locked == 0u) {
            d = pin.delta;
        }
        let q = pin.pos + d;
        let a = pin.pos - pc;
        let b = q - qc;
        let w2: f32 = 1.0 / (max(dot(v - pin.pos, v - pin.pos), 0.001) * max(dot(v - pin.pos, v - pin.pos), 0.001));
        cos_sum = cos_sum + w2 * (a.x * b.x + a.y * b.y);
        sin_sum = sin_sum + w2 * (a.x * b.y - a.y * b.x);
    }

    let len = sqrt(cos_sum * cos_sum + sin_sum * sin_sum);
    if (len < 1e-9) {
        out_vertices[idx] = v + (qc - pc);
        return;
    }
    let cos_v = cos_sum / len;
    let sin_v = sin_sum / len;
    let rel = v - pc;
    let target = qc + vec2<f32>(rel.x * cos_v - rel.y * sin_v, rel.x * sin_v + rel.y * cos_v);
    out_vertices[idx] = mix(v, target, params.strength);
}
`;
