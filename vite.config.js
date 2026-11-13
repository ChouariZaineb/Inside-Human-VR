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

export default defineConfig( {
	// Chemins relatifs : le build fonctionne aussi sous un sous-dossier (GitHub Pages).
	base: './',
	server: { https: localHttps(), host: true },
	resolve: {
		// Les addons de Three.js importent 'three' : on les redirige vers 'three/webgpu'
		// pour n'avoir qu'une seule instance de Three.js (celle du WebGPURenderer).
		alias: [ { find: /^three$/, replacement: 'three/webgpu' } ]
	},
	build: {
		// WebGPU n'existe que sur des navigateurs récents : on cible ES2022+ (top-level await).
		target: 'esnext',
		// Three.js WebGPU est volumineux : on relève le seuil d'avertissement.
		chunkSizeWarningLimit: 2000
	}
} );
