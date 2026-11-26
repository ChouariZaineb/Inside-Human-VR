/**
 * migrate-to-mjs.mjs — Passe tous les fichiers JavaScript du projet au format .mjs (modules ES).
 *
 * @author Chouari Zaineb
 * @role   Intégration : appliquer la règle « tous les fichiers en .mjs » demandée par le superviseur.
 *
 * Ce que fait le script (à lancer une seule fois, à la racine du projet) :
 *   1. liste les fichiers .js suivis par git, sauf les fichiers de bibliothèques tierces
 *      (public/draco/ : décodeur Draco fourni par Three.js, on ne modifie pas un fichier externe) ;
 *   2. les renomme en .mjs avec `git mv` (git garde l'historique de chaque fichier) ;
 *   3. corrige tous les chemins qui pointent vers ces fichiers : imports, balises <script> des pages HTML,
 *      chaînes de caractères ('./sw.mjs'…) et noms de fichiers cités dans la documentation (.md).
 *      Un chemin n'est modifié que s'il désigne vraiment un fichier renommé : les URL du CDN
 *      (three.webgpu.js) et le décodeur Draco ne sont pas touchés ;
 *   4. adapte les deux réglages qui dépendent de l'extension :
 *      - vite.config.mjs : le plugin du CDN traite aussi les fichiers .mjs ;
 *      - src/pwa.mjs : le Service Worker (public/sw.mjs) est enregistré comme module ({ type: 'module' }).
 *
 *   node tools/migrate-to-mjs.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const KEEP_JS = [ 'public/draco/' ]; // bibliothèques tierces : gardées telles quelles

const git = ( cmd ) => execSync( `git ${cmd}`, { encoding: 'utf8' } );
const tracked = git( 'ls-files' ).split( '\n' ).filter( Boolean );

// 1. Fichiers à renommer.
const toRename = tracked.filter( ( f ) => f.endsWith( '.js' ) && ! KEEP_JS.some( ( dir ) => f.startsWith( dir ) ) );
const renamed = new Set( toRename );
const basenames = new Set( toRename.map( ( f ) => path.posix.basename( f ) ) );

// 2. Renommage avec git (l'historique suit le fichier).
for ( const file of toRename ) git( `mv "${file}" "${file.replace( /\.js$/, '.mjs' )}"` );
console.log( `${toRename.length} fichiers renommés en .mjs` );

// 3. Correction des chemins dans le code, les pages et la documentation.
const textFiles = git( 'ls-files' ).split( '\n' ).filter( ( f ) => /\.(mjs|html|md|yml|json|webmanifest|css)$/.test( f ) && ! f.startsWith( 'public/draco/' ) );

/** Le chemin relatif `spec`, écrit dans `fromFile`, désigne-t-il un fichier renommé ? */
function pointsToRenamed( fromFile, spec ) {

	const dir = path.posix.dirname( fromFile );
	const candidates = [ path.posix.normalize( path.posix.join( dir, spec ) ) ];
	// Fichiers de public/ : servis à la racine du site (ex. './sw.mjs' depuis src/pwa.mjs).
	candidates.push( path.posix.normalize( path.posix.join( 'public', spec ) ) );
	// Pages HTML à la racine : './src/main.mjs'.
	candidates.push( path.posix.normalize( spec ) );
	return candidates.some( ( c ) => renamed.has( c ) );

}

let changedFiles = 0;
for ( const file of textFiles ) {

	const before = fs.readFileSync( file, 'utf8' );
	let after = before;

	if ( ! file.endsWith( '.md' ) ) {

		// Chemins relatifs entre guillemets : './x.js', "../y/z.js", `./sw.mjs`
		// (y compris dans les exemples des commentaires, écrits depuis src/ : './systems/EventBus.js').
		after = after.replace( /(['"`])(\.{1,2}\/[^'"`\s]*?)\.js\1/g, ( match, quote, spec ) => {

			const exampleFromSrc = ! spec.includes( 'draco' ) && basenames.has( `${path.posix.basename( spec )}.js` );
			return pointsToRenamed( file, `${spec}.js` ) || exampleFromSrc ? `${quote}${spec}.mjs${quote}` : match;

		} );

	}

	// Noms de fichiers cités (documentation, commentaires) : Engine.mjs → Engine.mjs, src/main.mjs → src/main.mjs
	after = after.replace( /(?<![\w./-])((?:[\w-]+\/)*)([\w-]+(?:\.[\w-]+)*)\.js(?![\w])/g, ( match, dirs, name ) => {

		if ( ! basenames.has( `${name}.js` ) ) return match;
		if ( dirs && ! [ ...renamed ].some( ( f ) => f.endsWith( `${dirs}${name}.js` ) ) ) return match;
		return `${dirs}${name}.mjs`;

	} );

	if ( after !== before ) {

		fs.writeFileSync( file, after );
		changedFiles ++;

	}

}

console.log( `${changedFiles} fichiers mis à jour (imports, pages HTML, documentation)` );

// 4. Réglages qui dépendent de l'extension des fichiers.
function patch( file, from, to ) {

	const text = fs.readFileSync( file, 'utf8' );
	if ( ! text.includes( from ) ) return console.warn( `À vérifier à la main dans ${file} : ${from}` );
	fs.writeFileSync( file, text.replace( from, to ) );

}
patch( 'vite.config.mjs', '.*\\.js$/.test( file )', '.*\\.m?js$/.test( file )' );
patch( 'src/pwa.mjs', "register( './sw.mjs', { scope: './' } )", "register( './sw.mjs', { scope: './', type: 'module' } )" );
console.log( 'vite.config.mjs et src/pwa.mjs adaptés' );