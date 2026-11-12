/**
 * pwa.js — Enregistrement du Service Worker (Progressive Web App).
 *
 * - Enregistre public/sw.js : l'application devient installable et fonctionne hors ligne.
 * - Envoie au Service Worker la liste des fichiers déjà chargés par la page, pour qu'ils
 *   soient disponibles hors ligne dès la première visite.
 * - Affiche l'état de la connexion dans un badge toujours visible (« En ligne » / « Hors ligne »).
 * - Affiche un bouton « Installer l'application » quand le navigateur propose l'installation.
 *
 * @author Chouari Zaineb
 * @date   2026-11-12
 * @role   PWA : Service Worker, badge de connexion, installation.
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

/**
 * Badge de connexion : vert « En ligne », orange clignotant « Hors ligne · mode cache ».
 * Mis à jour par les événements 'online' et 'offline' du navigateur.
 */
export function initNetworkBadge() {

	const badge = document.getElementById( 'net-badge' );
	const label = document.getElementById( 'net-label' );
	if ( ! badge || ! label ) return;

	const update = () => {

		const online = navigator.onLine;
		badge.dataset.state = online ? 'online' : 'offline';
		label.textContent = online ? 'En ligne' : 'Hors ligne · mode cache';
		console.info( online ? '[PWA] En ligne' : '[PWA] Hors ligne : l\'application continue depuis le cache' );

	};

	window.addEventListener( 'online', update );
	window.addEventListener( 'offline', update );
	update();

}

/**
 * Bouton « Installer l'application ».
 * Le navigateur émet 'beforeinstallprompt' quand l'application est installable (manifeste,
 * Service Worker, HTTPS ou localhost) : on garde cet événement et on affiche le bouton ;
 * au clic, prompt() ouvre la fenêtre d'installation du navigateur.
 */
export function initInstallButton() {

	const button = document.getElementById( 'btn-install' );
	if ( ! button ) return;

	let deferredPrompt = null;

	window.addEventListener( 'beforeinstallprompt', ( event ) => {

		event.preventDefault(); // on remplace la bannière du navigateur par notre bouton
		deferredPrompt = event;
		button.hidden = false;

	} );

	button.addEventListener( 'click', async () => {

		if ( ! deferredPrompt ) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		console.info( `[PWA] Installation : ${outcome === 'accepted' ? 'acceptée' : 'refusée'}` );
		deferredPrompt = null;
		button.hidden = true;

	} );

	window.addEventListener( 'appinstalled', () => {

		button.hidden = true;
		console.info( '[PWA] Application installée' );

	} );

	// Déjà lancée comme application installée : pas de bouton.
	if ( window.matchMedia( '(display-mode: standalone)' ).matches ) button.hidden = true;

}
