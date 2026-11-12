/**
 * LungsLevel.js — Niveau 2 : les poumons (les échanges gazeux).
 *
 * Décor : une bronche qui amène l'air, une alvéole pulmonaire (poche d'air) et un capillaire
 * sanguin qui l'entoure. Le sang du capillaire passe du bleu (pauvre en oxygène) au rouge
 * (riche en oxygène) au fur et à mesure de la mission.
 *
 * Mission (type « transfer » dans levels.json) : déplacer chaque molécule au bon endroit.
 *   - O₂ (dioxygène) : de l'alvéole vers le capillaire (le sang) ;
 *   - CO₂ (dioxyde de carbone) : du capillaire vers l'alvéole (l'air).
 * Deux façons de jouer, en VR comme en mode bureau :
 *   - saisir la molécule (bouton grip en VR, clic droit maintenu en bureau), la porter et
 *     la LÂCHER dans l'alvéole ou dans le capillaire ;
 *   - ou en deux sélections : pointer la molécule (gâchette / clic), puis pointer sa destination.
 *
 * Déroulé (GameState de Melek) : ARRIVAL → EXPLORATION → MISSION → RESULT → DONE.
 * Les textes viennent de levels.json (niveau « lungs ») : ici il n'y a que la logique et le décor.
 */
import * as THREE from 'three/webgpu';
import { BaseLevel } from './BaseLevel.js';
import { PHASE } from '../data/GameState.js';

/** Nombre de molécules de chaque sorte à déplacer. */
const MOLECULES_PER_KIND = 3;

/** Centre de l'alvéole (m). */
const ALVEOLUS = new THREE.Vector3( - 0.4, 1.5, - 3.4 );
const ALVEOLUS_RADIUS = 0.9;

/** Centre de l'arc du capillaire autour de l'alvéole. */
const CAPILLARY_RADIUS = 1.35;

const PANEL_POS = { x: - 2.1, y: 1.7, z: - 2.4 };
const BUTTON_POS = { x: - 2.1, y: 0.85, z: - 2.4 };

const BLUE_BLOOD = new THREE.Color( 0x2f5fd0 );
const RED_BLOOD = new THREE.Color( 0xd02a2a );
const FLASH = { success: 0x2e7d32, error: 0xc62828, info: 0x1565c0, held: 0xffd54f };

/** Durée du déplacement d'une molécule vers sa destination (s). */
const MOVE_TIME = 0.8;

export class LungsLevel extends BaseLevel {

	constructor( options ) {

		super( { ...options, id: 'lungs' } );

		/** Éléments du décor : id (bronchus, alveolus, capillary) → objet 3D. @type {Map<string, THREE.Object3D>} */
		this.elements = new Map();

		/** Molécules : { group, kind, done, from, to, home, target, t }. */
		this.molecules = [];

		/** Molécule prise par le joueur (en attente d'une destination). */
		this.held = null;

		this.mainPanel = null;
		this.button = null;
		this._flash = new Map();

	}

	// ---------- Construction ----------

	async onLoad() {

		this._buildBronchus();
		this._buildAlveolus();
		this._buildCapillary();
		this._buildMolecules();

		this.mainPanel = this.addPanel( { width: 1.6, height: 1.0 }, PANEL_POS );
		this.button = this.addPanel( { width: 1.0, height: 0.3, variant: 'button' }, BUTTON_POS );
		this.addInteractable( this.button.mesh );

	}

	/** Points de téléportation du niveau (utilisés par LevelManager). */
	getTeleportPoints() {

		return [
			{ position: new THREE.Vector3( 0, 0, 0 ), rotationY: 0 },          // vue d'ensemble
			{ position: new THREE.Vector3( 0.3, 0, - 1.4 ), rotationY: 0 }     // près de l'alvéole
		];

	}

