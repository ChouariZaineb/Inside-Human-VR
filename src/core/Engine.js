/**
 * Engine.js — Point central du moteur Inside Human VR.
 *
 * C'est l'objet que les niveaux et les systèmes utilisent :
 *   - engine.scene, engine.camera, engine.renderer
 *   - engine.player : groupe « joueur » qui contient la caméra (et les manettes VR).
 *     La téléportation déplace ce groupe, jamais la caméra elle-même.
 *   - engine.onUpdate(callback) : s'abonner à la boucle de rendu.
 *   - engine.isVR() : vrai pendant une session immersive-vr.
 *
 * @example
 * const engine = new Engine( document.getElementById( 'app' ) );
 * await engine.init();
 * const stop = engine.onUpdate( ( delta, elapsed ) => { cube.rotation.y += delta; } );
 * engine.start();
 */
import * as THREE from 'three/webgpu';
import { Renderer, EYE_HEIGHT } from './Renderer.js';

/**
 * @callback UpdateCallback
 * @param {number} delta - Temps écoulé depuis l'image précédente (secondes, entre 0 et 0,1 s).
 * @param {number} elapsed - Temps écoulé depuis le démarrage du moteur (secondes).
 */

export class Engine extends THREE.EventDispatcher {

	/**
	 * @param {HTMLElement} container - Élément DOM qui reçoit le canvas.
	 */
	constructor( container ) {

		super();

		/** @private */
		this._view = new Renderer( container );

		/**
		 * Groupe « joueur » : contient la caméra et les manettes.
		 * Pour déplacer l'utilisateur, on déplace ce groupe.
		 * @type {THREE.Group}
		 */
		this.player = new THREE.Group();
		this.player.name = 'player';
		this.player.add( this._view.camera );
		this._view.scene.add( this.player );

		/** @private @type {Set<UpdateCallback>} */
		this._callbacks = new Set();

		/** @private */
		this._timer = new THREE.Timer();

		/** Vrai pendant une session VR (mis à jour par XRManager). @type {boolean} */
		this.xrActive = false;

		/** @private */
		this._running = false;

	}

	/** Scène principale. @type {THREE.Scene} */
	get scene() {

		return this._view.scene;

	}

	/** Caméra principale (enfant de `player`). @type {THREE.PerspectiveCamera} */
	get camera() {

		return this._view.camera;

	}

	/**
	 * Le WebGPURenderer, utilisé en mode bureau comme en VR.
	 * @type {THREE.WebGPURenderer}
	 */
	get renderer() {

		return this._view.renderer;

	}

	/**
	 * Initialise le renderer (asynchrone).
	 * @returns {Promise<void>}
	 */
	async init() {

		await this._view.init();

	}

	/**
	 * Démarre la boucle de rendu (renderer.setAnimationLoop, obligatoire pour la XR).
	 */
	start() {

		this._running = true;
		this._timer.reset();
		this._view.setAnimationLoop( ( timestamp ) => this._loop( timestamp ) );

	}

	/**
	 * Arrête ou reprend la boucle du mode bureau (pendant la VR, c'est le casque qui rythme les images).
	 * @param {boolean} paused
	 */
	pauseDesktopLoop( paused ) {

		if ( ! this._running ) return;
		this._view.setAnimationLoop( paused ? null : ( timestamp ) => this._loop( timestamp ) );

	}

	/**
	 * Met à jour la logique pour une image : appelle toutes les fonctions onUpdate.
	 * Utilisé par la boucle du mode bureau et par la boucle du casque (XRPresenter).
	 * @param {DOMHighResTimeStamp} timestamp
	 */
	step( timestamp ) {

		this._timer.update( timestamp );
		// Le delta est borné entre 0 et 0,1 s : au premier affichage, l'horodatage du navigateur
		// peut être légèrement antérieur à reset() (delta négatif), et après une pause il peut être énorme.
		const delta = THREE.MathUtils.clamp( this._timer.getDelta(), 0, 0.1 );
		const elapsed = this._timer.getElapsed();

		for ( const callback of this._callbacks ) callback( delta, elapsed );

	}

	/**
	 * Rendu stéréo (VR) : les deux yeux en une passe WebGPU.
	 * @param {THREE.ArrayCamera} stereoCamera
	 */
	renderStereo( stereoCamera ) {

		this._view.renderStereo( stereoCamera );

	}

	/** Taille du canvas imposée par le casque. @param {number} width @param {number} height */
	setXRSize( width, height ) {

		this._view.setXRSize( width, height );

	}

	/** Retour à la taille de la fenêtre après la VR. */
	restoreSize() {

		this._view.restoreSize();

	}

	/**
	 * Abonne une fonction à la boucle de rendu.
	 * @param {UpdateCallback} callback - Appelée à chaque image avec (delta, elapsed).
	 * @returns {() => void} Fonction de désinscription.
	 */
	onUpdate( callback ) {

		this._callbacks.add( callback );
		return () => this._callbacks.delete( callback );

	}

	/**
	 * Indique si une session immersive-vr est en cours.
	 * @returns {boolean}
	 */
	isVR() {

		return this.xrActive;

	}

	/**
	 * Remet la caméra à hauteur des yeux, regard droit devant
	 * (utilisé en sortie de VR et en mode bureau).
	 */
	resetCameraPose() {

		this.camera.position.set( 0, EYE_HEIGHT, 0 );
		this.camera.quaternion.identity();

	}

	/**
	 * Une image : met à jour les abonnés puis dessine la scène.
	 * @private
	 * @param {number} timestamp
	 */
	_loop( timestamp ) {

		this.step( timestamp );
		this._view.render();

	}

}
