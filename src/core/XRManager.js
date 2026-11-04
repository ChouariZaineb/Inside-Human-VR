/**
 * XRManager.js — Gestion de la réalité virtuelle (WebXR).
 *
 * - Relie un bouton « Entrer en VR » à une session 'immersive-vr' en 'local-floor'.
 * - Crée les deux manettes (modèle 3D + rayon visible) dans `engine.player`,
 *   pour qu'elles suivent l'utilisateur lors des téléportations.
 * - Si WebXR n'est pas disponible, le bouton affiche « VR non disponible » sans planter.
 *
 * Événements émis (THREE.EventDispatcher) :
 *   - 'sessionstart' / 'sessionend'
 *   - 'select' { controller } : gâchette appuyée sur une manette
 *
 * Testé sans casque avec l'extension Chrome « Immersive Web Emulator ».
 */
import * as THREE from 'three/webgpu';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

/** Longueur par défaut du rayon des manettes (m). */
export const RAY_LENGTH = 5;

/** Options de session : 'local-floor' obligatoire, 'webgpu' pour la XR native WebGPU si disponible. */
const SESSION_INIT = {
	requiredFeatures: [ 'local-floor' ],
	optionalFeatures: [ 'bounded-floor', 'layers', 'webgpu' ]
};

export class XRManager extends THREE.EventDispatcher {

	/**
	 * @param {import('./Engine.js').Engine} engine
	 * @param {HTMLButtonElement} [button] - Bouton « Entrer en VR » (optionnel).
	 */
	constructor( engine, button = null ) {

		super();

		this.engine = engine;
		this.button = button;

		/** Vrai si le navigateur accepte une session immersive-vr. @type {boolean} */
		this.supported = false;

		/** Les deux manettes (rayon + événements). @type {THREE.Group[]} */
		this.controllers = [];

		/** Les deux « grips » (modèles 3D des manettes). @type {THREE.Group[]} */
		this.grips = [];

		/** @private @type {?XRSession} */
		this._session = null;
		this._modelFactory = new XRControllerModelFactory();

		this._onSessionEnd = this._onSessionEnd.bind( this );

		// Manettes créées tout de suite : les systèmes peuvent les utiliser dès le départ.
		this._setupControllers();

		// Si le renderer est remplacé (repli WebGL), on recrée les manettes.
		engine.addEventListener( 'rendererchange', () => this._setupControllers() );

		if ( this.button ) {

			this.button.disabled = true;
			this.button.textContent = 'Vérification de la VR…';
			this.button.addEventListener( 'click', () => this.toggle() );

		}

	}

	/**
	 * Vérifie le support WebXR et met à jour le bouton.
	 * Ne bloque jamais plus de `timeout` ms (certains navigateurs ne répondent pas).
	 * @param {number} [timeout=3000] - Délai maximal d'attente (ms).
	 * @returns {Promise<boolean>} Vrai si la VR est disponible.
	 */
	async init( timeout = 3000 ) {

		if ( 'xr' in navigator ) {

			try {

				const check = navigator.xr.isSessionSupported( 'immersive-vr' );
				const timer = new Promise( ( resolve ) => setTimeout( () => resolve( false ), timeout ) );
				this.supported = await Promise.race( [ check, timer ] );

			} catch ( error ) {

				console.warn( '[XR] Vérification du support impossible :', error );

			}

		}

		this._updateButton();

		console.info( `[XR] immersive-vr ${this.supported ? 'disponible' : 'non disponible'}` );
		return this.supported;

	}

	/** Vrai si une session est en cours. @type {boolean} */
	get isPresenting() {

		return this._session !== null;

	}

	/** Entre en VR, ou en sort si une session est déjà ouverte. */
	toggle() {

		return this.isPresenting ? this.exit() : this.enter();

	}

