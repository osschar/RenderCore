/**
 * Created by Primoz on 28.4.2016.
 */

import {FRONT_AND_BACK_SIDE, FRONT_SIDE, BACK_SIDE, FUNC_LEQUAL, FUNC_LESS, FUNC_GEQUAL, FUNC_GREATER, FUNC_EQUAL, FUNC_NOTEQUAL, FUNC_NEVER, FUNC_ALWAYS, POINTS, LINES, LINE_LOOP, LINE_STRIP, TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN} from '../constants.js';

import {Renderer} from './Renderer.js';

import {Matrix4} from '../math/Matrix4.js';
import {Sphere} from '../math/Sphere.js';
import {Frustum} from '../math/Frustum.js';
import {Vector3} from '../math/Vector3.js';
import {Color} from '../math/Color.js';

import {AmbientLight} from '../lights/AmbientLight.js';
import {DirectionalLight} from '../lights/DirectionalLight.js';
import {PointLight} from '../lights/PointLight.js';
import {SpotLight} from '../lights/SpotLight.js';
import {CustomShaderMaterial} from '../materials/CustomShaderMaterial.js';
import {OutlineBasicMaterial} from "../materials/OutlineBasicMaterial.js";
import {RenderArrayManager} from './RenderArrayManager.js';
import {Vector4} from '../math/Vector4.js';


export class MeshRenderer extends Renderer {

	/**
	 * Create new MeshRenderer object.
	 *
	 * @param canvas The canvas where the renderer draws its output.
	 * @param gl_version Version of the GL context to be used.
	 * @param optionalContextAttributes
	 */
	constructor(canvas, gl_version, optionalContextAttributes) {
		// Call abstract Renderer constructor
		super(canvas, gl_version, optionalContextAttributes);

		// Frustum
		this._projScreenMatrix = new Matrix4();
		this._sphere = new Sphere();
		this._frustum = new Frustum();

		//region Current frame render arrays
		this._renderArrayManager = new RenderArrayManager();
		this._lightsCombined = {
			ambient: [0, 0, 0],
			directional: [],
			point: [],
			spot: []
		};
		this._zVector = new Vector3();
		// endregion

		// Enable depth testing (disable depth testing with gl.ALWAYS)
		this._gl.enable(this._gl.DEPTH_TEST);

		// Enable back-face culling by default
		this._gl.frontFace(this._gl.CCW);

		// Set the selected renderer
		this._selectedRenderer = this._meshRender;

		this.notinit = true;

		this._wasReset = true;

		//picking
		this._pickEnabled = false;
		this._pickCoordinateX = 0;
		this._pickCoordinateY = 0;
		this._pickedColor = new Uint8Array(4);
		this._pickCallback = null;
		this.used = false;
	}


	//SET GET
	set selectedRenderer(selectedRenderer) { this._selectedRenderer = selectedRenderer; }
	get pickedColor() { return this._pickedColor; }


	/**
	 * Render mesh.
	 *
	 * @param scene Scene to be rendered.
	 * @param camera Camera observing the scene.
	 */
	_meshRender(scene, camera) {

		// Update scene graph and camera matrices
		if (scene.autoUpdate === true)
			scene.updateMatrixWorld();

		this._projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		this._frustum.setFromMatrix(this._projScreenMatrix);

		// Clear the render arrays //why not just modify: add/remove?
		this._renderArrayManager.clearAll();

		// Update objects attributes and set up lights
		this._updateObjects(scene, camera);

		// Setup lights only if there are any lights (hope it fixes light settings)
		if (this._renderArrayManager.lights.length > 0)
			this._setupLights(this._renderArrayManager.lights, camera);

		// Programs need to be loaded after the lights
		if (!this._loadRequiredPrograms()) {
			console.warn("Required programs not loaded!");

			console.log("-----------------PRE-----------------");
			console.log("REQUIRED: " + this._requiredPrograms + " length: " + this._requiredPrograms.size);
			console.log(this._requiredPrograms);
			console.log("--------------------------------------");
			console.log("LOADING: " + this._loadingPrograms + " length: " + this._loadingPrograms.size);
			console.log(this._loadingPrograms);
			console.log("--------------------------------------");
			console.log("COMPILED: " + this._compiledPrograms + " length: " + this._compiledPrograms.size);
			console.log(this._compiledPrograms);
			console.log("--------------------------------------");

			return;
		}
		if(!this.used) {
			console.log("-----------------POST------------------");
			console.log("REQUIRED: " + this._requiredPrograms + " length: " + this._requiredPrograms.size);
			console.log(this._requiredPrograms);
			console.log("--------------------------------------");
			console.log("LOADING: " + this._loadingPrograms + " length: " + this._loadingPrograms.size);
			console.log(this._loadingPrograms);
			console.log("--------------------------------------");
			console.log("COMPILED: " + this._compiledPrograms + " length: " + this._compiledPrograms.size);
			console.log(this._compiledPrograms);
			console.log("--------------------------------------");
			this.used = true;
		}

		//RENDER OBJECTS

		// Render picking objects
		if(this._pickEnabled) {
			this._renderPickingObjects(this._renderArrayManager.opaqueObjects, this._renderArrayManager.transparentObjects, this._renderArrayManager.opaqueObjectsWithOutline, this._renderArrayManager.transparentObjectsWithOutline, camera);
		}

		// Render opaque objects
		this._renderOpaqueObjects(this._renderArrayManager.opaqueObjects, camera);

		// Render transparent objects
		this._renderTransparentObjects(this._renderArrayManager.transparentObjects, camera);

		// Render outlines
		this._renderOutlinedObjects(this._renderArrayManager.opaqueObjectsWithOutline, this._renderArrayManager.transparentObjectsWithOutline, camera);

		// Render skybox last (opitmization)
		this._renderOpaqueObjects(this._renderArrayManager.skyboxes, camera);
	}

