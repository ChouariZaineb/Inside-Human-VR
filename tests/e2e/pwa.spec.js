/**
 * pwa.spec.js — Progressive Web App : manifeste, Service Worker et démarrage hors ligne.
 *
 * @author Chouari Zaineb
 * @date   2026-11-12
 * @role   Qualité : vérifie l'exigence ENF-04 (l'application complète fonctionne sans connexion
 *         après la première visite), sur la version de production (npm run build + preview).
 */
import { test, expect } from '@playwright/test';
import { PREVIEW_URL } from '../../playwright.config.js';

test.describe( 'PWA (version de production)', () => {

	test.use( { baseURL: PREVIEW_URL } );

	test( 'le manifeste décrit une application installable', async ( { page } ) => {

		await page.goto( '/' );
		const manifest = await page.evaluate( async () => {

			const link = document.querySelector( 'link[rel="manifest"]' );
			return ( await fetch( link.href ) ).json();

		} );

		expect( manifest.short_name ).toBe( 'Inside Human VR' );
		expect( manifest.display ).toBe( 'standalone' );
		expect( manifest.start_url ).toBe( './' );
		const sizes = manifest.icons.map( ( icon ) => icon.sizes );
		expect( sizes ).toContain( '192x192' );
		expect( sizes ).toContain( '512x512' );

		for ( const icon of manifest.icons ) {

			const response = await page.request.get( icon.src );
			expect( response.ok() ).toBe( true );

		}

	} );

	test( 'après une première visite, l\'application démarre hors ligne', async ( { page, context } ) => {

		await page.goto( '/' );

		// Le Service Worker est actif et a rangé les fichiers dans le cache.
		await page.waitForFunction( async () => {

			const registration = await navigator.serviceWorker.getRegistration();
			return Boolean( registration && registration.active );

		} );
		await expect.poll( () => page.evaluate( async () => {

			const names = await caches.keys();
			let count = 0;
			for ( const name of names ) count += ( await ( await caches.open( name ) ).keys() ).length;
			return count;

		} ), { timeout: 20_000 } ).toBeGreaterThan( 5 );

		// Coupure du réseau, puis rechargement.
		await context.setOffline( true );
		await page.reload();

		await expect( page.locator( '#home' ) ).toBeVisible();
		await expect( page.locator( '#app canvas' ) ).toBeVisible( { timeout: 30_000 } );
		expect( await page.evaluate( () => navigator.onLine ) ).toBe( false );

		// Le badge de connexion l'indique à l'utilisateur.
		await expect( page.locator( '#net-badge' ) ).toHaveAttribute( 'data-state', 'offline' );
		await expect( page.locator( '#net-label' ) ).toHaveText( 'Hors ligne · mode cache' );

		await context.setOffline( false );
		await expect( page.locator( '#net-badge' ) ).toHaveAttribute( 'data-state', 'online' );

	} );

} );
