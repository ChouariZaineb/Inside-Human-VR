/**
 * Point d'entrée de l'application Inside Human VR.
 *
 * Assemble le moteur et les systèmes, puis charge la scène de départ :
 *   Engine (rendu + boucle) → XRManager (VR) + DesktopControls (bureau)
 *   → Interaction (pointage) → Teleport (déplacement) → BodyScene (corps humain).
 *
 * Ajouter ?test à l'adresse pour charger la scène de test du moteur à la place.
 */
import { Engine } from './core/Engine.js';
import { XRManager } from './core/XRManager.js';
import { DesktopControls } from './core/DesktopControls.js';
import { Interaction } from './systems/Interaction.js';
import { Teleport } from './systems/Teleport.js';
import { createTestScene } from './debug/TestScene.js';
import { createBodyScene } from './scenes/BodyScene.js';

const home = document.getElementById( 'home' );
const status = document.getElementById( 'status' );

// 1. Moteur
const engine = new Engine( document.getElementById( 'app' ) );
await engine.init();

// 2. Entrées : VR et mode bureau
const xr = new XRManager( engine, document.getElementById( 'btn-vr' ) );

// Vérification du support VR en parallèle : ne bloque pas le démarrage de la scène.
xr.addEventListener( 'supportchange', ( { supported } ) => {

	status.textContent = supported ? '' : 'VR non disponible : utilisez le mode bureau (ou Immersive Web Emulator).';

} );
xr.init();

const desktop = new DesktopControls( engine, document.getElementById( 'reticle' ) );
document.getElementById( 'btn-desktop' ).addEventListener( 'click', () => desktop.lock() );

// 3. Systèmes
const interaction = new Interaction( engine, xr, desktop );
const teleport = new Teleport( engine, interaction );

// 4. Écran d'accueil : caché pendant la VR ou le mode bureau.
desktop.addEventListener( 'lock', () => { home.hidden = true; } );
desktop.addEventListener( 'unlock', () => { home.hidden = false; } );

xr.addEventListener( 'sessionstart', () => {

	desktop.setEnabled( false );
	home.hidden = true;

} );

xr.addEventListener( 'sessionend', () => {

	desktop.setEnabled( true );
	home.hidden = false;

} );

xr.addEventListener( 'error', () => {

	status.textContent = 'La session VR n\'a pas pu démarrer : passez en mode bureau.';

} );

// 5. Scène de départ : le corps humain (ou la scène de test avec ?test dans l'adresse).
const useTestScene = new URLSearchParams( location.search ).has( 'test' );
if ( useTestScene ) createTestScene( { engine, interaction, teleport } );
else createBodyScene( { engine, interaction, teleport } );

// 6. Compteur d'images/s, seulement en développement (retiré du build).
if ( import.meta.env.DEV ) {

	const { default: Stats } = await import( 'three/addons/libs/stats.module.js' );
	const stats = new Stats();
	stats.dom.style.zIndex = '20'; // au-dessus de l'écran d'accueil
	document.body.appendChild( stats.dom );
	engine.onUpdate( () => stats.update() );

	// Accès depuis la console du navigateur pour déboguer : window.app.engine, etc.
	window.app = { engine, xr, desktop, interaction, teleport };

}

engine.start();
