// Offline page: retry on demand and as soon as the connection comes back.
const status = document.getElementById("status");
function retry() {
  if (status) status.textContent = "جارٍ المحاولة… · Trying…";
  location.reload();
}
document.getElementById("retry")?.addEventListener("click", retry);
window.addEventListener("online", retry);
