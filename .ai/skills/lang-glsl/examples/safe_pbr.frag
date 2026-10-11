#version 450 core
precision highp float;

layout(location = 0) in vec3 vNormal;
layout(location = 1) in vec2 vTexCoord;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform LightingUBO {
    vec3 lightDir;
    float intensity;
    vec4 lightColor;
};

void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(lightDir);
    float NdotL = clamp(dot(N, L), 0.0, 1.0);
    vec3 diffuse = lightColor.rgb * (NdotL * intensity);
    fragColor = vec4(diffuse, 1.0);
}\n