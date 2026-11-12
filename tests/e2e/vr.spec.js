/**
 * vr.spec.js — Session WebXR immersive-vr simulée (Meta Quest 3) et interactions avec les manettes.
 *
 * @author Chouari Zaineb
 * @date   2026-11-12
 * @role   Qualité : vérifie la session WebXR Device API, le rendu WebGPU en VR, la gâchette,
 *         la saisie au grip, le retour haptique et la rotation sur soi au joystick.
 */
import { test, expect } from '@playwright/test';
import { installQuest3, openApp, enterVR, worldPosition, aim, press, setButton, thumbstick } from './helpers.js';

/** Expression qui désigne le cœur sélectionnable de la scène de départ. */
const HEART = `[ ...window.app.interaction._selectables.keys() ].find( ( o ) => o.name !== 'teleport-point' )`;

test.describe( 'Réalité virtuelle (casque Meta Quest 3 simulé)', () => {

	test.beforeEach( async ( { page } ) => {

		await installQuest3( page );
		await openApp( page );

		// Espion du retour haptique : on enregistre chaque vibration demandée.
		await page.evaluate( () => {

			window.__pulses = [];
			const xr = window.app.xr;
			const pulse = xr.pulse.bind( xr );
			xr.pulse = ( controller, intensity, duration ) => {

				window.__pulses.push( { hand: controller.userData.index, intensity, duration } );
				pulse( controller, intensity, duration );

			};

		} );

		await enterVR( page );

	} );

	test( 'la session immersive-vr est rendue en WebGPU avec les deux manettes suivies', async ( { page } ) => {

		const state = await page.evaluate( () => ( {
			vr: window.app.engine.isVR(),
			webgpu: window.app.engine.renderer.backend.isWebGPUBackend === true,
			drawCalls: window.app.engine.renderer.info.render.drawCalls,
			controllers: window.app.xr.controllers.map( ( c ) => c.userData.connected && c.visible )
		} ) );

		expect( state.vr ).toBe( true );
		expect( state.webgpu ).toBe( true );
		expect( state.drawCalls ).toBeGreaterThan( 0 );
		expect( state.controllers ).toEqual( [ true, true ] );

	} );

	test( 'la gâchette sur le cœur ouvre le niveau du cœur et fait vibrer la manette', async ( { page } ) => {

		await aim( page, 'right', await worldPosition( page, HEART ) );
		await press( page, 'right', 'trigger' );

		await expect.poll( () => page.evaluate( () => window.app.levels.currentId ) ).toBe( 'heart' );
		const pulses = await page.evaluate( () => window.__pulses );
		expect( pulses.some( ( p ) => p.intensity === 0.6 ) ).toBe( true ); // vibration de sélection

	} );

	test( 'le grip saisit le cœur, le joystick le tourne, il revient à sa place une fois lâché', async ( { page } ) => {

		await aim( page, 'right', await worldPosition( page, HEART ) );
		await setButton( page, 'right', 'squeeze', 1 );

		const held = await page.evaluate( () => window.app.interaction.getHeld( 'vr-1' ) !== null );
		expect( held ).toBe( true );

		const before = await page.evaluate( () => window.app.interaction.getHeld( 'vr-1' ).rotation.y );
		await thumbstick( page, 'right', 0.9, 0 );
		await page.waitForTimeout( 500 );
		await thumbstick( page, 'right', 0, 0 );
		const after = await page.evaluate( () => window.app.interaction.getHeld( 'vr-1' ).rotation.y );
		expect( Math.abs( after - before ) ).toBeGreaterThan( 0.3 );

		await setButton( page, 'right', 'squeeze', 0 );
		expect( await page.evaluate( () => window.app.interaction.getHeld( 'vr-1' ) ) ).toBe( null );

		const pulses = await page.evaluate( () => window.__pulses );
		expect( pulses.some( ( p ) => p.intensity === 0.8 ) ).toBe( true ); // vibration de saisie

	} );

	test( 'le joystick fait tourner l\'utilisateur de 30° (snap turn)', async ( { page } ) => {

		const before = await page.evaluate( () => window.app.engine.player.rotation.y );
		await thumbstick( page, 'right', 1, 0 );
		await thumbstick( page, 'right', 0, 0 );
		const after = await page.evaluate( () => window.app.engine.player.rotation.y );

		expect( Math.abs( after - before ) * 180 / Math.PI ).toBeCloseTo( 30, 3 );

	} );

} );
