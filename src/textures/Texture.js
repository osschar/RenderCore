/**
 * Created by Primoz on 21. 07. 2016.
 */
import {_Math} from '../math/Math.js';

export class Texture {
	static DEFAULT_IMAGE = null;
	static FILTER = {
		NearestFilter : 0,
		NearestMipMapNearestFilter : 1,
		NearestMipMapLinearFilter : 2,
		LinearFilter : 3,
		LinearMipMapNearestFilter : 4,
		LinearMipMapLinearFilter : 5,
	};
	/** NOTE
	 * Only following formats can be added as color attachments
	 * gl.R16F, gl.RG16F, gl.RGBA16F, gl.R32F, gl.RG32F, gl.RGBA32F, gl.R11F_G11F_B10F.
	 */
	static FORMAT = {
		ALPHA : 6,
		RGB : 7,
		RGBA : 8,
		LUMINANCE : 9,
		LUMINANCE_ALPHA : 10,
		DEPTH_COMPONENT : 11,
		DEPTH_COMPONENT24 : 12,
		DEPTH_COMPONENT32F : 12.5,
		RGB16F : 13,
		RGB32F : 14,
		RGBA16F : 15,
		RGBA32F : 16,
		R16F : 17,
		R8: 17.1,
		RED: 17.2,
		RED_INTEGER: 17.25,
		R32F : 17.3,
		R32I : 17.4,
		R32UI : 17.5,
	};
	static WRAPPING = {
		RepeatWrapping : 18,
		ClampToEdgeWrapping : 19,
		MirroredRepeatWrapping : 20,
	};
	static TYPE = {
		UNSIGNED_BYTE : 21,			// Color (default)
		UNSIGNED_SHORT : 22,		// Depth (default)
		UNSIGNED_INT : 23,
		HALF_FLOAT : 24,
		FLOAT : 25,
		INT : 26
	};


	_update = {
		size: true,
	};


	constructor(image, wrapS, wrapT, minFilter, magFilter, internalFormat, format, type, width = 1024, height = 1024) {
		this._uuid = _Math.generateUUID();
		this.type = "Texture";

		this._image = (image) ? image : Texture.DEFAULT_IMAGE;

		// Filters
		this._magFilter = (magFilter !== undefined) ? magFilter : Texture.FILTER.LinearFilter;
		this._minFilter = (minFilter !== undefined) ? minFilter : Texture.FILTER.LinearFilter;

		// Wrapping
		this._wrapS = (wrapS !== undefined) ? wrapS : Texture.WRAPPING.ClampToEdgeWrapping;
		this._wrapT = (wrapT !== undefined) ? wrapT : Texture.WRAPPING.ClampToEdgeWrapping;

		// Format
		this._internalFormat = (internalFormat !== undefined) ? internalFormat : Texture.FORMAT.RGBA;
		this._format = (format !== undefined) ? format : Texture.FORMAT.RGBA;

		// Type
		this._type = (type !== undefined) ? type : Texture.TYPE.UNSIGNED_BYTE;

		// Clear function
		this.clearFunction = 0;

		// Mipmaps
		this._generateMipmaps = false;

		// If image is specified this is disregarded (Should be specified when using empty textures)
		this._width = width;
		this._height = height;

		// Set UNPACK_FLIP_Y_WEBGL - this is needed for Image data source.
		// Set it to false when loading data from raw arrays where first data is at (0,0).
		this._flipy = true;

		this._dirty = true;
		this.update = {
			size: true,
		};
		this.idleTime = 0;
	}

	applyConfig(texConfig) {
		this.wrapS = texConfig.wrapS;
		this.wrapT = texConfig.wrapT;
		this.minFilter = texConfig.minFilter;
		this.magFilter = texConfig.magFilter;
		this.internalFormat = texConfig.internalFormat;
		this.format = texConfig.format;
		this.type = texConfig.type;

		this.clearFunction = texConfig.clearFunction;
	}

	// region GETTERS
	get dirty() { return this._dirty; }
	set dirty(dirty) { this._dirty = dirty; }
	get update() { return this._update; }
	set update(update) { this._update = update; }
	get image() { return this._image; }

	get wrapS() {
		return this._wrapS;
	}
	get wrapT(){
		return this._wrapT;
	}
	get minFilter(){
		return this._minFilter;
	}
	get magFilter(){
		return this._magFilter;
	}
	get internalFormat() {
		return this._internalFormat;
	}
	get format() {
		return this._format;
	}
	get type() {
		return this._type;
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
	get flipy() {
		return this._flipy;
	}
	// endregion

	// region SETTERS
	set image(value) {
		if (value !== this._image) {
			this._image = value;
			this._dirty = true;
		}
	}

	set wrapS(value) {
		if (value !== this._wrapS) {
			this._wrapS = value;
			this._dirty = true;
		}
	}
	set wrapT(value) {
		if (value !== this._wrapT) {
			this._wrapT = value;
			this._dirty = true;
		}
	}

	set minFilter(value) {
		if (value !== this._minFilter) {
			this._minFilter = value;
			this._dirty = true;
		}
	}
	set magFilter(value) {
		if (value !== this._magFilter) {
			this._magFilter = value;
			this._dirty = true;
		}
	}

	set internalFormat(value) {
		if (value !== this._internalFormat) {
			this._internalFormat = value;
			this._dirty = true;
		}
	}
	set format(value) {
		if (value !== this._format) {
			this._format = value;
			this._dirty = true;
		}
	}

	set width(value) {
		if (value !== this._width) {
			this._width = value;
			this._dirty = true;
			this.update.size = true;
		}
	}

	set height(value) {
		if (value !== this._height) {
			this._height = value;
			this._dirty = true;
			this.update.size = true;
		}
	}

	set flipy(value) {
		if (value !== this._flipy) {
			this._flipy = value;
			this._dirty = true;
		}
	}

	set type(value) {
		if (value !== this._type) {
			this._type = value;
			this._dirty = true;
		}
	}
	// endregion
};
