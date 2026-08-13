/**
 * La Hulpe 3 Fantasy Manager — Filtre "vieux coach"
 *
 * Pas un vrai vieillissement (ça demanderait un modèle IA côté serveur,
 * hors de portée d'un site 100% statique) — un traitement photo à
 * l'ancienne (désaturation/sépia, grain, vignettage) qui donne l'air d'une
 * vieille photo de coach retrouvée dans les archives du club. Tourne
 * entièrement dans le navigateur via Canvas, rien n'est envoyé nulle part.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.utils = window.LH3.utils || {};

  const SIZE = 240;

  function clampByte(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /** file: un File venant d'un <input type="file"> — renvoie une Promise<dataURI JPEG>. */
  function applyFilter(file) {
    return loadImage(file).then((img) => {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      // Recadrage centré façon "cover", pour remplir le carré sans déformer.
      const scale = Math.max(SIZE / img.width, SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (SIZE - w) / 2;
      const y = (SIZE - h) / 2;

      ctx.filter = 'grayscale(0.35) sepia(0.55) contrast(1.15) brightness(0.92) saturate(0.7)';
      ctx.drawImage(img, x, y, w, h);
      ctx.filter = 'none';

      // Grain — un vrai bruit par pixel, pas un filtre CSS, pour l'effet pellicule.
      const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 28;
        data[i] = clampByte(data[i] + noise);
        data[i + 1] = clampByte(data[i + 1] + noise);
        data[i + 2] = clampByte(data[i + 2] + noise);
      }
      ctx.putImageData(imageData, 0, 0);

      // Vignettage — assombrit les bords, façon tirage argentique.
      const gradient = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.32, SIZE / 2, SIZE / 2, SIZE * 0.7);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(35,25,15,0.55)');
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.globalCompositeOperation = 'source-over';

      return canvas.toDataURL('image/jpeg', 0.85);
    });
  }

  window.LH3.utils.oldPhoto = { applyFilter };
})();
