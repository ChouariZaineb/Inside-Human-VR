/**
 * XRManager.js — Gestion de la réalité virtuelle avec l'API WebXR Device.
 *
 * - Relie le bouton « Entrer en VR » à navigator.xr.requestSession('immersive-vr'),
 *   avec la fonctionnalité obligatoire 'local-floor'.
 * - Confie l'affichage à XRPresenter (rendu WebGPU des deux yeux, copie vers le casque).
 * - Suit les manettes avec session.inputSources et frame.getPose() : rayon (targetRaySpace)
 *   et main (gripSpace), placés dans `engine.player` pour suivre les téléportations.
 * - Si WebXR n'est pas disponible, le bouton affiche « VR non disponible » sans planter.
 *
 * Événements émis (THREE.EventDispatcher) :
 *   - 'sessionstart' / 'sessionend'
 *   - 'select' { controller } : gâchette appuyée (événement WebXR 'selectstart')
 *   - 'squeezestart' / 'squeezeend' { controller } : bouton de saisie (grip) appuyé / relâché
 *
 * Retour et entrées supplémentaires (API Gamepad de chaque inputSource) :
 *   - pulse(controller, intensité, durée) : vibration de la manette (retour haptique) ;
 *   - getThumbstick(controller) : position du joystick { x, y } entre -1 et 1.
 *
 * Testé sans casque avec l'extension Chrome « Immersive Web Emulator ».
 */
import * as THREE from 'three/webgpu';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRPresenter } from './XRPresenter.js';

/** Longueur par défaut du rayon des manettes (m). */
export const RAY_LENGTH = 5;

