/**
 * Based on Sprite by Sebastien.
 *
 * Apr. 22 Simplifed by Matevz to:
 * - Construct geometry and material in place.
 * - Assume use of fixed unit square quad, centered by default (-0.5,0.5) -> (0.5,-0.5)
 *   This simplifies shaders and does not require the use of deltaOffsets as they are
 *   implied in the vertex position.
 * - Removed deltaOffsets and obsolete spriteSize members.
 * - Normals are not needed, shader can always set them to (0,0,+/-1).
 * - Shader basic_zsprite also supports picking and outline.
 * - Removed support for CIRCLES and POINTS.
 *
 * Description
 * Camera-facing quad. Extents of the quad should be 1 in both directions and
 * actual size needs to be set via 'spriteSize' propery passed to SpriteBasicMaterial.
 * 'mode' can be SPRITE_SPACE_SCREEN (size is in pixels) or SPRITE_SPACE_WORLD
 * (model-view coordinates). E.g.: { mode: RC.SPRITE_SPACE_SCREEN, spriteSize: [40, 40] }
 * By default the sprite is cenetered on its position, pass xy0/1 as needed to
 * place / center sprite in other ways.
 * There is, in principle, no reason to restrict this to a Quad, it can be any 2D mesh
 * that fits into nit square, eg., triangle, five-pointed-star.
 *
 * Texture 0 in SpriteBasicMaterial is mapped onto the mesh. If transparent flag is set,
 * fragments with zero alpha are discarded so one can have shapes determined by the texture.
 * For instancing, one should also bind an instanceData texture (RGBA32F).
 * rgb components are used as position offsets (in ZSprite's reference frame).
 * a value could be used to pass color (as ubyte quad) or the whole concept could
 * be extended to also (optionally) include per-instance sprite-scale (or size).
 */

import {Mesh} from './Mesh.js';
import {Quad} from './Quad.js';
import {ZSpriteBasicMaterial} from '../materials/ZSpriteBasicMaterial.js';
import {Vector2} from '../RenderCore.js';
import {Color} from '../math/Color.js';
import {SPRITE_SPACE_SCREEN} from '../constants.js';


export class ZSprite extends Mesh {
    constructor(geometry = null, material = null) {
        if (geometry === null) {
            let xy0 = new Vector2(-0.5, 0.5);
            let xy1 = new Vector2(0.5, -0.5);
            geometry = Quad.makeGeometry(xy0, xy1, false, false, false);
        }
        if (material === null) {
            material = new ZSpriteBasicMaterial();
        }

        // MT for Sebastien -- what would be the best way to clone material?
        // ZSpriteBasicMaterial.clone_for_xyzz() seems OK but one needs to
        // take care with uniform / texture / instanceData updates.
        // Ideally, one could even have the same program built and compiled
        // several times with different SB flags.
        let pmat = material.clone_for_picking();
        let omat = material.clone_for_outline();

        //SUPER
        super(geometry, material, pmat, omat);
        this.type = "ZSprite";
    }
}


//------------------------------------------------------------------------------
// ZLogo
//------------------------------------------------------------------------------

/**
 * A screen-space image for the overlay -- an experiment logo, a watermark.
 *
 * A ZSprite is already the right shape for this: a camera-facing unit quad whose
 * size is given in pixels in SPRITE_SPACE_SCREEN, textured, with zero-alpha
 * fragments discarded so the outline comes from the image rather than the quad.
 * Placed in the overlay scene it is positioned by the overlay's orthographic
 * camera, so `position` is simply a (0,1) screen fraction.
 *
 * It implements the same small interaction interface as ZText -- ovlGetPos,
 * ovlSetPos, ovlGetSize, ovlSetSize, getScreenRect, setHighlight -- so the
 * viewer's existing move and corner-resize handling drives it unchanged.
 */
export class ZLogo extends ZSprite {
    /// Resize grip, matching ZText: fraction of the shorter side, floored in CSS px.
    static RESIZE_GRIP_FRAC = 0.05;
    static GRIP_MIN_PX = 28;

