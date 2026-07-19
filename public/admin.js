/* ==========================================
   NOVA AI — admin.js
   Dashboard réservé au compte admin
========================================== */

const SUPABASE_URL = "https://fokziksapqquupnibjau.supabase.co";
const SUPABASE_KEY = "sb_publishable_xdzZ4xtdJiv5koMxgZ8wzA_C1wCpV70";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authScreen = document.getElementById("authScreen");
const deniedScreen = document.getElementById("deniedScreen");
const dashboard = document.getElementById("dashboard");

function showOnly(el){
    [authScreen, deniedScreen, dashboard].forEach(e => e.classList.add("hidden"));
    el.classList.remove("hidden");
}

async function submitAdminAuth(){

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const errorBox = document.getElementById("authError");
    errorBox.textContent = "";

    if(!email || !password){
        errorBox.textContent = "Remplis l'email et le mot de passe.";
        return;
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if(error){
        errorBox.textContent = error.message;
        return;
    }

    checkAdminAndLoad(data.session.user);

}
window.submitAdminAuth = submitAdminAuth;

function adminLogout(){
    sb.auth.signOut().then(()=> location.reload());
}
window.adminLogout = adminLogout;

async function checkAdminAndLoad(user){

  const { data: profile, error } = await sb
        .from("profiles")
        .select("id, email, is_admin")
        .eq("id", user.id)
        .single();

console.log("PROFILE :", profile);
console.log("ERROR :", error);

    if(error || !profile || !profile.is_admin){
        showOnly(deniedScreen);
        return;
    }

    showOnly(dashboard);
    loadStats();
    setInterval(loadStats, 15000); // rafraîchit toutes les 15s

}

async function loadStats(){

    // Comptes créés
    const { count: accounts } = await sb
        .from("profiles")
        .select("*", { count: "exact", head: true });

    // Connectés dans les 2 dernières minutes
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count: online } = await sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", twoMinAgo);

    // Messages envoyés
    const { count: messages } = await sb
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("type", "message_sent");

    // Images générées
    const { count: images } = await sb
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("type", "image_generated");

    document.getElementById("statAccounts").textContent = accounts ?? "0";
    document.getElementById("statOnline").textContent = online ?? "0";
    document.getElementById("statMessages").textContent = messages ?? "0";
    document.getElementById("statImages").textContent = images ?? "0";

    loadActivity();

}

async function loadActivity(){

    const { data: events } = await sb
        .from("events")
        .select("type, created_at, profiles(email)")
        .order("created_at", { ascending: false })
        .limit(10);

    const box = document.getElementById("activityList");

    if(!events || !events.length){
        box.innerHTML = '<div class="activityRow">Aucune activité pour l\'instant.</div>';
        return;
    }

    const labels = {
        chat_created: "🆕 Nouvelle conversation",
        message_sent: "💬 Message envoyé",
        image_generated: "🖼️ Image générée"
    };

    box.innerHTML = events.map(ev => `
        <div class="activityRow">
            <span>${labels[ev.type] || ev.type} — ${ev.profiles?.email || "utilisateur"}</span>
            <span class="time">${new Date(ev.created_at).toLocaleString("fr-FR")}</span>
        </div>
    `).join("");

}

// ================= DEMARRAGE =================

sb.auth.getSession().then(({ data })=>{
    if(data.session){
        checkAdminAndLoad(data.session.user);
    }
    // sinon : reste sur l'écran de connexion
});
