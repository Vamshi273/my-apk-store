import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Replace these two placeholders with the Project URL and publishable key
// from Supabase Dashboard -> Project Settings -> API.
const SUPABASE_URL = "https://clshwvpktoxiivufmkct.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_esGuRNQKwZCetlza57B44g_tWC4_EBk";
const BUCKET = "apk-files";
const MAX_APK_BYTES = 50 * 1024 * 1024;

const $ = (id) => document.getElementById(id);
const els = {
  appGrid: $("app-grid"), appCount: $("app-count"), status: $("library-status"),
  notice: $("notice"), adminOpen: $("admin-open"), signOut: $("sign-out"),
  adminPanel: $("admin-panel"), loginDialog: $("login-dialog"), loginForm: $("login-form"),
  loginClose: $("login-close"), loginError: $("login-error"), loginButton: $("login-button"),
  uploadForm: $("upload-form"), uploadButton: $("upload-button"), manageList: $("manage-list")
};

let supabase = null;
let currentUser = null;
let isAdmin = false;
let apps = [];

function showNotice(message, isError = false) {
  els.notice.textContent = message;
  els.notice.classList.toggle("error", isError);
  els.notice.classList.remove("hidden");
}
function hideNotice() { els.notice.classList.add("hidden"); }
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
function safeFileName(name) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "app.apk";
}
function fileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function initials(name) {
  return (name || "A").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}
