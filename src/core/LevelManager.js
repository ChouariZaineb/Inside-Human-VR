/**
 * LevelManager.js — Chargement des scènes et des niveaux, et passage de l'un à l'autre.
 *
 * Un seul niveau est en mémoire à la fois (exigence de performance) :
 *   1. on libère le niveau courant (dispose), ses objets pointables et ses points de téléportation ;
 *   2. on crée le nouveau niveau, on attend son chargement (load) ;
 *   3. on relie ses objets pointables à Interaction et ses points à Teleport ;
 *   4. on le démarre (start) et on l'abonne à la boucle de rendu (update).
 *
 * Il fait aussi le lien entre le moteur (Zaineb) et les niveaux (Melek) :
 *   - Interaction appelle onSelect → LevelManager émet EVENTS.OBJECT_SELECTED sur l'EventBus,
 *     ce qu'attend BaseLevel (contrat décrit en haut de BaseLevel.js) ;
 *   - quand un niveau est terminé (EVENTS.LEVEL_COMPLETED), on passe au niveau débloqué
 *     suivant, ou on revient à la scène de départ.
 *
 * Saisie : si un objet pointable a `userData.grab = { onGrab, onRelease }`, il peut être saisi
 * (bouton grip en VR, clic droit maintenu en bureau) ; `onRelease({ position })` reçoit l'endroit du lâcher.
 *
 * Un « niveau » est tout objet qui possède tout ou partie de ces méthodes :
 *   load(), start(), update(delta, elapsed), dispose(),
 *   getInteractables() → Object3D[], getTeleportPoints() → [{ position, rotationY }].
 *
 * @example
 * const levels = new LevelManager( { engine, interaction, teleport } );
 * levels.register( 'heart', ( ctx ) => new HeartLevel( { scene: ctx.engine.scene, camera: ctx.engine.camera } ) );
 * await levels.load( 'heart' );
 */
import * as THREE from 'three/webgpu';
import { eventBus as defaultBus, EVENTS } from '../systems/EventBus.js';
import { gameState as defaultGameState } from '../data/GameState.js';

/** Point d'arrivée par défaut si le niveau n'en déclare pas. */
const DEFAULT_POINTS = [ { position: new THREE.Vector3( 0, 0, 0 ), rotationY: 0 } ];

export class LevelManager {

	/**
	 * @param {Object} options
	 * @param {import('./Engine.js').Engine} options.engine
	 * @param {import('../systems/Interaction.js').Interaction} options.interaction
	 * @param {import('../systems/Teleport.js').Teleport} options.teleport
	 * @param {import('../systems/EventBus.js').EventBus} [options.eventBus]
	 * @param {import('../data/GameState.js').GameState} [options.gameState]
	 * @param {string} [options.homeId='home'] - Scène affichée quand aucun niveau n'est en cours.
	 */
	constructor( { engine, interaction, teleport, eventBus = defaultBus, gameState = defaultGameState, homeId = 'home' } ) {

		this.engine = engine;
		this.interaction = interaction;
		this.teleport = teleport;
		this.eventBus = eventBus;
		this.gameState = gameState;
		this.homeId = homeId;

		/** Fabriques de niveaux : id → (contexte) => niveau. @private @type {Map<string, Function>} */
		this._factories = new Map();

		/** Niveau en cours. @type {?Object} */
		this.current = null;

		/** Identifiant du niveau en cours. @type {?string} */
		this.currentId = null;

		/** Objets actuellement reliés à Interaction. @private @type {Set<THREE.Object3D>} */
		this._linked = new Set();

		/** @private Chargement en cours (évite deux chargements simultanés). */
		this._loading = null;

		// Fin d'un niveau : niveau suivant débloqué, sinon retour à la scène de départ.
		this._offCompleted = eventBus.on( EVENTS.LEVEL_COMPLETED, ( { levelId } ) => this._onLevelCompleted( levelId ) );

		// Boucle : mise à jour du niveau et des objets pointables (un niveau peut en ajouter en cours de route).
		this._offUpdate = engine.onUpdate( ( delta, elapsed ) => {

			if ( ! this.current ) return;
			this._syncInteractables();
			if ( this.current.update ) this.current.update( delta, elapsed );

		} );

	}

	/**
	 * Déclare un niveau.
	 * @param {string} id - Identifiant (le même que dans levels.json, ex. « lungs »).
	 * @param {(context: { engine, interaction, teleport, eventBus, gameState, levels: LevelManager }) => Object} factory
	 */
	register( id, factory ) {

		this._factories.set( id, factory );

	}

