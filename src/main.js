/**
 * Point d'entrée de l'application Inside Human VR.
 * Initialise le moteur et charge la scène de départ.
 */
import { Engine } from './core/Engine.js';
import { XRManager } from './core/XRManager.js';

const engine = new Engine( document.getElementById( 'app' ) );
await engine.init();

const xr = new XRManager( engine, document.getElementById( 'btn-vr' ) );
await xr.init();

engine.start();
