/**
 * restructure-src.mjs — Range tout le code de l'application dans src/ (nouvelle arborescence).
 *
 * @author Chouari Zaineb
 * @role   Intégration : appliquer l'arborescence demandée par le superviseur
 *         (src/assets, src/scripts, src/pages, src/styles ; suppression de public/, sandbox/ et tests/).
 *
 * Ce que fait le script (à lancer une seule fois, à la racine du projet, sur un dépôt propre) :
 *   1. calcule, pour chaque fichier suivi par git, son nouvel emplacement (table MOVES ci-dessous) ;
 *   2. le déplace avec `git mv` (git garde l'historique de chaque fichier) ;
 *   3. recalcule les chemins relatifs entre fichiers : imports des .mjs, balises <script>/<link> des pages HTML.
 *      Un chemin n'est modifié que s'il désigne vraiment un fichier du projet (ancien emplacement connu) :
 *      les URL du CDN (three/addons/…) et les URL du site ('./sw.mjs', 'assets/models/…') ne sont pas touchées ;
 *   4. corrige les URL du site qui changent (fichiers chargés à l'exécution) :
 *      levels.json → missions.json, décodeur Draco draco/ → assets/models/draco/, icônes icons/ → assets/icons/,
 *      styles.css → styles/styles.css, et le nom du cache du Service Worker (pour forcer la mise à jour) ;
 *   5. corrige les chemins cités dans les commentaires du code (public/…, sandbox/…, src/core/…).
 *
 * La documentation (.md) et les fichiers de configuration (vite.config.mjs, playwright.config.mjs,
 * package.json, workflows) sont mis à jour à la main ensuite.
 *
 *   node tools/restructure-src.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const git = ( cmd ) => execSync( `git ${cmd}`, { encoding: 'utf8' } );
const tracked = git( 'ls-files' ).split( '\n' ).filter( Boolean );

// 1. Nouvel emplacement de chaque fichier : [ ancien préfixe, nouveau préfixe ], le premier qui correspond gagne.
const MOVES = [
	[ 'index.html', 'src/index.html' ],
	[ 'styles.css', 'src/styles/styles.css' ],
	[ 'public/manifest.webmanifest', 'src/manifest.webmanifest' ],
	[ 'public/sw.mjs', 'src/sw.mjs' ],
	// Le dossier « content » devient « missions » et le fichier est renommé : il contient les textes,
	// les explications et les missions de chaque organe.
	[ 'public/assets/content/levels.json', 'src/assets/missions/missions.json' ],
	[ 'public/assets/content/', 'src/assets/missions/' ],
	[ 'public/assets/', 'src/assets/' ],
	// Décodeur Draco (fichiers tiers, gardés en .js) : rangé avec les modèles qu'il décompresse.
	[ 'public/draco/', 'src/assets/models/draco/' ],
	[ 'public/icons/', 'src/assets/icons/' ],
	// Pages d'essai : la page HTML dans src/pages/, son script dans src/scripts/pages/.
	[ /^sandbox\/([^/]+\.html)$/, 'src/pages/$1' ],
	[ /^sandbox\/([^/]+\.mjs)$/, 'src/scripts/pages/$1' ],
	// Tests : unitaires et de bout en bout, rangés avec les scripts qu'ils vérifient.
	[ 'tests/', 'src/scripts/tests/' ],
	// Tout le JavaScript de l'application dans src/scripts/ (sous-dossiers conservés).
	[ /^src\/(main\.mjs|pwa\.mjs|(core|systems|levels|scenes|data|shaders|debug)\/.+)$/, 'src/scripts/$1' ]
];

function destination( file ) {

	for ( const [ from, to ] of MOVES ) {

		if ( from instanceof RegExp ) {

			if ( from.test( file ) ) return file.replace( from, to );

		} else if ( file === from || ( from.endsWith( '/' ) && file.startsWith( from ) ) ) {

			return to + file.slice( from.length );

		}

	}

	return null;

}

const moves = new Map(); // ancien chemin → nouveau chemin
for ( const file of tracked ) {

	const to = destination( file );
	if ( to ) moves.set( file, to );

}

// 2. Déplacement avec git (l'historique suit le fichier).
for ( const [ from, to ] of moves ) {

	fs.mkdirSync( path.dirname( to ), { recursive: true } );
	git( `mv "${from}" "${to}"` );

}

console.log( `${moves.size} fichiers déplacés avec git mv` );

const oldFiles = new Set( tracked );
const newPath = ( file ) => moves.get( file ) ?? file;
const oldPath = new Map( tracked.map( ( file ) => [ newPath( file ), file ] ) ); // nouveau → ancien

// 3. Chemins relatifs entre fichiers (imports, <script src>, <link href>).
/** Recalcule `spec`, écrit dans le fichier `newFile` (anciennement `oldFile`). */
function rewriteRelative( oldFile, newFile, spec ) {

	const target = path.posix.normalize( path.posix.join( path.posix.dirname( oldFile ), spec ) );
	if ( ! oldFiles.has( target ) ) return spec; // URL du site ou fichier externe : inchangé

	let relative = path.posix.relative( path.posix.dirname( newFile ), newPath( target ) );
	if ( ! relative.startsWith( '.' ) ) relative = `./${relative}`;
	return relative;

}