	_renderPickingObjects(opaqueObjects, transparentObjects, opaqueObjectsWithOutline, transparentObjectsWithOutline, camera){
		this._renderPickableObjects(opaqueObjects, camera);
		this._renderPickableObjects(transparentObjects, camera);
		this._renderPickableObjects(opaqueObjectsWithOutline, camera);
		this._renderPickableObjects(transparentObjectsWithOutline, camera);


		//const pixelColor = new Uint8Array(4);
		this._gl.readPixels(this._pickCoordinateX, this._canvas.height-this._pickCoordinateY, 1, 1, this._gl.RGBA, this._gl.UNSIGNED_BYTE, this._pickedColor);


		this._glManager.clear(true, true, true);
		this._pickEnabled = false;
		this._pickCallback(this._pickedColor);
	}
	_renderOutlinedObjects(opaqueObjectsWithOutline, transparentObjectsWithOutline, camera){
		if (opaqueObjectsWithOutline.length + transparentObjectsWithOutline.length > 0) {
			// drawing will set stencil stencil
			this.gl.enable(this.gl.STENCIL_TEST);
			this.gl.clearStencil(1);
			this.gl.clear(this.gl.STENCIL_BUFFER_BIT);

			this._renderOpaqueOutlinedObjects(opaqueObjectsWithOutline, camera);
			this._renderTransparentOutlinedObjects(transparentObjectsWithOutline, camera);

			// done
			this.gl.disable(this.gl.STENCIL_TEST);
		}
	}
	_renderOpaqueOutlinedObjects(opaqueObjects, camera){
		if (opaqueObjects.length > 0) {
			// Sort the objects by render order
			opaqueObjects.sort(function(a, b) {
				return a.renderOrder - b.renderOrder;
			});

			this._renderOutlines(opaqueObjects, camera);
		}
	}
	_renderTransparentOutlinedObjects(transparentObjects, camera){
		// Sort the objects by Z
		transparentObjects.sort(function(a, b) {
			let renderOrderDiff = a.renderOrder - b.renderOrder;
			if(renderOrderDiff === 0){
				return b._zVector.z - a._zVector.z;
			}else{
				return renderOrderDiff;
			}
		});

		// Enable Blending
		this._gl.enable(this._gl.BLEND);

		// Set up blending equation and params
		this._gl.blendEquation(this._gl.FUNC_ADD);
		//added separate blending function
		this._gl.blendFuncSeparate(this._gl.SRC_ALPHA, this._gl.ONE_MINUS_SRC_ALPHA, this._gl.ONE, this._gl.ONE_MINUS_SRC_ALPHA);

		// Render transparent objects
		this._renderOutlines(transparentObjects, camera);

		// Clean up
		this._gl.disable(this._gl.BLEND);
	}
	_renderOutlines(objectsWithOutline, camera){

		// draw objects
		for (let i = 0; i < objectsWithOutline.length; i++) {
			const object = objectsWithOutline.get(i);


			this.gl.enable(this.gl.DEPTH_TEST);
			this.gl.depthFunc(this.gl.LESS);
			//this.gl.depthMask(true);


			/*--------------------------------------------------------------------------------------------------------*/
			this.gl.stencilFunc(this.gl.EQUAL, 1, 1); //stencil pass test function (the test | reference value | mask)
			this.gl.stencilOp(this.gl.KEEP, this.gl.INCR, this.gl.INCR); //stencil state change operator (s-buff fail | s-buff pass, d-buff fail | s-buff pass, d-buff pass)
			this.gl.stencilMask(0xFF); //STENCIL WRITE mask


			// draw objects
			this._setupProgram(object, camera, object.material.requiredProgram(this).programID);
			//this._setup_material_settings(object.material);
			//COMPACT
			this._drawObject(object);
			/*--------------------------------------------------------------------------------------------------------*/


			this.gl.disable(this.gl.DEPTH_TEST); //DRAW OUTLINE ON TOP OF THE FLOR AND OTHER OBJECTS
			//this.gl.depthFunc(this.gl.ALWAYS);
			//this.gl.depthMask(false);


			/*--------------------------------------------------------------------------------------------------------*/
			// set stencil mode to only draw those not previous drawn
			this.gl.stencilFunc(this.gl.EQUAL, 1, 1);
			this.gl.stencilOp(this.gl.KEEP, this.gl.ZERO, this.gl.ZERO);
			this.gl.stencilMask(0xFF); //STENCIL WRITE mask


			// draw object halo
			this._setupProgram(object.outline, camera, object.outline.material.requiredProgram(this).programID);
			//this._setup_material_settings(object.outline.material);
			//COMPACT
			this._drawObject(object.outline);
			/*--------------------------------------------------------------------------------------------------------*/


			this.gl.enable(this.gl.DEPTH_TEST);
			this.gl.depthFunc(this.gl.NEVER);


			/*--------------------------------------------------------------------------------------------------------*/
			this.gl.stencilFunc(this.gl.EQUAL, 2, 1); //stencil pass test function (the test | reference value | mask)
			this.gl.stencilOp(this.gl.KEEP, this.gl.DECR, this.gl.DECR); //stencil state change operator (s-buff fail | s-buff pass, d-buff fail | s-buff pass, d-buff pass)
			this.gl.stencilMask(0xFF); //STENCIL WRITE mask


			// draw objects
			this._setupProgram(object, camera, object.material.requiredProgram(this).programID);
			//COMPACT
			this._drawObject(object);
			/*--------------------------------------------------------------------------------------------------------*/

			this.gl.enable(this.gl.DEPTH_TEST); //RE-ENABLE
		}
	}

