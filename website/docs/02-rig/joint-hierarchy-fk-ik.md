# Hierarquia de Juntas, Cinemática Direta (FK) e Cinemática Inversa (IK)

O esqueleto do personagem é definido por um conjunto de juntas anatômicas com relações de parentesco.

## 1. Estrutura de Junta e Poses

```odin
package rig

import "../core"

Joint :: struct {
    id:     string,
    name:   string,
    parent: string, // ID da junta pai ou "" se for raiz
    rest_x: f32,    // Coordenada absoluta de repouso X
    rest_y: f32,    // Coordenada absoluta de repouso Y
    color:  [4]f32,
}

JointDelta :: struct {
    angle: f32, // Rotação em radianos
    dx:    f32, // Deslocamento relativo X
    dy:    f32, // Deslocamento relativo Y
}

Pose :: struct {
    joints: map[string]JointDelta,
}
```

## 2. Cinemática Direta (FK - Forward Kinematics)

As juntas armazenam coordenadas de repouso absolutas no espaço do personagem.
Para calcular a matriz de um osso em uma pose:
1. Obtém-se a translação relativa do pai para o filho no repouso: $\Delta_{rest} = (J.x - P.x, J.y - P.y)$.
2. Aplica-se o delta animado da pose: rotação $\theta$ e translação $(\delta_x, \delta_y)$.
3. Multiplica-se a matriz do pai pela matriz local.

```odin
bone_matrices :: proc(joints: []Joint, pose: ^Pose, allocator := context.allocator) -> map[string]core.Mat2x3 {
    result := make(map[string]core.Mat2x3, len(joints), allocator)
    // Travessia em ordem topológica garantindo que pais são resolvidos antes dos filhos
    for j in joints {
        local := core.MAT_IDENTITY
        cos_a := math.cos(pose.joints[j.id].angle)
        sin_a := math.sin(pose.joints[j.id].angle)
        
        parent_mat := core.MAT_IDENTITY
        px, py: f32 = 0, 0
        if j.parent != "" {
            parent_mat = result[j.parent]
            p := find_joint(joints, j.parent)
            px, py = p.rest_x, p.rest_y
        }

        local.a  =  cos_a
        local.b  =  sin_a
        local.c  = -sin_a
        local.d  =  cos_a
        local.tx = (j.rest_x - px) + pose.joints[j.id].dx
        local.ty = (j.rest_y - py) + pose.joints[j.id].dy

        result[j.id] = core.mat_mul(parent_mat, local)
    }
    return result
}
```

## 3. Cinemática Inversa Analítica (IK de 2 Ossos)

Para braços (ombro $\to$ cotovelo $\to$ mão) e pernas (quadril $\to$ joelho $\to$ pé), utiliza-se o algoritmo analítico baseado na **Lei dos Cossenos**.

Dados:
- Ponto base $O$ (ombro/quadril).
- Alvo $T$ (posição desejada da mão/pé).
- Comprimentos dos segmentos: $L_1$ e $L_2$.
- Parâmetro de dobra $bend \in \{+1, -1\}$.

$$D = \min(L_1 + L_2 - \epsilon, \|T - O\|)$$
$$\alpha = \text{atan2}(T_y - O_y, T_x - O_x) - bend \cdot \arccos\left(\frac{L_1^2 + D^2 - L_2^2}{2 L_1 D}\right)$$

A posição do cotovelo/joelho é:
$$E = O + L_1 (\cos \alpha, \sin \alpha)$$
$$\beta = \text{atan2}(T_y - E_y, T_x - E_x)$$

Os ângulos resultantes são ajustados em relação ao repouso e atribuídos aos canais de rotação da junta base e da junta intermediária, garantindo alcance natural e estável sem instabilidade numérica.
