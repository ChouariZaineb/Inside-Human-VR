/**
 * playwright.config.js — Tests d'intégration automatisés (de bout en bout) d'Inside Human VR.
 *
 * @author Chouari Zaineb
 * @date   2026-11-12
 * @role   Qualité : un vrai navigateur Chrome ouvre l'application, simule un casque Meta Quest 3
 *         (moteur d'émulation « iwer » de Meta, celui d'Immersive Web Emulator) et vérifie le
 *         rendu WebGPU, la session WebXR, les interactions VR et la PWA hors ligne.
 *
 * Lancement : npm run test:e2e          (fenêtre visible : on voit le test jouer)
 *             npm run test:e2e:report   (ouvre le rapport HTML du dernier passage)
 *
 * Deux serveurs sont démarrés automatiquement :
 *   - le serveur de développement (port 5173) pour les tests fonctionnels ;
 *   - la version de production (npm run build, puis port 4173) pour le test PWA hors ligne.
 */
import { defineConfig } from '@playwright/test';
import fs from 'fs';

// Le projet passe en HTTPS si un certificat mkcert existe (voir vite.config.js).
const hasCertificate = [ 'certs', 'certificates' ].some( ( dir ) =>
	fs.existsSync( dir ) && fs.readdirSync( dir ).some( ( file ) => file.endsWith( '-key.pem' ) ) );
const protocol = hasCertificate ? 'https' : 'http';

export const DEV_URL = `${protocol}://localhost:5173`;
export const PREVIEW_URL = `${protocol}://localhost:4173`;

// WebGPU est obligatoire : sous Windows et macOS, on utilise le Chrome installé (vraie carte graphique) ;
// sous Linux (machine d'intégration continue), WebGPU passe par SwiftShader (rendu logiciel).
const linux = process.platform === 'linux';
const args = [ '--enable-unsafe-webgpu' ];
if ( linux ) args.push( '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface' );

export default defineConfig( {
	testDir: './tests/e2e',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [ [ 'list' ], [ 'html', { open: 'never' } ] ],

	use: {
		baseURL: DEV_URL,
		channel: linux ? undefined : 'chrome',
		headless: process.env.HEADLESS === '1',
		viewport: { width: 1280, height: 720 },
		ignoreHTTPSErrors: true,
		launchOptions: { args },
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	},

	webServer: [
		{
			command: 'npx vite --port 5173 --strictPort',
			url: DEV_URL,
			ignoreHTTPSErrors: true,
			reuseExistingServer: true,
			timeout: 60_000
		},
		{
			command: 'npx vite build && npx vite preview --port 4173 --strictPort',
			url: PREVIEW_URL,
			ignoreHTTPSErrors: true,
			reuseExistingServer: true,
			timeout: 120_000
		}
	]
} );