function setAdminUI() {
  els.adminOpen.classList.toggle("hidden", isAdmin);
  els.signOut.classList.toggle("hidden", !currentUser);
  els.adminPanel.classList.toggle("hidden", !isAdmin);
}
function appCard(app) {
  const icon = app.icon_url
    ? `<img class="app-icon" src="${escapeHtml(app.icon_url)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;app-icon&quot;>${escapeHtml(initials(app.name))}</div>'">`
    : `<div class="app-icon">${escapeHtml(initials(app.name))}</div>`;
  return `<article class="app-card">
    <div class="app-card-top">${icon}<div><h3>${escapeHtml(app.name)}</h3><span class="version">Version ${escapeHtml(app.version)}</span></div></div>
    <p class="app-description">${escapeHtml(app.description)}</p>
    <div class="card-bottom"><span class="file-label">${escapeHtml(fileSize(app.file_size) || "Android APK")}</span><a class="button button-primary" href="${escapeHtml(app.apk_url)}" download>↓ Download</a></div>
  </article>`;
}
async function loadApps() {
  if (!supabase) return;
  els.status.textContent = "Loading…";
  const { data, error } = await supabase.from("apps").select("*").order("created_at", { ascending: false });
  if (error) {
    els.status.textContent = "Could not load apps";
    els.appGrid.innerHTML = `<div class="empty-state"><p>Could not load the app library.</p><small>${escapeHtml(error.message)}</small></div>`;
    return;
  }
  apps = data || [];
  els.appCount.textContent = apps.length;
  els.status.textContent = `${apps.length} app${apps.length === 1 ? "" : "s"} published`;
  els.appGrid.innerHTML = apps.length
    ? apps.map(appCard).join("")
    : `<div class="empty-state"><p>No apps published yet.</p><span>Check back soon for downloads.</span></div>`;
  renderManageList();
}
function renderManageList() {
  if (!isAdmin) return;
  els.manageList.innerHTML = apps.length ? apps.map(app => `
    <div class="manage-row">
      <div><strong>${escapeHtml(app.name)} <span class="version">v${escapeHtml(app.version)}</span></strong><small>${escapeHtml(app.apk_path)}</small></div>
      <button class="button delete-button" type="button" data-delete="${escapeHtml(app.id)}">Delete</button>
    </div>`).join("") : `<p class="muted">No apps published yet. Use the form above to upload your first APK.</p>`;
}
async function refreshAdminStatus(user) {
  currentUser = user || null;
  isAdmin = false;
  if (currentUser && supabase) {
    const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", currentUser.id).maybeSingle();
    isAdmin = !error && !!data;
  }
  setAdminUI();
  if (currentUser && !isAdmin) showNotice("You are signed in, but this account is not on the administrator allowlist.", true);
  else if (isAdmin) showNotice("Administrator access enabled.");
  else hideNotice();
  renderManageList();
}
async function uploadFile(bucket, path, file, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: contentType || file.type || "application/octet-stream"
  });
  if (error) throw error;
}
async function deleteApp(appId) {
  const app = apps.find(item => item.id === appId);
  if (!app || !confirm(`Delete "${app.name}" and its stored files? This cannot be undone.`)) return;
  showNotice("Deleting app…");
  const paths = [app.apk_path, app.icon_path].filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) { showNotice(`Could not delete stored files: ${storageError.message}`, true); return; }
  }
  const { error } = await supabase.from("apps").delete().eq("id", appId);
  if (error) { showNotice(`Could not delete app record: ${error.message}`, true); return; }
  showNotice("App deleted.");
  await loadApps();
}
function setupEvents() {
  els.adminOpen.addEventListener("click", () => {
    els.loginError.textContent = "";
    els.loginDialog.showModal();
  });
  els.loginClose.addEventListener("click", () => els.loginDialog.close());
  els.loginDialog.addEventListener("click", (event) => {
    if (event.target === els.loginDialog) els.loginDialog.close();
  });
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return;
    els.loginButton.disabled = true;
    els.loginError.textContent = "";
    const { error } = await supabase.auth.signInWithPassword({
      email: $("login-email").value.trim(), password: $("login-password").value
    });
    els.loginButton.disabled = false;
    if (error) { els.loginError.textContent = error.message; return; }
    const { data } = await supabase.auth.getUser();
    await refreshAdminStatus(data.user);
    els.loginDialog.close();
    if (isAdmin) {
      $("admin-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      showNotice("Signed in successfully.");
    }
  });
  els.signOut.addEventListener("click", async () => {
    await supabase.auth.signOut();
    await refreshAdminStatus(null);
    showNotice("Signed out.");
  });
  els.uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isAdmin || !currentUser) { showNotice("Administrator access is required.", true); return; }
    hideNotice();
    const name = $("app-name").value.trim();
    const version = $("app-version").value.trim();
    const description = $("app-description").value.trim();
    const apk = $("apk-file").files[0];
    const icon = $("app-icon").files[0];
    if (!apk || !name || !version || !description) { showNotice("Complete all required fields and select an APK.", true); return; }
    if (!apk.name.toLowerCase().endsWith(".apk")) { showNotice("Please choose a file ending in .apk.", true); return; }
    if (apk.size > MAX_APK_BYTES) { showNotice("This APK exceeds 50 MB. Choose a smaller file or use a storage plan that supports larger uploads.", true); return; }
    if (icon && !["image/png", "image/jpeg", "image/webp"].includes(icon.type)) { showNotice("Icon must be PNG, JPG, or WebP.", true); return; }

    els.uploadButton.disabled = true;
    els.uploadButton.textContent = "Uploading…";
    let apkPath = "";
    let iconPath = "";
    try {
      const id = crypto.randomUUID();
      apkPath = `${id}/${Date.now()}-${safeFileName(apk.name)}`;
      await uploadFile(BUCKET, apkPath, apk, "application/vnd.android.package-archive");
      const { data: apkPublic } = supabase.storage.from(BUCKET).getPublicUrl(apkPath);
      let iconUrl = null;
      if (icon) {
        iconPath = `${id}/icon-${safeFileName(icon.name)}`;
        await uploadFile(BUCKET, iconPath, icon, icon.type);
        const { data: iconPublic } = supabase.storage.from(BUCKET).getPublicUrl(iconPath);
        iconUrl = iconPublic.publicUrl;
      }
      const { error } = await supabase.from("apps").insert({
        name, version, description, apk_path: apkPath, apk_url: apkPublic.publicUrl,
        icon_path: iconPath || null, icon_url: iconUrl, file_size: apk.size, uploaded_by: currentUser.id
      });
      if (error) throw error;
      els.uploadForm.reset();
      showNotice("App uploaded and published successfully.");
      await loadApps();
    } catch (error) {
      // Clean up an uploaded object if metadata creation failed.
      const cleanup = [apkPath, iconPath].filter(Boolean);
      if (cleanup.length) await supabase.storage.from(BUCKET).remove(cleanup);
      showNotice(`Upload failed: ${error.message || "Unknown error"}`, true);
    } finally {
      els.uploadButton.disabled = false;
      els.uploadButton.textContent = "Upload app";
    }
  });
  els.manageList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete]");
    if (button) await deleteApp(button.dataset.delete);
  });
}
async function init() {
  setupEvents();
  if (SUPABASE_URL.startsWith("YOUR_") || SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")) {
    els.status.textContent = "Setup required";
    els.appGrid.innerHTML = `<div class="empty-state"><p>Connect your Supabase project to begin.</p><span>Follow the README setup steps, then publish to GitHub Pages.</span></div>`;
    showNotice("Setup needed: add your Supabase Project URL and publishable key in app.js.");
    return;
  }
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    await refreshAdminStatus(session?.user || null);
    supabase.auth.onAuthStateChange((_event, sessionNow) => {
      // Defer database work outside the auth callback to avoid locking auth state.
      setTimeout(() => refreshAdminStatus(sessionNow?.user || null), 0);
    });
    await loadApps();
  } catch (error) {
    els.status.textContent = "Setup error";
    showNotice(`Could not initialize Supabase: ${error.message}`, true);
  }
}
init();
