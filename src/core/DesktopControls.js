/**
 * DesktopControls.js — Mode bureau (souris + clavier), sans casque.
 *
 * - PointerLockControls : la souris oriente le regard (aucun déplacement continu).
 * - Un réticule au centre de l'écran sert de « pointeur » ; clic gauche = sélection.
 * - Échap libère la souris (comportement natif du navigateur).
 * - Désactivé automatiquement pendant une session VR.
 *
 * Événements émis :
 *   - 'lock' / 'unlock' : la souris est capturée / libérée
 *   - 'select' : clic gauche pendant que la souris est capturée
 */
import * as THREE from 'three/webgpu';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class DesktopControls extends THREE.EventDispatcher {

	/**
	 * @param {import('./Engine.js').Engine} engine
	 * @param {HTMLElement} [reticle] - Élément DOM du réticule (affiché quand la souris est capturée).
	 */
	constructor( engine, reticle = null ) {

		super();

		this.engine = engine;
		this.reticle = reticle;

		/** Contrôles « regard à la souris » de Three.js. @type {PointerLockControls} */
		this.controls = new PointerLockControls( engine.camera, document.body );

		/** Faux pendant une session VR. @type {boolean} */
		this.enabled = true;

		this.controls.addEventListener( 'lock', () => {

			this._showReticle( true );
			this.dispatchEvent( { type: 'lock' } );

		} );

		this.controls.addEventListener( 'unlock', () => {

			this._showReticle( false );
			this.dispatchEvent( { type: 'unlock' } );

		} );

		this._onMouseDown = this._onMouseDown.bind( this );
		document.addEventListener( 'mousedown', this._onMouseDown );

	}

	/** Vrai si la souris est capturée (mode bureau actif). @type {boolean} */
	get isLocked() {

		return this.controls.isLocked;

	}

	/**
	 * Capture la souris pour démarrer le mode bureau.
	 * Doit être appelé depuis un geste utilisateur (clic sur un bouton).
	 */
	lock() {

		if ( this.enabled ) this.controls.lock();

	}

	/** Libère la souris. */
	unlock() {

		if ( this.isLocked ) this.controls.unlock();

	}

	/**
	 * Active ou désactive le mode bureau (désactivé pendant la VR).
	 * @param {boolean} enabled
	 */
	setEnabled( enabled ) {

		this.enabled = enabled;
		this.controls.enabled = enabled;
		if ( ! enabled ) this.unlock();

	}

	/** Libère les écouteurs. */
	dispose() {

		document.removeEventListener( 'mousedown', this._onMouseDown );
		this.controls.dispose();

	}

	/** @private */
	_onMouseDown( event ) {

		if ( this.enabled && this.isLocked && event.button === 0 ) {

			this.dispatchEvent( { type: 'select' } );

		}

	}

	/** @private */
	_showReticle( visible ) {

		if ( this.reticle ) this.reticle.hidden = ! visible;

	}

}
