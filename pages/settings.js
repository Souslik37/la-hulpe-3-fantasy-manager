/**
 * La Hulpe 3 Fantasy Manager — Page Paramètres
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  function buildAccountSection(manager) {
    return el('div', { className: 'card' }, [
      el('h3', { style: { marginBottom: '14px' } }, ['👤 Mon compte']),
      el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, ['Nom de manager']),
        el('div', {}, [manager.name]),
      ]),
      el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, ['Rôle']),
        el('div', {}, [manager.role === 'admin' ? '⚙️ Administrateur' : 'Joueur']),
      ]),
      el('div', { className: 'field-hint', style: { margin: '10px 0 14px' } }, [
        'Le nom sert à te reconnecter — il ne peut pas être changé ici. Demande à l\'admin si besoin.',
      ]),
      el('button', {
        className: 'btn btn-danger',
        onClick: async () => {
          await window.LH3.services.authService.signOut();
          window.LH3.app.boot();
        },
      }, ['Se déconnecter']),
    ]);
  }

  function buildCoachSection(manager) {
    const coach = Object.assign({}, manager.coach);

    function field(key, label, isTextarea) {
      const input = el(isTextarea ? 'textarea' : 'input', {
        type: 'text', value: coach[key] || '',
        onInput: (e) => { coach[key] = e.target.value; },
      });
      return el('div', { className: 'field' }, [el('label', {}, [label]), input]);
    }

    const accentInput = el('input', {
      type: 'text', value: coach.accent || '',
      onInput: (e) => { coach.accent = e.target.value; },
    });
    const accentField = el('div', { className: 'field' }, [el('label', {}, ['Accent']), accentInput]);
    const accentSearch = window.LH3.components.accentSearch.render({
      onPick: (line) => { coach.accent = line; accentInput.value = line; },
    });

    const card = el('div', { className: 'card' }, [
      el('h3', { style: { marginBottom: '14px' } }, ['🧢 Mon coach']),
      field('name', 'Nom'),
      field('previousJob', 'Métier précédent'),
      accentField,
      accentSearch,
      field('managementStyle', 'Style de management'),
      field('quote', 'Citation fétiche'),
      field('story', 'Histoire', true),
      el('div', { style: { display: 'flex', gap: '10px', marginTop: '10px' } }, [
        el('button', {
          className: 'btn',
          onClick: () => {
            const random = window.LH3.services.managerService.randomCoach(coach.name);
            window.LH3.services.managerService.updateCoach(manager.id, random);
            window.LH3.pages.settings.render(document.getElementById('page-root'));
          },
        }, ['🎲 Régénérer aléatoirement']),
        el('button', {
          className: 'btn btn-primary',
          onClick: () => {
            window.LH3.services.managerService.updateCoach(manager.id, coach);
            window.LH3.components.toast.show('Coach mis à jour ✅', 'success');
          },
        }, ['Enregistrer']),
      ]),
    ]);
    return card;
  }

  function render(root) {
    const manager = window.LH3.services.managerService.getActiveManager();

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Paramètres']),
      el('p', {}, ['Gère ton coach et ton compte.']),
    ]));

    const grid = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } }, [
      buildCoachSection(manager),
      buildAccountSection(manager),
    ]);
    root.appendChild(grid);
  }

  window.LH3.pages.settings = { render };
})();