	_renderOpaqueObjects(opaqueObjects, camera){
		if (opaqueObjects.length > 0) {
			// Sort the objects by render order
			opaqueObjects.sort(function(a, b) {
				return a.renderOrder - b.renderOrder;
			});

			this._renderObjects(opaqueObjects, camera);
		}
	}
	_renderTransparentObjects(transparentObjects, camera){
		if (transparentObjects.length > 0) {
			// Sort the objects by Z
			transparentObjects.sort(function(a, b) {
				let renderOrderDiff = a.renderOrder - b.renderOrder;
				if(renderOrderDiff === 0){
					return b._zVector.z - a._zVector.z;
				}else{
					return renderOrderDiff;
				}
			});

			// Enable Blending
			this._gl.enable(this._gl.BLEND);

			// Set up blending equation and params
			this._gl.blendEquation(this._gl.FUNC_ADD);
			//added separate blending function
			this._gl.blendFuncSeparate(this._gl.SRC_ALPHA, this._gl.ONE_MINUS_SRC_ALPHA, this._gl.ONE, this._gl.ONE_MINUS_SRC_ALPHA);

			// Render transparent objects
			this._renderObjects(transparentObjects, camera);

			// Clean up
			this._gl.disable(this._gl.BLEND);
		}
	}
	/**
	 * Render objects.
	 *
	 * @param objects Objects to be rendered.
	 * @param camera Camera observing the scene.
	 */
	_renderObjects(objects, camera) {
		for (let i = 0; i < objects.length; i++) {
			const object = objects.get(i);

			//SET PROGRAM
			this._setupProgram(object, camera, object.material.requiredProgram(this).programID);

			this._setup_material_settings(object.material);

			//COMPACT
			this._drawObject(object);
		}
	}
	_renderPickableObjects(objects, camera){
		for (let i = 0; i < objects.length; i++) {
			const object = objects.get(i);

			if(!object.pickable) continue;

			//SET PROGRAM
			this._setupProgram(object, camera, object.pickingMaterial.requiredProgram(this).programID);

			this._setup_material_side(object.material.side);
			this._setup_material_depth(true, object.material.depthFunc, true);

			//COMPACT
			this._drawObject(object);
		}
	}
	_setupProgram(object, camera, programID){
		let program = this._compiledPrograms.get(programID);
		program.use();

		this._setup_uniforms(program, object, camera);
		this._setup_attributes(program, object);
	}
	_drawObject(object){
		if (typeof object.draw !== "function") console.warn("Object " + object.type + " has no draw function");
		object.draw(this._gl, this._glManager);
	}

	/**
	 * Set attribute values.
	 *
	 * @param program The program to set attribute values for.
	 * @param object Object with attribute values.
	 * @param vertices Mesh vertices.
	 */
	//GLOBAL ATTRIBUTES
	_setup_attributes(program, object) {
		let attributeSetter = program.attributeSetter;
		let attributes = Object.getOwnPropertyNames(attributeSetter);

		let customAttributes;

		// If material is a type of CustomShaderMaterial it may contain its own definition of attributes
		if (object.material instanceof CustomShaderMaterial) {
			customAttributes = object.material._attributes;
		}

		let buffer;

		// Set all of the properties
		for (let i = 0; i < attributes.length; i++) {

			switch (attributes[i]) {
				case "VPos":
					const vertices = object.geometry.vertices;
					if(!vertices) {
						console.error("[" + object.type + "]: vertices not found in geometry!");
						break;
					}
					buffer = this._glManager.getAttributeBuffer(vertices);
					attributeSetter["VPos"].set(buffer, vertices.itemSize, object.instanced, vertices.divisor);
					break;
				case "VNorm":
					const normals = object.geometry.normals;
					if(!normals) {
						console.error("[" + object.type + "]: normals not found in geometry!");
						break;
					}
					buffer = this._glManager.getAttributeBuffer(normals);
					attributeSetter["VNorm"].set(buffer, 3, object.instanced, normals.divisor);
					break;
				case "a_Tangent":
					const tangents = object.geometry.tangents;
					if(!tangents) {
						console.error("[" + object.type + "]: tangents not found in geometry!");
						break;
					}
					buffer = this._glManager.getAttributeBuffer(tangents);
					attributeSetter["a_Tangent"].set(buffer, 3, object.instanced, tangents.divisor);
					break;
				case "a_Bitangent":
					const bitangents = object.geometry.bitangents;
					if(!bitangents) {
						console.error("[" + object.type + "]: bitangents not found in geometry!");
						break;
					}
					buffer = this._glManager.getAttributeBuffer(bitangents);
					attributeSetter["a_Bitangent"].set(buffer, 3, object.instanced, bitangents.divisor);
					break;
				case "VColor":
					const vertColor = object.geometry.vertColor;
					if(!vertColor) {
						console.error("[" + object.type + "]: vertColor not found in geometry!");
						break;
					}
					buffer = this._glManager.getAttributeBuffer(vertColor);
					attributeSetter["VColor"].set(buffer, 4, object.instanced, vertColor.divisor);
					break;
				case "uv":
					const uv = object.geometry.uv;
					if(!uv) {
						console.error("[" + object.type + "]: uv not found in geometry!");
						break;
					}
					buffer = this._glManager.getAttributeBuffer(uv);
					attributeSetter["uv"].set(buffer, 2, object.instanced, uv.divisor);
					break;
				case "MMat":
					const MMat = object.geometry.MMat;
					if(!MMat) {
						console.error("[" + object.type + "]: MMat not found in geometry!");
						break;
					}
					buffer = this._glManager.getAttributeBuffer(MMat);
					attributeSetter["MMat"].set(buffer, 16, object.instanced, MMat.divisor);
					break;
				default:
					let found = false;

					// Check if the custom attributes are given
					if (customAttributes !== undefined) {
						let attr = customAttributes[attributes[i]];

						// If attribute is defined in the custom attribute object, fetch buffer and bind it to program
						if (attr !== undefined) {
							found = true;
							buffer = this._glManager.getAttributeBuffer(attr);
							attributeSetter[attributes[i]].set(buffer, attr.itemSize, object.instanced, attr.divisor);
						}
					}

					// Notify the user if the attribute was not found
					if (!found) {
						console.error("----------------------------------------");
						console.error("Attribute (" + attributes[i] + ") not set!");
						console.error(object);
						console.error(program);
						console.error(attributeSetter);
						console.error("----------------------------------------");
					}
					break;
			}
		}
	}

