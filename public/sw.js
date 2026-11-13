/**
 * sw.js — Service Worker d'Inside Human VR (fonctionnement hors ligne de la PWA).
 *
 * Stratégie « réseau d'abord, cache en secours » :
 *   - en ligne : chaque fichier est téléchargé normalement, et une copie est rangée dans le cache ;
 *   - hors ligne : le fichier est servi depuis le cache.
 * Ainsi, après une première visite complète, toute l'application fonctionne sans connexion,
 * et une nouvelle version déployée est prise en compte dès qu'on est en ligne.
 *
 * Au premier chargement, la page s'affiche AVANT que le Service Worker soit actif : pwa.js lui envoie
 * alors la liste des fichiers déjà chargés (message CACHE_URLS) pour qu'il les range aussi.
 */
const CACHE = 'inside-human-vr-v2';

/** Coquille de l'application, rangée dès l'installation. */
const APP_SHELL = [
	'./',
	'./index.html',
	'./styles.css',
	'./manifest.webmanifest',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
	'./icons/icon-maskable-512.png',
	'./assets/content/levels.json'
];

// Installation : on range la coquille de l'application.
self.addEventListener( 'install', ( event ) => {

	event.waitUntil(
		caches.open( CACHE )
			.then( ( cache ) => Promise.allSettled( APP_SHELL.map( ( url ) => cache.add( url ) ) ) )
			.then( () => self.skipWaiting() )
	);

} );

// Activation : on supprime les anciens caches et on prend le contrôle des pages ouvertes.
self.addEventListener( 'activate', ( event ) => {

	event.waitUntil(
		caches.keys()
			.then( ( keys ) => Promise.all( keys.filter( ( key ) => key !== CACHE ).map( ( key ) => caches.delete( key ) ) ) )
			.then( () => self.clients.claim() )
	);

} );

// Requêtes : réseau d'abord, cache en secours.
self.addEventListener( 'fetch', ( event ) => {

	const request = event.request;
	const url = new URL( request.url );

	// Seulement les GET de notre propre site (pas le serveur de développement en direct, pas les autres sites).
	if ( request.method !== 'GET' || url.origin !== self.location.origin ) return;
	if ( url.pathname.startsWith( '/@vite' ) || url.search.includes( 'token=' ) ) return;

	event.respondWith(
		fetch( request )
			.then( ( response ) => {

				if ( response.ok ) {

					const copy = response.clone();
					caches.open( CACHE ).then( ( cache ) => cache.put( request, copy ) );

				}

				return response;

			} )
			.catch( async () => {

				// ignoreVary : les fichiers rangés à l'installation n'avaient pas l'en-tête Origin
				// que le navigateur ajoute aux scripts « crossorigin » de Vite.
				const cached = await caches.match( request, { ignoreVary: true, ignoreSearch: request.mode === 'navigate' } );
				if ( cached ) return cached;

				// Page demandée hors ligne et absente du cache : on sert l'accueil.
				if ( request.mode === 'navigate' ) return caches.match( './index.html' );
				return Response.error();

			} )
	);

} );

// Message de la page : ranger les fichiers déjà chargés avant l'activation.
self.addEventListener( 'message', ( event ) => {

	if ( ! event.data || event.data.type !== 'CACHE_URLS' ) return;

	event.waitUntil(
		caches.open( CACHE ).then( ( cache ) => Promise.allSettled(
			event.data.urls.map( ( url ) => cache.match( url, { ignoreVary: true } ).then( ( hit ) => hit || cache.add( url ) ) )
		) )
	);

} );
