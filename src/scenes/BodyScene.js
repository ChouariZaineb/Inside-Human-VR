/**
 * BodyScene.js — Scène de départ : le corps humain en VR.
 *
 * C'est la première scène que voit l'utilisateur en entrant dans l'application :
 *   - le corps humain « radio » de Yessmine (XrayBody.js), à grande échelle (3,5 m),
 *     pour donner l'impression d'être déjà miniaturisé devant lui ;
 *   - une plateforme ronde au sol ;
 *   - 3 points de téléportation : vue d'ensemble, vue du thorax, vue de côté ;
 *   - le cœur est sélectionnable (gâchette ou clic) : point d'entrée du niveau 1 ;
 *   - le cœur peut aussi être SAISI (grip ou clic droit maintenu) et sorti du corps pour l'observer :
 *     lâché, il revient se placer tout seul dans la poitrine.
 *
 * Elle relie le travail des trois membres : moteur et VR (Zaineb), modèle 3D (Yessmine),
 * et plus tard l'entrée dans les niveaux (Melek).
 */
import * as THREE from 'three/webgpu';
import { createXrayBody } from '../systems/XrayBody.js';

/** Le corps de XrayBody mesure ~10 unités : 0,35 → environ 3,5 m de haut. */
const BODY_SCALE = 0.35;

/** Distance du corps devant le point de départ (m). */
const BODY_Z = - 4;

/**
 * Construit la scène du corps humain.
 * @param {Object} context
 * @param {import('../core/Engine.js').Engine} context.engine
 * @param {import('../systems/Interaction.js').Interaction} context.interaction
 * @param {import('../systems/Teleport.js').Teleport} context.teleport
 * @param {(organ: string) => void} [context.onOrganSelected] - Appelée quand on sélectionne un organe.
 * @returns {() => void} Fonction qui libère la scène.
 */
export function createBodyScene( { engine, interaction, teleport, onOrganSelected = null } ) {

	const root = new THREE.Group();
	root.name = 'body-scene';
	engine.scene.add( root );

	// Fond bleu nuit, cohérent avec le rendu « radio ».
	const previousBackground = engine.scene.background;
	engine.scene.background = new THREE.Color( 0x020814 );

	// 1. Le corps humain (module de Yessmine), posé sur le sol.
	const body = createXrayBody();
	body.group.scale.setScalar( BODY_SCALE );
	body.group.position.set( 0, 5 * BODY_SCALE + 0.05, BODY_Z ); // les pieds touchent le sol (y = -5 dans le modèle)
	root.add( body.group );

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

	// 3. Points de téléportation : face au corps, près du thorax, sur le côté.
	const points = [
		{ position: new THREE.Vector3( 0, 0, 0 ), rotationY: 0 },                       // vue d'ensemble
		{ position: new THREE.Vector3( 0.3, 0, BODY_Z + 2 ), rotationY: 0 },            // devant le thorax
		{ position: new THREE.Vector3( 3, 0, BODY_Z ), rotationY: Math.PI / 2 }         // vue de côté
	];
	teleport.setPoints( points );
	teleport.teleportTo( points[ 0 ], { instant: true } );

	// 4. Le cœur : sélection (entrée dans le niveau 1) et saisie (pour l'observer de près).
	const heartHome = { position: body.heart.position.clone(), quaternion: body.heart.quaternion.clone() };
	let heartReturn = null; // animation de retour dans la poitrine
	let heartHeld = false;

	interaction.addSelectable( body.heart, {
		highlight: false,
		// Au survol, le cœur grossit (son enfant, car body.update() anime déjà l'échelle de body.heart).
		onHover: ( { hovered } ) => body.heart.children[ 0 ].scale.setScalar( hovered ? 1.2 : 0.98 ),
		onSelect: ( { source } ) => {

			console.log( `[BodyScene] Cœur sélectionné (${source}) : entrée dans le niveau 1` );
			if ( onOrganSelected ) onOrganSelected( 'heart' );

		},
		grabbable: true,
		onGrab: ( { source } ) => {

			// Le cœur vient dans la main, 50 cm devant la manette (ou devant les yeux en mode bureau).
			heartReturn = null;
			heartHeld = true;
			body.heart.position.set( 0, 0, - 0.5 );
			console.log( `[BodyScene] Cœur saisi (${source})` );

		},
		onRelease: () => {

			// De retour dans le corps : il repart vers sa place dans la poitrine.
			heartHeld = false;
			heartReturn = { t: 0, position: body.heart.position.clone(), quaternion: body.heart.quaternion.clone() };

		}
	} );

	const stopReturn = engine.onUpdate( ( delta ) => {

		if ( ! heartReturn ) return;
		heartReturn.t = Math.min( 1, heartReturn.t + delta / 0.8 );
		const k = heartReturn.t * heartReturn.t * ( 3 - 2 * heartReturn.t );
		body.heart.position.lerpVectors( heartReturn.position, heartHome.position, k );
		body.heart.quaternion.slerpQuaternions( heartReturn.quaternion, heartHome.quaternion, k );
		if ( heartReturn.t >= 1 ) heartReturn = null;

	} );

	// 5. Animation : battement du cœur et sang qui circule.
	const stopUpdate = engine.onUpdate( ( delta ) => {

		body.update( delta );
		// Tenu en main, le cœur n'est plus dans le corps mis à l'échelle : on garde sa taille réelle (≈ 35 cm).
		if ( heartHeld ) body.heart.scale.multiplyScalar( BODY_SCALE );

	} );

	// Libération propre (utilisée par le futur LevelManager).
	return function dispose() {

		stopUpdate();
		stopReturn();
		teleport.clear();
		interaction.removeSelectable( body.heart );
		engine.scene.remove( root );
		engine.scene.background = previousBackground;
		root.traverse( ( child ) => {

			if ( child.geometry ) child.geometry.dispose();
			if ( child.material ) child.material.dispose();

		} );

	};

}
