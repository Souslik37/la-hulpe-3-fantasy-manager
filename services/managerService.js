/**
 * La Hulpe 3 Fantasy Manager — Managers & Coachs
 *
 * La création de compte (nom + code) vit dans authService (Supabase Auth).
 * Ce module ne gère plus que la lecture/édition d'un manager déjà chargé en
 * mémoire (voir stateService).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  /**
   * `playerIds` doit refléter le roster RÉEL au moment de l'inscription (pas
   * le fichier statique data/players.js, qui peut être en retard sur des
   * ajouts/suppressions faits directement dans Supabase) — voir
   * authService.signUp, qui va chercher la liste à jour avant d'appeler ceci.
   */
  function defaultSquad(playerIds) {
    const ids = playerIds || window.LH3.data.PLAYERS.map((p) => p.id);
    const startersCount = window.LH3.data.CONFIG.squad.startersCount;
    return {
      starters: ids.slice(0, startersCount),
      bench: ids.slice(startersCount),
      captainId: null,
    };
  }

  function emptyCoach() {
    return {
      name: '', previousJob: '', accent: '', story: '', quote: '', managementStyle: '', avatarUrl: null,
    };
  }

  function getManager(id) {
    const state = window.LH3.services.stateService.getState();
    return state.managers[id] || null;
  }

  function getActiveManager() {
    const state = window.LH3.services.stateService.getState();
    return state.activeManagerId ? state.managers[state.activeManagerId] : null;
  }

  function listManagers() {
    const state = window.LH3.services.stateService.getState();
    return Object.values(state.managers).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Admin uniquement (voir pages/admin.js + RLS `managers_admin_delete`).
   * Ne supprime pas le compte de connexion Supabase Auth sous-jacent (ça
   * demande une clé service_role, jamais exposée côté client) — juste le
   * profil et tout ce qui en dépend (pronostics, via cascade SQL). Pour
   * libérer complètement le même nom plus tard, il faut aussi supprimer le
   * compte dans Supabase → Authentication → Users.
   */
  async function removeManager(id) {
    const state = window.LH3.services.stateService.getState();
    if (id === state.activeManagerId) {
      return { ok: false, reason: 'Tu ne peux pas supprimer ton propre profil pendant que tu es connecté avec.' };
    }
    const ok = await window.LH3.services.storageService.deleteManager(id);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };

    delete state.managers[id];
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  function updateCoach(managerId, coachData) {
    const manager = getManager(managerId);
    if (!manager) return;
    manager.coach = Object.assign({}, manager.coach, coachData);
    window.LH3.services.stateService.persist();
  }

  // ── Générateur de coach aléatoire (bouton "je n'ai pas d'inspiration") ──
  // Au moins 30 choix par catégorie pour que le tirage aléatoire ne se répète
  // pas trop vite quand plusieurs managers l'utilisent.
  const JOBS = [
    'ex-boucher', 'ancien militaire', 'prof de gym reconverti', 'ex-pilote de ligne',
    'ancien DJ de mariage', 'ex-vendeur de frites', 'ex-comptable désabusé',
    'ancien maître-nageur', 'ex-livreur de pizzas', 'ancien moine trappiste',
    'ex-agent immobilier douteux', 'ancien clown pour anniversaires', 'ex-videur de boîte de nuit',
    'ancien speaker de courses hippiques', 'ex-représentant en aspirateurs', 'ancien gardien de phare',
    'ex-formateur en team-building', 'ancien dresseur de perroquets', 'ex-chauffeur de bus scolaire',
    'ancien plongeur de restaurant étoilé', 'ex-arbitre de fléchettes professionnel', 'ancien vendeur de matelas',
    'ex-magicien de rue', 'ancien standardiste', 'ex-testeur de manèges à sensations',
    'ancien liftier', 'ex-guide touristique pour groupes du troisième âge', 'ancien camelot de marché',
    'ex-croupier de casino', 'ancien technicien de surface dans une salle de sport',
    'ex-installateur d\'antennes paraboliques', 'ancien apiculteur urbain',
  ];
  const ACCENTS = [
    'accent liégeois à couper au couteau', 'accent du Borinage', 'petit accent bruxellois',
    'accent chtimi importé', 'accent gaumais mystérieux', 'accent néerlandophone assumé',
    'accent français "parisien exilé"', 'sans accent particulier, mais voix grave qui impose le respect',
    'accent namurois qui traîne sur les voyelles', 'accent carolo assumé et fier', 'accent verviétois inimitable',
    'accent ardennais, rocailleux', 'accent du Brabant wallon "presque bruxellois"',
    'petit accent flamand qui ressort quand il s\'énerve', 'accent anversois à couper au couteau',
    'accent italien hérité d\'un grand-père maçon', 'accent portugais qui ressort après trois bières',
    'accent suisse romand, précis et posé', 'accent québécois ramené d\'un échange universitaire',
    'accent marseillais, sudiste jusqu\'au bout des ongles', 'accent corse mystérieux, jamais expliqué',
    'accent anglais d\'école privée, un peu forcé', 'accent espagnol de vacances à Lloret de Mar',
    'accent congolais chaleureux', 'accent tournaisien pointu',
    'accent liégeois version "batte", encore plus fort que le premier', 'accent luxembourgeois discret',
    'accent hollandais qui roule les r', 'voix éraillée par trois décennies de troisièmes mi-temps',
    'aucun accent identifiable, ce qui inquiète tout le monde',
  ];
  const STYLES = [
    'brutal mais juste', 'zen et énigmatique', 'motivateur à l\'américaine', 'à l\'ancienne, sifflet et gueulante',
    'tacticien obsessionnel du tableau blanc', 'copain d\'abord, coach ensuite', 'silencieux mais terrifiant',
    'grand fan de citations Instagram', 'adepte de la méthode Coué avant chaque match',
    'capable de motiver rien qu\'avec un regard', 'fan de vidéos tactiques YouTube regardées à 2h du matin',
    'croit dur comme fer à la sophrologie d\'avant-match', 'parle de "mentalité de guerrier" à chaque pause',
    'plus doux à l\'entraînement qu\'en match, allez comprendre', 'carnet tactique toujours ouvert, jamais relu',
    'change de tactique à la mi-temps, souvent pour le pire', 'fan de discours façon vestiaire de film américain',
    'prend tout au second degré, sauf le classement', 'obsédé par l\'échauffement, jamais par les étirements',
    'distribue des surnoms à tout le monde sans jamais les expliquer', 'croit encore aux principes tactiques des années 90',
    'adepte convaincu du "on verra sur le terrain"', 'gère le groupe comme une entreprise familiale',
    'capable d\'un discours de 20 minutes pour un exercice de 5', 'calcule des probabilités à voix haute pendant les matchs',
    'charismatique malgré lui', 'fan inconditionnel des exercices à l\'ancienne, sans ballon',
    'change d\'avis toutes les cinq minutes, mais toujours avec conviction',
    'gère son stress en grignotant des chips sur la ligne de touche', 'plus nerveux que les joueurs les jours de match',
  ];
  const STORIES = [
    'A rejoint le club après avoir vu une pub sur un tract collé sur un poteau.',
    'Ancienne gloire locale, revenu au club "juste pour donner un coup de main" il y a 6 ans.',
    'Personne ne sait vraiment comment il est arrivé là, mais tout le monde l\'écoute.',
    'A appris le rugby en regardant des rediffusions à 2h du matin.',
    'Prétend avoir failli jouer en pro, aucune preuve n\'existe.',
    'Recruté au bar du club après le troisième pichet.',
    'Est arrivé un jour d\'entraînement et n\'est jamais reparti.',
    'A commencé comme kiné bénévole, a fini par prendre les commandes.',
    'Ancien joueur retraité sur blessure, jamais vraiment reparti du club.',
    'A gagné le poste lors d\'un pari perdu en troisième mi-temps.',
    'Personne ne se souvient de son recrutement officiel, il était juste "déjà là".',
    'Le groupe WhatsApp du club lui a un jour écrit "tu coaches samedi" — il a répondu oui par erreur.',
    'A appris les règles du rugby la semaine précédant sa première séance.',
    'Ancien supporter dans les tribunes, promu sur un malentendu.',
    'Prétend avoir coaché en Nouvelle-Zélande, sans jamais donner de date précise.',
    'A pris le poste après une élection surprise en assemblée générale.',
    'Débarqué un jour de pluie, jamais reparti depuis.',
    'Ancien parent de joueur, resté bien après le départ de son fils du club.',
    'A signé son premier "contrat" de coach sur un coin de table, au bar.',
    'Se présente comme "consultant tactique" — personne ne sait ce que ça veut dire.',
    'Est devenu coach après avoir gagné un défi au marathon de bière du club.',
    'Sa légende dit qu\'il a déjà arbitré un match international, jamais confirmé.',
    'A pris ses fonctions après le départ précipité du coach précédent, sans transition.',
    'Ancien basketteur reconverti, toujours pas totalement à l\'aise avec l\'ovale.',
    'Ex-VRP, garde le sens du contact.',
    'Recruté via une petite annonce sur le groupe Facebook du club.',
    'A commencé bénévole à la buvette, fini sur le banc de touche.',
    'Dit avoir eu une "révélation" pendant la troisième mi-temps d\'un tournoi à l\'étranger.',
    'Ancien professeur de sport, en reconversion complète vers le rugby amateur.',
    'Ex-photographe du club, promu coach après avoir donné trop de conseils tactiques.',
  ];
  const QUOTES = [
    'On ne lâche rien, sauf la troisième mi-temps.',
    'Le talent ne suffit pas, il faut aussi le talent.',
    'Un plaquage bien placé vaut mille discours.',
    'Ici, on transpire ensemble et on trinque ensemble.',
    'La victoire, c\'est bien. La bière d\'après, c\'est mieux.',
    'Le rugby, c\'est 80 minutes de guerre et une vie d\'amitié.',
    'Un essai marqué ne vaut rien sans une bonne troisième mi-temps.',
    'On tombe à quinze, on se relève à quinze.',
    'Le ballon ovale ne pardonne rien, mais il rassemble tout le monde.',
    'Ici, la seule règle sacrée, c\'est de ne jamais rater la douche froide.',
    'Un bon plaquage, ça se fête au bar, pas sur le terrain.',
    'La sueur d\'aujourd\'hui, c\'est la bière méritée de ce soir.',
    'On ne choisit pas sa mêlée, on l\'assume.',
    'Le rugby, c\'est simple : on court, on tombe, on recommence.',
    'Un vestiaire silencieux est un vestiaire qui a déjà perdu.',
    'Le respect de l\'adversaire commence après le coup de sifflet, pas avant.',
    'On ne perd jamais vraiment, on offre juste une occasion de fête à l\'adversaire.',
    'Le talent, ça s\'entraîne. La troisième mi-temps, ça se vit.',
    'Sur ce terrain, on laisse son ego au vestiaire.',
    'Un club, c\'est une famille qu\'on n\'a pas choisie mais qu\'on garde quand même.',
    'Il n\'y a pas de mauvais temps, il n\'y a que de mauvaises excuses.',
    'On joue pour le maillot, on reste pour les copains.',
    'Une mêlée qui recule est une mêlée qui réfléchit.',
    'Le meilleur exercice tactique reste le tour de terrain à la bière.',
    'Un essai, ça s\'oublie. Une soirée d\'équipe, jamais.',
    'Le rugby ne se joue pas qu\'avec les jambes, il se joue avec le cœur.',
    'On tombe pour mieux se relever, et on trinque pour ne jamais oublier pourquoi.',
    'Ici, le seul carton qu\'on distribue, c\'est celui de l\'apéro.',
    'Mieux vaut un bon dernier en troisième mi-temps qu\'un mauvais premier tout seul.',
    'Le classement, ça va, ça vient. L\'ambiance du club, ça reste.',
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // \p{Diacritic} (plutôt que le classique ̀-ͯ) : évite un bug de
  // corruption d'encodage récurrent sur cette plage Unicode avec certains
  // outils d'édition — voir git blame pour l'historique.
  function normalizeSearch(str) {
    return String(str).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  /**
   * Recherche par mot-clé dans la base de nationalités (voir data/accents.js)
   * — jusqu'à 10 résultats. Certains pays (France, Belgique, USA...) ont
   * plusieurs variantes régionales qui partagent le même mot-clé général,
   * pour toutes les proposer d'un coup plutôt qu'une seule au hasard.
   */
  function searchAccents(query) {
    const q = normalizeSearch(query);
    if (!q) return [];
    return window.LH3.data.ACCENTS_DB
      .filter((entry) => entry.keywords.some((k) => normalizeSearch(k).includes(q)))
      .slice(0, 10);
  }

  function randomCoach(namePlaceholder) {
    return {
      name: namePlaceholder || '',
      previousJob: pick(JOBS),
      accent: pick(ACCENTS),
      story: pick(STORIES),
      quote: pick(QUOTES),
      managementStyle: pick(STYLES),
      avatarUrl: null,
    };
  }

  // Pioche champ par champ (voir components/fieldRandom.js) — mêmes
  // tableaux que randomCoach, pour que "régénérer juste l'accent" tire
  // dans le même pool que le bouton "régénérer tout".
  function randomJob() { return pick(JOBS); }
  function randomAccent() { return pick(ACCENTS); }
  function randomStory() { return pick(STORIES); }
  function randomQuote() { return pick(QUOTES); }
  function randomManagementStyle() { return pick(STYLES); }

  window.LH3.services.managerService = {
    getManager, getActiveManager, listManagers, removeManager,
    updateCoach, randomCoach, defaultSquad, emptyCoach, searchAccents,
    randomJob, randomAccent, randomStory, randomQuote, randomManagementStyle,
  };
})();
