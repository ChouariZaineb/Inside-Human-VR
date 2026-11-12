/**
 * Manipulation.js — Joysticks et manipulation des objets tenus.
 *
 * @author Chouari Zaineb
 * @date   2026-11-12
 * @role   Moteur et VR : interactions avancées (rotation sur soi, rotation et distance des objets tenus).
 *
 * En VR (joystick de chaque manette, API Gamepad de l'inputSource) :
 *   - sans objet en main : joystick gauche/droite → rotation sur soi de 30° (« snap turn »),
 *     confortable car sans rotation continue (pas de mal des transports) ;
 *   - avec un objet en main : joystick gauche/droite → l'objet tourne sur lui-même,
 *     joystick haut/bas → l'objet s'éloigne ou se rapproche.
 *
 * En mode bureau (souris capturée) :
 *   - molette → l'objet tenu s'éloigne ou se rapproche ;
 *   - touches Q et E → l'objet tenu tourne sur lui-même.
 */
import * as THREE from 'three/webgpu';

/** Angle d'un palier de rotation sur soi (radians). */
const SNAP_ANGLE = THREE.MathUtils.degToRad( 30 );

/** Le joystick doit dépasser ce seuil pour déclencher un palier, et revenir sous le second pour le suivant. */
const SNAP_ON = 0.7;
const SNAP_OFF = 0.3;

/** Zone morte du joystick (petits mouvements ignorés). */
const DEAD_ZONE = 0.15;

/** Vitesse de rotation d'un objet tenu (radians par seconde, joystick à fond). */
const ROTATE_SPEED = 2.5;

/** Vitesse de rapprochement / éloignement (mètres par seconde, joystick à fond). */
const PUSH_SPEED = 1.2;

/** Distance minimale et maximale d'un objet tenu devant la main (mètres). */
const MIN_DISTANCE = 0.15;
const MAX_DISTANCE = 3;

export class Manipulation {

	/**
	 * @param {import('../core/Engine.js').Engine} engine
	 * @param {import('../core/XRManager.js').XRManager} xr
	 * @param {import('../core/DesktopControls.js').DesktopControls} desktop
	 * @param {import('./Interaction.js').Interaction} interaction
	 */
	constructor( engine, xr, desktop, interaction ) {

		this.engine = engine;
		this.xr = xr;
		this.desktop = desktop;
		this.interaction = interaction;

		/** Palier de rotation déjà déclenché, par manette (évite d'enchaîner les paliers). @private */
		this._snapLatched = [ false, false ];

		/** Touches de rotation enfoncées en mode bureau. @private */
		this._keys = { q: false, e: false };

		this._onWheel = this._onWheel.bind( this );
		this._onKey = this._onKey.bind( this );
		window.addEventListener( 'wheel', this._onWheel, { passive: true } );
		window.addEventListener( 'keydown', this._onKey );
		window.addEventListener( 'keyup', this._onKey );

		this._unsubscribe = engine.onUpdate( ( delta ) => this.update( delta ) );

	}

	/**
	 * Appelée à chaque image.
	 * @param {number} delta - Temps écoulé depuis l'image précédente (s).
	 */
	update( delta ) {

		if ( this.engine.isVR() ) this._updateVR( delta );
		else this._updateDesktop( delta );

	}

	/** @private */
	_updateVR( delta ) {

		this.xr.controllers.forEach( ( controller, i ) => {

			if ( ! controller.userData.connected ) return;

			const { x, y } = this.xr.getThumbstick( controller );
			const held = this.interaction.getHeld( 'vr-' + i );

			if ( held ) {

				// Objet en main : le joystick le tourne et règle sa distance.
				if ( Math.abs( x ) > DEAD_ZONE ) held.rotateY( - x * ROTATE_SPEED * delta );
				if ( Math.abs( y ) > DEAD_ZONE ) this._push( held, y * PUSH_SPEED * delta );
				return;

			}

			// Mains libres : rotation sur soi par paliers de 30°.
			if ( ! this._snapLatched[ i ] && Math.abs( x ) > SNAP_ON ) {

				this._snapLatched[ i ] = true;
				this.snapTurn( x > 0 ? - SNAP_ANGLE : SNAP_ANGLE );
				this.xr.pulse( controller, 0.3, 30 );

			} else if ( this._snapLatched[ i ] && Math.abs( x ) < SNAP_OFF ) {

				this._snapLatched[ i ] = false;

			}

		} );

	}

	/** @private */
	_updateDesktop( delta ) {

		const held = this.interaction.getHeld( 'desktop' );
		if ( ! held ) return;

		const direction = ( this._keys.q ? 1 : 0 ) - ( this._keys.e ? 1 : 0 );
		if ( direction !== 0 ) held.rotateY( direction * ROTATE_SPEED * delta );

	}

	/**
	 * Fait tourner l'utilisateur sur lui-même autour de sa tête (et non autour de l'origine de player).
	 * @param {number} angle - Angle en radians (positif = vers la gauche).
	 */
	snapTurn( angle ) {

		const player = this.engine.player;
		const head = this.engine.camera.getWorldPosition( new THREE.Vector3() );

		// Rotation de player autour de l'axe vertical qui passe par la tête :
		// on ramène la tête à l'origine, on tourne, on la remet en place.
		player.position.sub( head ).applyAxisAngle( THREE.Object3D.DEFAULT_UP, angle ).add( head );
		player.rotation.y += angle;
		player.updateMatrixWorld( true );

	}

	/**
	 * Éloigne (amount > 0) ou rapproche (amount < 0) un objet tenu, le long de l'axe qui le relie à la main.
	 * @private
	 */
	_push( object, amount ) {

		const position = object.position; // coordonnées dans le repère de la main (ou de la caméra)
		const distance = THREE.MathUtils.clamp( position.length() - amount, MIN_DISTANCE, MAX_DISTANCE );
		if ( position.lengthSq() < 1e-6 ) position.set( 0, 0, - distance );
		else position.setLength( distance );

	}

	/** @private */
	_onWheel( event ) {

		if ( this.engine.isVR() || ! this.desktop.isLocked ) return;
		const held = this.interaction.getHeld( 'desktop' );
		if ( held ) this._push( held, - event.deltaY * 0.001 );

	}

	/** @private */
	_onKey( event ) {

		const key = event.key.toLowerCase();
		if ( key in this._keys ) this._keys[ key ] = event.type === 'keydown';

	}

	/** Libère le système. */
	dispose() {

		window.removeEventListener( 'wheel', this._onWheel );
		window.removeEventListener( 'keydown', this._onKey );
		window.removeEventListener( 'keyup', this._onKey );
		this._unsubscribe();

	}

}
