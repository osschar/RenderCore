#version 300 es
precision mediump float;


//DEF
//**********************************************************************************************************************
#define SPRITE_SPACE_WORLD 0.0
#define SPRITE_SPACE_SCREEN 1.0

#if (TEXTURE)
    #if (INSTANCED)
        const int TexLast = ##NUM_TEX - 2;
    #else
        const int TexLast = ##NUM_TEX - 1;
    #fi
#fi

//STRUCT
//**********************************************************************************************************************
#if (DLIGHTS)
struct DLight {
    //bool directional;
    vec3 position;
    vec3 color;
};
#fi
#if (PLIGHTS)
struct PLight {
    //bool directional;
    vec3 position;
    vec3 color;
    float distance;
    float decay;
};
#fi

struct Material {
    vec3 emissive;
    vec3 diffuse;
    #if (INSTANCED)
        sampler2D instanceData;
    #fi
    #if (TEXTURE)
        #for I_TEX in 0 to NUM_TEX
            sampler2D texture##I_TEX;
        #end
    #fi
};


//UIO
//**********************************************************************************************************************
uniform Material material;
#if (TRANSPARENT)
uniform float alpha;
#else
float alpha = 1.0;
#fi


#if (DLIGHTS)
uniform DLight dLights[##NUM_DLIGHTS];
#fi
#if (PLIGHTS)
uniform PLight pLights[##NUM_PLIGHTS];
#fi
uniform vec3 ambient;
#if (CIRCLES)
uniform vec2 spriteSize;
uniform vec2 viewport;
uniform float MODE;
#fi

#if (PLIGHTS)
in vec3 fragVPos;
#fi


#if (COLORS)
    in vec4 fragVColor;
#fi

#if (TEXTURE)
    in vec2 fragUV;
#fi

in vec2 VCenter;
in vec2 deltaVPos;

#if (PICK_MODE_RGB)
    uniform vec3 u_RGB_ID;
    layout(location = 0) out vec4 objectID;
#else if (PICK_MODE_UINT)
    uniform uint u_UINT_ID;
    layout(location = 0) out uint objectID;
#else if (OUTLINE)
    in vec3 v_position_viewspace;
    in vec3 v_normal_viewspace;
    in vec3 v_ViewDirection_viewspace;
    in float v_distanceToCamera_viewspace;

    //out vec4 color[3];
    layout (location = 0) out vec4 de_viewspace;
    layout (location = 1) out vec4 vp_viewspace;
    layout (location = 2) out vec4 vn_viewspace;
    layout (location = 3) out vec4 vd_viewspace;
    layout (location = 4) out vec4 dc_viewspace;
#else
    out vec4 outColor;
#fi

#if (CLIPPING_PLANES)
    struct ClippingPlane {
        vec3 normal;
        float constant;
    };

    uniform ClippingPlane clippingPlanes[##NUM_CLIPPING_PLANES];

    in vec3 vViewPosition;
#fi


//FUNCTIONS
//**********************************************************************************************************************
#if (PLIGHTS)
    // Calculates the point light color contribution
    vec3 calcPointLight(PLight light) {

        float distance = length(light.position - fragVPos);
        if(light.distance > 0.0 && distance > light.distance) return vec3(0.0, 0.0, 0.0);

        // Attenuation
        //float attenuation = 1.0f / (1.0f + 0.01f * distance + 0.0001f * (distance * distance));
        float attenuation = light.decay / (light.decay + 0.01f * distance + 0.0001f * (distance * distance));

        // Combine results
        vec3 diffuse = light.color * material.diffuse * attenuation;

        return diffuse;
    }
#fi


//MAIN
//**********************************************************************************************************************
void main() {

    #if (CLIPPING_PLANES)
        bool clipped = true;
        for(int i = 0; i < ##NUM_CLIPPING_PLANES; i++){
                clipped = ( dot( vViewPosition, clippingPlanes[i].normal ) > clippingPlanes[i].constant ) && clipped;
        }
        if ( clipped ) discard;
    #fi

    vec4 color;

    #if (CIRCLES)
    //DEPRECATED
    // if(MODE == SPRITE_SPACE_WORLD){
    //     //if (distance(deltaVPos.xy, VCenter.xy) > 4.0) {
    //     if (distance(deltaVPos.xy, VCenter.xy) > spriteSize.x) {
    //         discard; //performance trap
    //         //color = vec4(1.0, 1.0, 1.0, 0.0);
    //     }
    // }else if(MODE == SPRITE_SPACE_SCREEN){
    //     if (distance(deltaVPos.xy, VCenter.xy) > spriteSize.x) {
    //         discard; //performance trap
    //         //color = vec4(1.0, 1.0, 1.0, 0.0);
    //     }
    // }
    if (distance(deltaVPos.xy, VCenter.xy) > spriteSize.x) {
        discard; //performance trap
        //color = vec4(1.0, 1.0, 1.0, 0.0);
    }
    #fi


    // Calculate combined light contribution
    vec3 combined = ambient + material.emissive;

    #if (DLIGHTS)
        #for lightIdx in 0 to NUM_DLIGHTS
            combined += dLights[##lightIdx].color * material.diffuse;
        #end
    #fi

    #if (PLIGHTS)
        #for lightIdx in 0 to NUM_PLIGHTS
            combined += calcPointLight(pLights[##lightIdx]);
        #end
    #fi

    color = vec4(combined, alpha);


    #if (COLORS)
        color += fragVColor;
    #fi


    #if (TEXTURE)
        // Apply only the first texture -- second one is for instancing
        #for I_TEX in 0 to NUM_TEX
            color *= texture(material.texture##I_TEX, fragUV);
        #end
        #if (TRANSPARENT)
            if (color.w <= 0.00392) discard;
            // alternatively, increase fragment depth?
            // if (texcol.w < 0.25) gl_FragDepth = some larger value, clamped to 1.0; else gl_FragDepth = gl_FragCoord.z;
        #fi
    #fi

    #if (PICK_MODE_RGB)
        objectID = vec4(u_RGB_ID, 1.0);
    #else if (PICK_MODE_UINT)
        #if (PICK_INSTANCE)
            objectID = uint(gl_InstanceID) + 1; // no +1 if we do white clear
        #else
            objectID = u_UINT_ID;
        #fi
    #else if (OUTLINE)
        float depth = gl_FragCoord.z;
        //depth = linearizeDepth_1(fragVPos.z);
        //depth = linearizeDepth_2(gl_FragCoord.z) / u_Far;
        de_viewspace = vec4(depth, 0.0, 0.0, 1.0);

        //vp_viewspace = vec4(v_position_viewspace * 0.5 + 0.5, 1.0);
        vp_viewspace = vec4(v_position_viewspace, 1.0);

        //vn_viewspace = vec4(normalize(v_normal_viewspace) * 0.5 + 0.5, 0.0);
        vn_viewspace = vec4(v_normal_viewspace, 0.0);

        //vd_viewspace = vec4(normalize(v_ViewDirection_viewspace) * 0.5 + 0.5, 0.0);
        vd_viewspace = vec4(v_ViewDirection_viewspace, 0.0);

        dc_viewspace = vec4(v_distanceToCamera_viewspace, 0.0, 0.0, 1.0);
    #else
        outColor = color;
    #fi

}