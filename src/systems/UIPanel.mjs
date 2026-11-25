/**
 * UIPanel.js — Panneaux d'information flottants dans la scène 3D (interface diégétique).
 *
 * Le texte est dessiné sur un canvas 2D puis affiché comme texture sur un plan.
 * Fonctionne pareil en VR et en mode bureau, accepte les accents français,
 * et ne demande aucun fichier de police externe.
 *
 * Exemple :
 *   const panel = new UIPanel({ width: 1.6, height: 1.0 });
 *   panel.setContent({ title: 'Bienvenue', body: 'Voici ta mission…', variant: 'info' });
 *   panel.setPosition(0, 1.7, -2);
 *   scene.add(panel.mesh);
 *   // à chaque image : panel.update(camera);  (le panneau se tourne vers le joueur)
 */
import * as THREE from 'three/webgpu';

/** Couleurs par variante de panneau. */
const THEMES = {
  info: { bg: 'rgba(8, 24, 48, 0.92)', border: '#4fc3f7', title: '#ffffff', body: '#e3f2fd', footer: '#90caf9' },
  success: { bg: 'rgba(8, 42, 28, 0.92)', border: '#66bb6a', title: '#ffffff', body: '#e8f5e9', footer: '#a5d6a7' },
  error: { bg: 'rgba(56, 14, 14, 0.92)', border: '#ef5350', title: '#ffffff', body: '#ffebee', footer: '#ef9a9a' },
  button: { bg: 'rgba(20, 90, 160, 0.95)', border: '#ffffff', title: '#ffffff', body: '#ffffff', footer: '#ffffff' },
};

/** Pixels de texture par mètre : 640 donne des textes lisibles à 2 m (ENF-06). */
const PIXELS_PER_METER = 640;

/**
 * Découpe un texte en lignes qui tiennent dans maxWidth (les \n sont respectés).
 * @param {CanvasRenderingContext2D} ctx Contexte avec la police déjà définie.
 * @param {string} text
 * @param {number} maxWidth En pixels.
 * @returns {string[]}
 */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export class UIPanel {
  /**
   * @param {object} [options]
   * @param {number} [options.width=1.6] Largeur en mètres.
   * @param {number} [options.height=1.0] Hauteur en mètres.
   * @param {'info'|'success'|'error'|'button'} [options.variant='info']
   * @param {boolean} [options.billboard=true] Se tourne vers le joueur (rotation verticale uniquement).
   */
  constructor({ width = 1.6, height = 1.0, variant = 'info', billboard = true } = {}) {
    this.width = width;
    this.height = height;
    this.variant = variant;
    this.billboard = billboard;

    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(width * PIXELS_PER_METER);
    this.canvas.height = Math.round(height * PIXELS_PER_METER);
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false, side: THREE.DoubleSide }),
    );
    this.mesh.name = 'UIPanel';
    /** Permet de retrouver le panneau depuis un objet pointé (raycasting). */
    this.mesh.userData.panel = this;

    this._target = new THREE.Vector3();
    this._world = new THREE.Vector3();
  }

  /**
   * Met à jour le contenu et redessine le panneau.
   * @param {object} content
   * @param {string} [content.title]
   * @param {string} [content.body]
   * @param {string} [content.footer] Petit texte en bas (ex. « Étape 2 sur 4 »).
   * @param {'info'|'success'|'error'|'button'} [content.variant]
   */
  setContent({ title = '', body = '', footer = '', variant = this.variant } = {}) {
    this.variant = variant;
    const theme = THEMES[variant] ?? THEMES.info;
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const pad = Math.round(W * 0.05);
    const font = (px, weight = 'normal') => `${weight} ${px}px system-ui, "Segoe UI", Arial, sans-serif`;

    ctx.clearRect(0, 0, W, H);

    // Fond arrondi + bordure
    ctx.fillStyle = theme.bg;
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(3, 3, W - 6, H - 6, 28);
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.textAlign = variant === 'button' ? 'center' : 'left';
    const x = variant === 'button' ? W / 2 : pad;
    const maxWidth = W - pad * 2;
    let y = pad;

    // Titre
    if (title) {
      const titleSize = variant === 'button' ? Math.round(H * 0.4) : Math.round(H * 0.075);
      ctx.font = font(titleSize, 'bold');
      ctx.fillStyle = theme.title;
      const titleLines = wrapText(ctx, title, maxWidth);
      const lineH = Math.round(titleSize * 1.2);
      if (variant === 'button') y = Math.round((H - titleLines.length * lineH) / 2);
      for (const line of titleLines) {
        ctx.fillText(line, x, y);
        y += lineH;
      }
      if (variant !== 'button') {
        y += 8;
        ctx.fillStyle = theme.border;
        ctx.fillRect(pad, y, maxWidth, 3);
        y += 22;
      }
    }

    // Pied de page (réservé en bas)
    const footerSize = Math.round(H * 0.05);
    const footerSpace = footer ? footerSize + pad : 0;

    // Corps : la taille de police diminue jusqu'à ce que le texte tienne
    if (body) {
      const available = H - y - pad - footerSpace;
      let size = Math.round(H * 0.058);
      let lines;
      let lineH;
      do {
        ctx.font = font(size);
        lines = wrapText(ctx, body, maxWidth);
        lineH = Math.round(size * 1.3);
        if (lines.length * lineH <= available || size <= 20) break;
        size -= 2;
      } while (true);
      ctx.fillStyle = theme.body;
      for (const line of lines) {
        ctx.fillText(line, x, y);
        y += lineH;
      }
    }

    // Pied de page
    if (footer) {
      ctx.font = font(footerSize);
      ctx.fillStyle = theme.footer;
      ctx.fillText(footer, x, H - pad - footerSize);
    }

    this.texture.needsUpdate = true;
  }

  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z);
  }

  /** Affiche le panneau. */
  show() {
    this.mesh.visible = true;
  }

  /** Cache le panneau (il reste en mémoire). */
  hide() {
    this.mesh.visible = false;
  }

  /**
   * À appeler à chaque image : tourne le panneau vers le joueur (axe vertical uniquement).
   * @param {THREE.Camera} camera
   */
  update(camera) {
    if (!this.billboard || !camera || !this.mesh.visible) return;
    camera.getWorldPosition(this._target);
    this.mesh.getWorldPosition(this._world);
    this.mesh.lookAt(this._target.x, this._world.y, this._target.z);
  }

  /** Libère la mémoire GPU. */
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}
