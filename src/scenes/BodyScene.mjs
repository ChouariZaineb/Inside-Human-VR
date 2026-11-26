/**
 * BodyScene.mjs — Scène de départ : le corps humain en VR.
 *
 * C'est la première scène que voit l'utilisateur en entrant dans l'application :
 *   - le corps humain réel de Yessmine (RealBody.mjs : squelette, poumons, cerveau, cœur importés des .glb), à 3,5 m,
 *     pour donner l'impression d'être déjà miniaturisé devant lui ;
 *   - une plateforme ronde au sol ;
 *   - 3 points de téléportation : vue d'ensemble, vue du thorax, vue de côté ;
 *   - le cœur est sélectionnable (gâchette ou clic) : point d'entrée du niveau 1 ;
 *   - les poumons et le cerveau de la galerie sont aussi sélectionnables : ils ouvrent leur niveau
 *     s'il est débloqué, sinon un panneau explique quelle mission réussir d'abord ;
 *   - le cœur peut aussi être SAISI (grip ou clic droit maintenu) et sorti du corps pour l'observer :
 *     lâché, il revient se placer tout seul dans la poitrine.
 *
 * Elle relie le travail des trois membres : moteur et VR (Zaineb), modèle 3D (Yessmine),
 * et plus tard l'entrée dans les niveaux (Melek).
 */
import * as THREE from 'three/webgpu';
import { createRealBody } from '../systems/RealBody.mjs';
import { beatJS } from '../shaders/tissuePulse.mjs';
import { breathJS } from '../shaders/breathing.mjs';
import { UIPanel } from '../systems/UIPanel.mjs';

/** Niveau associé à chaque organe de la galerie, et mission à réussir pour le débloquer. */
const ORGAN_LEVELS = {
	lungs: { name: 'Les poumons', requires: 'la mission du cœur' },
	brain: { name: 'Le cerveau', requires: 'la mission des poumons' }
};

/** Durée d'affichage du panneau « niveau verrouillé » (s). */
const HINT_DURATION = 3.5;

/** Le corps réel mesure 1,8 m : x1,94 → environ 3,5 m de haut, pour l'effet « miniaturisé ». */
const BODY_SCALE = 3.5 / 1.8;

/** Distance du corps devant le point de départ (m). */
const BODY_Z = - 4;

/**
 * Construit la scène du corps humain.
 * @param {Object} context
 * @param {import('../core/Engine.mjs').Engine} context.engine
 * @param {import('../systems/Interaction.mjs').Interaction} context.interaction
 * @param {import('../systems/Teleport.mjs').Teleport} context.teleport
 * @param {import('../data/GameState.mjs').GameState} [context.gameState] - Progression (niveaux débloqués).
 * @param {(organ: string) => void} [context.onOrganSelected] - Appelée quand on sélectionne un organe.
 * @returns {() => void} Fonction qui libère la scène.
 */
