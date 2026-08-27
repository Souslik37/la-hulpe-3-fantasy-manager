-- ============================================================
-- La Hulpe 3 Fantasy Manager — Schéma Supabase
--
-- À coller intégralement dans Supabase → SQL Editor → "New query" → Run.
-- Peut être ré-exécuté sans risque (DROP ... IF EXISTS en tête) si tu dois
-- repartir de zéro pendant les tests.
-- ============================================================

create extension if not exists pgcrypto;

drop table if exists journal cascade;
drop table if exists predictions cascade;
drop table if exists matches cascade;
drop table if exists players cascade;
drop table if exists managers cascade;

-- ── Managers (un par joueur qui a créé son profil) ──────────────────────────
-- L'id est le même que celui créé par Supabase Auth lors de l'inscription
-- (email/mot de passe synthétiques générés depuis nom + code à 4 chiffres —
-- voir services/authService.js côté appli, l'utilisateur ne voit jamais
-- "email" ni "mot de passe").
create table managers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null unique,
  role text not null default 'player' check (role in ('player', 'admin')),
  coach jsonb not null default '{}'::jsonb,
  player_boosts jsonb not null default '{}'::jsonb,
  squad jsonb not null default '{}'::jsonb,
  pe integer not null default 0,
  history jsonb not null default '[]'::jsonb,
  -- fun_points et attribute_reserved : vestiges d'une ancienne version des
  -- événements du club (monnaie séparée, puis PE réservé par attribut).
  -- Plus utilisés par l'app depuis que les événements donnent du PE 100%
  -- libre (voir eventService.js) — laissés en base pour ne rien casser,
  -- mais peuvent être supprimés sans risque si besoin.
  fun_points integer not null default 0,
  attribute_reserved jsonb not null default '{}'::jsonb,
  -- Limite le bouton "Tout réinitialiser mon équipe" (myTeam.js) à 1
  -- utilisation par saison — remis à false par un futur reset de saison.
  reset_boosts_used boolean not null default false,
  -- Plancher par joueur/attribut sauvegardé via le bouton "Sauvegarder" (voir
  -- pages/myTeam.js) : impossible de redescendre en dessous ensuite, sauf en
  -- passant par resetBoosts (qui vide aussi ce champ).
  saved_boosts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Roster de base (partagé, 31 joueurs, éditable seulement par un admin) ───
create table players (
  id text primary key,
  name text not null,
  avatar_url text,
  base_attributes jsonb not null
);

-- ── Calendrier de saison (partagé, éditable seulement par un admin) ─────────
create table matches (
  id text primary key,
  matchday integer not null unique,
  opponent text not null,
  date date not null,
  status text not null default 'verrouille' check (status in ('verrouille', 'ouvert', 'termine')),
  result jsonb
);

-- ── Pronostics (un par manager par journée) ─────────────────────────────────
create table predictions (
  manager_id uuid not null references managers(id) on delete cascade,
  match_id text not null references matches(id) on delete cascade,
  score_for integer,
  score_against integer,
  total_tries integer,
  try_scorers jsonb not null default '[]'::jsonb,
  man_of_match_id text,
  blunder_id text,
  submitted_at timestamptz,
  breakdown jsonb,
  pe_earned integer,
  primary key (manager_id, match_id)
);

-- ── Commentaires avant/après-match (libres, facultatifs) ────────────────────
create table match_comments (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references matches(id) on delete cascade,
  manager_id uuid not null references managers(id) on delete cascade,
  phase text not null check (phase in ('pre', 'post')),
  text text not null,
  created_at timestamptz not null default now()
);

