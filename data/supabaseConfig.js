/**
 * La Hulpe 3 Fantasy Manager — Configuration Supabase
 *
 * L'URL et la clé "publishable" (anciennement "anon key") sont prévues pour
 * être publiques — elles sont visibles dans le code envoyé au navigateur de
 * chacun. La sécurité réelle vient des règles Row Level Security définies
 * dans supabase/schema.sql, pas du secret de ces valeurs.
 * Ne JAMAIS mettre ici une clé "service_role" (celle-là doit rester secrète).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.data = window.LH3.data || {};

  window.LH3.data.SUPABASE_CONFIG = {
    url: 'https://bhaigsokingvntqyytsm.supabase.co',
    publishableKey: 'sb_publishable_LW9qvyc_Hcj4SiEG0g5KUQ_DjNkqUyY',
  };
})();
