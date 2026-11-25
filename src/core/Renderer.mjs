/**
 * Renderer.js — Couche de rendu du moteur.
 *
 * Crée la scène, la caméra, les lumières de base et le WebGPURenderer de Three.js.
 * Le rendu se fait TOUJOURS avec ce WebGPURenderer, en mode bureau comme en VR :
 *   - en mode bureau : une caméra, dans le canvas de la page ;
 *   - en VR : les deux yeux en une passe (ArrayCamera), puis XRPresenter copie l'image vers le casque.
 * WebGPU est obligatoire : sans WebGPU, init() lève une erreur, affichée sur l'écran d'accueil par main.js.
 */
import * as THREE from 'three/webgpu';

/** Hauteur des yeux (m) en mode bureau, avant l'entrée en VR. */
export const EYE_HEIGHT = 1.6;

/** Paramètres du WebGPURenderer. */
const RENDERER_PARAMETERS = {
	antialias: true,
	outputBufferType: THREE.UnsignedByteType
};

/** Pixel ratio maximal en mode bureau (performances). */
const MAX_PIXEL_RATIO = 2;

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

		/** Le WebGPURenderer de Three.js. @type {?THREE.WebGPURenderer} */
		this.renderer = null;

		/** Pipeline de rendu direct associé au renderer. @type {?THREE.DirectRenderPipeline} */
		this.pipeline = null;

		/** Vrai pendant une session VR : la taille du canvas est imposée par le casque. */
		this.xrSized = false;

		this._addLights();
		this._onResize = this._onResize.bind( this );

	}

	/**
	 * Crée et initialise le renderer (asynchrone : `await renderer.init()`).
	 * @returns {Promise<void>}
	 */
	async init() {

		// WebGPU est obligatoire : pas de repli WebGL 2.
		if ( ! navigator.gpu ) throw new Error( 'WebGPU n\'est pas disponible dans ce navigateur (utilisez Chrome ou Edge récent).' );

		const renderer = this._createRenderer();
		await renderer.init();

		if ( ! renderer.backend.isWebGPUBackend ) throw new Error( 'WebGPU n\'a pas pu démarrer sur cette carte graphique.' );

		this._install( renderer );
		window.addEventListener( 'resize', this._onResize );
		console.info( '[Renderer] Backend : WebGPU' );

	}

	/**
	 * Démarre ou arrête la boucle de rendu du mode bureau.
	 * @param {?Function} callback - Appelée à chaque image (null pour arrêter).
	 */
	setAnimationLoop( callback ) {

		this.renderer.setAnimationLoop( callback );

	}

	/** Dessine la scène avec la caméra principale (mode bureau). */
	render() {

		this.pipeline.render( this.scene, this.camera );

	}

	/**
	 * Dessine la scène pour les deux yeux en une seule passe WebGPU (VR).
	 * Chaque sous-caméra de l'ArrayCamera a son viewport (moitié gauche, moitié droite).
	 * @param {THREE.ArrayCamera} stereoCamera
	 */
	renderStereo( stereoCamera ) {

		this.renderer.render( this.scene, stereoCamera );

	}

	/**
	 * Donne au canvas la taille de l'image du casque (pixel ratio 1).
	 * @param {number} width
	 * @param {number} height
	 */
	setXRSize( width, height ) {

		this.xrSized = true;
		this.renderer.setPixelRatio( 1 );
		this.renderer.setSize( width, height, false );

	}

	/** Revient à la taille de la fenêtre après la VR. */
	restoreSize() {

		this.xrSized = false;
		this.renderer.setPixelRatio( Math.min( window.devicePixelRatio, MAX_PIXEL_RATIO ) );
		this._onResize();

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
	 * Fabrique le WebGPURenderer.
	 * @returns {THREE.WebGPURenderer}
	 */
	_createRenderer() {

		const renderer = new THREE.WebGPURenderer( RENDERER_PARAMETERS );
		renderer.setPixelRatio( Math.min( window.devicePixelRatio, MAX_PIXEL_RATIO ) );
		renderer.setSize( window.innerWidth, window.innerHeight );

		// La VR n'utilise pas le gestionnaire XR intégré de Three.js : XRPresenter parle
		// directement à l'API WebXR Device et rend avec ce même WebGPURenderer.
		renderer.xr.enabled = false;

		return renderer;

	}

	/**
	 * Place le canvas dans la page.
	 * @param {THREE.WebGPURenderer} renderer
	 */
	_install( renderer ) {

		this.container.appendChild( renderer.domElement );
		this.renderer = renderer;
		this.pipeline = new THREE.DirectRenderPipeline( renderer );

	}

	/** Adapte caméra et canvas à la taille de la fenêtre. */
	_onResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		// Pendant une session VR, la taille est imposée par le casque.
		if ( this.xrSized ) return;
		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

}