#version 300 es
precision mediump float;


//UIO
//**********************************************************************************************************************
#if(PICK_MODE_RGB)
uniform vec3 u_RGB_ID;
#fi
#if(PICK_MODE_UINT)
uniform uint u_UINT_ID;
#fi

#if(PICK_MODE_RGB)
layout(location = 0) out vec4 objectID;
#fi
#if(PICK_MODE_UINT)
layout(location = 0) out uint objectID;
#fi
#if(PICK_MODE_UINT_PRIM)
flat in uint PrimitiveID;
layout(location = 0) out uint PrimitiveIDout;
#fi


//MAIN
//**********************************************************************************************************************
void main() {
    #if(PICK_MODE_RGB)
    objectID = vec4(u_RGB_ID, 1.0);
    #fi
    #if(PICK_MODE_UINT)
    objectID = u_UINT_ID;
    #fi
    #if(PICK_MODE_UINT_PRIM)
    PrimitiveIDout = PrimitiveID;
    #fi
}