#version 300 es
precision mediump float;


//DEF
//**********************************************************************************************************************
#define SPRITE_SPACE_WORLD 0.0
#define SPRITE_SPACE_SCREEN 1.0

#if (INSTANCED)
struct Material {
    vec3 emissive;
    vec3 diffuse;
    sampler2D instanceData;
    // The following one could actually be instanced in int (or it has to be float?)
    // #if (OUTLINE)
    //    sampler2D instance_indices;
    // #fi
    #if (TEXTURE)
        #for I_TEX in 0 to NUM_TEX
            sampler2D texture##I_TEX;
        #end
    #fi
};
#fi

//UIO
//**********************************************************************************************************************
uniform mat4 MVMat; // Model View Matrix
uniform mat4 PMat;  // Projection Matrix
uniform vec2 spriteSize;
uniform vec2 viewport;
uniform float MODE;

in vec3 VPos;       // Vertex position
in vec2 deltaOffset;
//in vec3 center;

#if (CIRCLES)
out vec2 VCenter;
out vec2 deltaVPos;
#fi

#if (COLORS)
    in vec4 VColor;
    out vec4 fragVColor;
#fi

#if (TEXTURE)
    in vec2 uv;
    out vec2 fragUV;
#fi

#if (PLIGHTS)
    out vec3 fragVPos;
#fi

#if (POINTS)
    uniform float pointSize;
#fi

#if (CLIPPING_PLANES)
    out vec3 vViewPosition;
#fi

#if (INSTANCED)
    uniform Material material;
#fi

#if (OUTLINE)
uniform mat3 NMat;  // Normal Matrix
in vec3 VNorm;      // Vertex normal

out vec3 v_position_viewspace;
out vec3 v_normal_viewspace;
out vec3 v_ViewDirection_viewspace;
out float v_distanceToCamera_viewspace;
#fi

//MAIN
//**********************************************************************************************************************
void main() {
     // Model view position
    //vec4 VCenter_viewspace = MVMat * vec4(center, 1.0);

    vec4 VPos_viewspace;

    #if (INSTANCED)
        ivec2 tsi = textureSize(material.instanceData, 0);
        vec2 ootsf = vec2(1.0 / float(tsi.x), 1.0 / float(tsi.y));
        vec2 tc;
        tc.y = (float(gl_InstanceID / tsi.x) + 0.5) * ootsf.y;
        tc.x = (float(gl_InstanceID % tsi.x) + 0.5) * ootsf.x;
        vec4 pos = texture(material.instanceData, tc);
        vec4 trans = vec4(pos.x, pos.y, pos.z, 0.0);
    #fi


    if(MODE == SPRITE_SPACE_WORLD){
        #if (INSTANCED)
            VPos_viewspace = MVMat * (vec4(VPos, 1.0) + trans);
        #else
            VPos_viewspace = MVMat * vec4(VPos, 1.0);
        #fi
        // position + delta offset
        //vec4 delta_viewspace = vec4(deltaOffset * spriteSize.xy, 0.0, 0.0);

        //vec4 deltaVPos_viewspace = (VPos_viewspace + delta_viewspace);


        // world space size position
        //gl_Position = (PMat * VPos_viewspace) + delta; //v1
        //gl_Position = PMat * deltaVPos_viewspace; //v2

        // MT version, assume vertices in x,y plane, z = 0; also, assume unit size (vertices at +-0.5 x and y)
        gl_Position = PMat * (VPos_viewspace + vec4(VPos, 1.0)*vec4(spriteSize.xy, 0.0, 0.0));

        #if (CIRCLES)
        // set for circle shape
        vec4 VCenter_viewspace = VPos_viewspace;

        deltaVPos = deltaVPos_viewspace.xy;
        VCenter = VCenter_viewspace.xy;
        #fi
    }else if(MODE == SPRITE_SPACE_SCREEN){
        // Need position of the center!
        #if (INSTANCED)
            VPos_viewspace = MVMat * (vec4(0.0, 0.0, 0.0, 1.0) + trans);
        #else
            VPos_viewspace = MVMat * vec4(0.0, 0.0, 0.0, 1.0);
        #fi

        // Projected position + delta offset
        //vec2 delta_screenspace = deltaOffset * spriteSize.xy;
        //vec3 delta_NDC = vec3(delta_screenspace.xy / viewport, 0.0);

        vec4 VPos_clipspace = PMat * VPos_viewspace;
        //vec3 VPos_NDC = VPos_clipspace.xyz / VPos_clipspace.w;
        //vec3 deltaVPos_NDC = VPos_NDC + delta_NDC;


        // screen space size position
        //gl_Position = deltaVPos_NDC;
        // gl_Position = vec4(deltaVPos_NDC * VPos_clipspace.w, VPos_clipspace.w);

        // MT version
        gl_Position = VPos_clipspace + vec4(VPos.xy * 2.0 * spriteSize.xy / viewport * VPos_clipspace.w, 0.0, 0.0);

        #if (CIRCLES)
        // set for circle shape
        vec4 VCenter_viewspace = VPos_viewspace;

        deltaVPos = deltaVPos_NDC.xy * viewport;
        vec4 VCenter_clipspace = PMat * VCenter_viewspace;
        VCenter = VCenter_clipspace.xy / VCenter_clipspace.w * viewport;
        #fi
    }


    #if (PLIGHTS)
        // Pass vertex position to fragment shader
        fragVPos = vec3(VPos_viewspace) / VPos_viewspace.w;
    #fi

    #if (COLORS)
        // Pass vertex color to fragment shader
        fragVColor = VColor;
    #fi

    #if (TEXTURE)
        // Pass uv coordinate to fragment shader
        fragUV = uv;
    #fi

    #if (POINTS)
        gl_PointSize = pointSize / length(VPos_viewspace.xyz);
        if(gl_PointSize < 1.0) gl_PointSize = 1.0;
    #fi

    #if (CLIPPING_PLANES)
        vViewPosition = -VPos_viewspace.xyz;
    #fi

    #if (OUTLINE)
        v_position_viewspace = VPos_viewspace.xyz;
        v_normal_viewspace = vec3(0.0, 0.0, -1.0);

        float dToCam = length(VPos_viewspace.xyz);
        v_ViewDirection_viewspace = -VPos_viewspace.xyz / dToCam;
        v_distanceToCamera_viewspace = dToCam;
    #fi
 }