	_buildBronchus() {

		const bronchus = new THREE.Mesh(
			new THREE.CylinderGeometry( 0.28, 0.34, 2.2, 32, 1, true ),
			new THREE.MeshStandardMaterial( { color: 0xe8b4b8, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x000000 } )
		);
		bronchus.position.set( ALVEOLUS.x, ALVEOLUS.y + ALVEOLUS_RADIUS + 1.0, ALVEOLUS.z );
		bronchus.name = 'bronche';
		this.group.add( bronchus );
		this._registerElement( 'bronchus', bronchus );

	}

	_buildAlveolus() {

		const alveolus = new THREE.Mesh(
			new THREE.SphereGeometry( ALVEOLUS_RADIUS, 48, 32 ),
			new THREE.MeshStandardMaterial( {
				color: 0xf4a6b6, roughness: 0.4, transparent: true, opacity: 0.55,
				side: THREE.DoubleSide, depthWrite: false, emissive: 0x000000
			} )
		);
		alveolus.position.copy( ALVEOLUS );
		alveolus.name = 'alvéole';
		this.group.add( alveolus );
		this._registerElement( 'alveolus', alveolus );

	}

	_buildCapillary() {

		// Demi-anneau autour de l'alvéole, côté droit.
		const capillary = new THREE.Mesh(
			new THREE.TorusGeometry( CAPILLARY_RADIUS, 0.2, 20, 64, Math.PI ),
			new THREE.MeshStandardMaterial( { color: BLUE_BLOOD.clone(), roughness: 0.5, emissive: 0x000000 } )
		);
		capillary.position.copy( ALVEOLUS );
		capillary.rotation.z = - Math.PI / 2; // l'arc passe à droite de l'alvéole, de bas en haut
		capillary.name = 'capillaire';
		this.group.add( capillary );
		this._registerElement( 'capillary', capillary );

	}

	_buildMolecules() {

		const kinds = this.content.mission.molecules; // [ { id: 'o2', depuis, vers, ... }, { id: 'co2', ... } ]

		for ( const kind of kinds ) {

			for ( let i = 0; i < MOLECULES_PER_KIND; i ++ ) {

				const group = kind.id === 'co2' ? createCO2() : createO2();
				const home = this._slot( kind.depuis, i );
				group.position.copy( home );
				group.userData.moleculeId = kind.id;
				this.group.add( group );
				this.addInteractable( group );

				const molecule = { group, kind, done: false, home, from: null, target: null, t: 0, onArrive: null, grabbed: false };
				this.molecules.push( molecule );

				// Saisie : LevelManager transmet ces fonctions à Interaction.
				group.userData.grab = {
					onGrab: () => this._onMoleculeGrabbed( molecule ),
					onRelease: ( { position } ) => this._onMoleculeDropped( molecule, position )
				};

			}

		}

	}

	/**
	 * Position de la i-ème place devant une zone (l'alvéole ou le capillaire),
	 * devant la paroi pour rester facile à pointer.
	 * @param {'alveolus'|'capillary'} zone
	 * @param {number} i
	 * @param {boolean} [arrival=false] - Places d'arrivée, un peu décalées des places de départ.
	 */
	_slot( zone, i, arrival = false ) {

		const y = ALVEOLUS.y - 0.45 + i * 0.45;

		if ( zone === 'alveolus' ) {

			return new THREE.Vector3( ALVEOLUS.x + ( arrival ? 0.35 : - 0.35 ), y, ALVEOLUS.z + ALVEOLUS_RADIUS + 0.25 );

		}

		return new THREE.Vector3( ALVEOLUS.x + CAPILLARY_RADIUS + ( arrival ? - 0.05 : 0.35 ), y, ALVEOLUS.z + 0.6 );

	}

	_registerElement( id, object ) {

		object.userData.elementId = id;
		this.elements.set( id, object );
		this._flash.set( object, 0 );
		this.addInteractable( object );

	}

	// ---------- Déroulé ----------

	onStart() {

		this.mainPanel.setContent( { title: this.content.intro.titre, body: this.content.intro.texte, variant: 'info' } );
		this._setButton( 'startExploration', 'Explorer' );

	}

