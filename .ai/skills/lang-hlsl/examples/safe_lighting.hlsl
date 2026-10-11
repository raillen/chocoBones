struct VSOutput {
    float4 position : SV_POSITION;
    float3 normal : NORMAL;
    float2 uv : TEXCOORD0;
};

cbuffer FrameData : register(b0, space0) {
    float4x4 viewProj;
    float3 lightDirection;
    float padding0;
};

float4 main(VSOutput input) : SV_TARGET {
    float3 N = normalize(input.normal);
    float3 L = normalize(lightDirection);
    float NdotL = saturate(dot(N, L));
    return float4(NdotL.xxx, 1.0f);
}\n