/**
 * La Hulpe 3 Fantasy Manager — Bootstrap & routeur
 *
 * Routeur minimal basé sur location.hash (pas de framework, pas de build).
 * Chaque page expose `render(rootElement)` dans window.LH3.pages.<clé>.
 *
 * Démarrage (async, car ça implique Supabase) : on vérifie s'il existe déjà
 * une session (reconnexion automatique), on charge l'état, puis on affiche
 * soit l'écran de connexion, soit l'appli.
 */
(function () {
  window.LH3 = window.LH3 || {};

  const DEFAULT_ROUTE = 'home';

  function currentRouteKey() {
    const hash = window.location.hash.replace('#', '');
    const known = window.LH3.components.navbar.NAV_ITEMS.map((i) => i.key);
    let key = known.includes(hash) ? hash : DEFAULT_ROUTE;

    // Garde-fou côté client (la vraie protection est dans les règles
    // Supabase) : une page normale ne doit jamais afficher l'Administration.
    if (key === 'admin') {
      const manager = window.LH3.services.managerService.getActiveManager();
      if (!manager || manager.role !== 'admin') key = DEFAULT_ROUTE;
    }
    return key;
  }

  function renderApp() {
    const key = currentRouteKey();
    if (window.location.hash !== '#' + key) {
      window.history.replaceState(null, '', '#' + key);
    }
    window.LH3.components.navbar.render(key);
    const root = document.getElementById('page-root');
    root.className = 'page-root fade-page';
    window.LH3.pages[key].render(root);
  }

  function showOnboarding() {
    document.getElementById('boot-loading').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    const onboardRoot = document.getElementById('onboarding-root');
    onboardRoot.classList.remove('hidden');
    window.LH3.pages.onboarding.mount(onboardRoot);
  }

  function showApp() {
    document.getElementById('boot-loading').classList.add('hidden');
    document.getElementById('onboarding-root').classList.add('hidden');
    document.getElementById('onboarding-root').innerHTML = '';
    document.getElementById('app').classList.remove('hidden');
    renderApp();
  }

  function showBootLoading() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('onboarding-root').classList.add('hidden');
    document.getElementById('boot-loading').classList.remove('hidden');
  }

  /** Point d'entrée unique, ré-appelé après connexion/inscription/déconnexion. */
  async function boot() {
    showBootLoading();
    let session = null;
    try {
      session = await window.LH3.services.authService.getSession();
    } catch (e) {
      console.error('[script] vérification de session impossible', e);
    }

    if (!session) {
      showOnboarding();
      return;
    }

    try {
      const state = await window.LH3.services.stateService.init(session.user.id);
      if (!state.managers[session.user.id]) {
        // Session Supabase valide mais ligne "managers" manquante (rare —
        // échec partiel lors d'une inscription précédente). On ne peut pas
        // faire tourner l'appli sur un profil qui n'existe pas vraiment.
        throw new Error('Profil manager introuvable pour cette session.');
      }
    } catch (e) {
      console.error('[script] chargement des données impossible', e);
      window.LH3.components.toast && window.LH3.components.toast.show(
        'Connexion au serveur impossible — vérifie ta connexion internet et réessaie.', 'error'
      );
      await window.LH3.services.authService.signOut();
      showOnboarding();
      return;
    }

    showApp();
  }

  window.addEventListener('hashchange', () => {
    if (window.LH3.services.managerService.getActiveManager()) renderApp();
  });

  window.LH3.app = { boot };

  document.addEventListener('DOMContentLoaded', boot);
})();
