"use strict";

/* ============================================================
   NakT — logique de l'application (JavaScript pur)
   ============================================================ */

// ---- CONFIGURATION : placez ici votre URL et votre clé ANON ----
// La clé "anon" est publique : elle est faite pour apparaître côté navigateur.
// La clé "service_role" ne doit JAMAIS être écrite ici.
const SUPABASE_URL = "https://bubuaqfophidvwezfvwn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jy6kC8RHihpZ8p7XGxQQxg_IwUVjhj_";

// Création du client Supabase (variable globale fournie par le CDN)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Déconnexion automatique après 15 min d'inactivité ----------
const DUREE_INACTIVITE_MS = 15 * 60 * 1000; // 15 minutes
let minuteurDeconnexion = null;

function redemarrerMinuteurInactivite() {
  clearTimeout(minuteurDeconnexion);
  minuteurDeconnexion = setTimeout(() => {
    sb.auth.signOut(); // déconnexion silencieuse après inactivité
  }, DUREE_INACTIVITE_MS);
}
// Toute interaction (clic, touche, mouvement) remet le compteur à zéro
["click", "keydown", "touchstart", "mousemove"].forEach((evt) =>
  document.addEventListener(evt, redemarrerMinuteurInactivite, { passive: true })
);

// ---------- Fonctions utilitaires ----------
// Toujours manipuler les dates en UTC pour éviter les décalages de fuseau.
function versISO(date) {
  return date.toISOString().slice(0, 10);
}
function depuisISO(chaine) {
  return new Date(chaine + "T00:00:00Z");
}
function ajouterJours(dateISO, n) {
  const d = depuisISO(dateISO);
  d.setUTCDate(d.getUTCDate() + n);
  return versISO(d);
}
function joursEntre(a, b) {
  return Math.round((depuisISO(b) - depuisISO(a)) / 86400000);
}
function formatDateFr(iso) {
  return depuisISO(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

// ---------- Vérification des réponses Supabase ----------
// On ne lit JAMAIS les données sans vérifier d'abord qu'il n'y a pas d'erreur.
function verifierReponse(reponse, messageErreur) {
  if (reponse.error) {
    console.error(messageErreur, reponse.error.message); // message technique, pas de données de santé
    throw new Error("Erreur de communication avec la base de données.");
  }
  return reponse.data || [];
}

// ---------- Calculs (transparents et documentés) ----------
// 1. Durée moyenne du cycle : moyenne des cycle_length enregistrés,
//    28 jours par défaut si aucun cycle.
function dureeMoyenneCycle(cycles) {
  if (cycles.length === 0) return 28;
  const somme = cycles.reduce((total, c) => total + c.cycle_length, 0);
  return Math.round(somme / cycles.length);
}

// 2. Prochaines règles = dernier start_date + durée moyenne.
// 3. Ovulation estimée = prochaines règles − 14 jours.
// 4. Fenêtre fertile = ovulation − 5 jours à ovulation + 1 jour.
// 5. Rappel de test = ovulation + 14 jours, ou prochaines règles si plus tôt.
function calculerEstimations(cycles) {
  if (cycles.length === 0) return null;
  const tries = [...cycles].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const dernierDebut = tries[0].start_date;
  const moyenne = dureeMoyenneCycle(cycles);
  const prochainesRegles = ajouterJours(dernierDebut, moyenne);
  const ovulation = ajouterJours(prochainesRegles, -14);
  const debutFenetre = ajouterJours(ovulation, -5);
  const finFenetre = ajouterJours(ovulation, 1);
  const rappelTest = joursEntre(ajouterJours(ovulation, 14), prochainesRegles) < 0
    ? prochainesRegles
    : ajouterJours(ovulation, 14);
  return { dernierDebut, moyenne, prochainesRegles, ovulation, debutFenetre, finFenetre, rappelTest };
}

// ---------- Affichage : jamais innerHTML avec des données utilisateur ----------
// On utilise createElement + textContent pour éviter toute injection (XSS).
function creerLigne(texte) {
  const li = document.createElement("li");
  li.textContent = texte;
  return li;
}

// ---------- État de l'application ----------
let cycles = [];
let entreesJournal = [];
let tests = [];

// ---------- Navigation entre les vues ----------
const vues = ["accueil", "cycle", "calendrier", "journal", "tests", "parametres"];
document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((b) => b.classList.remove("actif"));
    btn.classList.add("actif");
    vues.forEach((v) => {
      document.getElementById("vue-" + v).style.display = (v === btn.dataset.vue) ? "" : "none";
    });
  });
});

