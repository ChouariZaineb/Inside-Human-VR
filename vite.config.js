import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * HTTPS local (facultatif) : si un certificat mkcert existe dans ./certs ou ./certificates,
 * le serveur de développement l'utilise. Utile pour tester sur un vrai casque en réseau local.
 * Sans certificat, Vite reste en HTTP : localhost suffit pour WebXR.
 */
function localHttps() {

	for ( const name of [ 'certs', 'certificates' ] ) {

		const dir = path.resolve( name );
		if ( ! fs.existsSync( dir ) ) continue;
		const key = fs.readdirSync( dir ).find( ( f ) => f.endsWith( '-key.pem' ) );
		if ( ! key ) continue;
		const cert = key.replace( '-key.pem', '.pem' );
		if ( fs.existsSync( path.join( dir, cert ) ) ) {

			return { key: fs.readFileSync( path.join( dir, key ) ), cert: fs.readFileSync( path.join( dir, cert ) ) };

		}

	}

	return undefined;

}


/**
 * Charge Three.js r187 depuis jsDelivr au lieu du paquet local.
 * Nous ne modifions pas les imports applicatifs : Vite les transforme en URL
 * pendant le dev ET le build, puis le navigateur charge les modules via HTTPS.
 * Les dépendances transitives ('three') utilisent l'import map HTML.
 */
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.187.0';

function threeCdnPlugin() {

	return {
		name: 'inside-human-three-cdn',
		enforce: 'pre',
		transform( code, id ) {

			const file = id.split( '?' )[ 0 ].replaceAll( '\\', '/' );
			if ( ! /\/(src|sandbox)\/.*\.js$/.test( file ) ) return null;

			const changed = code.replace(
				/(\bfrom\s*|\bimport\s*\(\s*)(['"])(three(?:\/webgpu|\/tsl|\/addons\/[^'"\s)]+)?)\2/g,
				( match, prefix, quote, id ) => {

					let path;
					if ( id === 'three' || id === 'three/webgpu' ) path = '/build/three.webgpu.js';
					else if ( id === 'three/tsl' ) path = '/build/three.tsl.js';
					else if ( id.startsWith( 'three/addons/' ) ) path = '/examples/jsm/' + id.slice( 'three/addons/'.length );
					else return match;
					return prefix + quote + THREE_CDN + path + quote;

				}
			);

			return changed === code ? null : { code: changed, map: null };

		}
	};

}

export default defineConfig( {
	// Chemins relatifs : le build fonctionne aussi sous un sous-dossier (GitHub Pages).
	base: './',
	server: { https: localHttps(), host: true },
	optimizeDeps: {
		noDiscovery: true
	},
	plugins: [ threeCdnPlugin() ],
	build: {
		rollupOptions: { external: ( id ) => id.startsWith( THREE_CDN + '/' ) },
		// WebGPU n'existe que sur des navigateurs récents : on cible ES2022+ (top-level await).
		target: 'esnext',
		// Three.js WebGPU est volumineux : on relève le seuil d'avertissement.
		chunkSizeWarningLimit: 2000
	}
} );
