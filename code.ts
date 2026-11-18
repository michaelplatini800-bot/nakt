// supabase/functions/delete-account/index.ts
// Suppression du compte : nécessite la clé service_role, qui ne doit JAMAIS
// être placée dans le frontend. L'utilisateur appelle cette fonction avec son
// JWT ; on vérifie son identité avant de supprimer quoi que ce soit.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Le client envoie son propre jeton : on vérifie qui il est.
  const authHeader = req.headers.get("Authorization") ?? "";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // serveur uniquement
  );
  const { data: userData, error } = await admin.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (error || !userData?.user) {
    return new Response("Non authentifié", { status: 401 });
  }
  // delete_user efface la ligne auth.users ; les tables ont
  // "on delete cascade", donc cycles/journal/test_log sont supprimés aussi.
  const { error: delError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (delError) return new Response("Échec de suppression", { status: 500 });
  return new Response("Compte supprimé", { status: 200 });
});
