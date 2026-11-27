/** Vérifie que le navigateur charge réellement Three.js r187 depuis un CDN. */
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

test( 'les modules WebGPU proviennent du CDN, pas de node_modules', async ( { page } ) => {

	const requests = [];
	page.on( 'request', ( req ) => requests.push( req.url() ) );
	await openApp( page );
	const cdn = requests.filter( ( url ) => url.startsWith( 'https://cdn.jsdelivr.net/npm/three@0.187.0/' ) );
	expect( cdn.length ).toBeGreaterThan( 0 );
	expect( cdn.some( ( url ) => url.includes( 'three.webgpu.js' ) ) ).toBe( true );
	expect( requests.some( ( url ) => url.includes( '/node_modules/.vite/deps/three' ) ) ).toBe( false );

} );
