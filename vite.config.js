// Configuration Vite du projet Inside Human VR.
import { defineConfig } from 'vite';

export default defineConfig( {
	// Chemins relatifs : le build fonctionne aussi sous un sous-dossier (GitHub Pages).
	base: './',
	build: {
		// WebGPU n'existe que sur des navigateurs récents : on cible ES2022+ (top-level await).
		target: 'esnext'
	}
} );
