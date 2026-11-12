/**
 * Interaction.js — Pointage et sélection d'objets (raycasting).
 *
 * Un seul code de raycasting, deux stratégies d'entrée (patron Strategy) :
 *   - VR     : un rayon par manette, sélection à la gâchette, saisie au bouton grip ;
 *   - bureau : un rayon depuis le centre de l'écran (réticule), sélection au clic gauche,
 *              saisie en maintenant le clic droit.
 *
 * Saisir (grab) : l'objet visé est accroché à la manette (ou à la caméra en bureau),
 * suit la main, puis est rendu à la scène quand on relâche, à l'endroit où on l'a lâché.
 *
 * @example
 * interaction.addSelectable( mesh, {
 *   onHover: ( { hovered } ) => console.log( hovered ? 'survol' : 'fin du survol' ),
 *   onSelect: ( { object, point } ) => console.log( 'sélection de', object.name, point )
 * } );
 * interaction.addSelectable( molecule, {
 *   grabbable: true,
 *   onRelease: ( { object, position } ) => console.log( 'lâché en', position )
 * } );
 * interaction.removeSelectable( mesh );
 */
import * as THREE from 'three/webgpu';
import { RAY_LENGTH } from '../core/XRManager.js';

/**
 * @typedef {Object} HoverEvent
 * @property {THREE.Object3D} object - L'objet enregistré.
 * @property {boolean} hovered - Vrai au début du survol, faux à la fin.
 */

/**
 * @typedef {Object} SelectEvent
 * @property {THREE.Object3D} object - L'objet enregistré.
 * @property {THREE.Vector3} point - Point touché (coordonnées monde).
 * @property {'vr'|'desktop'} source - Stratégie d'entrée utilisée.
 */

/**
 * @typedef {Object} SelectableOptions
 * @property {(event: HoverEvent) => void} [onHover] - Début / fin du survol.
 * @property {(event: SelectEvent) => void} [onSelect] - Gâchette ou clic sur l'objet.
 * @property {boolean} [highlight=true] - Surbrillance automatique (émissive) au survol.
 * @property {number} [highlightColor=0x444444] - Couleur émissive de surbrillance.
 * @property {boolean} [grabbable=false] - L'objet peut être saisi (grip en VR, clic droit en bureau).
 * @property {(event: { object, source }) => void} [onGrab] - L'objet vient d'être saisi.
 * @property {(event: { object, position: THREE.Vector3, source }) => void} [onRelease] - L'objet est lâché (position monde).
 */

const SCREEN_CENTER = new THREE.Vector2( 0, 0 );

export class Interaction {

	/**
	 * @param {import('../core/Engine.js').Engine} engine
	 * @param {import('../core/XRManager.js').XRManager} xr
	 * @param {import('../core/DesktopControls.js').DesktopControls} desktop
	 */
	constructor( engine, xr, desktop ) {

		this.engine = engine;
		this.xr = xr;
		this.desktop = desktop;

		/** @private @type {Map<THREE.Object3D, SelectableOptions>} */
		this._selectables = new Map();

		/** Dernier objet visé par chaque pointeur (id → résultat). @private */
		this._hits = new Map();

		/** Objets survolés à l'image précédente. @private @type {Set<THREE.Object3D>} */
		this._hovered = new Set();

		/** @private */
		this._raycaster = new THREE.Raycaster();

		/** Objets tenus : id du pointeur → { object, parent, holder }. @private */
		this._held = new Map();

		// Les deux stratégies d'entrée déclenchent la même sélection et la même saisie.
		xr.addEventListener( 'select', ( event ) => this._select( 'vr-' + event.controller.userData.index, 'vr' ) );
		desktop.addEventListener( 'select', () => this._select( 'desktop', 'desktop' ) );

		xr.addEventListener( 'squeezestart', ( event ) => this._grab( 'vr-' + event.controller.userData.index, event.controller, 'vr' ) );
		xr.addEventListener( 'squeezeend', ( event ) => this._release( 'vr-' + event.controller.userData.index, 'vr' ) );
		desktop.addEventListener( 'grabstart', () => this._grab( 'desktop', engine.camera, 'desktop' ) );
		desktop.addEventListener( 'grabend', () => this._release( 'desktop', 'desktop' ) );

		this._unsubscribe = engine.onUpdate( () => this.update() );

	}

	/**
	 * Rend un objet pointable et sélectionnable (lui et tous ses enfants).
	 * @param {THREE.Object3D} object
	 * @param {SelectableOptions} [options]
	 */
	addSelectable( object, options = {} ) {

		this._selectables.set( object, { highlight: true, highlightColor: 0x444444, ...options } );

	}

	/**
	 * Retire un objet de la liste des objets sélectionnables.
	 * @param {THREE.Object3D} object
	 */
	removeSelectable( object ) {

		for ( const [ id, held ] of this._held ) if ( held.object === object ) this._release( id, null, false );
		if ( this._hovered.has( object ) ) this._setHovered( object, false );
		this._hovered.delete( object );
		this._selectables.delete( object );

		for ( const [ id, hit ] of this._hits ) if ( hit.object === object ) this._hits.delete( id );

	}

	/** Retire tous les objets sélectionnables (changement de niveau). */
	clear() {

		for ( const object of [ ...this._selectables.keys() ] ) this.removeSelectable( object );

	}

