/**
 * La Hulpe 3 Fantasy Manager — Toasts (notifications éphémères)
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  function show(message, type) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const toast = window.LH3.utils.dom.el('div', { className: 'toast ' + (type || '') }, [message]);
    root.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  window.LH3.components.toast = { show };
})();
