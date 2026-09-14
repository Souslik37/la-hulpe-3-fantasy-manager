// La Hulpe 3 Fantasy Manager — Edge Function : reset du code d'un manager
//
// Permet à un admin d'attribuer un NOUVEAU code à 4 chiffres à un manager
// qui a perdu le sien. C'est la SEULE opération de l'app qui a réellement
// besoin de la clé service_role (jamais exposée au navigateur, voir
// data/supabaseConfig.js) — d'où l'Edge Function plutôt qu'un appel direct
// depuis services/authService.js.
//
// Duplique volontairement slugify()/derivePassword() de services/authService.js
// (rien ne peut être partagé entre le navigateur vanilla-JS sans build step
// et ce runtime Deno) — si le format du "code" change un jour côté
// authService.js, reporter le même changement ici.

import { createClient } from 'npm:@supabase/supabase-js@2';

const PASSWORD_PREFIX = 'LH3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Plage Unicode "Combining Diacritical Marks" (0x0300-0x036f), construite à
// partir des codes numériques plutôt que d'un échappement \u littéral dans
// le regex — évite tout souci d'encodage à l'édition de ce fichier. Doit
// rester identique au slugify() de services/authService.js.
const COMBINING_MARKS_RANGE = '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']';
const COMBINING_MARKS = new RegExp(COMBINING_MARKS_RANGE, 'g');

function slugify(name: string): string {
  return String(name)
    .normalize('NFD').replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function derivePassword(name: string, pin: string): string {
  return `${PASSWORD_PREFIX}-${slugify(name)}-${pin}`;
}

function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    if (req.method !== 'POST') return json({ ok: false, reason: 'Méthode non supportée.' }, 405);

    const authHeader = req.headers.get('Authorization') || '';
    const callerJwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!callerJwt) return json({ ok: false, reason: 'Non authentifié.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Identifie l'appelant à partir de son propre token (jamais d'un champ
    // "callerId" envoyé par le client, qui ne prouverait rien).
    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerJwt);
    if (callerErr || !callerData.user) {
      return json({ ok: false, reason: 'Session invalide — reconnecte-toi. [debug getUser: ' + (callerErr ? callerErr.message : 'pas de user renvoyé') + ']' }, 401);
    }

    // Même règle que managers_admin_write côté RLS (supabase/schema.sql) :
    // seul un role='admin' peut agir sur le compte d'un autre manager.
    // TEMPORAIRE : le message d'erreur inclut des détails de debug (uid
    // résolu, erreur DB éventuelle, ligne trouvée) le temps de diagnostiquer
    // pourquoi ce check refuse un compte admin confirmé en base — à
    // retirer une fois le bug identifié.
    const { data: callerManager, error: callerManagerErr } = await admin
      .from('managers').select('id, role').eq('id', callerData.user.id).maybeSingle();
    if (callerManagerErr || !callerManager || callerManager.role !== 'admin') {
      return json({
        ok: false,
        reason: 'Réservé aux admins. [debug uid=' + callerData.user.id
          + ' dbErr=' + (callerManagerErr ? JSON.stringify(callerManagerErr) : 'aucune')
          + ' found=' + JSON.stringify(callerManager) + ']',
      }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { managerId, newPin } = body || {};
    if (!managerId || typeof managerId !== 'string') return json({ ok: false, reason: 'managerId manquant.' }, 400);
    if (!isValidPin(newPin)) return json({ ok: false, reason: 'Le nouveau code doit être composé de 4 chiffres.' }, 400);

    const { data: targetManager, error: targetErr } = await admin
      .from('managers').select('name').eq('id', managerId).maybeSingle();
    if (targetErr || !targetManager) return json({ ok: false, reason: 'Manager introuvable.' }, 404);

    const newPassword = derivePassword(targetManager.name, newPin);
    const { error: updateErr } = await admin.auth.admin.updateUserById(managerId, { password: newPassword });
    if (updateErr) return json({ ok: false, reason: updateErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error('[reset-manager-pin]', e);
    return json({ ok: false, reason: 'Erreur serveur inattendue.' }, 500);
  }
});
