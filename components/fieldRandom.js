/**
 * La Hulpe 3 Fantasy Manager — Champ de formulaire + régénération aléatoire
 *
 * Un champ texte (ou textarea) avec un petit bouton ↻ qui ne pioche QUE ce
 * champ-là (voir managerService.randomJob/randomAccent/...), sans toucher
 * au reste du coach — contrairement au bouton "🎲 tout régénérer" existant,
 * qui reste inchangé à côté.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const { el } = window.LH3.utils.dom;

  /** opts: { label, value, placeholder, isTextarea, onInput(value), onRandom(): newValue } */
  function render(opts) {
    const input = el(opts.isTextarea ? 'textarea' : 'input', {
      type: 'text', placeholder: opts.placeholder, value: opts.value || '',
      onInput: (e) => opts.onInput(e.target.value),
    });
    const regenBtn = el('button', {
      type: 'button', className: 'field-regen-btn', title: 'Régénérer uniquement ce champ',
      onClick: () => { const v = opts.onRandom(); input.value = v; },
    }, ['↻']);

    return el('div', { className: 'field' }, [
      el('div', { className: 'field-label-row' }, [
        el('label', {}, [opts.label]),
        regenBtn,
      ]),
      input,
    ]);
  }

  window.LH3.components.fieldRandom = { render };
})();
