/**
 * poumons.spec.js — Mission complète du niveau des poumons, jouée en VR avec les manettes.
 *
 * @author Chouari Zaineb
 * @date   2026-11-12
 * @role   Qualité : vérifie de bout en bout le déroulé d'un niveau (BaseLevel, GameState),
 *         la saisie et le dépôt des molécules, le score et la couleur du sang.
 */
import { test, expect } from '@playwright/test';
import { installQuest3, openApp, enterVR, worldPosition, aim, press, setButton, moveController } from './helpers.js';

const LEVEL = 'window.app.levels.current';

/**
 * Saisit la molécule n° i, la porte jusqu'à une zone et la lâche.
 * @param {import('@playwright/test').Page} page
 * @param {number} i
 * @param {'alveolus'|'capillary'} zone
 */
async function carryMolecule( page, i, zone ) {

	const start = await worldPosition( page, `${LEVEL}.molecules[ ${i} ].group` );
	await aim( page, 'right', start );
	await setButton( page, 'right', 'squeeze', 1 );

	// Place libre dans la zone : on déplace la manette du même vecteur que la molécule doit parcourir.
	const target = await page.evaluate( ( [ zone, i ] ) => {

		const level = window.app.levels.current;
		const p = level._slot( zone, i % 3, true );
		level.group.localToWorld( p );
		return [ p.x, p.y, p.z ];

	}, [ zone, i ] );
	await moveController( page, 'right', [ target[ 0 ] - start[ 0 ], target[ 1 ] - start[ 1 ], target[ 2 ] - start[ 2 ] ] );
	await setButton( page, 'right', 'squeeze', 0 );
	await page.waitForTimeout( 1000 ); // animation de traversée (0,8 s)

	// La manette revient à sa position de départ pour la molécule suivante.
	await moveController( page, 'right', [ start[ 0 ] - target[ 0 ], start[ 1 ] - target[ 1 ], start[ 2 ] - target[ 2 ] ] );

}

test.describe( 'Niveau des poumons en VR', () => {

	test.beforeEach( async ( { page } ) => {

		await installQuest3( page );
		await openApp( page );
		await page.evaluate( async () => {

			window.app.gameState.unlock( 'lungs' );
			await window.app.levels.load( 'lungs' );

		} );
		await enterVR( page );

		// Boutons « Explorer » puis « Lancer la mission », à la gâchette.
		for ( let k = 0; k < 2; k ++ ) {

			await aim( page, 'right', await worldPosition( page, `${LEVEL}.button.mesh` ) );
			await press( page, 'right', 'trigger' );

		}

		await expect.poll( () => page.evaluate( () => window.app.levels.current.gameState.phase ) ).toBe( 'mission' );

	} );

	test( 'déposer les 6 molécules au bon endroit termine la mission avec 100 points', async ( { page } ) => {

		for ( let i = 0; i < 6; i ++ ) {

			const zone = await page.evaluate( ( i ) => window.app.levels.current.molecules[ i ].kind.vers, i );
			await carryMolecule( page, i, zone );

		}

		const result = await page.evaluate( () => {

			const level = window.app.levels.current;
			return {
				phase: level.gameState.phase,
				result: level.gameState.results.lungs,
				blood: level.elements.get( 'capillary' ).material.color.getHexString()
			};

		} );

		expect( result.phase ).toBe( 'result' );
		expect( result.result.score ).toBe( 100 );
		expect( result.result.errors ).toBe( 0 );
		expect( result.result.correct ).toBe( 6 );
		expect( result.blood ).toBe( 'd02a2a' ); // le sang est devenu rouge (oxygéné)

	} );

	test( 'une molécule lâchée hors des zones retourne à sa place sans changer le score', async ( { page } ) => {

		const start = await worldPosition( page, `${LEVEL}.molecules[ 0 ].group` );
		await aim( page, 'right', start );
		await setButton( page, 'right', 'squeeze', 1 );
		await moveController( page, 'right', [ - 1.5, 0.8, 0 ] ); // loin de l'alvéole et du capillaire
		await setButton( page, 'right', 'squeeze', 0 );
		await page.waitForTimeout( 1000 ); // animation de retour (0,8 s)

		const state = await page.evaluate( () => {

			const level = window.app.levels.current;
			const m = level.molecules[ 0 ];
			return {
				errors: level.gameState.errors,
				correct: level.gameState.correct,
				done: m.done,
				distanceToHome: m.group.position.distanceTo( m.home )
			};

		} );

		expect( state.correct ).toBe( 0 );
		expect( state.errors ).toBe( 0 );
		expect( state.done ).toBe( false );
		expect( state.distanceToHome ).toBeLessThan( 0.06 ); // revenue à sa place (elle flotte de ±4 cm)

	} );

} );
