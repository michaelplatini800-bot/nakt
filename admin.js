// Page admin : affiche seulement trois chiffres globaux.
const $ = (id) => document.getElementById(id);
const montrer = (texte) => { $("msg").textContent = texte; };

let sb = null;
try {
  if (!window.supabase) throw new Error("bibliothèque Supabase non chargée");
  sb = window.supabase.createClient("https://bubuaqfophidvwezfvwn.supabase.co", "sb_publishable_jy6kC8RHihpZ8p7XGxQQxg_IwUVjhj_");
} catch (e) {
  montrer("Erreur d'initialisation : " + e.message);
}

async function afficherStats() {
  const { data, error } = await sb.rpc("stats_admin");
  if (error) { montrer("Accès refusé : " + error.message); return; }
  $("s-total").textContent = data.comptes_total;
  $("s-7j").textContent = data.comptes_7_jours;
  $("s-cycles").textContent = data.cycles_total;
  $("zone-connexion").classList.add("hidden");
  $("zone-stats").classList.remove("hidden");
  montrer("");
}

$("btn-connexion").addEventListener("click", async () => {
  if (!sb) return;
  const { error } = await sb.auth.signInWithPassword({
    email: $("a-email").value.trim(),
    password: $("a-mdp").value,
  });
  if (error) { montrer("Connexion impossible : " + error.message); return; }
  afficherStats();
});

$("btn-google-admin").addEventListener("click", async () => {
  if (!sb) return;
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: "https://michaelplatini800-bot.github.io/nakt/admin.html" },
  });
  if (error) montrer("Connexion Google impossible : " + error.message);
});

$("btn-deconnexion").addEventListener("click", async () => {
  if (sb) await sb.auth.signOut();
  location.reload();
});

if (sb) {
  sb.auth.getSession().then(({ data }) => {
    if (data.session) afficherStats();
  });
}
