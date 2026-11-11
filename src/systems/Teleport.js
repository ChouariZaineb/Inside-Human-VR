/**
 * Teleport.js — Déplacement par téléportation (seul mode de déplacement, ENF-06).
 *
 * - Affiche des disques au sol aux points prédéfinis ; un disque visé s'anime.
 * - VR : viser avec la manette + gâchette. Bureau : viser au réticule + clic,
 *   ou touches 1 à 9 pour aller directement au point n°1 à 9.
 * - Court fondu au noir pendant le saut pour éviter le mal des transports.
 * - Déplace `engine.player`, jamais la caméra.
 *
 * @example
 * teleport.setPoints( [
 *   { position: new THREE.Vector3( 0, 0, 0 ), rotationY: 0 },
 *   { position: new THREE.Vector3( 0, 0, -8 ), rotationY: Math.PI }
 * ] );
 * teleport.clear();
 */
import * as THREE from 'three/webgpu';

/**
 * @typedef {Object} TeleportPoint
 * @property {THREE.Vector3} position - Position au sol (coordonnées monde).
 * @property {number} [rotationY=0] - Orientation du regard à l'arrivée (radians).
 */

/** Durée de chaque moitié du fondu (s). */
const FADE_TIME = 0.15;

const COLOR_IDLE = new THREE.Color( 0x4fd6ff );
const COLOR_HOVER = new THREE.Color( 0xffffff );

export class Teleport {

	/**
	 * @param {import('../core/Engine.js').Engine} engine
	 * @param {import('./Interaction.js').Interaction} interaction
	 */
	constructor( engine, interaction ) {

		this.engine = engine;
		this.interaction = interaction;

		/** Groupe contenant les disques de téléportation. @type {THREE.Group} */
		this.group = new THREE.Group();
		this.group.name = 'teleport-points';
		engine.scene.add( this.group );

		/** @private @type {{ point: TeleportPoint, disk: THREE.Mesh, hovered: boolean }[]} */
		this._markers = [];

		// Géométries partagées par tous les disques.
		this._diskGeometry = new THREE.CircleGeometry( 0.45, 40 ).rotateX( - Math.PI / 2 );
		this._ringGeometry = new THREE.RingGeometry( 0.5, 0.6, 40 ).rotateX( - Math.PI / 2 );

		// Fondu : une petite sphère noire autour des yeux, dessinée par-dessus tout.
		this._fade = this._createFadeSphere();
		engine.camera.add( this._fade );

		/** @private État du fondu : null ou { target, time, moved }. */
		this._jump = null;

		this._onKeyDown = this._onKeyDown.bind( this );
		window.addEventListener( 'keydown', this._onKeyDown );

		this._unsubscribe = engine.onUpdate( ( delta, elapsed ) => this._update( delta, elapsed ) );

	}

	/**
	 * Remplace les points de téléportation affichés.
	 * @param {TeleportPoint[]} points
	 */
	setPoints( points ) {

		this.clear();

		for ( const point of points ) {

			const disk = new THREE.Mesh(
				this._diskGeometry,
				new THREE.MeshBasicMaterial( { color: COLOR_IDLE, transparent: true, opacity: 0.45, depthWrite: false } )
			);

			const ring = new THREE.Mesh(
				this._ringGeometry,
				new THREE.MeshBasicMaterial( { color: COLOR_IDLE, transparent: true, opacity: 0.9, depthWrite: false } )
			);

			disk.add( ring );
			disk.name = 'teleport-point';
			disk.position.copy( point.position ).y += 0.02; // juste au-dessus du sol
			this.group.add( disk );

			const marker = { point, disk, hovered: false };
			this._markers.push( marker );

			this.interaction.addSelectable( disk, {
				highlight: false,
				onHover: ( { hovered } ) => { marker.hovered = hovered; },
				onSelect: () => this.teleportTo( point )
			} );

		}

	}

	/** Retire tous les points de téléportation. */
	clear() {

		for ( const { disk } of this._markers ) {

			this.interaction.removeSelectable( disk );
			this.group.remove( disk );
			disk.material.dispose();
			disk.children[ 0 ].material.dispose();

		}

		this._markers = [];

	}

	/**
	 * Téléporte l'utilisateur vers un point.
	 * @param {TeleportPoint} point
	 * @param {{ instant?: boolean }} [options] - `instant: true` : sans fondu (placement initial).
	 */
	teleportTo( point, { instant = false } = {} ) {

		if ( instant ) {

			this._move( point );
			return;

		}

		if ( this._jump ) return; // un saut est déjà en cours
		this._jump = { target: point, time: 0, moved: false };

	}

	/** Libère le système. */
	dispose() {

		this.clear();
		window.removeEventListener( 'keydown', this._onKeyDown );
		this.engine.camera.remove( this._fade );
		this.engine.scene.remove( this.group );
		this._unsubscribe();

	}

	/**
	 * Place le joueur : la tête (et non l'origine du groupe) arrive sur le point.
	 * @private
	 * @param {TeleportPoint} point
	 */
	_move( point ) {

		const { player, camera } = this.engine;

		player.rotation.set( 0, point.rotationY || 0, 0 );
		player.position.copy( point.position );

		// En bureau, on remet le regard droit devant pour respecter rotationY.
		if ( ! this.engine.isVR() ) this.engine.resetCameraPose();

		// En VR, la tête peut être décalée de l'origine du groupe : on compense en XZ.
		player.updateMatrixWorld( true );
		const head = camera.getWorldPosition( new THREE.Vector3() );
		player.position.x += point.position.x - head.x;
		player.position.z += point.position.z - head.z;

	}

	/** Animation des disques et du fondu. @private */
	_update( delta, elapsed ) {

		for ( const { disk, hovered } of this._markers ) {

			const pulse = hovered ? 1.15 + Math.sin( elapsed * 8 ) * 0.08 : 1;
			disk.scale.setScalar( pulse );
			disk.material.color.copy( hovered ? COLOR_HOVER : COLOR_IDLE );
			disk.children[ 0 ].material.color.copy( disk.material.color );
			disk.children[ 0 ].rotation.y = elapsed * ( hovered ? 2 : 0.5 );

		}

		if ( ! this._jump ) return;

		// Fondu : noir en FADE_TIME, saut, puis retour en FADE_TIME.
		const jump = this._jump;
		jump.time += delta;

		if ( ! jump.moved && jump.time >= FADE_TIME ) {

			this._move( jump.target );
			jump.moved = true;

		}

		const t = jump.time / FADE_TIME;
		this._fade.material.opacity = t < 1 ? t : Math.max( 0, 2 - t );
		this._fade.visible = this._fade.material.opacity > 0;

		if ( jump.time >= FADE_TIME * 2 ) {

			this._fade.visible = false;
			this._jump = null;

		}

	}

	/** Touches 1 à 9 en mode bureau. @private */
	_onKeyDown( event ) {

		if ( this.engine.isVR() ) return;

		const index = Number.parseInt( event.key, 10 ) - 1;
		if ( index >= 0 && index < this._markers.length ) this.teleportTo( this._markers[ index ].point );

	}

	/** @private */
	_createFadeSphere() {

		const sphere = new THREE.Mesh(
			new THREE.SphereGeometry( 0.2, 16, 8 ),
			new THREE.MeshBasicMaterial( {
				color: 0x000000, transparent: true, opacity: 0,
				side: THREE.BackSide, depthTest: false, depthWrite: false
			} )
		);

		sphere.name = 'teleport-fade';
		sphere.renderOrder = 9999;
		sphere.visible = false;
		sphere.frustumCulled = false;
		return sphere;

	}

}