// ---------- Écrans : auth / consentement / application ----------
function afficherEcran(nom) {
  document.getElementById("ecran-auth").style.display = nom === "auth" ? "" : "none";
  document.getElementById("ecran-consentement").style.display = nom === "consentement" ? "" : "none";
  document.getElementById("application").style.display = nom === "app" ? "" : "none";
}

// Le consentement est mémorisé en mémoire (pas dans localStorage :
// aucune donnée de santé dans le stockage local).
let consentementAccepte = false;

document.getElementById("case-consentement").addEventListener("change", (e) => {
  document.getElementById("btn-accepter-consentement").disabled = !e.target.checked;
});
document.getElementById("btn-accepter-consentement").addEventListener("click", () => {
  consentementAccepte = true;
  afficherEcran("app");
  chargerDonnees();
});

// ---------- Authentification ----------
document.getElementById("btn-inscription").addEventListener("click", async () => {
  const email = document.getElementById("a-email").value.trim();
  const mdp = document.getElementById("a-mdp").value;
  const { error } = await sb.auth.signUp({ email, password: mdp });
  const zoneErreur = document.getElementById("auth-erreur");
  zoneErreur.textContent = error
    ? "Inscription impossible : " + error.message
    : "Compte créé ! Vérifiez votre boîte mail si une confirmation est demandée.";
});
document.getElementById("btn-connexion").addEventListener("click", async () => {
  const email = document.getElementById("a-email").value.trim();
  const mdp = document.getElementById("a-mdp").value;
  const { error } = await sb.auth.signInWithPassword({ email, password: mdp });
  document.getElementById("auth-erreur").textContent =
    error ? "Connexion impossible : email ou mot de passe incorrect." : "";
});
document.getElementById("btn-deconnexion").addEventListener("click", () => sb.auth.signOut());

// À chaque changement d'état de connexion (login, logout, session expirée)
sb.auth.onAuthStateChange(async (evenement, session) => {
  if (session?.user) {
    if (consentementAccepte) {
      afficherEcran("app");
      await chargerDonnees();
    } else {
      afficherEcran("consentement");
    }
    redemarrerMinuteurInactivite();
  } else {
    cycles = []; entreesJournal = []; tests = [];
    afficherEcran("auth");
  }
});

// ---------- Chargement des données (avec vérification des réponses) ----------
async function chargerDonnees() {
  let r = await sb.from("cycles").select("*").order("start_date", { ascending: false });
  cycles = verifierReponse(r, "lecture cycles");
  r = await sb.from("journal").select("*").order("entry_date", { ascending: false });
  entreesJournal = verifierReponse(r, "lecture journal");
  r = await sb.from("test_log").select("*").order("test_date", { ascending: false });
  tests = verifierReponse(r, "lecture tests");
  rafraichirTout();
}

function rafraichirTout() {
  rafraichirAccueil();
  rafraichirListes();
  rafraichirCalendrier();
}

