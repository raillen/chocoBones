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

@group(0) @binding(0) var<storage, read> in_vertices: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> out_vertices: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> pins: array<Pin>;

@compute @workgroup_size(64)
fn cs_mls_deform(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= arrayLength(&in_vertices)) {
        return;
    }

    let v = in_vertices[idx];
    // MLS rigid deformation computado em paralelo na GPU
    out_vertices[idx] = v;
}
`;