	/**
	 * Vrai si un niveau porte cet identifiant.
	 * @param {string} id
	 * @returns {boolean}
	 */
	has( id ) {

		return this._factories.has( id );

	}

	/**
	 * Remplace le niveau courant par le niveau demandé.
	 * @param {string} id
	 * @returns {Promise<Object>} Le niveau chargé.
	 */
	async load( id ) {

		if ( ! this._factories.has( id ) ) throw new Error( `LevelManager : niveau inconnu « ${id} »` );
		// Impossible de contourner la progression via une URL ou un appel JavaScript.
		if ( id !== this.homeId && ! this.gameState.isUnlocked( id ) ) {
			throw new Error( `LevelManager : niveau « ${id} » encore verrouillé` );
		}
		if ( this._loading ) await this._loading;

		this._loading = this._doLoad( id );

		try {

			return await this._loading;

		} finally {

			this._loading = null;

		}

	}

	/** Revient à la scène de départ. */
	goHome() {

		return this.load( this.homeId );

	}

	/** Libère le niveau courant et le gestionnaire. */
	dispose() {

		this._unloadCurrent();
		this._offCompleted();
		this._offUpdate();

	}

	/** @private */
	async _doLoad( id ) {

		this._unloadCurrent();

		const level = this._factories.get( id )( {
			engine: this.engine,
			interaction: this.interaction,
			teleport: this.teleport,
			eventBus: this.eventBus,
			gameState: this.gameState,
			levels: this
		} );

		if ( level.load ) await level.load();

		// Points de téléportation du niveau : on arrive sur le premier, sans fondu.
		const points = level.getTeleportPoints ? level.getTeleportPoints() : DEFAULT_POINTS;
		this.teleport.setPoints( points );
		this.teleport.teleportTo( points[ 0 ], { instant: true } );

		this.current = level;
		this.currentId = id;
		this._syncInteractables();

		if ( level.start ) level.start();

		console.info( `[LevelManager] Niveau chargé : ${id}` );
		return level;

	}

	/** @private */
	_unloadCurrent() {

		if ( ! this.current ) return;

		for ( const object of this._linked ) this.interaction.removeSelectable( object );
		this._linked.clear();
		this.teleport.clear();

		if ( this.current.dispose ) this.current.dispose();

		this.current = null;
		this.currentId = null;

	}

	/**
	 * Relie à Interaction les objets pointables du niveau (ajoutés ou retirés depuis l'image précédente).
	 * La sélection est transmise au niveau par l'EventBus (EVENTS.OBJECT_SELECTED).
	 * @private
	 */
	_syncInteractables() {

		if ( ! this.current.getInteractables ) return;

		const wanted = new Set( this.current.getInteractables() );

		for ( const object of this._linked ) {

			if ( ! wanted.has( object ) ) {

				this.interaction.removeSelectable( object );
				this._linked.delete( object );

			}

		}

		for ( const object of wanted ) {

			if ( this._linked.has( object ) ) continue;

			// Un niveau rend un objet saisissable en remplissant object.userData.grab = { onGrab, onRelease }.
			const grab = object.userData.grab;

			this.interaction.addSelectable( object, {
				// Les panneaux n'ont pas de couleur émissive : la surbrillance ne s'applique qu'aux objets 3D.
				highlight: ! object.userData.panel,
				onSelect: ( { object: selected } ) => this.eventBus.emit( EVENTS.OBJECT_SELECTED, { object: selected } ),
				grabbable: Boolean( grab ),
				onGrab: grab && grab.onGrab,
				onRelease: grab && grab.onRelease
			} );
			this._linked.add( object );

		}

	}

	/** @private */
	_onLevelCompleted( levelId ) {

		const next = this.gameState.results[ levelId ] ? this._nextLevel( levelId ) : null;
		const target = next && this.has( next ) && this.gameState.isUnlocked( next ) ? next : this.homeId;

		// Laisse le niveau terminer son image avant de le remplacer.
		setTimeout( () => this.load( target ), 0 );

	}

	/** Identifiant du niveau débloqué par `levelId` (champ « unlocks » de levels.json). @private */
	_nextLevel( levelId ) {

		const content = this.current && this.current.content;
		return content && content.id === levelId ? content.unlocks : null;

	}

}