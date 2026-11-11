/**
 * TestScene.js — Scène de test du moteur, sans aucun modèle externe.
 *
 * Sert à vérifier la VR, le mode bureau, la téléportation et la sélection :
 *   - un sol et un tunnel (TubeGeometry) qui évoque un vaisseau sanguin ;
 *   - 3 points de téléportation le long du tunnel ;
 *   - 3 sphères sélectionnables qui affichent leur nom dans la console.
 *
 * C'est aussi un exemple d'utilisation de l'API du moteur pour les niveaux.
 */
import * as THREE from 'three/webgpu';

/**
 * Construit la scène de test.
 * @param {Object} context
 * @param {import('../core/Engine.js').Engine} context.engine
 * @param {import('../systems/Interaction.js').Interaction} context.interaction
 * @param {import('../systems/Teleport.js').Teleport} context.teleport
 * @returns {() => void} Fonction qui libère la scène.
 */
export function createTestScene( { engine, interaction, teleport } ) {

	const root = new THREE.Group();
	root.name = 'test-scene';
	engine.scene.add( root );

	// Trajet du vaisseau : une courbe douce le long de -Z, à 1,5 m de hauteur.
	const path = new THREE.CatmullRomCurve3( [
		new THREE.Vector3( 0, 1.5, 6 ),
		new THREE.Vector3( 0, 1.5, 0 ),
		new THREE.Vector3( 1.5, 1.5, - 8 ),
		new THREE.Vector3( - 1, 1.5, - 16 ),
		new THREE.Vector3( 0, 1.5, - 24 )
	] );

	// Paroi du vaisseau (vue de l'intérieur comme de l'extérieur).
	const vessel = new THREE.Mesh(
		new THREE.TubeGeometry( path, 120, 3, 32, false ),
		new THREE.MeshStandardMaterial( {
			color: 0x8a1020, emissive: 0x2a0005, roughness: 0.6,
			side: THREE.DoubleSide, transparent: true, opacity: 0.85
		} )
	);
	vessel.name = 'vaisseau';
	root.add( vessel );

	// Sol plat sur lequel se posent les points de téléportation.
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry( 6, 34 ).rotateX( - Math.PI / 2 ),
		new THREE.MeshStandardMaterial( { color: 0x3a0a10, roughness: 0.9 } )
	);
	floor.position.set( 0, 0, - 9 );
	floor.name = 'sol';
	root.add( floor );

	// Points de téléportation : sur le trajet, au sol, regard vers -Z.
	const points = [ 0.25, 0.5, 0.75 ].map( ( t ) => {

		const position = path.getPointAt( t ).setY( 0 );
		return { position, rotationY: 0 };

	} );
	teleport.setPoints( points );
	teleport.teleportTo( points[ 0 ], { instant: true } );

	// Sphères sélectionnables, une devant chaque point.
	const cells = [
		{ name: 'Globule rouge', color: 0xd01c2a },
		{ name: 'Globule blanc', color: 0xf2f2f2 },
		{ name: 'Plaquette', color: 0xe8c547 }
	];

	const spheres = cells.map( ( cell, index ) => {

		const sphere = new THREE.Mesh(
			new THREE.SphereGeometry( 0.3, 32, 16 ),
			new THREE.MeshStandardMaterial( { color: cell.color, roughness: 0.4 } )
		);
		sphere.name = cell.name;
		sphere.position.copy( points[ index ].position ).add( new THREE.Vector3( 0.8, 1.4, - 2 ) );
		root.add( sphere );

		interaction.addSelectable( sphere, {
			onSelect: ( { object, source } ) => console.log( `[TestScene] Sélection : ${object.name} (${source})` )
		} );

		return sphere;

	} );

	// Petite animation pour illustrer engine.onUpdate.
	const stopUpdate = engine.onUpdate( ( delta, elapsed ) => {

		spheres.forEach( ( sphere, index ) => {

			sphere.position.y = 1.4 + Math.sin( elapsed * 1.5 + index ) * 0.1;

		} );

	} );

	// Libération propre (sera utile au futur LevelManager).
	return function dispose() {

		stopUpdate();
		teleport.clear();
		spheres.forEach( ( sphere ) => interaction.removeSelectable( sphere ) );
		engine.scene.remove( root );
		root.traverse( ( child ) => {

			if ( child.geometry ) child.geometry.dispose();
			if ( child.material ) child.material.dispose();

		} );

	};

}