-- ── Journal du Club (partagé, généré automatiquement) ───────────────────────
create table journal (
  id uuid primary key default gen_random_uuid(),
  generator_id text,
  match_id text references matches(id) on delete set null,
  matchday integer,
  date date,
  icon text,
  title text,
  text text,
  kind text,
  -- Données structurées optionnelles pour un affichage riche (voir
  -- components/matchReport.js) : consensus des pronostics, stats prédites
  -- vs réelles, marqueurs, citations... `text` reste le repli simple pour
  -- les entrées qui n'en ont pas (ex: les 7 brèves auto de data/events.js).
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ── Archives de saison (figées au moment d'un reset, voir Administration) ──
-- Une ligne par manager par saison archivée. `manager_id` n'est PAS une
-- clé étrangère vers managers(id) : l'archive doit rester lisible même si
-- le manager est supprimé/renommé plus tard — c'est un instantané
-- autonome, pas une vue live. `squad`/`player_cards`/`predictions`/
-- `presence` sont eux-mêmes des instantanés complets (pas de dépendance
-- aux tables matches/players/predictions qui seront vidées/remplacées par
-- le reset qui suit immédiatement l'archivage).
create table season_archives (
  id uuid primary key default gen_random_uuid(),
  season_label text not null,
  manager_id uuid not null,
  manager_name text not null,
  coach_name text,
  final_pe integer not null default 0,
  final_prestige text,
  final_team_overall integer,
  squad jsonb not null default '{}'::jsonb,
  player_cards jsonb not null default '[]'::jsonb,
  predictions jsonb not null default '[]'::jsonb,
  presence jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now()
);

-- ── Périodes d'assiduité (bonus de présence, ~tous les 2 mois) ──────────────
-- `ratings` est un objet { managerId: { tier, pe } } — un seul manager par
-- clé, pas besoin d'une table séparée pour si peu de lignes par saison.
create table presence_periods (
  id text primary key,
  label text not null,
  date date not null,
  ratings jsonb not null default '{}'::jsonb
);

-- ── Événements du club (bonus ponctuels, purement fun) ──────────────────────
-- Complètement séparés des PE : ne comptent ni pour le classement, ni pour
-- le budget d'attributs — juste un compteur "Points Fun" pour le folklore
-- (ex : "Braderie de La Hulpe", "Cadeau du président"). `recipient_ids`
-- fige QUI a reçu le bonus au moment de la création (un manager qui
-- rejoint plus tard n'en profite pas rétroactivement), ce qui permet une
-- annulation exacte, symétrique à Assiduité/Calendrier.
create table club_events (
  id text primary key,
  title text not null,
  icon text not null default '🎉',
  date date not null,
  amount integer not null,
  recipient_ids uuid[] not null default '{}'::uuid[],
  -- null = Points Fun génériques (comme avant) ; sinon une des clés de
  -- CONFIG.attributes (ex: 'troisiemeMiTemps') — voir managers.attribute_reserved.
  attribute_key text
);

-- ============================================================
-- Row Level Security — chacun ne peut modifier QUE ses propres
-- données ; le calendrier/roster/journal ne sont modifiables que
-- par un compte dont role = 'admin'.
-- ============================================================

alter table managers enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table journal enable row level security;
alter table presence_periods enable row level security;
alter table club_events enable row level security;
alter table match_comments enable row level security;
alter table season_archives enable row level security;

-- Managers : tout le monde peut lire tout le monde (classement, capitaine
-- fétiche...), mais chacun ne modifie que sa propre ligne.
create policy "managers_select_all" on managers for select using (true);
create policy "managers_insert_own" on managers for insert with check (auth.uid() = id);
create policy "managers_update_own" on managers for update using (auth.uid() = id);
-- Sans ça, l'admin ne peut écrire QUE sa propre ligne : toute distribution
-- de PE à quelqu'un d'autre (notation de pronostics, bonus d'assiduité,
-- événements du club) échoue silencieusement pour tout le monde sauf
-- l'admin lui-même (0 ligne affectée par RLS, pas une erreur SQL — donc
-- rien ne le signale côté appli, voir storageService.saveManagerProgress).
create policy "managers_admin_write" on managers for update using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
create policy "managers_admin_delete" on managers for delete using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Players : lecture publique, écriture réservée à un admin.
create policy "players_select_all" on players for select using (true);
create policy "players_admin_write" on players for all using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Matches : lecture publique, écriture réservée à un admin.
create policy "matches_select_all" on matches for select using (true);
create policy "matches_admin_write" on matches for all using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Predictions : chacun lit/écrit ses propres pronostics ; un admin peut tout
-- lire et écrire (pour noter les pronostics de tout le monde après un match).
create policy "predictions_select_own_or_admin" on predictions for select using (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
create policy "predictions_insert_own" on predictions for insert with check (auth.uid() = manager_id);
create policy "predictions_update_own_or_admin" on predictions for update using (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Journal : lecture publique, écriture réservée à un admin (le journal est
-- régénéré automatiquement quand un admin encode un résultat).
create policy "journal_select_all" on journal for select using (true);
create policy "journal_admin_write" on journal for all using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Périodes d'assiduité : lecture publique, écriture réservée à un admin.
create policy "presence_periods_select_all" on presence_periods for select using (true);
create policy "presence_periods_admin_write" on presence_periods for all using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Événements du club : lecture publique, écriture réservée à un admin.
create policy "club_events_select_all" on club_events for select using (true);
create policy "club_events_admin_write" on club_events for all using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Commentaires de match : lecture publique, chacun gère ses propres
-- commentaires (comme les pronostics) ; un admin peut aussi les nettoyer.
create policy "match_comments_select_all" on match_comments for select using (true);
create policy "match_comments_insert_own" on match_comments for insert with check (auth.uid() = manager_id);
create policy "match_comments_delete_own_or_admin" on match_comments for delete using (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Archives de saison : lecture publique (historique consultable par tous),
-- écriture réservée à un admin (créées uniquement au moment d'un reset).
create policy "season_archives_select_all" on season_archives for select using (true);
create policy "season_archives_admin_write" on season_archives for all using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- ============================================================
-- Droits Postgres de base — SÉPARÉS des règles RLS ci-dessus. RLS filtre
-- QUELLES lignes sont visibles/modifiables, mais le rôle doit d'abord avoir
-- le droit d'accéder à la table du tout (sinon : "permission denied for
-- table ..."). `anon` = requêtes non connectées (clé publishable seule),
-- `authenticated` = une fois un manager connecté.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on public.managers to anon, authenticated;
grant insert, update, delete on public.managers to authenticated;

grant select on public.players to anon, authenticated;
grant insert, update, delete on public.players to authenticated;

grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;

grant select, insert, update on public.predictions to authenticated;

grant select on public.journal to anon, authenticated;
grant insert, delete on public.journal to authenticated;

grant select on public.presence_periods to anon, authenticated;
grant insert, update, delete on public.presence_periods to authenticated;

grant select on public.club_events to anon, authenticated;
grant insert, update, delete on public.club_events to authenticated;

grant select on public.match_comments to anon, authenticated;
grant insert, delete on public.match_comments to authenticated;

grant select on public.season_archives to anon, authenticated;
grant insert, update, delete on public.season_archives to authenticated;

-- ============================================================
-- Roster de base des 31 joueurs (identique à data/players.js, tous les
-- attributs démarrent à 50).
-- ============================================================
insert into players (id, name, avatar_url, base_attributes) values
  ('amaury', 'Amaury', 'assets/avatars/amaury.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('ambroise', 'Ambroise', 'assets/avatars/ambroise.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('anthony', 'Anthony', 'assets/avatars/anthony.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('aurelien', 'Aurélien', 'assets/avatars/aurelien.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('baptiste', 'Baptiste', 'assets/avatars/baptiste.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('cedric', 'Cédric', 'assets/avatars/cedric.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('dorian', 'Dorian', 'assets/avatars/dorian.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('floda', 'FloDa', 'assets/avatars/floda.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('francois', 'François', 'assets/avatars/francois.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('fred', 'Fred', 'assets/avatars/fred.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('guillaume', 'Guillaume', 'assets/avatars/guillaume.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('harold', 'Harold', 'assets/avatars/harold.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('jonathan', 'Jonathan', 'assets/avatars/jonathan.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('hubert', 'Hubert', 'assets/avatars/hubert.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('lancelot', 'Lancelot', 'assets/avatars/lancelot.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('max-poelaert', 'Max Poelaert', 'assets/avatars/max-poelaert.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('max-spork', 'Max Spork', 'assets/avatars/max-spork.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('max-petit', 'Max Petit', 'assets/avatars/max-petit.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('milan', 'Milan', 'assets/avatars/milan.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('nath', 'Nath', 'assets/avatars/nath.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('nicolas', 'Nicolas', 'assets/avatars/nicolas.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('theo', 'Theo', 'assets/avatars/theo.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('thom', 'Thom', 'assets/avatars/thom.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('tristan', 'Tristan', 'assets/avatars/tristan.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('vini', 'Vini', 'assets/avatars/vini.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('alex-lc', 'Alex LC', 'assets/avatars/alex-lc.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('alex-claeys', 'Alex Claeys', 'assets/avatars/alex-claeys.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('lucien', 'Lucien', 'assets/avatars/lucien.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('edouard', 'Édouard', 'assets/avatars/edouard.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('paul', 'Paul', 'assets/avatars/paul.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('sylvain', 'Sylvain', 'assets/avatars/sylvain.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('adrien', 'Adrien', 'assets/avatars/adrien.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}'),
  ('thib-van-ca', 'Thib Van Ca', 'assets/avatars/thib-van-ca.png', '{"force":50,"vitesse":50,"technique":50,"plaquage":50,"vision":50,"endurance":50,"mental":50,"discipline":50,"leadership":50,"troisiemeMiTemps":50}');

-- ============================================================
-- Calendrier de saison (identique au seed de data/matches.js — à mettre à
-- jour depuis la page Administration une fois en ligne).
-- ============================================================
insert into matches (id, matchday, opponent, date, status) values
  ('md-1', 1, 'Adversaire J1', '2026-08-01', 'ouvert'),
  ('md-2', 2, 'Adversaire J2', '2026-08-08', 'verrouille'),
  ('md-3', 3, 'Adversaire J3', '2026-08-15', 'verrouille'),
  ('md-4', 4, 'Adversaire J4', '2026-08-22', 'verrouille'),
  ('md-5', 5, 'Adversaire J5', '2026-08-29', 'verrouille'),
  ('md-6', 6, 'Adversaire J6', '2026-09-05', 'verrouille'),
  ('md-7', 7, 'Adversaire J7', '2026-09-12', 'verrouille'),
  ('md-8', 8, 'Adversaire J8', '2026-09-19', 'verrouille'),
  ('md-9', 9, 'Adversaire J9', '2026-09-26', 'verrouille'),
  ('md-10', 10, 'Adversaire J10', '2026-10-03', 'verrouille'),
  ('md-11', 11, 'Adversaire J11', '2026-10-10', 'verrouille'),
  ('md-12', 12, 'Adversaire J12', '2026-10-17', 'verrouille'),
  ('md-13', 13, 'Adversaire J13', '2026-10-24', 'verrouille'),
  ('md-14', 14, 'Adversaire J14', '2026-10-31', 'verrouille'),
  ('md-15', 15, 'Adversaire J15', '2026-11-07', 'verrouille'),
  ('md-16', 16, 'Adversaire J16', '2026-11-14', 'verrouille'),
  ('md-17', 17, 'Adversaire J17', '2026-11-21', 'verrouille'),
  ('md-18', 18, 'Adversaire J18', '2026-11-28', 'verrouille');

-- ============================================================
-- Périodes d'assiduité (bonus de présence, ~tous les 2 mois). Dates
-- modifiables depuis Administration → Assiduité, comme le calendrier.
-- ============================================================
insert into presence_periods (id, label, date) values
  ('presence-1', 'Fin septembre', '2026-09-30'),
  ('presence-2', 'Fin décembre', '2026-12-31'),
  ('presence-3', 'Fin février', '2027-02-28'),
  ('presence-4', 'Fin avril', '2027-04-30');
