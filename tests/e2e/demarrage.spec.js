/**
 * demarrage.spec.js — Démarrage de l'application : WebGPU, scène de départ, PWA déclarée.
 *
 * @author Chouari Zaineb
 * @date   2026-11-12
 * @role   Qualité : vérifie les exigences EF-01, EF-03 et ENF-03 du cahier des charges.
 */
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

test.describe( 'Démarrage', () => {

	test( 'le rendu utilise le backend WebGPU de Three.js r187', async ( { page } ) => {

		const logs = [];
		page.on( 'console', ( message ) => logs.push( message.text() ) );

		await openApp( page );

		const renderer = await page.evaluate( () => ( {
			webgpu: window.app.engine.renderer.backend.isWebGPUBackend === true,
			revision: window.app.engine.renderer.constructor.name
		} ) );

		expect( renderer.webgpu ).toBe( true );
		expect( renderer.revision ).toBe( 'WebGPURenderer' );
		expect( logs ).toContain( '[Renderer] Backend : WebGPU' );

	} );

	test( 'la scène de départ affiche le corps humain', async ( { page } ) => {

		await openApp( page );

		const scene = await page.evaluate( () => {

			let body = false;
			window.app.engine.scene.traverse( ( object ) => {

				if ( object.name === 'body-scene' ) body = true;

			} );
			return { level: window.app.levels.currentId, body };

		} );

		expect( scene.level ).toBe( 'home' );
		expect( scene.body ).toBe( true );
		await expect( page.locator( '#app canvas' ) ).toBeVisible();

	} );

	test( 'la page déclare le manifeste et enregistre le Service Worker', async ( { page } ) => {

		await openApp( page );

		await expect( page.locator( 'link[rel="manifest"]' ) ).toHaveAttribute( 'href', './manifest.webmanifest' );
		const registered = await page.evaluate( async () => Boolean( await navigator.serviceWorker.getRegistration() ) );
		expect( registered ).toBe( true );

	} );

} );