	beginExploration() {

		if ( this.gameState.phase !== PHASE.ARRIVAL ) return;
		this.gameState.setPhase( PHASE.EXPLORATION );
		this.mainPanel.setContent( { title: this.content.exploration.titre, body: this.content.exploration.texte, variant: 'info' } );
		this._setButton( 'startMission', 'Lancer la mission' );

	}

	beginMission() {

		if ( this.gameState.phase !== PHASE.EXPLORATION ) return;
		this.gameState.setPhase( PHASE.MISSION );
		this._setButton( null );
		this._showProgress( this.content.mission.titre, `${this.content.mission.consigne}\nSaisis une molécule (grip ou clic droit) et lâche-la au bon endroit.`, 'info' );

	}

	/**
	 * Appelé par BaseLevel quand un objet est sélectionné (EVENTS.OBJECT_SELECTED).
	 * @param {THREE.Object3D} object
	 */
	onSelect( object ) {

		if ( object === this.button.mesh ) return this._onButton( this.button.mesh.userData.action );

		const molecule = this.molecules.find( ( m ) => m.group === object );
		if ( molecule ) return this._onMolecule( molecule );

		const id = object.userData.elementId;
		if ( id ) this._onElement( id );

	}

	_onButton( action ) {

		if ( action === 'startExploration' ) this.beginExploration();
		else if ( action === 'startMission' ) this.beginMission();
		else if ( action === 'complete' ) this.gameState.completeLevel();

	}

	_onMolecule( molecule ) {

		if ( this.gameState.phase !== PHASE.MISSION ) {

			// Hors mission : simple information sur la molécule.
			const k = molecule.kind;
			this.mainPanel.setContent( { title: `${k.symbole} : ${k.nom}`, body: k.explication, variant: 'info' } );
			return;

		}

		if ( molecule.done || molecule.arriving ) return;

		this.held = molecule;
		this._flashObject( molecule.group, 'held' );
		this.mainPanel.setContent( {
			title: `${molecule.kind.symbole} sélectionné`,
			body: 'Pointe maintenant sa destination : l\'alvéole (l\'air) ou le capillaire (le sang).',
			footer: this._footer(),
			variant: 'info'
		} );

	}

	_onElement( id ) {

		// Une molécule est prise : l'élément visé est sa destination.
		if ( this.held && ( id === 'alveolus' || id === 'capillary' ) ) return this._tryTransfer( this.held, id );

		const element = this.content.elements.find( ( e ) => e.id === id );
		if ( ! element ) return;
		this._flashObject( this.elements.get( id ), 'info' );

		if ( this.gameState.phase === PHASE.MISSION ) {

			this._showProgress( element.nom, `${element.fonction}\nCommence par pointer une molécule.`, 'info' );

		} else {

			this.mainPanel.setContent( { title: element.nom, body: element.fonction, variant: 'info' } );

		}

	}

	_tryTransfer( molecule, destination ) {

		this.held = null;

		if ( destination === molecule.kind.depuis ) {

			// Même endroit : la molécule est relâchée, ce n'est pas une erreur.
			this._returnHome( molecule );
			this._showProgress( 'Molécule relâchée', 'Choisis une destination différente de son point de départ.', 'info' );
			return;

		}

		if ( destination !== molecule.kind.vers ) {

			this._returnHome( molecule );
			this.gameState.recordError( molecule.kind.id );
			this._flashObject( this.elements.get( destination ), 'error' );
			this._showProgress( 'Oups !', this.content.mission.erreurGenerique, 'error' );
			return;

		}

		// Bonne destination : la molécule traverse la paroi.
		const index = this.molecules.filter( ( m ) => m !== molecule && m.kind.id === molecule.kind.id && ( m.done || m.arriving ) ).length;
		molecule.arriving = true;
		this._moveTo( molecule, this._slot( destination, index, true ), () => {

			molecule.home = molecule.group.position.clone();
			this._onArrived( molecule );

		} );
		this.gameState.recordCorrect();
		this._flashObject( this.elements.get( destination ), 'success' );
		this._showProgress( 'Bien joué !', molecule.kind.explication, 'success' );

	}

