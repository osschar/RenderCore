import { STRIPE_SPACE_SCREEN } from "../constants.js";
import { Float32Attribute } from "../core/BufferAttribute.js";
import { Color } from "../math/Color.js";
import { StripeBasicMaterial } from "./StripeBasicMaterial.js";


export class StripesBasicMaterial extends StripeBasicMaterial {
    constructor(args = {}){
        //SUPER
        super();


        this.type = "StripesBasicMaterial";
        this.programName = "basic_stripes";


        //ASSEMBLE MATERIAL
        this.color = args.color ? args.color : new Color(Math.random() * 0xffffff);
        this.emissive = args.emissive ? args.emissive : new Color(Math.random() * 0xffffff);

        //this.setUniform("aspect", args.aspect ? args.aspect : window.innerWidth/window.innerHeight);
        //this.setUniform("viewport", args.viewport ? args.viewport : [window.innerWidth, window.innerHeight]);
        //this.setUniform("halfLineWidth", args.lineWidth? args.lineWidth/2.0 : 1.0/2.0);
        this.lineWidth = (args.lineWidth !== undefined) ? args.lineWidth : 1.0;
        this.mode = (args.mode !== undefined) ? args.mode : STRIPE_SPACE_SCREEN;
        this.prevVertex = (args.baseGeometry !== undefined) ? StripesBasicMaterial._setupPrevVertices(args.baseGeometry) : null;
        this.nextVertex = (args.baseGeometry !== undefined) ? StripesBasicMaterial._setupNextVertices(args.baseGeometry) : null;
        this.deltaOffset = (args.baseGeometry !== undefined) ? StripesBasicMaterial._setupDeltaDirections(args.baseGeometry) : null;
        this.depthBias = (args.depthBias !== undefined) ? args.depthBias : 0;
    }


    /// Constant bias towards the viewer, in NDC depth units, for a stripe that
    /// has to win against a surface it is drawn on -- an axis panel ruling a
    /// floor, most obviously. Negative values push away.
    ///
    /// Compiled in only when asked for: zero removes the flag, so a stripe that
    /// does not want it pays nothing and gets the same program it always had.
    /// See basic_stripes_template.vert for why polygon offset cannot do this.
    ///
    /// Beware it wins against EVERYTHING nearby, not only the surface it was
    /// meant for -- a track passing just behind a biased line will be drawn over
    /// by it. Hence off by default and set per material rather than globally.
    get depthBias() { return this._depthBias; }
    set depthBias(v) {
        v = v || 0;
        this._depthBias = v;

        if (v !== 0) {
            if (!this.hasSBFlag("DEPTH_BIAS")) {
                this.addSBFlag("DEPTH_BIAS");
                // The flag set changed, so the cached template no longer
                // describes this material -- drop it and let it be rebuilt.
                this.requiredProgramTemplate = null;
            }
            this.setUniform("depthBias", v);
        } else if (this.hasSBFlag("DEPTH_BIAS")) {
            this.rmSBFlag("DEPTH_BIAS");
            this.requiredProgramTemplate = null;
        }
    }

    get lineWidth() { return this._lineWidth; }
    set lineWidth(lineWidth) {
        this._lineWidth = lineWidth;
        this.setUniform("halfLineWidth", lineWidth/2.0);
    }
    get mode() { return this._mode; }
    set mode(mode) {
        this._mode = mode;
        this.setUniform("MODE", mode);
    }
    get prevVertex() { return this._prevVertex; }
    set prevVertex(prevVertex) {
        this._prevVertex = prevVertex;
        this.setAttribute("prevVertex", prevVertex);
    }
    get nextVertex() { return this._nextVertex; }
    set nextVertex(nextVertex) {
        this._nextVertex = nextVertex;
        this.setAttribute("nextVertex", nextVertex);
    }
    get deltaOffset() { return this._deltaOffset; }
    set deltaOffset(deltaOffset) {
        this._deltaOffset = deltaOffset;
        this.setAttribute("deltaOffset", deltaOffset);
    }