export function createBodyScene( { engine, interaction, teleport, gameState = null, onOrganSelected = null } ) {

	const root = new THREE.Group();
	root.name = 'body-scene';
	engine.scene.add( root );

	// Fond bleu nuit, cohérent avec le rendu « radio ».
	const previousBackground = engine.scene.background;
	engine.scene.background = new THREE.Color( 0x020814 );

	// 1. Le corps humain : modèles .glb importés (données), chargés en arrière-plan.
	let disposed = false;
	let body = null;
	const heartPivot = new THREE.Group(); // le cœur, détaché du corps pour pouvoir être saisi
	heartPivot.name = 'coeur';
	const heartBeat = new THREE.Group();  // enfant : battement et survol
	heartPivot.add( heartBeat );
	let heartHome = null;
	let heartReturn = null; // animation de retour dans la poitrine
	let heartHeld = false;
	let hover = false;
	let time = 0;

	// Disposition « galerie » : squelette au centre, organes à gauche, vaisseaux à droite.
	const ORGAN_SCALE = BODY_SCALE * 1.6;
	const GALLERY = {
		brain: { pos: [ - 2.6, 3.2, BODY_Z ], spin: 0.35 },
		lungs: { pos: [ - 2.6, 2.0, BODY_Z ], spin: 0.35 },
		heart: { pos: [ - 2.6, 0.85, BODY_Z + 0.2 ], spin: 0 },
		vessels: { pos: [ 2.6, 0, BODY_Z ], spin: 0 } // la hauteur est réglée au chargement
	};
	const floaters = []; // organes qui flottent et tournent doucement
	let lungsRoot = null;
	const organSelectables = []; // poumons et cerveau de la galerie, pointables

	// Panneau affiché quand on pointe un organe dont le niveau est encore verrouillé.
	const hint = new UIPanel( { width: 1.5, height: 0.5, variant: 'info' } );
	hint.mesh.visible = false;
	root.add( hint.mesh );
	let hintTime = 0;

	/** Montre le panneau à droite de l'organe, quelques secondes. */
	const showHint = ( holder, content ) => {

		hint.setContent( content );
		hint.mesh.position.copy( holder.position ).add( new THREE.Vector3( 1.7, 0.2, 0.9 ) );
		hint.mesh.visible = true;
		hintTime = HINT_DURATION;

	};

	/** Rend un organe de la galerie pointable : il grossit au survol et ouvre son niveau. */
	const makeOrganSelectable = ( name, floater ) => {

		const info = ORGAN_LEVELS[ name ];
		interaction.addSelectable( floater.holder, {
			highlight: false,
			onHover: ( { hovered } ) => { floater.hovered = hovered; },
			onSelect: ( { source } ) => {

				const unlocked = ! gameState || gameState.isUnlocked( name );
				console.log( `[BodyScene] ${info.name} sélectionnés (${source}) : ${unlocked ? 'ouverture du niveau' : 'niveau verrouillé'}` );
				if ( unlocked ) {

					if ( onOrganSelected ) onOrganSelected( name );
					return;

				}
				showHint( floater.holder, {
					title: `${info.name} : verrouillé`,
					body: `Réussis d'abord ${info.requires} pour débloquer ce niveau.`,
					variant: 'error'
				} );

			}
		} );
		organSelectables.push( floater.holder );

	};

	/** Sort une partie du corps pour la poser dans la galerie (RealBody ne la déplace plus). */
	const detach = ( real, name, scale ) => {

		const part = real.parts[ name ];
		if ( ! part ) return null;
		delete real.parts[ name ];
		const holder = new THREE.Group();
		holder.name = `galerie-${name}`;
		part.root.position.set( 0, 0, 0 );
		holder.add( part.root );
		holder.scale.setScalar( scale );
		holder.position.set( ...GALLERY[ name ].pos );
		root.add( holder );
		return { part, holder };

	};

	const bodyReady = createRealBody( { skeletonOpacity: 1 } ).then( ( real ) => {

		if ( disposed ) return;
		body = real;
		body.group.scale.setScalar( BODY_SCALE );
		body.group.position.set( 0, 0.02, BODY_Z ); // squelette debout au centre, pieds sur le sol
		root.add( body.group );

		for ( const name of [ 'brain', 'lungs' ] ) {

			const item = detach( real, name, ORGAN_SCALE );
			if ( ! item ) continue;
			const floater = { holder: item.holder, baseY: item.holder.position.y, spin: GALLERY[ name ].spin, hovered: false };
			floaters.push( floater );
			if ( name === 'lungs' ) lungsRoot = item.part.root;
			makeOrganSelectable( name, floater );

		}

		// Vaisseaux sanguins : à droite, à la même taille et à la même hauteur que le squelette.
		const vessels = detach( real, 'vessels', BODY_SCALE );
		if ( vessels ) vessels.holder.position.y = 0.02 + vessels.part.cfg.inBody[ 1 ] * BODY_SCALE;

		const heart = real.parts.heart;
		if ( ! heart ) return;
		delete real.parts.heart; // RealBody ne le replace plus : la scène le gère
		heartPivot.position.set( ...GALLERY.heart.pos );
		heartPivot.scale.setScalar( ORGAN_SCALE );
		heart.root.position.set( 0, 0, 0 );
		heartBeat.add( heart.root );
		root.add( heartPivot );
		heartHome = { position: heartPivot.position.clone(), quaternion: heartPivot.quaternion.clone() };

		// Le cœur : sélection (entrée dans le niveau 1) et saisie (pour l'observer de près).
		interaction.addSelectable( heartPivot, {
			highlight: false,
			onHover: ( { hovered } ) => { hover = hovered; },
			onSelect: ( { source } ) => {

				console.log( `[BodyScene] Cœur sélectionné (${source}) : entrée dans le niveau 1` );
				if ( onOrganSelected ) onOrganSelected( 'heart' );

			},
			grabbable: true,
			onGrab: ( { source } ) => {

				// Le cœur vient dans la main, 50 cm devant la manette (ou devant les yeux en mode bureau).
				heartReturn = null;
				heartHeld = true;
				heartPivot.position.set( 0, 0, - 0.5 );
				console.log( `[BodyScene] Cœur saisi (${source})` );

			},
			onRelease: () => {

				heartHeld = false;
				heartReturn = { t: 0, position: heartPivot.position.clone(), quaternion: heartPivot.quaternion.clone() };

			}
		} );

	} ).catch( ( error ) => console.warn( 'Corps indisponible :', error.message ?? error ) );

	// Panneau d'aide, visible seulement en VR (en mode bureau, l'écran d'accueil donne déjà les consignes).
	const help = new UIPanel( { width: 1.3, height: 0.8 } );
	help.setContent( {
		title: 'Bienvenue dans le corps humain',
		body: 'Vise le cœur avec le rayon et appuie sur la gâchette (ou pince les doigts) pour commencer la mission.\nVise un cercle au sol pour te téléporter.',
		variant: 'info'
	} );
	help.setPosition( 1.25, 1.25, - 2 );
	help.mesh.visible = false;
	root.add( help.mesh );

	// 2. Plateforme ronde sous le corps et zone de déplacement.
	const platform = new THREE.Mesh(
		new THREE.CircleGeometry( 6, 64 ).rotateX( - Math.PI / 2 ),
		new THREE.MeshStandardMaterial( { color: 0x0b1a33, roughness: 0.9 } )
	);
	platform.position.set( 0, 0, BODY_Z + 1 );
	platform.name = 'plateforme';
	root.add( platform );

	const ring = new THREE.Mesh(
		new THREE.RingGeometry( 5.9, 6, 96 ).rotateX( - Math.PI / 2 ),
		new THREE.MeshBasicMaterial( { color: 0x2f7dff } )
	);
	ring.position.set( 0, 0.01, BODY_Z + 1 );
	root.add( ring );

	void bodyReady;

	// 3. Points de téléportation : face au corps, près du thorax, sur le côté.
	const points = [
		{ position: new THREE.Vector3( 0, 0, 0 ), rotationY: 0 },                       // vue d'ensemble
		{ position: new THREE.Vector3( 0.3, 0, BODY_Z + 2 ), rotationY: 0 },            // devant le thorax
		{ position: new THREE.Vector3( 3, 0, BODY_Z ), rotationY: Math.PI / 2 }         // vue de côté
	];
	teleport.setPoints( points );
	teleport.teleportTo( points[ 0 ], { instant: true } );

	// 4. Animation : respiration, battement du cœur, retour du cœur dans la poitrine.
	const stopUpdate = engine.onUpdate( ( delta ) => {

		time += delta;
		help.mesh.visible = engine.isVR();
		if ( help.mesh.visible ) help.update( engine.camera );
		if ( body ) {

			body.update( delta );
			if ( lungsRoot ) lungsRoot.scale.setScalar( 1 + 0.05 * breathJS( time ) );
			for ( const f of floaters ) {

				f.holder.rotation.y += delta * f.spin;
				f.holder.position.y = f.baseY + 0.06 * Math.sin( time * 0.9 + f.baseY );
				f.holder.scale.setScalar( ORGAN_SCALE * ( f.hovered ? 1.15 : 1 ) ); // grossit au survol

			}

		}

		if ( heartReturn ) {

			heartReturn.t = Math.min( 1, heartReturn.t + delta / 0.8 );
			const k = heartReturn.t * heartReturn.t * ( 3 - 2 * heartReturn.t );
			heartPivot.position.lerpVectors( heartReturn.position, heartHome.position, k );
			heartPivot.quaternion.slerpQuaternions( heartReturn.quaternion, heartHome.quaternion, k );
			if ( heartReturn.t >= 1 ) heartReturn = null;

		}

		// Panneau « verrouillé » : tourné vers l'utilisateur, puis masqué.
		if ( hintTime > 0 ) {

			hintTime -= delta;
			hint.update( engine.camera );
			if ( hintTime <= 0 ) hint.mesh.visible = false;

		}

		// Tenu en main, le cœur prend une taille d'environ 35 cm ; dans le corps, l'échelle du corps.
		heartPivot.scale.setScalar( heartHeld ? 3 : ORGAN_SCALE );
		heartBeat.scale.setScalar( ( hover ? 1.2 : 1 ) * ( 1 + 0.05 * beatJS( time ) ) );
		heartBeat.rotation.y = time * 0.5;

	} );

	// Libération propre (utilisée par le futur LevelManager).
	return function dispose() {

		disposed = true;
		stopUpdate();
		teleport.clear();
		interaction.removeSelectable( heartPivot );
		for ( const holder of organSelectables ) interaction.removeSelectable( holder );
		hint.dispose();
		engine.scene.remove( root );
		engine.scene.background = previousBackground;
		help.texture.dispose();
		root.traverse( ( child ) => {

			if ( child.geometry ) child.geometry.dispose();
			if ( child.material ) [].concat( child.material ).forEach( ( m ) => m.dispose() );

		} );

	};

}