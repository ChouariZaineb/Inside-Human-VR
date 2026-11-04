/**
 * Point d'entrée de l'application Inside Human VR.
 * Initialise le moteur et charge la scène de départ.
 */
import { Engine } from './core/Engine.js';
import { XRManager } from './core/XRManager.js';
import { DesktopControls } from './core/DesktopControls.js';
import { Interaction } from './systems/Interaction.js';
import { Teleport } from './systems/Teleport.js';

const engine = new Engine( document.getElementById( 'app' ) );
await engine.init();

const xr = new XRManager( engine, document.getElementById( 'btn-vr' ) );
await xr.init();

const desktop = new DesktopControls( engine, document.getElementById( 'reticle' ) );
document.getElementById( 'btn-desktop' ).addEventListener( 'click', () => desktop.lock() );

// Le mode bureau est coupé pendant la VR.
xr.addEventListener( 'sessionstart', () => desktop.setEnabled( false ) );
xr.addEventListener( 'sessionend', () => desktop.setEnabled( true ) );

const interaction = new Interaction( engine, xr, desktop );
const teleport = new Teleport( engine, interaction );

engine.start();
