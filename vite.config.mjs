import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * HTTPS local (facultatif) : si un certificat mkcert existe dans ./certs ou ./certificates (racine du projet),
 * le serveur de développement l'utilise. Utile pour tester sur un vrai casque en réseau local.
 * Sans certificat, Vite reste en HTTP : localhost suffit pour WebXR.
 */
function localHttps() {

	for ( const name of [ 'certs', 'certificates' ] ) {

		// Depuis la racine du projet (dossier de ce fichier), pas depuis « root: 'src' ».
		const dir = path.resolve( import.meta.dirname, name );
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

/** Dossier des sources de l'application (racine de Vite). */
const SRC = path.resolve( import.meta.dirname, 'src' );
const SRC_POSIX = SRC.replaceAll( '\\', '/' );

function threeCdnPlugin() {

	return {
		name: 'inside-human-three-cdn',
		enforce: 'pre',
		transform( code, id ) {

			const file = id.split( '?' )[ 0 ].replaceAll( '\\', '/' );
			// Tout fichier .mjs/.js de l'application, sous src/ (scripts, pages, Service Worker).
			if ( ! file.startsWith( SRC_POSIX + '/' ) || ! /\.m?js$/.test( file ) ) return null;

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

/** Type des fichiers statiques servis en développement. */
const STATIC_TYPES = {
	'.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm',
	'.glb': 'model/gltf-binary', '.png': 'image/png', '.webmanifest': 'application/manifest+json'
};

/**
 * Fichiers servis tels quels (ni hachés, ni transformés) : modèles 3D, décodeur Draco, missions,
 * icônes, Service Worker et manifeste. Leur URL doit rester fixe, car le code les charge par leur nom
 * (assets/models/heart.glb, ./sw.mjs…). Ce plugin remplace l'ancien dossier public/ :
 *   - en développement, il les sert directement depuis src/ : sans lui, Vite transformerait les .js
 *     du décodeur Draco et sw.mjs comme des modules de l'application ;
 *   - à la fin du build, il les copie dans dist/.
 */
function staticFilesPlugin() {

	let outDir;
	return {
		name: 'inside-human-static-files',
		configResolved( config ) {

			// Copie seulement pendant un build (Vite appelle aussi closeBundle à l'arrêt du serveur de dev).
			if ( config.command === 'build' ) outDir = path.resolve( config.root, config.build.outDir );

		},
		configureServer( server ) {

			server.middlewares.use( ( req, res, next ) => {

				const [ pathname, query ] = req.url.split( '?' );
				if ( query && /\b(import|url|raw|inline)\b/.test( query ) ) return next(); // import géré par Vite
				const url = decodeURIComponent( pathname );
				if ( ! url.startsWith( '/assets/' ) && url !== '/sw.mjs' && url !== '/manifest.webmanifest' ) return next();

				const file = path.join( SRC, url );
				if ( ! file.startsWith( SRC + path.sep ) || ! fs.existsSync( file ) || ! fs.statSync( file ).isFile() ) return next();

				res.setHeader( 'Content-Type', STATIC_TYPES[ path.extname( file ) ] ?? 'application/octet-stream' );
				res.setHeader( 'Cache-Control', 'no-cache' );
				fs.createReadStream( file ).pipe( res );

			} );

		},
		closeBundle() {

			if ( ! outDir ) return;

			fs.cpSync( path.join( SRC, 'assets' ), path.join( outDir, 'assets' ), { recursive: true } );
			for ( const file of [ 'sw.mjs', 'manifest.webmanifest' ] ) fs.copyFileSync( path.join( SRC, file ), path.join( outDir, file ) );

		}
	};

}

/** Pages d'essai de src/pages/, construites en plus de l'accueil. */
const PAGES = [ 'atlas', 'biologie', 'body', 'organs', 'xray' ];

export default defineConfig( {
	// Les sources de l'application sont dans src/ (pages, scripts, styles, assets).
	root: 'src',
	// Chemins relatifs : le build fonctionne aussi sous un sous-dossier (GitHub Pages).
	base: './',
	// Pas de dossier public/ : les fichiers statiques sont copiés par staticFilesPlugin().
	publicDir: false,
	server: { https: localHttps(), host: true },
	optimizeDeps: {
		noDiscovery: true
	},
	plugins: [ threeCdnPlugin(), staticFilesPlugin() ],
	build: {
		// Le résultat reste dans dist/, à la racine du projet (publié sur GitHub Pages).
		outDir: '../dist',
		emptyOutDir: true,
		rollupOptions: {
			// Plusieurs pages : l'accueil et les pages d'essai.
			input: {
				main: path.join( SRC, 'index.html' ),
				...Object.fromEntries( PAGES.map( ( name ) => [ name, path.join( SRC, 'pages', `${name}.html` ) ] ) )
			},
			external: ( id ) => id.startsWith( THREE_CDN + '/' )
		},
		// WebGPU n'existe que sur des navigateurs récents : on cible ES2022+ (top-level await).
		target: 'esnext',
		// Three.js WebGPU est volumineux : on relève le seuil d'avertissement.
		chunkSizeWarningLimit: 2000
	}
} );
