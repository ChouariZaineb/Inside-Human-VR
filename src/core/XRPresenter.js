/**
 * XRPresenter.js — La VR avec l'API WebXR Device, rendue par WebGPU.
 *
 * Pourquoi ce module ?
 *   Pour afficher une image dans un casque, WebXR demande une « couche » (layer).
 *   Une couche WebGPU (XRGPUBinding) n'existe que derrière des drapeaux expérimentaux de Chrome
 *   et n'est pas gérée par Immersive Web Emulator. Seule la couche WebGL (XRWebGLLayer) est
 *   disponible partout.
 *
 * La solution retenue :
 *   1. la session est ouverte directement avec l'API WebXR Device :
 *      navigator.xr.requestSession('immersive-vr'), requestReferenceSpace('local-floor'),
 *      session.requestAnimationFrame(), frame.getViewerPose(), frame.getPose() pour les manettes ;
 *   2. TOUTE la scène est rendue par le WebGPURenderer (shaders WGSL), les deux yeux en une seule
 *      passe grâce à une ArrayCamera (une sous-caméra et un viewport par œil) ;
 *   3. l'image finale est seulement COPIÉE dans la couche XRWebGLLayer (texImage2D + blitFramebuffer),
 *      sans aucun dessin WebGL : WebGL ne sert que de « tuyau » vers le casque.
 *   Le jour où XRGPUBinding sera disponible, seule l'étape 3 changera.
 */
import * as THREE from 'three/webgpu';

export class XRPresenter extends THREE.EventDispatcher {

	/**
	 * @param {import('./Engine.js').Engine} engine
	 */
	constructor( engine ) {

		super();

		this.engine = engine;

		/** Session en cours. @type {?XRSession} */
		this.session = null;

		/** Espace de référence 'local-floor' (origine au sol). @type {?XRReferenceSpace} */
		this.referenceSpace = null;

		/** Caméra stéréo : une sous-caméra par œil. */
		this.stereoCamera = new THREE.ArrayCamera( [ this._createEye(), this._createEye() ] );

		/** @private Contexte WebGL compatible XR, utilisé uniquement pour la copie vers le casque. */
		this._gl = null;
		this._layer = null;
		this._texture = null;
		this._readFramebuffer = null;

		this._onFrame = this._onFrame.bind( this );
		this._onEnd = this._onEnd.bind( this );

	}

	/**
	 * Démarre l'affichage dans le casque pour une session déjà ouverte.
	 * @param {XRSession} session - Session 'immersive-vr' obtenue avec navigator.xr.requestSession().
	 */
	async start( session ) {

		this.session = session;
		session.addEventListener( 'end', this._onEnd );

		// 1. Couche de sortie : un contexte WebGL compatible XR qui ne dessine rien lui-même.
		const canvas = document.createElement( 'canvas' );
		const gl = canvas.getContext( 'webgl2', { xrCompatible: true, alpha: false, antialias: false, depth: false } );
		if ( gl.makeXRCompatible ) await gl.makeXRCompatible();
		this._gl = gl;

		this._layer = new XRWebGLLayer( session, gl, { alpha: false, antialias: false, depth: false } );
		await session.updateRenderState( {
			baseLayer: this._layer,
			depthNear: this.engine.camera.near,
			depthFar: this.engine.camera.far
		} );

		this._texture = gl.createTexture();
		gl.bindTexture( gl.TEXTURE_2D, this._texture );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		this._readFramebuffer = gl.createFramebuffer();

		// 2. Repère : 'local-floor' place l'origine au niveau du sol.
		this.referenceSpace = await session.requestReferenceSpace( 'local-floor' );

		// 3. Le canvas WebGPU prendra la taille de l'image du casque à la première image (_onFrame).
		this._width = 0;
		this._height = 0;

		// 4. Boucle d'images du casque (remplace celle de la fenêtre).
		session.requestAnimationFrame( this._onFrame );

		console.info( '[XR] Session WebXR démarrée : rendu WebGPU des deux yeux, copie vers XRWebGLLayer' );

	}