// ---------- Vue Accueil ----------
function rafraichirAccueil() {
  const estimations = calculerEstimations(cycles);
  const aucun = "— (enregistrez d'abord un cycle)";
  if (!estimations) {
    ["acc-regles", "acc-ovulation", "acc-fenetre", "acc-rappel"].forEach(
      (id) => (document.getElementById(id).textContent = aucun)
    );
    document.getElementById("alerte-test").style.display = "none";
    return;
  }
  document.getElementById("acc-regles").textContent = formatDateFr(estimations.prochainesRegles);
  document.getElementById("acc-ovulation").textContent = formatDateFr(estimations.ovulation);
  document.getElementById("acc-fenetre").textContent =
    formatDateFr(estimations.debutFenetre) + " au " + formatDateFr(estimations.finFenetre);
  document.getElementById("acc-rappel").textContent = formatDateFr(estimations.rappelTest);

  // Rappel de test : message affiché quand la date est atteinte.
  const aujourdhui = versISO(new Date());
  const alerte = document.getElementById("alerte-test");
  if (aujourdhui >= estimations.rappelTest) {
    alerte.textContent = "Il est temps de faire un test de grossesse urinaire ou une prise de sang.";
    alerte.style.display = "";
  } else {
    alerte.style.display = "none";
  }
}

// ---------- Vue Cycle ----------
document.getElementById("form-cycle").addEventListener("submit", async (e) => {
  e.preventDefault();
  const zoneErreur = document.getElementById("cycle-erreur");
  zoneErreur.textContent = "";
  // Les limites sont vérifiées ici ET dans la base (contraintes CHECK).
  const dureeRegles = parseInt(document.getElementById("c-duree-regles").value, 10);
  const dureeCycle = parseInt(document.getElementById("c-duree-cycle").value, 10);
  if (!(dureeRegles >= 1 && dureeRegles <= 10)) { zoneErreur.textContent = "Durée des règles : entre 1 et 10."; return; }
  if (!(dureeCycle >= 20 && dureeCycle <= 45)) { zoneErreur.textContent = "Durée du cycle : entre 20 et 45."; return; }
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from("cycles").insert({
    user_id: user.id,
    start_date: document.getElementById("c-debut").value,
    period_length: dureeRegles,
    cycle_length: dureeCycle,
  });
  if (error) {
    zoneErreur.textContent = "Enregistrement refusé (vérifiez les valeurs saisies).";
    return;
  }
  await chargerDonnees();
});

function rafraichirListes() {
  // Cycles
  const listeCycles = document.getElementById("liste-cycles");
  listeCycles.textContent = "";
  cycles.forEach((c) => listeCycles.appendChild(
    creerLigne("Début : " + formatDateFr(c.start_date) +
      " — règles : " + c.period_length + " j — cycle : " + c.cycle_length + " j")
  ));
  // Journal
  const listeJournal = document.getElementById("liste-journal");
  listeJournal.textContent = "";
  entreesJournal.forEach((j) => listeJournal.appendChild(
    creerLigne(formatDateFr(j.entry_date) + " — humeur : " + (j.mood || "—") +
      " — symptômes : " + (j.symptoms || "—") +
      " — flux : " + (j.flow || "—") +
      " — température : " + (j.temperature ?? "—"))
  ));
  // Tests
  const listeTests = document.getElementById("liste-tests");
  listeTests.textContent = "";
  tests.forEach((t) => listeTests.appendChild(
    creerLigne(formatDateFr(t.test_date) + (t.note ? " — " + t.note : ""))
  ));
}

// ---------- Vue Calendrier mensuel ----------
let moisAffiche = new Date(); // 1er jour du mois affiché
moisAffiche.setUTCDate(1);

document.getElementById("cal-moins").addEventListener("click", () => {
  moisAffiche.setUTCMonth(moisAffiche.getUTCMonth() - 1); rafraichirCalendrier();
});
document.getElementById("cal-plus").addEventListener("click", () => {
  moisAffiche.setUTCMonth(moisAffiche.getUTCMonth() + 1); rafraichirCalendrier();
});

