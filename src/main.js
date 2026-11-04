/**
 * Point d'entrée de l'application Inside Human VR.
 * Initialise le moteur et charge la scène de départ.
 */
import { Engine } from './core/Engine.js';

const engine = new Engine( document.body );
await engine.init();
engine.start();