    constructor(args = {}) {
        const size = args.size !== undefined ? args.size : 64;   // CSS pixels

        // Emissive must be white: the fragment shader forms the base colour as
        // ambient + emissive and then multiplies the texture into it, so the
        // ZSpriteBasicMaterial default of black would keep only the image's
        // alpha and draw the logo as a flat silhouette.
        const mat = new ZSpriteBasicMaterial({ SpriteMode: SPRITE_SPACE_SCREEN,
                                               SpriteSize: [size, size],
                                               emissive: new Color(0xffffff) });
        mat.transparent = true;
        super(null, mat);

        this.type = "ZLogo";
        this._size  = size;
        this._xPos  = args.x !== undefined ? args.x : 0.06;
        this._yPos  = args.y !== undefined ? args.y : 0.92;
        this._aspect_wh = 1.0;            // image aspect, set once the texture loads

        // CSS pixel scale and viewport, pushed by the owning viewer.
        this._pxToScreen = 1.0 / 900.0;
        this._vpH = 900;

        this.resizable = args.resizable !== undefined ? args.resizable : true;
        this.pickable  = args.pickable  !== undefined ? args.pickable  : true;

        // Dimmed until hovered: a logo is a watermark, not a control.
        this._baseOpacity = args.opacity !== undefined ? args.opacity : 0.80;
        this._highlight = false;
        this.material.opacity = this._baseOpacity;

        // Two separate hazards, both about the object matrix.
        // 1) GlViewerRCore sets Object3D.sDefaultQuaternionsAndAutoUpdate = false,
        //    under which Object3D never creates position/quaternion/scale, so
        //    `this.position` would be undefined here.
        // 2) EveScene turns matrixAutoUpdate off for every element it builds, so
        //    the matrix has to be refreshed by hand or the object silently stays
        //    at the origin -- for the overlay camera, the bottom-left corner.
        this.enableQuaternions();
        this.position.set(this._xPos, this._yPos, 0.0);
        this.updateMatrix();
        this._applySize();
    }

    setLogoTexture(texture, imgW, imgH) {
        this.material.clearMaps();
        this.material.addMap(texture);
        if (imgW > 0 && imgH > 0) this._aspect_wh = imgW / imgH;
        this._applySize();
    }

    /// SpriteSize is in device pixels; _size is CSS pixels, so scale by the
    /// device-pixel ratio, which is pxToScreen * viewportHeight.
    _applySize() {
        const pr = Math.max(this._pxToScreen * this._vpH, 1e-6);
        const h = this._size * pr;
        this.material.setUniform("SpriteSize", [h * this._aspect_wh, h]);
    }

    setPixelScale(pxToScreen, vpW, vpH) {
        let changed = false;
        if (Math.abs(pxToScreen - this._pxToScreen) > 1e-9) { this._pxToScreen = pxToScreen; changed = true; }
        if (vpH && vpH !== this._vpH) { this._vpH = vpH; changed = true; }
        if (changed) this._applySize();
        return changed;
    }

    // ---- overlay interaction interface ------------------------------------
    ovlGetPos()     { return [this._xPos, this._yPos]; }
    ovlSetPos(x, y) { this._xPos = x; this._yPos = y; this.position.set(x, y, 0.0);
                      this.updateMatrix(); }   // see the note in the constructor
    ovlGetSize()    { return this._size; }
    ovlSetSize(s)   { this._size = s; this._applySize(); }

    /// The sprite is centred on its position; size is CSS pixels, so the height
    /// in screen fractions is size * pxToScreen and the width follows the image
    /// aspect, divided by the viewport aspect to land in x fractions.
    getScreenRect(aspect) {
        const hy = 0.5 * this._size * this._pxToScreen;
        const hx = hy * this._aspect_wh / aspect;

        const sq_css = Math.max(ZLogo.RESIZE_GRIP_FRAC * 2.0 * Math.min(hy, hx * aspect) / this._pxToScreen,
                                ZLogo.GRIP_MIN_PX);
        const gy = sq_css * this._pxToScreen;

        return { x0: this._xPos - hx, x1: this._xPos + hx,
                 y0: this._yPos - hy, y1: this._yPos + hy,
                 grip_x: gy / aspect, grip_y: gy };
    }

    setHighlight(on) {
        if (this._highlight === on) return;
        this._highlight = on;
        this.material.opacity = on ? 1.0 : this._baseOpacity;
    }
    get highlight() { return this._highlight; }
}
