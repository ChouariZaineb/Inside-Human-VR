/**
 * Point d'entrée de l'application Inside Human VR.
 * Initialise le moteur et charge la scène de départ.
 */
import { Renderer } from './core/Renderer.js';

const view = new Renderer( document.body );
await view.init();
view.setAnimationLoop( () => view.render() );
