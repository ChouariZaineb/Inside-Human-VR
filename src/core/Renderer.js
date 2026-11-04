/**
 * Renderer.js — Couche de rendu du moteur.
 *
 * Crée la scène, la caméra, les lumières de base et le WebGPURenderer de Three.js.
 * Gère aussi le repli WebGL prévu par Three.js pour la VR : si le navigateur
 * n'expose pas encore XRGPUBinding (cas de Chrome + Immersive Web Emulator),
 * `setupWebGLXRFallback` remplace le renderer par un WebGPURenderer
 * `forceWebGL: true` au moment d'entrer en VR. Le code reste 100 % 'three/webgpu'.
 */
import * as THREE from 'three/webgpu';
import { setupWebGLXRFallback } from 'three/addons/webxr/WebGLXRFallback.js';

/** Hauteur des yeux (m) en mode bureau, avant l'entrée en VR. */
export const EYE_HEIGHT = 1.6;

/** Paramètres du WebGPURenderer (repris de l'exemple officiel webgpu_xr_cubes). */
const RENDERER_PARAMETERS = {
	antialias: true,
	outputBufferType: THREE.UnsignedByteType
};

export class Renderer extends THREE.EventDispatcher {

	/**
	 * @param {HTMLElement} container - Élément DOM qui reçoit le canvas.
	 */
	constructor( container ) {

		super();

		/** @type {HTMLElement} */
		this.container = container;

		/** Scène principale. @type {THREE.Scene} */
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0x12040a );

		/** Caméra perspective (near très petit : on est miniaturisé). @type {THREE.PerspectiveCamera} */
		this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 200 );
		this.camera.position.set( 0, EYE_HEIGHT, 0 );

		/** Renderer courant (peut changer lors du repli WebGL en VR). @type {?THREE.WebGPURenderer} */
		this.renderer = null;

		/** Pipeline de rendu direct associé au renderer courant. @type {?THREE.DirectRenderPipeline} */
		this.pipeline = null;

		this._addLights();
		this._onResize = this._onResize.bind( this );

	}

	/**
	 * Crée et initialise le renderer (asynchrone : `await renderer.init()`).
	 * @returns {Promise<void>}
	 */
	async init() {

		const renderer = this._createRenderer();
		await renderer.init();
		this._install( renderer );

		// Repli WebGL automatique au démarrage d'une session XR si nécessaire.
		setupWebGLXRFallback(
			renderer,
			() => this._createRenderer( true ),
			( newRenderer, oldRenderer ) => this._install( newRenderer, oldRenderer )
		);

		window.addEventListener( 'resize', this._onResize );

		const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2 (repli)';
		console.info( `[Renderer] Backend : ${backend}` );

	}

	/**
	 * Démarre la boucle de rendu. `setAnimationLoop` est obligatoire pour la XR.
	 * @param {?Function} callback - Appelée à chaque image (null pour arrêter).
	 */
	setAnimationLoop( callback ) {

		this.renderer.setAnimationLoop( callback );

	}

	/** Dessine la scène avec la caméra principale. */
	render() {

		this.pipeline.render( this.scene, this.camera );

	}

	/** Lumières de base, neutres ; les finitions visuelles viendront plus tard. */
	_addLights() {

		const hemi = new THREE.HemisphereLight( 0xffe6e6, 0x330000, 1.2 );
		this.scene.add( hemi );

		const sun = new THREE.DirectionalLight( 0xffffff, 1.5 );
		sun.position.set( 3, 6, 2 );
		this.scene.add( sun );

	}

	/**
	 * Fabrique un WebGPURenderer configuré.
	 * @param {boolean} [forceWebGL=false] - Force le backend WebGL 2 (repli XR).
	 * @returns {THREE.WebGPURenderer}
	 */
	_createRenderer( forceWebGL = false ) {

		const parameters = { ...RENDERER_PARAMETERS };
		if ( forceWebGL ) parameters.forceWebGL = true;

		const renderer = new THREE.WebGPURenderer( parameters );
		renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
		renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.xr.enabled = true;
		renderer.xr.setReferenceSpaceType( 'local-floor' );

		return renderer;

	}

	/**
	 * Installe un renderer (premier ou de repli) et prévient les abonnés.
	 * @param {THREE.WebGPURenderer} newRenderer
	 * @param {?THREE.WebGPURenderer} [oldRenderer=null]
	 */
	_install( newRenderer, oldRenderer = null ) {

		if ( oldRenderer === null ) {

			this.container.appendChild( newRenderer.domElement );

		} else {

			this.container.replaceChild( newRenderer.domElement, oldRenderer.domElement );
			oldRenderer.dispose();
			console.info( '[Renderer] Session XR : repli sur le backend WebGL 2 de Three.js' );

		}

		this.renderer = newRenderer;
		this.pipeline = new THREE.DirectRenderPipeline( newRenderer );

		this.dispatchEvent( { type: 'rendererchange', renderer: newRenderer, oldRenderer } );

	}

	/** Adapte caméra et canvas à la taille de la fenêtre. */
	_onResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		// Pendant une session XR, la taille est imposée par le casque.
		if ( this.renderer.xr.isPresenting ) return;
		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

}