function rafraichirCalendrier() {
  const estimations = calculerEstimations(cycles);
  const table = document.getElementById("table-calendrier");
  table.textContent = "";
  document.getElementById("cal-titre").textContent =
    moisAffiche.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

  // Ligne d'en-tête : lundi → dimanche
  const ligneJours = document.createElement("tr");
  ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].forEach((j) => {
    const th = document.createElement("th");
    th.textContent = j;
    ligneJours.appendChild(th);
  });
  table.appendChild(ligneJours);

  // Construction des cellules du mois
  const annee = moisAffiche.getUTCFullYear();
  const mois = moisAffiche.getUTCMonth();
  const nbJours = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  const decalageLundi = (new Date(Date.UTC(annee, mois, 1)).getUTCDay() + 6) % 7;

  let ligne = document.createElement("tr");
  for (let i = 0; i < decalageLundi; i++) ligne.appendChild(document.createElement("td"));

  for (let jour = 1; jour <= nbJours; jour++) {
    const dateISO = versISO(new Date(Date.UTC(annee, mois, jour)));
    const cellule = document.createElement("td");
    const span = document.createElement("span");
    span.textContent = String(jour);
    if (estimations) {
      // Classe CSS selon la période (règles, fertile, ovulation, rappel)
      if (dateISO >= estimations.dernierDebut &&
          joursEntre(estimations.dernierDebut, dateISO) < (cycles[0]?.period_length ?? 5)) {
        span.classList.add("jour-regles");
      }
      if (dateISO >= estimations.debutFenetre && dateISO <= estimations.finFenetre) {
        span.classList.add("jour-fertile");
      }
      if (dateISO === estimations.ovulation) span.classList.add("jour-ovulation");
      if (dateISO === estimations.rappelTest) span.classList.add("jour-rappel");
    }
    cellule.appendChild(span);
    ligne.appendChild(cellule);
    if ((decalageLundi + jour) % 7 === 0) {
      table.appendChild(ligne);
      ligne = document.createElement("tr");
    }
  }
  table.appendChild(ligne);
}

// ---------- Vue Journal ----------
document.getElementById("form-journal").addEventListener("submit", async (e) => {
  e.preventDefault();
  const zoneErreur = document.getElementById("journal-erreur");
  zoneErreur.textContent = "";
  const tempBrute = document.getElementById("j-temp").value;
  const { error } = await sb.from("journal").insert({
    entry_date: document.getElementById("j-date").value,
    mood: document.getElementById("j-humeur").value.trim() || null,
    symptoms: document.getElementById("j-symptomes").value.trim() || null,
    flow: document.getElementById("j-flux").value,
    temperature: tempBrute ? parseFloat(tempBrute) : null,
  });
  if (error) {
    zoneErreur.textContent = "Enregistrement refusé (vérifiez les valeurs saisies).";
    return;
  }
  await chargerDonnees();
});

// ---------- Vue Tests ----------
document.getElementById("form-test").addEventListener("submit", async (e) => {
  e.preventDefault();
  const zoneErreur = document.getElementById("test-erreur");
  zoneErreur.textContent = "";
  // On enregistre UNIQUEMENT la date + une note libre. Jamais de résultat.
  const { error } = await sb.from("test_log").insert({
    test_date: document.getElementById("t-date").value,
    note: document.getElementById("t-note").value.trim() || null,
  });
  if (error) { zoneErreur.textContent = "Enregistrement refusé."; return; }
  await chargerDonnees();
});

// ---------- Paramètres : export JSON ----------
document.getElementById("btn-export").addEventListener("click", () => {
  const donnees = { cycles, journal: entreesJournal, tests };
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = "nakt-export.json";
  lien.click();
  URL.revokeObjectURL(lien.href);
});

// ---------- Paramètres : suppression du compte ----------
// Passe par la Edge Function "delete-account" (clé service_role côté serveur
// uniquement). Le cascade de la base efface d'abord toutes les lignes.
document.getElementById("btn-supprimer-compte").addEventListener("click", async () => {
  const confirmation = confirm(
    "Voulez-vous vraiment supprimer définitivement votre compte et toutes vos données ?"
  );
  if (!confirmation) return;
  const { data: session } = await sb.auth.getSession();
  const reponse = await fetch(SUPABASE_URL + "/functions/v1/delete-account", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.session.access_token },
  });
  if (reponse.ok) {
    await sb.auth.signOut();
    alert("Compte et données supprimés.");
  } else {
    alert("La suppression a échoué. Réessayez plus tard.");
  }
});
