# NakT — suivi de cycle

Application web (téléphone Android et PC) pour suivre son cycle menstruel,
estimer l'ovulation et se rappeler quand faire un test de grossesse urinaire.
Outil d'estimation uniquement — pas une méthode de contraception ni un
diagnostic médical.

## 1. Créer le projet Supabase
1. Créez un compte sur https://supabase.com puis un nouveau projet.
2. Ouvrez **SQL Editor**, collez tout le contenu de `schema.sql`, exécutez.
3. Dans **Settings > API**, notez :
   - `Project URL` (ex. https://xxxx.supabase.co)
   - la clé `anon` **publique** (JAMAIS la clé `service_role`).
4. Collez ces deux valeurs dans les constantes en haut de `app.js`.
5. Déployez la Edge Function `delete-account` (voir le dossier
   `supabase/functions/delete-account/`) avec la CLI :
   `supabase functions deploy delete-account`
   La clé `service_role` est injectée automatiquement côté serveur.

## 2. Tester en local
```bash
# Servir le dossier en HTTPS local (CSP + Supabase exigent un contexte sécurisé)
npx serve .
# ou : python3 -m http.server 8000