	// ---------- Saisie (grip en VR, clic droit en bureau) ----------

	_onMoleculeGrabbed( molecule ) {

		molecule.grabbed = true;
		if ( this.gameState.phase === PHASE.MISSION && ! molecule.done ) {

			this.held = molecule;
			this._flashObject( molecule.group, 'held' );
			this._showProgress( `${molecule.kind.symbole} en main`, 'Porte-la et lâche-la dans l\'alvéole (l\'air) ou dans le capillaire (le sang).', 'info' );

		}

	}

	/**
	 * La molécule est lâchée : on regarde dans quelle zone elle se trouve.
	 * @param {Object} molecule
	 * @param {THREE.Vector3} worldPosition - Endroit du lâcher (coordonnées monde).
	 */
	_onMoleculeDropped( molecule, worldPosition ) {

		molecule.grabbed = false;
		if ( this.held === molecule ) this.held = null;

		// Elle était déjà en route vers sa destination : elle reprend son trajet depuis ici.
		if ( molecule.target ) {

			this._moveTo( molecule, molecule.target, molecule.onArrive );
			return;

		}

		if ( this.gameState.phase !== PHASE.MISSION || molecule.done ) return this._returnHome( molecule );

		const zone = this._zoneAt( this.group.worldToLocal( worldPosition.clone() ) );
		if ( ! zone ) {

			this._returnHome( molecule );
			this._showProgress( 'Pas ici !', 'Lâche la molécule dans l\'alvéole (la sphère rose) ou dans le capillaire (l\'anneau).', 'info' );
			return;

		}

		this._tryTransfer( molecule, zone );

	}

	/**
	 * Zone où se trouve un point : l'alvéole, le capillaire, ou aucune.
	 * @param {THREE.Vector3} point - Coordonnées locales du niveau.
	 * @returns {?('alveolus'|'capillary')}
	 */
	_zoneAt( point ) {

		const distance = point.distanceTo( ALVEOLUS );
		if ( distance < ALVEOLUS_RADIUS + 0.35 ) return 'alveolus';
		if ( point.x > ALVEOLUS.x + 0.3 && Math.abs( distance - CAPILLARY_RADIUS ) < 0.55 ) return 'capillary';
		return null;

	}

	/** Déplacement animé d'une molécule vers une position, puis appel de onArrive. */
	_moveTo( molecule, target, onArrive = null ) {

		molecule.from = molecule.group.position.clone();
		molecule.target = target.clone();
		molecule.onArrive = onArrive;
		molecule.t = 0;

	}

	/** La molécule retourne à sa place de départ (sauf si elle y est déjà). */
	_returnHome( molecule ) {

		if ( molecule.group.position.distanceTo( molecule.home ) < 0.01 ) return;
		this._moveTo( molecule, molecule.home );

	}

	/** Appelé quand une molécule a atteint sa destination. */
	_onArrived( molecule ) {

		molecule.done = true;
		molecule.arriving = false;

		// La molécule arrivée n'est plus pointable.
		const index = this._interactables.indexOf( molecule.group );
		if ( index !== - 1 ) this._interactables.splice( index, 1 );

		if ( this.molecules.every( ( m ) => m.done ) && this.gameState.phase === PHASE.MISSION ) this._finishMission();

	}

	_finishMission() {

		const result = this.gameState.finishLevel( { nextLevelId: this.content.unlocks } );
		this.mainPanel.setContent( {
			title: this.content.reussite.titre,
			body: this.content.reussite.texte,
			footer: `Score : ${result.score}/100  ·  Erreurs : ${result.errors}  ·  Temps : ${result.timeSeconds} s`,
			variant: 'success'
		} );
		this._setButton( 'complete', 'Continuer' );

	}

	// ---------- Affichage ----------

	_footer() {

		const done = this.molecules.filter( ( m ) => m.done || m.arriving ).length;
		return `Molécules déplacées : ${done} sur ${this.molecules.length}`;

	}

