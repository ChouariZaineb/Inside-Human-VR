/**
 * pwa.js — Enregistrement du Service Worker (Progressive Web App).
 *
 * - Enregistre public/sw.js : l'application devient installable et fonctionne hors ligne.
 * - Envoie au Service Worker la liste des fichiers déjà chargés par la page, pour qu'ils
 *   soient disponibles hors ligne dès la première visite.
 * - Affiche l'état (en ligne / hors ligne) dans la console.
 *
 * Le manifeste (public/manifest.webmanifest) est déclaré dans index.html.
 */

/**
 * Enregistre le Service Worker. Sans effet si le navigateur ne le gère pas.
 * @returns {Promise<?ServiceWorkerRegistration>}
 */
export async function registerServiceWorker() {

	if ( ! ( 'serviceWorker' in navigator ) ) {

		console.info( '[PWA] Service Worker non disponible dans ce navigateur' );
		return null;

	}

	try {

		// Chemin relatif : fonctionne aussi sous un sous-dossier (GitHub Pages).
		const registration = await navigator.serviceWorker.register( './sw.js', { scope: './' } );
		console.info( `[PWA] Service Worker enregistré (portée : ${registration.scope})` );

		await navigator.serviceWorker.ready;
		cacheLoadedFiles( registration );

		window.addEventListener( 'online', () => console.info( '[PWA] En ligne' ) );
		window.addEventListener( 'offline', () => console.info( '[PWA] Hors ligne : l\'application continue depuis le cache' ) );

		return registration;

	} catch ( error ) {

		console.warn( '[PWA] Échec de l\'enregistrement du Service Worker :', error );
		return null;

	}

}

/**
 * Demande au Service Worker de ranger les fichiers déjà chargés (scripts, styles, données…).
 * @param {ServiceWorkerRegistration} registration
 */
function cacheLoadedFiles( registration ) {

	const worker = registration.active;
	if ( ! worker ) return;

	const urls = performance.getEntriesByType( 'resource' )
		.map( ( entry ) => entry.name )
		.filter( ( url ) => url.startsWith( location.origin ) && ! url.includes( '/@vite' ) && ! url.includes( 'token=' ) );

	urls.push( location.href.split( '#' )[ 0 ] );
	worker.postMessage( { type: 'CACHE_URLS', urls } );

}
