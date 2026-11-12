/**
 * helpers.js — Outils communs aux tests de bout en bout.
 *
 * @author Chouari Zaineb
 * @date   2026-11-12
 * @role   Qualité : simulation d'un casque Meta Quest 3 et de ses manettes, visée, boutons, attente du moteur.
 *
 * Le casque est simulé par « iwer » (Immersive Web Emulation Runtime, Meta), le même moteur que
 * l'extension Chrome Immersive Web Emulator. Il remplace navigator.xr par une implémentation complète
 * de l'API WebXR Device (sessions, poses, manettes, boutons, joysticks).
 */
import fs from 'fs';
import path from 'path';

const IWER = fs.readFileSync( path.resolve( 'node_modules/iwer/build/iwer.js' ), 'utf8' );

/**
 * Installe un casque Meta Quest 3 simulé avant le chargement de la page.
 * Le casque est accessible dans la page sous le nom window.__xrDevice.
 * @param {import('@playwright/test').Page} page
 */
export async function installQuest3( page ) {

	await page.addInitScript( `${IWER};
		window.__xrDevice = new IWER.XRDevice( IWER.metaQuest3 );
		window.__xrDevice.installRuntime( { forceInstall: true } );` );

}

/**
 * Ouvre l'application et attend que le moteur et la scène de départ soient prêts.
 * window.app n'existe qu'en développement (voir src/main.js).
 * @param {import('@playwright/test').Page} page
 * @param {string} [url='/']
 */
export async function openApp( page, url = '/' ) {

	await page.goto( url );
	await page.waitForFunction( () => window.app && window.app.levels && window.app.levels.currentId !== null, null, { timeout: 30_000 } );

}

/**
 * Clique sur « Entrer en VR » et attend que la session WebXR soit active.
 * @param {import('@playwright/test').Page} page
 */
export async function enterVR( page ) {

	await page.waitForFunction( () => ! document.getElementById( 'btn-vr' ).disabled );
	await page.click( '#btn-vr' );
	await page.waitForFunction( () => window.app.engine.isVR() && window.app.xr.controllers.every( ( c ) => c.userData.connected ) );
	await page.waitForTimeout( 500 );

}

/**
 * Position monde d'un objet de la scène, désigné par une expression évaluée dans la page.
 * @param {import('@playwright/test').Page} page
 * @param {string} expression - Ex. "window.app.levels.current.button.mesh".
 * @returns {Promise<number[]>} [x, y, z]
 */
export async function worldPosition( page, expression ) {

	return page.evaluate( ( expr ) => {

		const object = eval( expr ); // expression écrite par le test lui-même
		const v = object.getWorldPosition( new ( window.app.engine.camera.position.constructor )() );
		return [ v.x, v.y, v.z ];

	}, expression );

}

/**
 * Oriente une manette pour que son rayon vise un point du monde.
 * @param {import('@playwright/test').Page} page
 * @param {'left'|'right'} hand
 * @param {number[]} target - [x, y, z]
 */
export async function aim( page, hand, target ) {

	await page.evaluate( ( [ hand, target ] ) => {

		const controller = window.__xrDevice.controllers[ hand ];
		const V = window.app.engine.camera.position.constructor;
		const Q = window.app.engine.camera.quaternion.constructor;
		const from = new V( controller.position.x, controller.position.y, controller.position.z );
		const direction = new V( ...target ).sub( from ).normalize();
		const q = new Q().setFromUnitVectors( new V( 0, 0, - 1 ), direction );
		controller.quaternion.set( q.x, q.y, q.z, q.w );

	}, [ hand, target ] );
	await waitFrames( page );

}

/**
 * Appuie puis relâche un bouton de manette ('trigger' = gâchette, 'squeeze' = grip).
 * @param {import('@playwright/test').Page} page
 * @param {'left'|'right'} hand
 * @param {string} button
 */
export async function press( page, hand, button ) {

	await setButton( page, hand, button, 1 );
	await setButton( page, hand, button, 0 );

}

/**
 * Change la valeur d'un bouton de manette (1 = appuyé, 0 = relâché).
 * @param {import('@playwright/test').Page} page
 * @param {'left'|'right'} hand
 * @param {string} button
 * @param {number} value
 */
export async function setButton( page, hand, button, value ) {

	await page.evaluate( ( [ hand, button, value ] ) => window.__xrDevice.controllers[ hand ].updateButtonValue( button, value ), [ hand, button, value ] );
	await waitFrames( page );

}

/**
 * Déplace une manette (translation) d'un vecteur [dx, dy, dz].
 * @param {import('@playwright/test').Page} page
 * @param {'left'|'right'} hand
 * @param {number[]} delta
 */
export async function moveController( page, hand, delta ) {

	await page.evaluate( ( [ hand, d ] ) => {

		const c = window.__xrDevice.controllers[ hand ];
		c.position.set( c.position.x + d[ 0 ], c.position.y + d[ 1 ], c.position.z + d[ 2 ] );

	}, [ hand, delta ] );
	await waitFrames( page );

}

/**
 * Position du joystick d'une manette.
 * @param {import('@playwright/test').Page} page
 * @param {'left'|'right'} hand
 * @param {number} x
 * @param {number} y
 */
export async function thumbstick( page, hand, x, y ) {

	await page.evaluate( ( [ hand, x, y ] ) => window.__xrDevice.controllers[ hand ].updateAxes( 'thumbstick', x, y ), [ hand, x, y ] );
	await waitFrames( page );

}

/**
 * Attend que l'application ait affiché quelques images VR.
 * Un délai fixe (300 ms) ne suffit pas sur un serveur CI sans carte graphique :
 * il y a peu d'images par seconde, et une action (viser, appuyer, déplacer)
 * n'est prise en compte qu'à l'image suivante. On compte donc les images, pas le temps.
 * @param {import('@playwright/test').Page} page
 * @param {number} [count=3] - Nombre d'images à attendre.
 */
export async function waitFrames( page, count = 3 ) {

	await page.evaluate( ( count ) => new Promise( ( resolve ) => {

		const presenter = window.app.xr.presenter;
		if ( ! window.app.engine.isVR() ) return setTimeout( resolve, 300 );

		let seen = 0;
		const onFrame = () => {

			if ( ++ seen < count ) return;
			presenter.removeEventListener( 'frame', onFrame );
			resolve();

		};
		presenter.addEventListener( 'frame', onFrame );

	} ), count );

}