/** Options de la session WebXR : 'local-floor' obligatoire (origine au sol). */
const SESSION_INIT = {
	requiredFeatures: [ 'local-floor' ],
	optionalFeatures: [ 'bounded-floor' ]
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

		/** Affichage dans le casque (rendu WebGPU). */
		this.presenter = new XRPresenter( engine );
		this.presenter.addEventListener( 'frame', ( event ) => this._updateControllers( event.frame, event.referenceSpace ) );
		this.presenter.addEventListener( 'end', () => this._onSessionEnd() );

		this._onInputSourcesChange = this._onInputSourcesChange.bind( this );
		this._onSelectStart = ( event ) => this._dispatchInput( 'select', event.inputSource );
		this._onSqueezeStart = ( event ) => this._dispatchInput( 'squeezestart', event.inputSource );
		this._onSqueezeEnd = ( event ) => this._dispatchInput( 'squeezeend', event.inputSource );

		// Manettes créées tout de suite : les systèmes peuvent les utiliser dès le départ.
		this._setupControllers();

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

		if ( ! ( 'xr' in navigator ) ) {

			console.info( '[XR] immersive-vr non disponible : WebXR absent (navigateur non compatible ou page non sécurisée, utilisez localhost ou HTTPS)' );
			this._updateButton();
			return false;

		}

		// Un casque (ou l'émulateur) peut apparaître après le chargement : on revérifie.
		if ( ! this._listeningDevices ) {

			this._listeningDevices = true;
			navigator.xr.addEventListener( 'devicechange', () => {

				if ( ! this.isPresenting ) this.init( timeout );

			} );

		}

		let reason = 'aucun casque détecté (cliquez sur l\'icône Immersive Web Emulator dans la barre d\'outils pour l\'activer sur ce site)';

		try {

			const check = navigator.xr.isSessionSupported( 'immersive-vr' );
			const timer = new Promise( ( resolve ) => setTimeout( () => resolve( null ), timeout ) );
			const result = await Promise.race( [ check, timer ] );

			if ( result === null ) reason = `pas de réponse du navigateur en ${timeout} ms`;
			this.supported = result === true;

		} catch ( error ) {

			reason = `erreur lors de la vérification (${error.message})`;
			this.supported = false;

		}

		this._updateButton();

		if ( this.supported ) console.info( '[XR] immersive-vr disponible' );
		else console.info( `[XR] immersive-vr non disponible : ${reason}` );

		this.dispatchEvent( { type: 'supportchange', supported: this.supported } );
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

			// API WebXR Device : demande d'une session immersive.
			const session = await navigator.xr.requestSession( 'immersive-vr', SESSION_INIT );
			this._session = session;

			session.addEventListener( 'inputsourceschange', this._onInputSourcesChange );
			session.addEventListener( 'selectstart', this._onSelectStart );
			session.addEventListener( 'squeezestart', this._onSqueezeStart );
			session.addEventListener( 'squeezeend', this._onSqueezeEnd );

			// La boucle du casque remplace celle de la fenêtre.
			this.engine.pauseDesktopLoop( true );
			this.engine.xrActive = true;

			await this.presenter.start( session );
			this._onInputSourcesChange( { added: session.inputSources, removed: [] } );

			this._updateButton();
			this.dispatchEvent( { type: 'sessionstart' } );
			return true;

		} catch ( error ) {

			console.error( '[XR] Impossible de démarrer la session VR :', error );
			if ( this._session ) this._session.end().catch( () => {} );
			this._session = null;
			this.engine.xrActive = false;
			this.engine.pauseDesktopLoop( false );
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

		if ( ! this._session ) return;

		const session = this._session;
		session.removeEventListener( 'inputsourceschange', this._onInputSourcesChange );
		session.removeEventListener( 'selectstart', this._onSelectStart );
		session.removeEventListener( 'squeezestart', this._onSqueezeStart );
		session.removeEventListener( 'squeezeend', this._onSqueezeEnd );
		this._session = null;

		for ( const controller of this.controllers ) this._disconnect( controller );

		// En sortie de VR, la caméra reprend la pose du mode bureau et la boucle de la fenêtre repart.
		this.engine.xrActive = false;
		this.engine.resetCameraPose();
		this.engine.pauseDesktopLoop( false );

		this._updateButton();
		this.dispatchEvent( { type: 'sessionend' } );

	}

	/**
	 * Manettes ajoutées ou retirées (API WebXR : session.inputSources).
	 * La manette gauche prend l'index 0, la droite l'index 1.
	 * @private
	 */
	_onInputSourcesChange( { added, removed } ) {

		for ( const source of removed ) {

			const controller = this.controllers.find( ( c ) => c.userData.inputSource === source );
			if ( controller ) this._disconnect( controller );

		}

		for ( const source of added ) {

			if ( ! source.targetRaySpace ) continue;
			const preferred = source.handedness === 'left' ? 0 : 1;
			let controller = this.controllers[ preferred ];
			if ( controller.userData.connected ) controller = this.controllers.find( ( c ) => ! c.userData.connected );
			if ( ! controller ) continue;

			const grip = this.grips[ controller.userData.index ];
			controller.userData.connected = true;
			controller.userData.inputSource = source;
			controller.userData.line.visible = source.targetRayMode === 'tracked-pointer';

			// Le modèle 3D officiel de la manette se charge à la réception de 'connected'.
			grip.dispatchEvent( { type: 'connected', data: source } );

		}

	}

	/** @private */
	_disconnect( controller ) {

		if ( ! controller.userData.connected ) return;
		controller.userData.connected = false;
		controller.userData.inputSource = null;
		controller.userData.line.visible = false;
		controller.visible = false;

		const grip = this.grips[ controller.userData.index ];
		grip.visible = false;
		grip.dispatchEvent( { type: 'disconnected' } );

	}

	/**
	 * Place les manettes à chaque image avec frame.getPose() (API WebXR).
	 * @private
	 * @param {XRFrame} frame
	 * @param {XRReferenceSpace} referenceSpace
	 */
	_updateControllers( frame, referenceSpace ) {

		for ( const controller of this.controllers ) {

			const source = controller.userData.inputSource;
			const grip = this.grips[ controller.userData.index ];
			if ( ! source ) continue;

			const rayPose = frame.getPose( source.targetRaySpace, referenceSpace );
			controller.visible = rayPose !== undefined && rayPose !== null;
			if ( controller.visible ) {

				controller.matrix.fromArray( rayPose.transform.matrix );
				controller.updateMatrixWorld( true );

			}

			const gripPose = source.gripSpace ? frame.getPose( source.gripSpace, referenceSpace ) : null;
			grip.visible = gripPose !== undefined && gripPose !== null;
			if ( grip.visible ) {

				grip.matrix.fromArray( gripPose.transform.matrix );
				grip.updateMatrixWorld( true );

			}

		}

	}

	/**
	 * Fait vibrer une manette (retour haptique), si le matériel le permet.
	 * @param {THREE.Group} controller - Une des deux manettes (this.controllers).
	 * @param {number} [intensity=0.5] - Force, de 0 à 1.
	 * @param {number} [duration=40] - Durée en millisecondes.
	 */
	pulse( controller, intensity = 0.5, duration = 40 ) {

		const gamepad = controller && controller.userData.inputSource && controller.userData.inputSource.gamepad;
		if ( ! gamepad ) return;

		const actuator = gamepad.hapticActuators && gamepad.hapticActuators[ 0 ];
		if ( actuator && actuator.pulse ) {

			actuator.pulse( intensity, duration ).catch( () => {} );

		} else if ( gamepad.vibrationActuator && gamepad.vibrationActuator.playEffect ) {

			gamepad.vibrationActuator.playEffect( 'dual-rumble', { duration, strongMagnitude: intensity, weakMagnitude: intensity } ).catch( () => {} );

		}

	}

	/**
	 * Position du joystick d'une manette (mapping « xr-standard » : axes 2 et 3).
	 * @param {THREE.Group} controller
	 * @returns {{ x: number, y: number }} Entre -1 et 1 ; { 0, 0 } sans joystick.
	 */
	getThumbstick( controller ) {

		const gamepad = controller && controller.userData.inputSource && controller.userData.inputSource.gamepad;
		if ( ! gamepad || ! gamepad.axes ) return { x: 0, y: 0 };

		const axes = gamepad.axes;
		const x = axes.length >= 4 ? axes[ 2 ] : ( axes[ 0 ] || 0 );
		const y = axes.length >= 4 ? axes[ 3 ] : ( axes[ 1 ] || 0 );
		return { x, y };

	}

	/** @private */
	_dispatchInput( type, source ) {

		const controller = this.controllers.find( ( c ) => c.userData.inputSource === source );
		if ( controller ) this.dispatchEvent( { type, controller } );

	}

	/** Met à jour le texte et l'état du bouton. @private */
	_updateButton() {

		if ( ! this.button ) return;

		this.button.disabled = ! this.supported;

		if ( ! this.supported ) this.button.textContent = 'VR non disponible';
		else this.button.textContent = this.isPresenting ? 'Quitter la VR' : 'Entrer en VR';

	}

	/**
	 * Crée les deux manettes : un groupe pour le rayon, un groupe pour la main (modèle 3D).
	 * Leur position est écrite à chaque image par _updateControllers().
	 * @private
	 */
	_setupControllers() {

		const player = this.engine.player;

		for ( let i = 0; i < 2; i ++ ) {

			// Manette « target ray » : origine et direction du rayon.
			const controller = new THREE.Group();
			controller.name = `controller-${i}`;
			controller.matrixAutoUpdate = false;
			controller.visible = false;
			controller.userData.index = i;
			controller.userData.connected = false;
			controller.userData.inputSource = null;
			controller.userData.line = this._createRayLine();
			controller.add( controller.userData.line );
			player.add( controller );
			this.controllers.push( controller );

			// Manette « grip » : position de la main, avec le modèle 3D officiel.
			const grip = new THREE.Group();
			grip.name = `grip-${i}`;
			grip.matrixAutoUpdate = false;
			grip.visible = false;
			grip.add( this._modelFactory.createControllerModel( grip ) );
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