	_showProgress( title, body, variant ) {

		this.mainPanel.setContent( { title, body, footer: this._footer(), variant } );

	}

	_setButton( action, label = '' ) {

		this.button.mesh.userData.action = action;
		this.button.mesh.visible = action !== null;
		if ( action ) this.button.setContent( { title: label, variant: 'button' } );

	}

	/** Allume brièvement un objet (couleur émissive qui s'estompe). */
	_flashObject( object, kind ) {

		object.traverse( ( child ) => {

			if ( ! child.material || ! child.material.emissive ) return;
			child.material.emissive.setHex( FLASH[ kind ] );
			child.material.emissiveIntensity = 1;

		} );
		this._flash.set( object, 1 );

	}

	onUpdate( delta, elapsed ) {

		// L'alvéole « respire » doucement.
		const breath = 1 + 0.04 * Math.sin( elapsed * 1.6 );
		this.elements.get( 'alveolus' ).scale.setScalar( breath );

		// Couleur du sang : du bleu au rouge selon l'oxygène déjà passé dans le capillaire.
		const o2 = this.molecules.filter( ( m ) => m.kind.id === 'o2' );
		const oxygen = o2.filter( ( m ) => m.done ).length / Math.max( 1, o2.length );
		this.elements.get( 'capillary' ).material.color.copy( BLUE_BLOOD ).lerp( RED_BLOOD, oxygen );

		// Molécules : flottement, déplacement vers la destination.
		this.molecules.forEach( ( m, i ) => {

			if ( m.grabbed ) return; // tenue en main : c'est la manette qui la déplace

			if ( m.target ) {

				m.t = Math.min( 1, m.t + delta / MOVE_TIME );
				const s = m.t * m.t * ( 3 - 2 * m.t ); // départ et arrivée en douceur
				m.group.position.lerpVectors( m.from, m.target, s );
				if ( m.t >= 1 ) {

					const onArrive = m.onArrive;
					m.target = null;
					m.onArrive = null;
					if ( onArrive ) onArrive();

				}
				return;

			}

			m.group.position.y = m.home.y + Math.sin( elapsed * 2 + i ) * 0.04;
			m.group.rotation.y += delta * 0.8;
			m.group.scale.setScalar( m === this.held ? 1.25 + Math.sin( elapsed * 8 ) * 0.05 : 1 );

		} );

		// Les flashs s'estompent (sauf la molécule tenue, qui reste allumée).
		for ( const [ object, value ] of this._flash ) {

			if ( value <= 0 ) continue;
			if ( this.held && object === this.held.group ) continue;
			const next = Math.max( 0, value - delta * 1.2 );
			this._flash.set( object, next );
			object.traverse( ( child ) => {

				if ( child.material && child.material.emissive ) child.material.emissiveIntensity = next;

			} );

		}

	}

	onDispose() {

		this.elements.clear();
		this.molecules = [];
		this.held = null;
		this._flash.clear();

	}

}

// ---------- Modèles des molécules (générés par code) ----------

function atom( color, x ) {

	// Une géométrie par atome : BaseLevel.dispose() libère toutes les géométries du niveau.
	const mesh = new THREE.Mesh( new THREE.SphereGeometry( 0.09, 20, 14 ), new THREE.MeshStandardMaterial( { color, roughness: 0.3, emissive: 0x000000 } ) );
	mesh.position.x = x;
	return mesh;

}

/** O₂ : deux atomes d'oxygène (rouges). */
function createO2() {

	const group = new THREE.Group();
	group.name = 'O2';
	group.add( atom( 0xe53935, - 0.075 ), atom( 0xe53935, 0.075 ) );
	return group;

}

/** CO₂ : un atome de carbone (gris foncé) entre deux atomes d'oxygène (rouges). */
function createCO2() {

	const group = new THREE.Group();
	group.name = 'CO2';
	group.add( atom( 0x424242, 0 ), atom( 0xe53935, - 0.15 ), atom( 0xe53935, 0.15 ) );
	return group;

}