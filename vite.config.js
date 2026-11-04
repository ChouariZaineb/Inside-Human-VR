// Configuration Vite du projet Inside Human VR.
import { defineConfig } from 'vite';

export default defineConfig( {
	// Chemins relatifs : le build fonctionne aussi sous un sous-dossier (GitHub Pages).
	base: './',
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
