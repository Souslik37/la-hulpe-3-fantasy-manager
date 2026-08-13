/**
 * La Hulpe 3 Fantasy Manager — Connexion / Création de profil
 *
 * L'utilisateur ne voit jamais "email" ni "mot de passe" : uniquement un
 * nom et un code à 4 chiffres (voir services/authService.js pour ce qui se
 * passe réellement derrière, avec Supabase Auth).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  function mount(root) {
    let mode = 'signup'; // 'signup' | 'login'
    let step = 1; // signup uniquement : 1 = identité, 2 = coach
    let busy = false;

    let name = '';
    let pin = '';
    let pinConfirm = '';
    let coach = window.LH3.services.managerService.randomCoach('');

    function renderSteps(doneCount) {
      return el('div', { className: 'onboard-steps' }, [0, 1].map((i) =>
        el('div', { className: 'dot' + (i < doneCount ? ' done' : '') })
      ));
    }

    function buildModeTabs() {
      return el('div', { className: 'tabs', style: { marginBottom: '20px' } }, [
        el('div', {
          className: 'tab-btn' + (mode === 'signup' ? ' active' : ''),
          onClick: () => { mode = 'signup'; step = 1; renderAll(); },
        }, ['Créer mon profil']),
        el('div', {
          className: 'tab-btn' + (mode === 'login' ? ' active' : ''),
          onClick: () => { mode = 'login'; renderAll(); },
        }, ['J\'ai déjà un profil']),
      ]);
    }

    function pinInput(value, onInput, placeholder) {
      return el('input', {
        type: 'text', inputmode: 'numeric', maxlength: '4', placeholder: placeholder || '••••',
        value,
        onInput: (e) => {
          const filtered = e.target.value.replace(/\D/g, '').slice(0, 4);
          e.target.value = filtered; // reflète immédiatement le filtrage dans le champ visible
          onInput(filtered);
        },
      });
    }

    // ── Connexion ────────────────────────────────────────────────────────
    function buildLogin() {
      const nameInput = el('input', {
        type: 'text', placeholder: 'Ton nom', value: name,
        onInput: (e) => { name = e.target.value; },
      });
      const pinField = pinInput(pin, (v) => { pin = v; });

      const submitBtn = el('button', {
        className: 'btn btn-primary btn-block',
        onClick: async () => {
          if (busy) return;
          if (!name.trim() || pin.length !== 4) {
            window.LH3.components.toast.show('Renseigne ton nom et ton code à 4 chiffres.', 'error');
            return;
          }
          busy = true; submitBtn.disabled = true; submitBtn.textContent = 'Connexion...';
          try {
            const res = await window.LH3.services.authService.signIn(name, pin);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              return;
            }
            window.LH3.app.boot();
          } catch (e) {
            console.error('[onboarding] erreur inattendue à la connexion', e);
            window.LH3.components.toast.show('Une erreur inattendue est survenue — réessaie.', 'error');
          } finally {
            busy = false; submitBtn.disabled = false; submitBtn.textContent = 'Se connecter';
          }
        },
      }, ['Se connecter']);

      return el('div', { className: 'onboard-card' }, [
        buildModeTabs(),
        el('div', { className: 'onboard-logo' }, ['🏉']),
        el('h1', {}, ['Content de te revoir']),
        el('p', { className: 'sub' }, ['Retape ton nom et ton code à 4 chiffres pour retrouver ton équipe.']),
        el('div', { className: 'field' }, [el('label', {}, ['Ton nom']), nameInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Ton code à 4 chiffres']), pinField]),
        submitBtn,
      ]);
    }

    // ── Inscription — étape 1 : identité ────────────────────────────────
    function buildSignupStep1() {
      const nameInput = el('input', {
        type: 'text', placeholder: 'Ex : Fred', value: name,
        onInput: (e) => { name = e.target.value; },
      });
      const pinField = pinInput(pin, (v) => { pin = v; }, '4 chiffres');
      const pinConfirmField = pinInput(pinConfirm, (v) => { pinConfirm = v; }, 'Retape le code');

      const nextBtn = el('button', {
        className: 'btn btn-primary btn-block',
        onClick: () => {
          if (!name.trim()) { window.LH3.components.toast.show('Choisis un nom.', 'error'); return; }
          if (pin.length !== 4) { window.LH3.components.toast.show('Le code doit faire 4 chiffres.', 'error'); return; }
          if (pin !== pinConfirm) { window.LH3.components.toast.show('Les deux codes ne correspondent pas.', 'error'); return; }
          step = 2;
          renderAll();
        },
      }, ['Continuer →']);

      return el('div', { className: 'onboard-card' }, [
        buildModeTabs(),
        el('div', { className: 'onboard-logo' }, ['🏉']),
        el('h1', {}, ['La Hulpe 3 Fantasy Manager']),
        el('p', { className: 'sub' }, ['Choisis un nom et un code à 4 chiffres — c\'est tout ce qu\'il te faudra pour te reconnecter plus tard.']),
        renderSteps(0),
        el('div', { className: 'field' }, [el('label', {}, ['Ton nom de manager']), nameInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Ton code à 4 chiffres']), pinField]),
        el('div', { className: 'field' }, [el('label', {}, ['Confirme le code']), pinConfirmField]),
        el('div', { className: 'field-hint', style: { marginBottom: '14px' } }, ['Retiens bien ce code : il n\'y a pas de mail de récupération, il faudra demander à l\'admin de le réinitialiser si tu l\'oublies.']),
        nextBtn,
      ]);
    }

    // ── Inscription — étape 2 : coach ───────────────────────────────────
    function buildSignupStep2() {
      function field(key, label, placeholder, isTextarea) {
        const input = el(isTextarea ? 'textarea' : 'input', {
          type: 'text', placeholder, value: coach[key] || '',
          onInput: (e) => { coach[key] = e.target.value; },
        });
        return el('div', { className: 'field' }, [el('label', {}, [label]), input]);
      }

      function regenField(key, label, placeholder, randomFn, isTextarea) {
        return window.LH3.components.fieldRandom.render({
          label, placeholder, value: coach[key], isTextarea,
          onInput: (v) => { coach[key] = v; },
          onRandom: () => { coach[key] = randomFn(); return coach[key]; },
        });
      }

      const accentInput = el('input', {
        type: 'text', placeholder: 'Ex : accent liégeois à couper au couteau', value: coach.accent || '',
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

      const finishBtn = el('button', {
        className: 'btn btn-primary btn-block',
        onClick: async () => {
          if (busy) return;
          if (!coach.name.trim()) { window.LH3.components.toast.show('Donne au moins un nom à ton coach 😉', 'error'); return; }
          busy = true; finishBtn.disabled = true; finishBtn.textContent = 'Création en cours...';
          try {
            const res = await window.LH3.services.authService.signUp(name, pin, coach);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              return;
            }
            window.LH3.components.toast.show('Bienvenue ' + name + ' 👋', 'success');
            window.LH3.app.boot();
          } catch (e) {
            console.error('[onboarding] erreur inattendue à l\'inscription', e);
            window.LH3.components.toast.show('Une erreur inattendue est survenue — réessaie.', 'error');
          } finally {
            busy = false; finishBtn.disabled = false; finishBtn.textContent = 'Terminer et entrer au club 🏉';
          }
        },
      }, ['Terminer et entrer au club 🏉']);

      return el('div', { className: 'onboard-card' }, [
        el('div', { className: 'onboard-logo' }, ['🧢']),
        el('h1', {}, ['Crée ton coach']),
        el('p', { className: 'sub' }, ['Un peu de folklore : le coach n\'a aucun impact sur le jeu, il est juste là pour le fun.']),
        renderSteps(1),
        field('name', 'Nom du coach', 'Ex : Coach Robert'),
        regenField('previousJob', 'Métier précédent', 'Ex : ex-boucher', window.LH3.services.managerService.randomJob),
        accentField,
        accentSearch,
        regenField('managementStyle', 'Style de management', 'Ex : brutal mais juste', window.LH3.services.managerService.randomManagementStyle),
        regenField('quote', 'Citation fétiche', 'Ex : On ne lâche rien, sauf la 3e mi-temps.', window.LH3.services.managerService.randomQuote),
        regenField('story', 'Son histoire', 'Quelques mots sur comment il a atterri ici...', window.LH3.services.managerService.randomStory, true),
        el('button', {
          className: 'btn btn-ghost btn-block', style: { marginBottom: '14px' },
          onClick: () => {
            coach = window.LH3.services.managerService.randomCoach(coach.name);
            renderAll();
          },
        }, ['🎲 Je n\'ai pas d\'inspiration, génère-moi un coach']),
        finishBtn,
      ]);
    }

    function renderAll() {
      root.innerHTML = '';
      let card;
      if (mode === 'login') card = buildLogin();
      else card = step === 1 ? buildSignupStep1() : buildSignupStep2();
      root.appendChild(el('div', { className: 'onboard-shell' }, [card]));
    }

    renderAll();
  }

  window.LH3.pages.onboarding = { mount };
})();
