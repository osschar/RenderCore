import * as RC from '../../src/RenderCore.js'
import {FRONT_SIDE} from '../../src/constants.js';

class App {

	constructor(canvas) {
		window.RC = RC;
		window.App = this;

		window.addEventListener("resize", () => {this.resize();}, false);


		this.canvas = canvas;

		const cnv = new RC.Canvas();
		cnv.canvasDOM = canvas;

		this.renderer = new RC.MeshRenderer(cnv, RC.WEBGL2, {antialias: true});
		this.renderer.clearColor = '#222222ff';
		this.renderer.addShaderLoaderUrls('../../src/shaders');

		this.scene = new RC.Scene();
		var scene = this.scene;

		let points = [];
		let colors = [];
		let normals = [];

		this.loadingManager = new RC.LoadingManager();
		let LAS = new RC.LASLoader(this.loadingManager, "arraybuffer", true, 1*1024*1024*64);
		LAS.load(
			//url
			"../common/pointclouds/planes_normals.las",
			//set
			[
				RC.LASLoader.PDRFormat2.Keys.X, RC.LASLoader.PDRFormat2.Keys.Y, RC.LASLoader.PDRFormat2.Keys.Z, 
				RC.LASLoader.PDRFormat2.Keys.RED, RC.LASLoader.PDRFormat2.Keys.GREEN, RC.LASLoader.PDRFormat2.Keys.BLUE,
				RC.LASLoader.PDRFormat2.Keys.NX, RC.LASLoader.PDRFormat2.Keys.NY, RC.LASLoader.PDRFormat2.Keys.NZ
			],
			//on load complete
			function(data){
				console.log("LAS load complete.");

				points = [];
				colors = [];
				normals = [];
			},
			//on progress
			function(xhr){
				//console.log("LAS " + (xhr.loaded / xhr.total * 100) + "% loaded.");
				console.log("LAS " + ((LAS.LASLoaded + xhr.loaded) / LAS.LASSize * 100) + "% loaded.");
			},
			//on error
			function(err){
				console.error("LAS load error.");
			},
			//on abort
			function(){
				console.error("LAS load abort.");
			},
			//on header load
			function(data){
				console.log("The size of LAS is: " + data.size + " " + data.type + ".");
			},
			//on chunk load
			function(data){
				//console.log(data);

				let pointCloudGeometry = new RC.Geometry();

				for(let i = 0; i < data.X.length; i++){
					points[i*3 + 0] = data.X[i];
					points[i*3 + 1] = data.Y[i];
					points[i*3 + 2] = data.Z[i];

					colors[i*4 + 0] = data.RED[i] / 255.0;
					colors[i*4 + 1] = data.GREEN[i] / 255.0;
					colors[i*4 + 2] = data.BLUE[i] / 255.0;
					colors[i*4 + 3] = 1.0;

					normals[i*3 + 0] = (data.NX[i] / 128.0) - 1.0;
					normals[i*3 + 1] = (data.NY[i] / 128.0) - 1.0;
					normals[i*3 + 2] = (data.NZ[i] / 128.0) - 1.0;
/*
					if(normals[i*3+1] < 0.5){
						normals[i*3 + 0] = 1.0 - normals[i*3 + 0];
						normals[i*3 + 1] = 1.0 - normals[i*3 + 1];
						normals[i*3 + 2] = 1.0 - normals[i*3 + 2];
					}*/
				}

				pointCloudGeometry.vertices = RC.Float32Attribute(points, 3);
				pointCloudGeometry.vertColor = RC.Float32Attribute(colors, 4);
				pointCloudGeometry.normals = RC.Float32Attribute(normals, 3);
				//pointCloudGeometry.indices = Uint32Attribute(Array.from(Array(points.length/3).keys()), 1);

				//pointCloudGeometry.computeVertexNormals();

				let pointCloudMaterial = new RC.CustomShaderMaterial("pointcloud", {"material.shininess": 16, "material.diffuse": [1, 0, 1]});
				
				pointCloudMaterial.color = new RC.Color(0x110044);
				pointCloudMaterial.useVertexColors = true;
				pointCloudMaterial.side = FRONT_SIDE;
				pointCloudMaterial.usePoints = true;
				pointCloudMaterial.pointSize = 200.0;

				let pointCloudObject = new RC.PointCloud(null, null, pointCloudGeometry, pointCloudMaterial);

				//pointCloudObject.rotateX(-Math.PI / 2);
				pointCloudObject.usePoints = true;
				pointCloudObject.visible = true;

				scene.add(pointCloudObject);
			}
		);

		//this.cube = new RC.Cube(1, new RC.Color(1.0, 0.0, 1.0));
		//this.scene.add(this.cube);

		this.camera = new RC.PerspectiveCamera(75, this.canvas.width/this.canvas.height, 0.1, 1000.0);
		this.camera.position = new RC.Vector3(0, 0.4, 7.5);//new RC.Vector3(50, 10, 100);
		var camera = this.camera;

		var keyboardRotation = {x: 0, y: 0, z: 0, reset: function() { this.x = 0; this.y = 0; this.z = 0; }};
		var keyboardTranslation = {x: camera.position.x, y: camera.position.y, z: camera.position.z, reset: function() { this.x = 0; this.y = 0; this.z = 0; }};
		this.keyboardInput = RC.KeyboardInput.instance;
		this.keyboardInput.addListener(function (pressedKeys) {
			// ROTATIONS
			if (pressedKeys.has(65)) keyboardRotation.y += 0.01; // A
			if (pressedKeys.has(68)) keyboardRotation.y += -0.01; // D
			if (pressedKeys.has(87)) keyboardRotation.x += 0.01; // W
			if (pressedKeys.has(83)) keyboardRotation.x += -0.01; // S
			if (pressedKeys.has(81)) keyboardRotation.z += 0.01; // Q
			if (pressedKeys.has(69)) keyboardRotation.z += -0.01; // R

			// TRANSLATIONS
			if (pressedKeys.has(39)) keyboardTranslation.x += +0.1; // RIGHT - Right
			if (pressedKeys.has(37)) keyboardTranslation.x += -0.1; // LEFT - Left
			if (pressedKeys.has(40)) keyboardTranslation.z += +0.1; // DOWN - Backward
			if (pressedKeys.has(38)) keyboardTranslation.z += -0.1; // UP - Forward
			if (pressedKeys.has(82)) keyboardTranslation.y += +0.1; // R - Upward
			if (pressedKeys.has(70)) keyboardTranslation.y += -0.1; // F - Downward

			camera.position.x = keyboardTranslation.x;
			camera.position.y = keyboardTranslation.y;
			camera.position.z = keyboardTranslation.z;

			camera.rotation.x = keyboardRotation.x;
			camera.rotation.y = keyboardRotation.y;
			camera.rotation.z = keyboardRotation.z;
		});

		this.resize();
		window.requestAnimationFrame(() => {
            this.render()
        });
	}

	render() {
		this.renderer.render(this.scene, this.camera);
		this.keyboardInput.update();
		window.requestAnimationFrame(() => {
            this.render()
        });
	}

	resize() {
		// Make the canvas the same size
		this.canvas.width  = window.innerWidth * window.devicePixelRatio;
		this.canvas.height = window.innerHeight * window.devicePixelRatio;

		// Update camera aspect ratio and renderer viewport
		this.camera.aspect = this.canvas.width / this.canvas.height;
		this.renderer.updateViewport(this.canvas.width, this.canvas.height);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const canvas = document.querySelector('canvas');
	const app = window.app = new App(canvas);
});