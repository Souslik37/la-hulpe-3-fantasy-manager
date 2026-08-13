/**
 * La Hulpe 3 Fantasy Manager — Modal générique
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const { el, clear, escapeHtml } = window.LH3.utils.dom;

  function close() {
    const root = document.getElementById('modal-root');
    clear(root);
  }

  /**
   * open({ title, body: Node|string, actions: [{label, className, onClick, closeOnClick}] })
   */
  function open(opts) {
    const root = document.getElementById('modal-root');
    clear(root);

    const bodyWrap = el('div', { className: 'modal-body' });
    if (typeof opts.body === 'string') bodyWrap.innerHTML = opts.body;
    else if (opts.body instanceof Node) bodyWrap.appendChild(opts.body);

    const actionsWrap = el('div', { className: 'modal-actions' },
      (opts.actions || []).map((a) => {
        const btn = el('button', {
          className: 'btn ' + (a.className || ''),
          onClick: () => {
            if (a.onClick) a.onClick(btn);
            if (a.closeOnClick !== false) close();
          },
        }, [a.label]);
        return btn;
      })
    );

    const box = el('div', { className: 'modal-box' }, [
      el('div', { className: 'modal-head' }, [
        el('h2', {}, [escapeHtml(opts.title || '')]),
        el('button', { className: 'modal-close', onClick: close }, ['✕']),
      ]),
      bodyWrap,
      actionsWrap,
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      onClick: (e) => { if (e.target === overlay && opts.dismissable !== false) close(); },
    }, [box]);

    root.appendChild(overlay);
    return { close, box };
  }

  window.LH3.components.modal = { open, close };
})();