	/**
	 * Set uniform values.
	 *
	 * @param program The program to set uniform values for.
	 * @param object Object with uniform values.
	 * @param camera Camera observing the scene.
	 * @param globalClippingPlanes Global clipping planes.
	 */
	//GLOBAL UNIFORMS (common for all objects/mats in renderer)
	_setup_uniforms(program, object, camera, globalClippingPlanes = undefined) {
		let uniformSetter = program.uniformSetter;

		// Reset the uniform validation
		uniformSetter.__validation.reset();

		if (uniformSetter["PMat"] !== undefined) {
			uniformSetter["PMat"].set(camera.projectionMatrix.elements);
		}

		if (uniformSetter["MVMat"] !== undefined) {
			uniformSetter["MVMat"].set(object.modelViewMatrix.elements);
		}

		if (uniformSetter["NMat"] !== undefined) {
			uniformSetter["NMat"].set(object.normalMatrix.elements);
		}

		if (uniformSetter["u_MMat"] !== undefined) {
			uniformSetter["u_MMat"].set(object.matrixWorld.elements);
		}
		if (uniformSetter["VMat"] !== undefined) {
			uniformSetter["VMat"].set(camera.matrixWorldInverse.elements);
		}
		if (uniformSetter["MVPMat"] !== undefined) {
			object.modelViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, object.modelViewMatrix);
			uniformSetter["MVPMat"].set(object.modelViewProjectionMatrix.elements);
		}
		if (uniformSetter["cameraPosition"] !== undefined) {
			const temp = new Vector3().setFromMatrixPosition(camera.matrixWorld);
			uniformSetter["cameraPosition"].set(temp.toArray());
		}
		if (uniformSetter["lightPosition_worldspace"] !== undefined) {
			const temp = new Vector3().setFromMatrixPosition(camera.matrixWorld);
			uniformSetter["lightPosition_worldspace"].set(temp.toArray());
		}
		if (globalClippingPlanes !== undefined && uniformSetter["globalClippingPlanes"] !== undefined) {
			uniformSetter["globalClippingPlanes"].set(globalClippingPlanes.elements);
		}
		if (uniformSetter["pickingColor"] !== undefined) {
			uniformSetter["pickingColor"].set(object.colorID.toArray());
		}
		if (uniformSetter["scale"] !== undefined) {
			uniformSetter["scale"].set(object.scale.toArray());
		}
		if (uniformSetter["time"] !== undefined) {
			uniformSetter["time"].set((new Date).getMilliseconds());
		}


		this._setup_light_uniforms(uniformSetter);

		this._setup_material_uniforms(object.material, uniformSetter, object);

		// Check if all of the uniforms have been set
		let notSet = uniformSetter.__validation.validate();