	/**
	 * Met à jour le survol (appelée automatiquement à chaque image).
	 */
	update() {

		this._hits.clear();
		const hoveredNow = new Set();

		for ( const pointer of this._getPointers() ) {

			const hit = this._raycast( pointer );
			if ( hit ) {

				this._hits.set( pointer.id, hit );
				hoveredNow.add( hit.object );

			}

			// En VR, le rayon visible s'arrête sur l'objet touché.
			if ( pointer.line ) pointer.line.scale.z = hit ? hit.distance : RAY_LENGTH;

		}

		for ( const object of this._hovered ) if ( ! hoveredNow.has( object ) ) this._setHovered( object, false );
		for ( const object of hoveredNow ) if ( ! this._hovered.has( object ) ) this._setHovered( object, true );
		this._hovered = hoveredNow;

	}

	/** Libère le système. */
	dispose() {

		this.clear();
		this._unsubscribe();

	}

	/**
	 * Stratégie d'entrée active → liste de pointeurs { id, ray(raycaster), line }.
	 * @private
	 */
	_getPointers() {

		const pointers = [];

		if ( this.engine.isVR() ) {

			for ( const controller of this.xr.controllers ) {

				const source = controller.userData.inputSource;
				if ( ! controller.userData.connected || ! source || source.targetRayMode !== 'tracked-pointer' ) continue;

				pointers.push( {
					id: 'vr-' + controller.userData.index,
					setRay: ( raycaster ) => {

						controller.updateWorldMatrix( true, false );
						raycaster.setFromXRController( controller );

					},
					line: controller.userData.line
				} );

			}

		} else if ( this.desktop.isLocked ) {

			pointers.push( {
				id: 'desktop',
				setRay: ( raycaster ) => {

					this.engine.camera.updateWorldMatrix( true, false );
					raycaster.setFromCamera( SCREEN_CENTER, this.engine.camera );

				},
				line: null
			} );

		}

		return pointers;

	}

	/**
	 * Lance un rayon et renvoie l'objet enregistré le plus proche.
	 * @private
	 */
	_raycast( pointer ) {

		if ( this._selectables.size === 0 ) return null;

		pointer.setRay( this._raycaster );
		const intersections = this._raycaster.intersectObjects( [ ...this._selectables.keys() ], true );

		for ( const intersection of intersections ) {

			const object = this._findSelectable( intersection.object );
			if ( object && isVisible( object ) ) {

				return { object, point: intersection.point.clone(), distance: intersection.distance };

			}

		}

		return null;

	}

	/**
	 * Remonte la hiérarchie jusqu'à l'objet enregistré.
	 * @private
	 */
	_findSelectable( object ) {

		while ( object ) {

			if ( this._selectables.has( object ) ) return object;
			object = object.parent;

		}

		return null;

	}

	/** @private */
	_select( pointerId, source ) {

		const hit = this._hits.get( pointerId );
		if ( ! hit ) return;

		const options = this._selectables.get( hit.object );
		if ( options && options.onSelect ) options.onSelect( { object: hit.object, point: hit.point, source } );

	}

	/**
	 * Saisit l'objet visé par ce pointeur : il est accroché à la main (manette) ou à la caméra.
	 * `attach` conserve sa position dans le monde au moment de la saisie.
	 * @private
	 */
	_grab( pointerId, holder, source ) {

		if ( this._held.has( pointerId ) ) return;

		const hit = this._hits.get( pointerId );
		if ( ! hit ) return;

		const options = this._selectables.get( hit.object );
		if ( ! options || ! options.grabbable ) return;

		const object = hit.object;
		this._held.set( pointerId, { object, parent: object.parent } );
		holder.attach( object );

		if ( options.onGrab ) options.onGrab( { object, source } );

	}

	/**
	 * Lâche l'objet tenu : il revient dans sa scène d'origine, à l'endroit où on l'a lâché.
	 * @private
	 */
	_release( pointerId, source, notify = true ) {

		const held = this._held.get( pointerId );
		if ( ! held ) return;
		this._held.delete( pointerId );

		const { object, parent } = held;
		if ( parent ) parent.attach( object );

		const options = this._selectables.get( object );
		if ( notify && options && options.onRelease ) {

			options.onRelease( { object, position: object.getWorldPosition( new THREE.Vector3() ), source } );

		}

	}

	/**
	 * Vrai si l'objet est actuellement tenu.
	 * @param {THREE.Object3D} object
	 * @returns {boolean}
	 */
	isHeld( object ) {

		for ( const held of this._held.values() ) if ( held.object === object ) return true;
		return false;

	}

	/** @private */
	_setHovered( object, hovered ) {

		const options = this._selectables.get( object );
		if ( ! options ) return;

		if ( options.highlight ) setHighlight( object, hovered ? options.highlightColor : null );
		if ( options.onHover ) options.onHover( { object, hovered } );

	}

}

/**
 * Applique (ou retire si color === null) une couleur émissive de surbrillance.
 * Remarque : un matériau partagé entre plusieurs objets s'allume pour tous.
 * @param {THREE.Object3D} root
 * @param {?number} color
 */
function setHighlight( root, color ) {

	root.traverse( ( child ) => {

		const material = child.material;
		if ( ! material || ! material.emissive ) return;

		if ( color !== null ) {

			if ( child.userData.baseEmissive === undefined ) child.userData.baseEmissive = material.emissive.getHex();
			material.emissive.setHex( color );

		} else if ( child.userData.baseEmissive !== undefined ) {

			material.emissive.setHex( child.userData.baseEmissive );
			delete child.userData.baseEmissive;

		}

	} );

}

/** Vrai si l'objet et tous ses parents sont visibles. */
function isVisible( object ) {

	while ( object ) {

		if ( ! object.visible ) return false;
		object = object.parent;

	}

	return true;

}
