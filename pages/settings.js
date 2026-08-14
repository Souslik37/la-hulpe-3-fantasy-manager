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

    function regenField(key, label, randomFn, isTextarea) {
      return window.LH3.components.fieldRandom.render({
        label, value: coach[key], isTextarea,
        onInput: (v) => { coach[key] = v; },
        onRandom: () => { coach[key] = randomFn(); return coach[key]; },
      });
    }

    const avatarPreview = el('div', { style: { marginBottom: '10px' } });
    function renderAvatarPreview() {
      avatarPreview.innerHTML = window.LH3.utils.avatar.renderAvatar(coach.name || manager.name, coach.avatarUrl, 78);
    }
    renderAvatarPreview();

    const avatarFileInput = el('input', {
      type: 'file', accept: 'image/*',
      onChange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const dataUri = await window.LH3.utils.imageResize.toDataUri(file);
          coach.avatarUrl = dataUri;
          renderAvatarPreview();
          window.LH3.components.toast.show('Photo mise à jour — clique "Enregistrer" pour la garder ✅', 'success');
        } catch (err) {
          console.error('[settings] échec du traitement photo', err);
          window.LH3.components.toast.show('Impossible de traiter cette photo — réessaie avec une autre.', 'error');
        }
      },
    });

    const avatarField = el('div', { className: 'field' }, [
      el('label', {}, ['Photo du coach']),
      avatarPreview,
      avatarFileInput,
      el('div', { className: 'field-hint' }, [
        'Choisis une photo (la tienne, pourquoi pas) pour ton coach. Tout se passe dans ton navigateur, rien n\'est envoyé nulle part.',
      ]),
    ]);

    const accentInput = el('input', {
      type: 'text', value: coach.accent || '',
      onInput: (e) => { coach.accent = e.target.value; },
    });
    const accentRegenBtn = el('button', {
      type: 'button', className: 'field-regen-btn', title: 'Régénérer uniquement ce champ',
      onClick: () => { coach.accent = window.LH3.services.managerService.randomAccent(); accentInput.value = coach.accent; },
    }, ['↻']);
    const accentField = el('div', { className: 'field' }, [
      el('div', { className: 'field-label-row' }, [el('label', {}, ['Accent']), accentRegenBtn]),
      accentInput,
    ]);
    const accentSearch = window.LH3.components.accentSearch.render({
      onPick: (line) => { coach.accent = line; accentInput.value = line; },
    });

    const card = el('div', { className: 'card' }, [
      el('h3', { style: { marginBottom: '14px' } }, ['🧢 Mon coach']),
      avatarField,
      field('name', 'Nom'),
      regenField('previousJob', 'Métier précédent', window.LH3.services.managerService.randomJob),
      accentField,
      accentSearch,
      regenField('managementStyle', 'Style de management', window.LH3.services.managerService.randomManagementStyle),
      regenField('quote', 'Citation fétiche', window.LH3.services.managerService.randomQuote),
      regenField('story', 'Histoire', window.LH3.services.managerService.randomStory, true),
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
