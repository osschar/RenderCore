import {Color} from '../math/Color.js';
import {CustomShaderMaterial} from './CustomShaderMaterial.js';

export class ZTextMaterial extends CustomShaderMaterial {
    constructor(programName = "ZText", uniforms = {}, attributes = {}, args = {}){
        super(programName, uniforms, attributes);

        this.type = "ZTextMaterial";
        this._uniforms = uniforms;
		this._attributes = attributes;

		this.color = args.color ? args.color : new Color(0, 0, 0);
    }

    /// Same program, PICK_MODE_UINT variant -- see ZSpriteBasicMaterial for the
    /// pattern. The font map is deliberately NOT copied: without TEXTURE the
    /// vertex shader skips the SDF varyings and only computes gl_Position, which
    /// is all picking needs.
    clone_for_picking() {
        let o = new ZTextMaterial();
        for (const u of ["MODE", "offset", "scale", "sdf_text_size",
                         "sdf_oo_N_pix_in_char", "hint_amount"])
            o.setUniform(u, this.getUniform(u));
        o.addSBFlag("PICK_MODE_UINT");
        return o;
    }

	get color() { return this._color; }
    set color(val) {
        this._color = val;

        // Notify onChange subscriber
        if (this._onChangeListener) {
            let update = {uuid: this._uuid, changes: {color: this._color.getHex()}};
            this._onChangeListener.materialUpdate(update)
        }
    }
}
