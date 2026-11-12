/**
 * Point d'entrée de l'application Inside Human VR.
 *
 * Assemble le moteur et les systèmes, puis charge la scène de départ :
 *   Engine (rendu + boucle) → XRManager (VR) + DesktopControls (bureau)
 *   → Interaction (pointage) → Teleport (déplacement)
 *   → LevelManager : scène du corps humain (« home »), puis niveaux du cœur et des poumons.
 *
 * Adresse : ?test pour la scène de test du moteur, ?level=heart ou ?level=lungs pour ouvrir un niveau.
 */
import { Engine } from './core/Engine.js';
import { XRManager } from './core/XRManager.js';
import { DesktopControls } from './core/DesktopControls.js';
import { Interaction } from './systems/Interaction.js';
import { Teleport } from './systems/Teleport.js';
import { createTestScene } from './debug/TestScene.js';
import { createBodyScene } from './scenes/BodyScene.js';
import { LevelManager } from './core/LevelManager.js';
import { HeartLevel } from './levels/HeartLevel.js';
import { LungsLevel } from './levels/LungsLevel.js';
import { BrainLevel } from './levels/BrainLevel.js';
import { gameState } from './data/GameState.js';
import { eventBus, EVENTS } from './systems/EventBus.js';
import { restoreProgress, bindProgressAutoSave } from './data/Storage.js';

const home = document.getElementById( 'home' );
const status = document.getElementById( 'status' );

// 1. Moteur
const engine = new Engine( document.getElementById( 'app' ) );
await engine.init();

// Restaurer les niveaux déjà réussis AVANT toute navigation (IndexedDB, EF-10).
await restoreProgress( gameState );
const persistence = bindProgressAutoSave( gameState, eventBus );

function updateProgressSummary() {
	const summary = document.getElementById( 'progress-summary' );
	if ( ! summary ) return;
	const names = { heart: 'Cœur', lungs: 'Poumons', brain: 'Cerveau' };
	const ids = Object.keys( names );
	const completed = ids.filter( ( id ) => Boolean( gameState.results[ id ] ) ).length;
	summary.textContent = `${completed} / 3 missions réussies · Progression locale`;
	const nextLevel = ids.find( ( id ) => gameState.isUnlocked( id ) && ! gameState.results[ id ] );
	const resumeButton = document.getElementById( 'btn-resume' );
	if ( resumeButton ) {
		resumeButton.hidden = completed === 0 || ! nextLevel;
		resumeButton.dataset.level = nextLevel ?? '';
		if ( nextLevel ) resumeButton.textContent = `Reprendre : ${names[ nextLevel ]}`;
	}
	for ( const id of ids ) {
		const indicator = document.querySelector( `[data-progress-level=\"${id}\"]` );
		if ( ! indicator ) continue;
		const state = gameState.results[ id ] ? 'Réussi' : gameState.isUnlocked( id ) ? 'Accessible' : 'Verrouillé';
		indicator.textContent = state;
		indicator.dataset.state = gameState.results[ id ] ? 'done' : gameState.isUnlocked( id ) ? 'available' : 'locked';
	}
}

eventBus.on( EVENTS.MISSION_SUCCESS, updateProgressSummary );
eventBus.on( EVENTS.LEVEL_UNLOCKED, updateProgressSummary );
updateProgressSummary();

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

// 5. Scènes et niveaux, gérés par le LevelManager (un seul en mémoire à la fois).
const levels = new LevelManager( { engine, interaction, teleport } );

// Scène de départ : le corps humain. Sélectionner le cœur lance le niveau 1.
levels.register( 'home', ( ctx ) => {

	let dispose = null;
	return {
		start: () => {

			dispose = createBodyScene( { ...ctx, onOrganSelected: ( organ ) => ctx.levels.load( organ ) } );

		},
		dispose: () => dispose && dispose()
	};

} );

// Niveaux (classes de Melek et de Zaineb, basées sur BaseLevel).
levels.register( 'heart', ( ctx ) => new HeartLevel( { scene: ctx.engine.scene, camera: ctx.engine.camera } ) );
levels.register( 'lungs', ( ctx ) => new LungsLevel( { scene: ctx.engine.scene, camera: ctx.engine.camera } ) );
levels.register( 'brain', ( ctx ) => new BrainLevel( { scene: ctx.engine.scene, camera: ctx.engine.camera } ) );

// Reprendre directement le premier niveau débloqué et non encore terminé.
// La capture de la souris doit venir du clic, pas d'une continuation asynchrone.
document.getElementById( 'btn-resume' ).addEventListener( 'click', () => {
	const id = document.getElementById( 'btn-resume' ).dataset.level;
	if ( ! id || ! gameState.isUnlocked( id ) ) return;
	levels.load( id ).catch( ( error ) => {
		status.textContent = `Impossible de reprendre le niveau : ${error.message}`;
		desktop.unlock();
	} );
	desktop.lock();
} );

// Adresse : ?test → scène de test du moteur ; ?level=lungs → ouvre directement un niveau (pour tester).
const params = new URLSearchParams( location.search );
if ( params.has( 'test' ) ) createTestScene( { engine, interaction, teleport } );
else {
	const requested = params.get( 'level' );
	const allowed = requested && levels.has( requested ) && ( requested === 'home' || gameState.isUnlocked( requested ) );
	await levels.load( allowed ? requested : 'home' );
	if ( requested && ! allowed ) status.textContent = `Niveau « ${requested} » verrouillé ou inconnu : termine d'abord la mission précédente.`;
}

// 6. Compteur d'images/s, seulement en développement (retiré du build).
if ( import.meta.env.DEV ) {

	const { default: Stats } = await import( 'three/addons/libs/stats.module.js' );
	const stats = new Stats();
	stats.dom.style.zIndex = '20'; // au-dessus de l'écran d'accueil
	document.body.appendChild( stats.dom );
	engine.onUpdate( () => stats.update() );

	// Accès depuis la console du navigateur pour déboguer : window.app.engine, etc.
	window.app = { engine, xr, desktop, interaction, teleport, levels, gameState, persistence };

}

engine.start();