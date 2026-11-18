// Page admin : affiche seulement trois chiffres globaux.
// Aucune donnée personnelle n'est lue ici.
const sb = supabase.createClient("COLLER_URL", "COLLER_CLE");

const $ = (id) => document.getElementById(id);

async function afficherStats() {
  // La fonction refuse l'appel si le compte n'est pas admin.
  const { data, error } = await sb.rpc("stats_admin");
  if (error) {
    $("msg").textContent = "Accès refusé ou erreur de chargement.";
    return;
  }
  $("s-total").textContent = data.comptes_total;
  $("s-7j").textContent = data.comptes_7_jours;
  $("s-cycles").textContent = data.cycles_total;
  $("zone-connexion").classList.add("hidden");
  $("zone-stats").classList.remove("hidden");
  $("msg").textContent = "";
}

$("btn-connexion").addEventListener("click", async () => {
  const { error } = await sb.auth.signInWithPassword({
    email: $("a-email").value.trim(),
    password: $("a-mdp").value,
  });
  if (error) {
    $("msg").textContent = "Connexion impossible.";
    return;
  }
  afficherStats();
});

$("btn-deconnexion").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

// Si déjà connecté, on charge directement.
sb.auth.getSession().then(({ data }) => {
  if (data.session) afficherStats();
});

// Connexion admin avec Google. Le droit d'accès est vérifié par stats_admin côté base.
$("btn-google-admin").addEventListener("click", async () => {
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: "https://michaelplatini800-bot.github.io/nakt/admin.html" },
  });
  if (error) $("msg").textContent = "Connexion Google impossible.";
});