    // The three per-vertex attributes a stripe needs, built straight into typed
    // arrays.
    //
    // A stripe expands each base vertex into two, one per side, so for a
    // segment (A, B) the four output vertices carry
    //
    //     VPos  = A A B B          the vertex itself
    //     prev  = A A A A          the segment's start
    //     next  = B B B B          the segment's end
    //     delta = (-1,+1) (-1,-1) (+1,+1) (+1,-1)
    //
    // delta.x says start-or-end and delta.y which side; the shader takes the
    // screen-space perpendicular from prev and next and offsets by delta.
    //
    // These used to be built as plain `new Array(n)` and then handed to
    // Float32Attribute, which copies them into a Float32Array -- so every
    // attribute was materialised twice, once boxed. A track of a thousand
    // points did that four times over.
    //
    // delta is now shared: it depends only on the vertex count, never on the
    // positions, so every stripe object with the same number of vertices can
    // use one buffer. An axis of three stripe objects, or a scene of a thousand
    // equal-length tracks, allocates it once.
    //
    // The copies of prev and next remain, and cannot be removed here: prev is A
    // four times, which no view of the base array can express. Doing that needs
    // the segments drawn INSTANCED -- four vertices per instance, prev and next
    // as divisor-1 views into the base array at offsets 0 and 12, stride 24 --
    // which is a change to the shader and the draw as well as to this file.

    static _baseArray(baseGeometry) {
        // Indexed or not, answer with the base positions in draw order.
        const verts = baseGeometry.vertices;
        if ( ! baseGeometry.indices)
            return { arr: verts.array, idx: null, n: verts.count() };

        const idx = baseGeometry.indices;
        return { arr: verts.array, idx: idx.array, n: idx.count() };
    }

    static _setupPrevVertices(baseGeometry) {
        const { arr, idx, n } = StripesBasicMaterial._baseArray(baseGeometry);
        const out = new Float32Array(n * 2 * 3);

        for (let i = 0; i < n; ++i) {
            // Even is a segment start and is its own prev; odd looks back one.
            const src = 3 * (idx ? idx[(i % 2 === 0) ? i : i - 1]
                                 : ((i % 2 === 0) ? i : i - 1));
            const dst = i * 6;
            out[dst    ] = out[dst + 3] = arr[src    ];
            out[dst + 1] = out[dst + 4] = arr[src + 1];
            out[dst + 2] = out[dst + 5] = arr[src + 2];
        }
        return new Float32Attribute(out, 3);
    }

    static _setupNextVertices(baseGeometry) {
        const { arr, idx, n } = StripesBasicMaterial._baseArray(baseGeometry);
        const out = new Float32Array(n * 2 * 3);

        for (let i = 0; i < n; ++i) {
            // Even looks forward one; odd is a segment end and is its own next.
            const src = 3 * (idx ? idx[(i % 2 === 0) ? i + 1 : i]
                                 : ((i % 2 === 0) ? i + 1 : i));
            const dst = i * 6;
            out[dst    ] = out[dst + 3] = arr[src    ];
            out[dst + 1] = out[dst + 4] = arr[src + 1];
            out[dst + 2] = out[dst + 5] = arr[src + 2];
        }
        return new Float32Attribute(out, 3);
    }

    static _setupDeltaDirections(baseGeometry) {
        const { n } = StripesBasicMaterial._baseArray(baseGeometry);

        let cached = StripesBasicMaterial._deltaCache.get(n);
        if (cached) return cached;

        const out = new Float32Array(n * 2 * 2);
        for (let i = 0; i < n; ++i) {
            const s = (i % 2 === 0) ? -1 : +1;   // start or end of its segment
            out[i * 4    ] = s; out[i * 4 + 1] = +1;
            out[i * 4 + 2] = s; out[i * 4 + 3] = -1;
        }

        cached = new Float32Attribute(out, 2);
        StripesBasicMaterial._deltaCache.set(n, cached);
        return cached;
    }
}

/// Keyed by vertex count -- delta depends on nothing else. See
/// _setupDeltaDirections().
StripesBasicMaterial._deltaCache = new Map();
