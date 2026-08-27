/**
 * La Hulpe 3 Fantasy Manager — Modal générique
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const { el, clear } = window.LH3.utils.dom;

  function close() {
    const root = document.getElementById('modal-root');
    clear(root);
  }

  /**
   * open({ title, body: Node|string, actions: [{label, className, onClick, closeOnClick}], onClose })
   *
   * `onClose` (optionnel) se déclenche pour TOUTE façon de fermer cette
   * modale précise (✕, clic hors-modale, ou une action dont closeOnClick
   * n'est pas à false) — jamais pour un simple appel global à
   * `modal.close()` fait par un AUTRE écran. Sert par ex. à annuler un
   * brouillon non explicitement sauvegardé (voir pages/myTeam.js).
   */
  function open(opts) {
    const root = document.getElementById('modal-root');
    clear(root);

    function closeThis() {
      close();
      if (opts.onClose) opts.onClose();
    }

    const bodyWrap = el('div', { className: 'modal-body' });
    if (typeof opts.body === 'string') bodyWrap.innerHTML = opts.body;
    else if (opts.body instanceof Node) bodyWrap.appendChild(opts.body);

    const actionsWrap = el('div', { className: 'modal-actions' },
      (opts.actions || []).map((a) => {
        const btn = el('button', {
          className: 'btn ' + (a.className || ''),
          onClick: () => {
            if (a.onClick) a.onClick(btn);
            if (a.closeOnClick !== false) closeThis();
          },
        }, [a.label]);
        return btn;
      })
    );

    const box = el('div', { className: 'modal-box' }, [
      el('div', { className: 'modal-head' }, [
        el('h2', {}, [opts.title || '']),
        el('button', { className: 'modal-close', onClick: closeThis }, ['✕']),
      ]),
      bodyWrap,
      actionsWrap,
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      onClick: (e) => { if (e.target === overlay && opts.dismissable !== false) closeThis(); },
    }, [box]);

    root.appendChild(overlay);
    return { close: closeThis, box };
  }

  window.LH3.components.modal = { open, close };
})();