	/**
	 * Démarre une session immersive-vr en espace 'local-floor'.
	 * @returns {Promise<boolean>} Vrai si la session a démarré.
	 */
	async enter() {

		if ( ! this.supported || this.isPresenting ) return false;

		try {

			const session = await navigator.xr.requestSession( 'immersive-vr', SESSION_INIT );
			session.addEventListener( 'end', this._onSessionEnd );

			// Toujours relire engine.renderer : il peut être remplacé pendant cet appel.
			await this.engine.renderer.xr.setSession( session );

			this._session = session;
			this._updateButton();
			this.dispatchEvent( { type: 'sessionstart' } );
			return true;

		} catch ( error ) {

			console.error( '[XR] Impossible de démarrer la session VR :', error );
			this.dispatchEvent( { type: 'error', error } );
			return false;

		}

	}

	/** Termine la session VR en cours. */
	async exit() {

		if ( this._session ) await this._session.end();

	}

	/** @private */
	_onSessionEnd() {

		this._session.removeEventListener( 'end', this._onSessionEnd );
		this._session = null;

		// En sortie de VR, la caméra reprend la pose du mode bureau.
		this.engine.resetCameraPose();

		this._updateButton();
		this.dispatchEvent( { type: 'sessionend' } );

	}

	/** Met à jour le texte et l'état du bouton. @private */
	_updateButton() {

		if ( ! this.button ) return;

		this.button.disabled = ! this.supported;

		if ( ! this.supported ) this.button.textContent = 'VR non disponible';
		else this.button.textContent = this.isPresenting ? 'Quitter la VR' : 'Entrer en VR';

	}

	/**
	 * (Re)crée les deux manettes à partir du renderer courant.
	 * @private
	 */
	_setupControllers() {

		const renderer = this.engine.renderer;
		const player = this.engine.player;

		// Retire les anciennes manettes (cas du changement de renderer).
		for ( const object of [ ...this.controllers, ...this.grips ] ) player.remove( object );
		this.controllers = [];
		this.grips = [];

		for ( let i = 0; i < 2; i ++ ) {

			// Manette « target ray » : origine et direction du rayon.
			const controller = renderer.xr.getController( i );
			controller.userData.index = i;
			controller.userData.connected = false;

			if ( ! controller.userData.line ) {

				controller.userData.line = this._createRayLine();
				controller.add( controller.userData.line );

			}

			if ( ! controller.userData.listening ) {

				controller.userData.listening = true;

				controller.addEventListener( 'connected', ( event ) => {

					controller.userData.connected = true;
					controller.userData.inputSource = event.data;
					controller.userData.line.visible = event.data.targetRayMode === 'tracked-pointer';

				} );

				controller.addEventListener( 'disconnected', () => {

					controller.userData.connected = false;
					controller.userData.inputSource = null;
					controller.userData.line.visible = false;

				} );

				controller.addEventListener( 'selectstart', () => {

					this.dispatchEvent( { type: 'select', controller } );

				} );

			}

			controller.userData.line.visible = false;
			player.add( controller );
			this.controllers.push( controller );

			// Manette « grip » : position de la main, avec le modèle 3D officiel.
			const grip = renderer.xr.getControllerGrip( i );
			if ( ! grip.userData.hasModel ) {

				grip.add( this._modelFactory.createControllerModel( grip ) );
				grip.userData.hasModel = true;

			}

			player.add( grip );
			this.grips.push( grip );

		}

	}

	/**
	 * Crée le rayon visible d'une manette (ligne de 1 m mise à l'échelle sur Z).
	 * @private
	 * @returns {THREE.Line}
	 */
	_createRayLine() {

		const geometry = new THREE.BufferGeometry().setFromPoints( [
			new THREE.Vector3( 0, 0, 0 ),
			new THREE.Vector3( 0, 0, - 1 )
		] );

		const material = new THREE.LineBasicMaterial( { color: 0x7fe8ff, transparent: true, opacity: 0.8 } );
		const line = new THREE.Line( geometry, material );
		line.name = 'ray';
		line.scale.z = RAY_LENGTH;
		line.visible = false;
		return line;

	}

}
