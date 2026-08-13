/**
 * La Hulpe 3 Fantasy Manager — Redimensionnement d'image générique
 *
 * Recadre en carré + compresse une image choisie par l'utilisateur en
 * data URI JPEG, pour la stocker directement dans un champ avatar_url (pas
 * de vieillissement/filtre ici, voir utils/oldPhoto.js pour ça — juste un
 * import propre et léger, sans dépendre d'un hébergement externe).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.utils = window.LH3.utils || {};

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /** file: un File venant d'un <input type="file"> — renvoie une Promise<dataURI JPEG>. */
  function toDataUri(file, size, quality) {
    size = size || 400;
    quality = quality || 0.85;
    return loadImage(file).then((img) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

      return canvas.toDataURL('image/jpeg', quality);
    });
  }

  window.LH3.utils.imageResize = { toDataUri };
})();