		if (notSet.length > 0) {
			let notSetString = notSet[0];

			// Notify the user which uniforms have not been set
			for (let i = 1; i < notSet.length; i++) {
				notSetString += ", " + notSet[i];
			}

			console.error("----------------------------------------");
			console.error("Uniforms (" + notSetString + ") not set!");
			console.error(object);
			console.error(program);
			console.error(uniformSetter);
			console.error("----------------------------------------");
		}
	}

	/**
	 * Set material uniform values.
	 *
	 * @param material The material to set material uniform values for.
	 * @param uniformSetter Used to set the values.
	 */
	//"LOCAL" UNIFORMS (for specific mat)
	// TODO: Better naming of the uniforms is needed in order to avoid string usage.
	_setup_material_uniforms(material, uniformSetter, object) {//TODO: Move to object specific - same as draw (Sebastien)
		// Setup custom user uniforms (in case of CustomShaderMaterial)
		if (material instanceof CustomShaderMaterial) {
			let customUniforms = material._uniforms;

			// Set all of the custom uniforms if they are defined within the shader
			for (let name in customUniforms) {
				if (customUniforms.hasOwnProperty(name)) {
					if (uniformSetter[name] !== undefined) {
						const uniform = customUniforms[name];

						if((uniform instanceof Function)){
							uniformSetter[name].set(uniform());
						}else{
							uniformSetter[name].set(uniform);
						}
					}
				}
			}
		}
		if (uniformSetter["material.emissive"] !== undefined) {
			uniformSetter["material.emissive"].set(material.emissive.toArray());
		}

		if (uniformSetter["material.diffuse"] !== undefined) {
			uniformSetter["material.diffuse"].set(material.color.toArray());
		}

		if (uniformSetter["material.specular"] !== undefined) {
			uniformSetter["material.specular"].set(material.specular.toArray());
		}

		if (uniformSetter["material.shininess"] !== undefined) {
			uniformSetter["material.shininess"].set(material.shininess);
		}

		if (uniformSetter["material.heightScale"] !== undefined) {
			uniformSetter["material.heightScale"].set(material.heightScale);
		}

		if (uniformSetter["material.blinn"] !== undefined) {
			uniformSetter["material.blinn"].set(material.blinn);
		}

		if (uniformSetter["material.receiveShadows"] !== undefined) {
			uniformSetter["material.receiveShadows"].set(material.receiveShadows);
		}


		const diffuseMap = material.diffuseMap;
		if(diffuseMap) {
			const texture = "material.diffuseMap";
			if (uniformSetter[texture] !== undefined) {
				uniformSetter[texture].set(this._glManager.getTexture(diffuseMap), 0);
			}else{
				// console.warn("---------------------------------------------------");
				// console.warn(object);
				// console.warn("Texture unifrom: " + texture + " not used in shader");
				// console.warn("---------------------------------------------------");
			}
		}

		const specularMap = material.specularMap;
		if(specularMap) {
			const texture = "material.specularMap";
			if (uniformSetter[texture] !== undefined) {
				uniformSetter[texture].set(this._glManager.getTexture(specularMap), 1);
			}else{
				// console.warn("---------------------------------------------------");
				// console.warn(object);
				// console.warn("Texture unifrom: " + texture + " not used in shader");
				// console.warn("---------------------------------------------------");
			}
		}

		const normalMap = material.normalMap;
		if(normalMap) {
			const texture = "material.normalMap";
			if (uniformSetter[texture] !== undefined) {
				uniformSetter[texture].set(this._glManager.getTexture(normalMap), 2);
			}else{
				// console.warn("---------------------------------------------------");
				// console.warn(object);
				// console.warn("Texture unifrom: " + texture + " not used in shader");
				// console.warn("---------------------------------------------------");
			}
		}

		const heightMap = material.heightMap;
		if(heightMap) {
			const texture = "material.heightMap";
			if (uniformSetter[texture] !== undefined) {
				uniformSetter[texture].set(this._glManager.getTexture(heightMap), 3);
			}else{
				// console.warn("---------------------------------------------------");
				// console.warn(object);
				// console.warn("Texture unifrom: " + texture + " not used in shader");
				// console.warn("---------------------------------------------------");
			}
		}


		// Setup texture uniforms (Are common for both predefined materials and custom shader material)
		let textures = material.maps;

		for (let i = 0; i < textures.length; i++) {
			const texture = "material.texture" + i;
			if (uniformSetter[texture] !== undefined) {
				uniformSetter[texture].set(this._glManager.getTexture(textures[i]), 15+i);
			}else{
				// console.warn("---------------------------------------------------");
				// console.warn(object);
				// console.warn("Texture unifrom: " + texture + " not used in shader");
				// console.warn("---------------------------------------------------");
			}
		}

		const cubeTextures = material.cubemaps;

		for (let i = 0; i < cubeTextures.length; i++) {
			const cubeTexture = "material.cubeTexture" + i;
			if (uniformSetter[cubeTexture] !== undefined) {
				uniformSetter[cubeTexture].set(this._glManager.getTexture(cubeTextures[i]), 20+i);
			}else{
				// console.warn("---------------------------------------------------");
				// console.warn(object);
				// console.warn("Cube texture unifrom: " + cubeTexture + " not used in shader");
				// console.warn("---------------------------------------------------");
			}
		}

		//common for all specific mats
		if (material.usePoints === true) {
			if (uniformSetter["pointSize"] !== undefined) {
				uniformSetter["pointSize"].set(material.pointSize);
			}
		}
		if (uniformSetter["lineWidth"] !== undefined) {
			uniformSetter["lineWidth"].set(material.lineWidth);
		}
		if (material.useClippingPlanes === true) {
			let prefix;
			for (let i = 0; i < material.clippingPlanes.length; i++) {
				prefix = "clippingPlanes[" + i + "]";
				if (uniformSetter[prefix + ".normal"] !== undefined){
					uniformSetter[prefix + ".normal"].set(material.clippingPlanes[i].normal.toArray());
				}
				if (uniformSetter[prefix + ".constant"] !== undefined){
					uniformSetter[prefix + ".constant"].set(material.clippingPlanes[i].constant);
				}
			}
		}
		if (material.transparent === true) {
			if (uniformSetter["alpha"] !== undefined) {
				uniformSetter["alpha"].set(material.opacity);
			}
			if (uniformSetter["material.alpha"] !== undefined) {
				uniformSetter["material.alpha"].set(material.opacity);
			}
		}else{
			if (uniformSetter["alpha"] !== undefined) {
				uniformSetter["alpha"].set(1.0);
			}
			if (uniformSetter["material.alpha"] !== undefined) {
				uniformSetter["material.alpha"].set(1.0);
			}
		}
		if (material instanceof OutlineBasicMaterial){
			if (uniformSetter["offset"] !== undefined) {
				uniformSetter["offset"].set(material.offset);
			}
		}
	}

	/**
	 * Set material setting values.
	 *
	 * @param material The material to set material setting values for.
	 */
	_setup_material_settings(material) {
		this._setup_material_side(material.side);
		this._setup_material_depth(material.depthTest, material.depthFunc, material.depthWrite);
	}
	_setup_material_side(materialSide){
		// Determine the type of face culling
		if (materialSide === FRONT_AND_BACK_SIDE) {
			this._gl.disable(this._gl.CULL_FACE);
		}
		else if (materialSide === FRONT_SIDE) {
			this._gl.enable(this._gl.CULL_FACE);
			this._gl.cullFace(this._gl.BACK);
		}
		else if (materialSide === BACK_SIDE) {
			this._gl.enable(this._gl.CULL_FACE);
			this._gl.cullFace(this._gl.FRONT);
		}
	}
	_setup_material_depth(depthTest, depthFunc, depthWrite){
		// If depth testing is not enabled set depth function to always pass
		if (depthTest) {
			this._gl.enable(this._gl.DEPTH_TEST);

			switch (depthFunc) {
				case FUNC_LEQUAL:
					this._gl.depthFunc(this._gl.LEQUAL);
					break;
				case FUNC_LESS:
					this._gl.depthFunc(this._gl.LESS);
					break;
				case FUNC_GEQUAL:
					this._gl.depthFunc(this._gl.GEQUAL);
					break;
				case FUNC_GREATER:
					this._gl.depthFunc(this._gl.GREATER);
					break;
				case FUNC_EQUAL:
					this._gl.depthFunc(this._gl.EQUAL);
					break;
				case FUNC_NOTEQUAL:
					this._gl.depthFunc(this._gl.NOTEQUAL);
					break;
				case FUNC_NEVER:
					this._gl.depthFunc(this._gl.NEVER);
					break;
				case FUNC_ALWAYS:
					this._gl.depthFunc(this._gl.ALWAYS);
					break;
			}
		}
		else if (!depthTest) {
			this._gl.disable(this._gl.DEPTH_TEST);
		}

		// Enable/Disable depth writing
		this._gl.depthMask(depthWrite);
	}

	/**
	 * Set light uniform values.
	 *
	 * @param uniformSetter Used to set the values.
	 */
	_setup_light_uniforms(uniformSetter) {

		if (uniformSetter["ambient"] !== undefined) {
			uniformSetter["ambient"].set(this._lightsCombined.ambient);
		}


		// DIRECTIONAL LIGHTS
		for (let i = 0; i < this._lightsCombined.directional.length; i++) {
			const prefix = "dLights[" + i + "]";
			const light = this._lightsCombined.directional[i];

			if (uniformSetter[prefix + ".position"]) {
				uniformSetter[prefix + ".position"].set(light.direction.toArray());
			}
			if (uniformSetter[prefix + ".direction"]) {
				uniformSetter[prefix + ".direction"].set(light.direction.toArray());
			}
			if (uniformSetter[prefix + ".color"]) {
				uniformSetter[prefix + ".color"].set(light.color.toArray());
			}
			if (uniformSetter[prefix + ".VPMat"] !== undefined) {
				uniformSetter[prefix + ".VPMat"].set(light.VPMat.elements);
			}
			if (uniformSetter[prefix + ".shadowmap"] !== undefined) {
				uniformSetter[prefix + ".shadowmap"].set(this._glManager.getTexture(light.shadowmap), 8+i);
			}
			if (uniformSetter[prefix + ".castShadows"]) {
				uniformSetter[prefix + ".castShadows"].set(light.castShadows);
			}
			if (uniformSetter[prefix + ".hardShadows"]) {
				uniformSetter[prefix + ".hardShadows"].set(light.hardShadows);
			}
			if (uniformSetter[prefix + ".minBias"]) {
				uniformSetter[prefix + ".minBias"].set(light.minBias);
			}
			if (uniformSetter[prefix + ".maxBias"]) {
				uniformSetter[prefix + ".maxBias"].set(light.maxBias);
			}
		}

		// POINT LIGHTS
		for (let i = 0; i < this._lightsCombined.point.length; i++) {
			const prefix = "pLights[" + i + "]";
			const light = this._lightsCombined.point[i];

			if (uniformSetter[prefix + ".position"]) {
				uniformSetter[prefix + ".position"].set(light.position.toArray());
			}
			if (uniformSetter[prefix + ".position_worldspace"]) {
				uniformSetter[prefix + ".position_worldspace"].set(light.position_worldspace.toArray());
			}
			if (uniformSetter[prefix + ".position_screenspace"]) {
				uniformSetter[prefix + ".position_screenspace"].set(light.position_screenspace.toArray());
			}
			if (uniformSetter[prefix + ".color"]) {
				uniformSetter[prefix + ".color"].set(light.color.toArray());
			}
			if (uniformSetter[prefix + ".distance"]) {
				uniformSetter[prefix + ".distance"].set(light.distance);
			}
			if (uniformSetter[prefix + ".decay"]) {
				uniformSetter[prefix + ".decay"].set(light.decay);
			}
			if (uniformSetter[prefix + ".VPMat"] !== undefined) {
				uniformSetter[prefix + ".VPMat"].set(light.VPMat.elements);
			}
			if (uniformSetter[prefix + ".shadowmap"] !== undefined) {
				uniformSetter[prefix + ".shadowmap"].set(this._glManager.getTexture(light.shadowmap), 10+i);
			}
			if (uniformSetter[prefix + ".castShadows"]) {
				uniformSetter[prefix + ".castShadows"].set(light.castShadows);
			}
			if (uniformSetter[prefix + ".hardShadows"]) {
				uniformSetter[prefix + ".hardShadows"].set(light.hardShadows);
			}
			if (uniformSetter[prefix + ".minBias"]) {
				uniformSetter[prefix + ".minBias"].set(light.minBias);
			}
			if (uniformSetter[prefix + ".maxBias"]) {
				uniformSetter[prefix + ".maxBias"].set(light.maxBias);
			}
			if (uniformSetter[prefix + ".shadowFar"]) {
				uniformSetter[prefix + ".shadowFar"].set(light.shadowFar);
			}
		}

		// SPOT LIGHTS
		for (let i = 0; i < this._lightsCombined.spot.length; i++) {
			const prefix = "sLights[" + i + "]";
			const light = this._lightsCombined.spot[i];

			if (uniformSetter[prefix + ".position"]) {
				uniformSetter[prefix + ".position"].set(light.position.toArray());
			}
			if (uniformSetter[prefix + ".position_screenspace"]) {
				uniformSetter[prefix + ".position_screenspace"].set(light.position_screenspace.toArray());
			}
			if (uniformSetter[prefix + ".color"]) {
				uniformSetter[prefix + ".color"].set(light.color.toArray());
			}
			if (uniformSetter[prefix + ".distance"]) {
				uniformSetter[prefix + ".distance"].set(light.distance);
			}
			if (uniformSetter[prefix + ".decay"]) {
				uniformSetter[prefix + ".decay"].set(light.decay);
			}
			if (uniformSetter[prefix + ".cutoff"]) {
				uniformSetter[prefix + ".cutoff"].set(light.cutoff);
			}
			if (uniformSetter[prefix + ".outerCutoff"]) {
				uniformSetter[prefix + ".outerCutoff"].set(light.outerCutoff);
			}
			if (uniformSetter[prefix + ".direction"]) {
				uniformSetter[prefix + ".direction"].set(light.direction.toArray());
			}
			if (uniformSetter[prefix + ".direction_screenspace"]) {
				uniformSetter[prefix + ".direction_screenspace"].set(light.direction_screenspace.toArray());
			}
			if (uniformSetter[prefix + ".VPMat"] !== undefined) {
				uniformSetter[prefix + ".VPMat"].set(light.VPMat.elements);
			}
			if (uniformSetter[prefix + ".shadowmap"] !== undefined) {
				uniformSetter[prefix + ".shadowmap"].set(this._glManager.getTexture(light.shadowmap), 12+i);
			}
			if (uniformSetter[prefix + ".castShadows"]) {
				uniformSetter[prefix + ".castShadows"].set(light.castShadows);
			}
			if (uniformSetter[prefix + ".hardShadows"]) {
				uniformSetter[prefix + ".hardShadows"].set(light.hardShadows);
			}
			if (uniformSetter[prefix + ".minBias"]) {
				uniformSetter[prefix + ".minBias"].set(light.minBias);
			}
			if (uniformSetter[prefix + ".maxBias"]) {
				uniformSetter[prefix + ".maxBias"].set(light.maxBias);
			}
		}
	}

	/**
	 * Project an object.
	 *
	 * @param object Object to be projected.
	 * @param camera Camera observing the scene.
	 */
	// TODO: Optimize required programs string. Overhead due to the string comparison is too big!
	_updateObjects(object, camera) {
		if (object.visible && (this._objectInFrustum(object) || this._screenshotInProgress)) {
			object.fillRenderArray(this._renderArrayManager);
			object.project(this._projScreenMatrix);

			const requiredPrograms = object.getRequiredPrograms(this);
			for(let rp = 0; rp < requiredPrograms.length; rp++){
				this._fillRequiredPrograms(requiredPrograms[rp]);
			}
			object.update(this._glManager, camera);

			// Recursively descend through children and project them
			for (let i = 0; i < object.children.length; i++) {
				this._updateObjects(object.children[i], camera);
			}
		}
	}
	_fillRequiredPrograms(requiredProgram){
		if(requiredProgram === null) return;

		if(!this._requiredPrograms.has(requiredProgram.programID)) this._requiredPrograms.set(requiredProgram.programID, requiredProgram);
	}

	/**
	 * Set up all of the lights found during the object projections. The lights are summed up into a single lights
	 * structure representing all of the lights that affect the scene in the current frame.
	 *
	 * @param lights Array of lights that were found during the projection.
	 * @param camera Camera observing the scene.
	 */
	_setupLights(lights, camera) {

		// Reset combinedLights
		this._lightsCombined.ambient = [0, 0, 0];
		this._lightsCombined.directional.length = 0;
		this._lightsCombined.point.length = 0;
		this._lightsCombined.spot.length = 0;

		// Light properties
		let light,
			color,
			intensity,
			distance;

		// Light colors
		let r = 0, g = 0, b = 0;

		for (let i = 0; i < lights.length; i++) {

			//light = lights[i];
			light = lights.get(i);

			color = light.color;
			intensity = light.intensity;

			if (light instanceof AmbientLight) {
				r += color.r * intensity;
				g += color.g * intensity;
				b += color.b * intensity;

				this._lightsCombined.ambient[0] += light.color.r * light.intensity;
				this._lightsCombined.ambient[1] += light.color.g * light.intensity;
				this._lightsCombined.ambient[2] += light.color.b * light.intensity;
			}
			else if (light instanceof DirectionalLight) {

				let lightProperties = {
					color: new Color(),
					direction: new Vector4(),
					ref: light,
					VPMat: new Matrix4(),
					shadowmap: null,
					castShadows: undefined,
					hardShadows: true,
					minBias: 0.005,
					maxBias: 0.05
				};

				lightProperties.color.copy(light.color).multiplyScalar(light.intensity);

				// direction V2
				lightProperties.direction.set(light.direction.x, light.direction.y, light.direction.z, 0.0);
				lightProperties.direction.applyMatrix4(light.matrixWorld);
				lightProperties.direction.applyMatrix4(camera.matrixWorldInverse);

				//VPMat
				const VMAT = new Matrix4().getInverse(light.cameraGroup.children[0].matrixWorld);
				const PMAT = light.cameraGroup.children[0].projectionMatrix;
				const LVPMAT = new Matrix4().multiplyMatrices(PMAT, VMAT);
				lightProperties.VPMat = LVPMAT;

				lightProperties.shadowmap = light.shadowmap;
				lightProperties.castShadows = light.castShadows;
				lightProperties.hardShadows = light.hardShadows;
				lightProperties.minBias = light.minBias;
				lightProperties.maxBias = light.maxBias;

				this._lightsCombined.directional.push(lightProperties);
			}
			else if (light instanceof PointLight) {

				let lightProperties = {
					color: new Color(),
					position: new Vector3(),
					position_worldspace: new Vector3(),
					position_screenspace: new Vector3(),
					distance: light.distance,
					decay: light.decay,
					ref: light,
					VPMat: new Matrix4(),
					shadowmap: null,
					castShadows: undefined,
					hardShadows: true,
					minBias: 0.005,
					maxBias: 0.05,
					shadowFar: 128.0
				};

				// Move the light to camera space
				lightProperties.position_worldspace.setFromMatrixPosition(light.matrixWorld);
				lightProperties.position.setFromMatrixPosition(light.matrixWorld);
				lightProperties.position.applyMatrix4(camera.matrixWorldInverse);


				// for god rays
				lightProperties.position_screenspace.setFromMatrixPosition(light.matrixWorld);
				lightProperties.position_screenspace.applyMatrix4(camera.matrixWorldInverse);
				const z = lightProperties.position_screenspace.z;
				lightProperties.position_screenspace.applyMatrix4(camera.projectionMatrix);

                if(z > 0) {
					lightProperties.position_screenspace.multiplyScalar(-1.0);
				}

                lightProperties.position_screenspace.multiplyScalar(0.5);
				lightProperties.position_screenspace.addScalar(0.5);
				//

				//VPMat
				const VMAT = new Matrix4().getInverse(light.cameraGroup.children[0].matrixWorld);
				const PMAT = light.cameraGroup.children[0].projectionMatrix;
				const LVPMAT = new Matrix4().multiplyMatrices(PMAT, VMAT);
				lightProperties.VPMat = LVPMAT;

				lightProperties.shadowmap = light.shadowmap;
				lightProperties.castShadows = light.castShadows;
				lightProperties.hardShadows = light.hardShadows;
				lightProperties.minBias = light.minBias;
				lightProperties.maxBias = light.maxBias;
				lightProperties.shadowFar = light.shadowFar;

				// Apply light intensity to color
				lightProperties.color.copy(light.color).multiplyScalar(light.intensity);

				this._lightsCombined.point.push(lightProperties);
			}
			else if (light instanceof SpotLight) {

				let lightProperties = {
					color: new Color(),
					position: new Vector3(),
					position_screenspace: new Vector3(),
					distance: light.distance,
					decay: light.decay,
					cutoff: Math.cos(light.cutoff),
					outerCutoff: Math.cos(light.outerCutoff),
					direction: new Vector4(),
					direction_screenspace: new Vector4(),
					ref: light,
					VPMat: new Matrix4(),
					shadowmap: null,
					castShadows: undefined,
					hardShadows: true,
					minBias: 0.005,
					maxBias: 0.05
				};

				// Move the light to camera space
				lightProperties.position.setFromMatrixPosition(light.matrixWorld);
				lightProperties.position.applyMatrix4(camera.matrixWorldInverse);


				// for god rays
				lightProperties.position_screenspace.setFromMatrixPosition(light.matrixWorld);
				lightProperties.position_screenspace.applyMatrix4(camera.matrixWorldInverse);
				const z = lightProperties.position_screenspace.z;
				lightProperties.position_screenspace.applyMatrix4(camera.projectionMatrix);

                lightProperties.position_screenspace.multiplyScalar(0.5);
				lightProperties.position_screenspace.addScalar(0.5);

				// Apply light intensity to color
				lightProperties.color.copy(light.color).multiplyScalar(light.intensity);

				// direction
				lightProperties.direction.set(light.direction.x, light.direction.y, light.direction.z, 0.0);
				lightProperties.direction.applyMatrix4(light.matrixWorld);
				lightProperties.direction.applyMatrix4(camera.matrixWorldInverse);

				// for god rays //todo reuse calculation
				lightProperties.direction_screenspace.set(light.direction.x, light.direction.y, light.direction.z, 0.0);
				lightProperties.direction_screenspace.applyMatrix4(light.matrixWorld);
				lightProperties.direction_screenspace.applyMatrix4(camera.matrixWorldInverse);
				const z2 = lightProperties.direction_screenspace.z;
				lightProperties.direction_screenspace.applyMatrix4(camera.projectionMatrix);

                lightProperties.direction_screenspace.multiplyScalar(1.0/lightProperties.direction_screenspace.w);

                if(z2 > 0) {
					lightProperties.direction_screenspace.multiplyScalar(-1.0);
				}

				//VPMat
				const VMAT = new Matrix4().getInverse(light.cameraGroup.children[0].matrixWorld);
				const PMAT = light.cameraGroup.children[0].projectionMatrix;
				const LVPMAT = new Matrix4().multiplyMatrices(PMAT, VMAT);
				lightProperties.VPMat = LVPMAT;

				lightProperties.shadowmap = light.shadowmap;
				lightProperties.castShadows = light.castShadows;
				lightProperties.hardShadows = light.hardShadows;
				lightProperties.minBias = light.minBias;
				lightProperties.maxBias = light.maxBias;


				this._lightsCombined.spot.push(lightProperties);
			}
		}
	}

	/**
	 * Check if an object is visible.
	 *
	 * @param object Object to be checked.
	 * @returns True if the object is visible.
	 */
	_objectInFrustum(object) {
		if(!object.frustumCulled) return true;


		if(object._UPDATE_BOUNDS){
			const boundingSphere = object.boundingSphere;

			// Apply TRS on sphere
			this._sphere.copy(boundingSphere).applyMatrix4(object.matrixWorld);

			object._UPDATE_BOUNDS = false;
		}

		// Check if the frustum intersects the sphere
		return this._frustum.intersectsSphere(this._sphere)
	}


	pick(x, y, callback){
		this._pickEnabled = true;
		this._pickCoordinateX = x;
		this._pickCoordinateY = y;
		this._pickCallback = callback;
	}
}