// 4. URL du site qui changent (fichiers chargés par le navigateur à l'exécution).
const URL_FIXES = [
	[ /assets\/content\/levels\.json/g, 'assets/missions/missions.json' ],
	// setDecoderPath( `${base}draco/` ) → `${base}assets/models/draco/`
	[ /\}draco\/`/g, '}assets/models/draco/`' ],
	// Service Worker et pages HTML : URL relatives à la racine du site.
	[ /(['"])\.\/draco\//g, '$1./assets/models/draco/' ],
	[ /(['"])\.\/icons\//g, '$1./assets/icons/' ],
	[ /(['"])\.\/styles\.css\1/g, '$1./styles/styles.css$1' ],
	// Manifeste : chemins des icônes relatifs au manifeste.
	[ /("src":\s*")icons\//g, '$1assets/icons/' ],
	// Pages d'essai : leur URL passe de /sandbox/xxx.html à /pages/xxx.html.
	[ /\/sandbox\/(\w+\.html)/g, '/pages/$1' ]
];

// 5. Chemins cités dans les commentaires et les messages.
const COMMENT_FIXES = [
	[ /public\/draco\//g, 'src/assets/models/draco/' ],
	[ /public\/icons\//g, 'src/assets/icons/' ],
	[ /public\/assets\/models/g, 'src/assets/models' ],
	[ /public\/(sw\.mjs|manifest\.webmanifest)/g, 'src/$1' ],
	[ /\bsrc\/(main\.mjs|pwa\.mjs|core\/|systems\/|levels\/|scenes\/|data\/|shaders\/|debug\/)/g, 'src/scripts/$1' ],
	[ /\blevels\.json\b/g, 'missions.json' ]
];

const textFiles = git( 'ls-files' ).split( '\n' ).filter( ( f ) =>
	/\.(mjs|html|webmanifest|css|py)$/.test( f ) && ! f.startsWith( 'src/assets/models/draco/' ) && f !== 'tools/migrate-to-mjs.mjs' && f !== 'tools/restructure-src.mjs' );

let changedFiles = 0;
for ( const file of textFiles ) {

	const before = fs.readFileSync( file, 'utf8' );
	const original = oldPath.get( file ) ?? file;
	let after = before;

	// Imports : from './x.mjs', import( '../y.mjs' ), et attributs src="…" / href="…" des pages HTML.
	after = after.replace( /(\bfrom\s*|\bimport\s*\(\s*|\b(?:src|href)=)(['"])(\.{1,2}\/[^'"\s]+)\2/g,
		( match, prefix, quote, spec ) => `${prefix}${quote}${rewriteRelative( original, file, spec )}${quote}` );

	for ( const [ pattern, replacement ] of [ ...URL_FIXES, ...COMMENT_FIXES ] ) after = after.replace( pattern, replacement );

	if ( after !== before ) {

		fs.writeFileSync( file, after );
		changedFiles ++;

	}

}

console.log( `${changedFiles} fichiers mis à jour (imports, pages HTML, URL chargées à l'exécution)` );

// Réglages ponctuels.
function patch( file, from, to ) {

	const text = fs.readFileSync( file, 'utf8' );
	if ( ! text.includes( from ) ) return console.warn( `À vérifier à la main dans ${file} : ${from}` );
	fs.writeFileSync( file, text.replace( from, to ) );

}

// Nouveau nom de cache : les navigateurs suppriment l'ancien cache et rangent les fichiers à leur nouvelle adresse.
patch( 'src/sw.mjs', "const CACHE = 'inside-human-vr-cdn-r187-biologie-v6';", "const CACHE = 'inside-human-vr-cdn-r187-arborescence-v1';" );
// Script Blender : les modèles générés vont dans src/assets/models/.
patch( 'tools/blender/build_biology.py', "OUT = ROOT / 'public' / 'assets' / 'models'", "OUT = ROOT / 'src' / 'assets' / 'models'" );
// Tests de bout en bout : iwer est lu depuis node_modules à la racine du projet, quel que soit le dossier courant.
patch( 'src/scripts/tests/e2e/helpers.mjs', "import path from 'path';\n", "import { fileURLToPath } from 'url';\n" );
patch( 'src/scripts/tests/e2e/helpers.mjs',
	"fs.readFileSync( path.resolve( 'node_modules/iwer/build/iwer.js' ), 'utf8' )",
	"fs.readFileSync( fileURLToPath( new URL( '../../../../node_modules/iwer/build/iwer.js', import.meta.url ) ), 'utf8' )" );
console.log( 'src/sw.mjs, build_biology.py et helpers.mjs adaptés' );