	/**
	 * Une image du casque.
	 * @private
	 * @param {DOMHighResTimeStamp} time
	 * @param {XRFrame} frame
	 */
	_onFrame( time, frame ) {

		const session = frame.session;
		session.requestAnimationFrame( this._onFrame );

		const pose = frame.getViewerPose( this.referenceSpace );
		if ( ! pose ) return;

		const engine = this.engine;

		// Taille de l'image du casque : l'émulateur peut la changer après le démarrage.
		const width = this._layer.framebufferWidth;
		const height = this._layer.framebufferHeight;
		if ( width !== this._width || height !== this._height ) {

			this._width = width;
			this._height = height;
			engine.setXRSize( width, height );

		}

		// Tête : la caméra principale (enfant de player) suit le casque.
		const camera = engine.camera;
		camera.matrix.fromArray( pose.transform.matrix );
		camera.matrix.decompose( camera.position, camera.quaternion, camera.scale );
		engine.player.updateMatrixWorld( true );

		// Yeux : matrice de projection et position fournies par WebXR pour chaque vue.
		const eyes = this.stereoCamera.cameras;
		pose.views.forEach( ( view, i ) => {

			const eye = eyes[ i ];
			if ( ! eye ) return;

			const viewport = this._layer.getViewport( view );
			eye.viewport.set( viewport.x, viewport.y, viewport.width, viewport.height );

			eye.projectionMatrix.fromArray( view.projectionMatrix );
			eye.projectionMatrixInverse.copy( eye.projectionMatrix ).invert();

			eye.matrix.fromArray( view.transform.matrix );
			eye.matrixWorld.multiplyMatrices( engine.player.matrixWorld, eye.matrix );
			eye.matrixWorldInverse.copy( eye.matrixWorld ).invert();

		} );

		// La caméra stéréo est placée sur la tête (utile pour le tri des objets transparents).
		this.stereoCamera.matrixWorld.copy( camera.matrixWorld );
		this.stereoCamera.matrixWorldInverse.copy( camera.matrixWorld ).invert();
		this.stereoCamera.projectionMatrix.copy( eyes[ 0 ].projectionMatrix );
		this.stereoCamera.projectionMatrixInverse.copy( eyes[ 0 ].projectionMatrixInverse );

		// Manettes : position du rayon et de la main, données par l'API WebXR.
		this.dispatchEvent( { type: 'frame', frame, referenceSpace: this.referenceSpace } );

		// Logique de l'application (Interaction, Teleport, niveaux…), puis rendu WebGPU des deux yeux.
		engine.step( time );
		engine.renderStereo( this.stereoCamera );

		// Copie de l'image WebGPU vers le casque.
		this._present();

	}

	/**
	 * Copie le canvas WebGPU dans le framebuffer de la couche XR.
	 * Doit être appelé dans la même tâche que le rendu (l'image WebGPU n'est lisible que jusqu'à sa présentation).
	 * @private
	 */
	_present() {

		const gl = this._gl;
		const source = this.engine.renderer.domElement;
		const width = this._layer.framebufferWidth;
		const height = this._layer.framebufferHeight;

		// Le canvas a son origine en haut, WebGL en bas : on retourne l'image à la copie.
		gl.bindTexture( gl.TEXTURE_2D, this._texture );
		gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, true );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source );

		gl.bindFramebuffer( gl.READ_FRAMEBUFFER, this._readFramebuffer );
		gl.framebufferTexture2D( gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._texture, 0 );
		gl.bindFramebuffer( gl.DRAW_FRAMEBUFFER, this._layer.framebuffer ); // null avec l'émulateur : framebuffer par défaut

		gl.blitFramebuffer( 0, 0, source.width, source.height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.LINEAR );

		gl.bindFramebuffer( gl.READ_FRAMEBUFFER, null );
		gl.bindFramebuffer( gl.DRAW_FRAMEBUFFER, null );

	}

	/** @private */
	_onEnd() {

		this.session.removeEventListener( 'end', this._onEnd );
		this.session = null;
		this.referenceSpace = null;

		const gl = this._gl;
		if ( gl ) {

			gl.deleteTexture( this._texture );
			gl.deleteFramebuffer( this._readFramebuffer );

		}

		this._gl = this._layer = this._texture = this._readFramebuffer = null;

		this.engine.restoreSize();
		this.dispatchEvent( { type: 'end' } );

	}

	/** @private */
	_createEye() {

		const eye = new THREE.PerspectiveCamera();
		eye.viewport = new THREE.Vector4();
		eye.matrixAutoUpdate = false;
		eye.matrixWorldAutoUpdate = false;
		return eye;

	}

}
