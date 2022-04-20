/**
 * Created by Sebastien.
 *
 * Apr. 22 Simplifed by Matevz to:
 * - construct geometry and material in place
 * - use fixed unit square quad, centered by default (-0.5,0.5) -> (0.5,-0.5)
 * This simplifies shaders and does not require the use of deltaOffsets as they are
 * implied in the vertex position.
 * TODO
 * - it seems we do not use to pass baseGeometry. remove the deltaOffsets
 * - normals are not needed, fix shader to always set (0,0,1)
 * - do we need to support CIRCLES and POINTS?
 *
 * Description
 * Camera-facing quad. Extents of the quad should be 1 in both directions and
 * actual size needs to be set via 'spriteSize' propery passed to SpriteBasicMaterial.
 * 'mode' can be SPRITE_SPACE_SCREEN (size is in pixels) or SPRITE_SPACE_WORLD
 * (model-view coordinates). E.g.: { mode: RC.SPRITE_SPACE_SCREEN, spriteSize: [40, 40] }
 * By default the sprite is cenetered on its position, pass xy0/1 as needed to
 * place / center sprite in other ways.
 */

import {Quad} from './Quad.js';
import {SpriteBasicMaterial} from '../materials/SpriteBasicMaterial.js';
import { Vector2 } from '../RenderCore.js';


export class Sprite extends Quad{
    constructor(material_args={}, xy0, xy1, material, geometry) {
        if (xy0 === undefined)
            xy0 = new Vector2(-0.5, 0.5);
        if (xy1 === undefined)
            xy1 = new Vector2(0.5, -0.5);
        if (geometry === undefined)
            geometry = Quad.makeGeometry(xy0, xy1, false, true, false);
        if (material === undefined) {
            material_args.baseGeometry = geometry;
            material = new SpriteBasicMaterial( material_args );
        }
        //SUPER
        super(xy0, xy1, material, geometry);
        this.type = "Sprite";
    }
}