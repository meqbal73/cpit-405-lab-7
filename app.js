/*
 * CPIT-405 Lab 7 - Unsplash search using three Ajax styles:
 *   1) XMLHttpRequest
 *   2) fetch() with Promises (.then/.catch)
 *   3) fetch() with async/await
 */

const API_URL = "https://api.unsplash.com/search/photos";
const PER_PAGE = 12;

const form = document.getElementById("search-form");
const keyInput = document.getElementById("api-key");
const toggleKeyBtn = document.getElementById("toggle-key");
const queryInput = document.getElementById("query");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const pager = document.getElementById("pager");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const pageInfo = document.getElementById("page-info");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");

let currentQuery = "";
let currentPage = 1;
let totalPages = 1;

// Remember the access key in this browser only (never committed to the repo).
try {
  keyInput.value = localStorage.getItem("unsplashKey") || "";
} catch (_) { /* storage may be unavailable */ }

function buildUrl(query, page) {
  const params = new URLSearchParams({
    query,
    page,
    per_page: PER_PAGE,
  });
  return `${API_URL}?${params}`;
}

/* ---------- 1) XMLHttpRequest ---------- */
function searchWithXHR(query, page, key) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", buildUrl(query, page));
    xhr.setRequestHeader("Authorization", `Client-ID ${key}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error("Invalid JSON response"));
        }
      } else {
        reject(new Error(describeHttpError(xhr.status)));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send();
  });
}

/* ---------- 2) fetch with Promises ---------- */
function searchWithPromises(query, page, key) {
  return fetch(buildUrl(query, page), {
    headers: { Authorization: `Client-ID ${key}` },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(describeHttpError(response.status));
    }
    return response.json();
  });
}

/* ---------- 3) fetch with async/await ---------- */
async function searchWithAsyncAwait(query, page, key) {
  const response = await fetch(buildUrl(query, page), {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status));
  }
  return await response.json();
}

function describeHttpError(status) {
  if (status === 401) return "Invalid access key (401).";
  if (status === 403) return "Rate limit reached or access denied (403).";
  return `Request failed with status ${status}.`;
}

/* ---------- DOM rendering ---------- */
function renderPhotos(photos) {
  resultsEl.replaceChildren();

  photos.forEach((photo) => {
    const figure = document.createElement("figure");
    figure.className = "card";
    figure.tabIndex = 0;

    const img = document.createElement("img");
    img.src = photo.urls.small;
    img.alt = photo.alt_description || `Photo by ${photo.user.name}`;
    img.loading = "lazy";

    const caption = document.createElement("figcaption");
    caption.append("Photo by ");
    const author = document.createElement("a");
    author.href = photo.user.links.html;
    author.target = "_blank";
    author.rel = "noopener noreferrer";
    author.textContent = photo.user.name;
    // Don't open the lightbox when the author link is clicked.
    author.addEventListener("click", (e) => e.stopPropagation());
    caption.append(author, " on Unsplash");

    figure.append(img, caption);

    // Mouse + keyboard interaction
    const open = () => openLightbox(photo);
    figure.addEventListener("click", open);
    figure.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    resultsEl.append(figure);
  });
}

function openLightbox(photo) {
  lightboxImg.src = photo.urls.regular;
  lightboxImg.alt = photo.alt_description || "";
  lightboxCaption.textContent = photo.description || photo.alt_description || `Photo by ${photo.user.name}`;
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.removeAttribute("src");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function updatePager() {
  pager.hidden = totalPages <= 1;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

/* ---------- Main search routine ---------- */
async function runSearch(page = 1) {
  const key = keyInput.value.trim();
  const query = queryInput.value.trim();
  if (!key || !query) return;

  try {
    localStorage.setItem("unsplashKey", key);
  } catch (_) { /* ignore */ }

  const method = form.elements["method"].value;
  const searchers = {
    xhr: searchWithXHR,
    promise: searchWithPromises,
    async: searchWithAsyncAwait,
  };

  setStatus("Loading...");
  try {
    const data = await searchers[method](query, page, key);
    currentQuery = query;
    currentPage = page;
    totalPages = data.total_pages || 1;

    renderPhotos(data.results);
    updatePager();

    if (data.results.length === 0) {
      setStatus(`No results for "${query}".`);
    } else {
      const label = { xhr: "XMLHttpRequest", promise: "Fetch + Promises", async: "Fetch + Async/Await" }[method];
      setStatus(`${data.total} results for "${query}" (via ${label}).`);
    }
  } catch (err) {
    resultsEl.replaceChildren();
    pager.hidden = true;
    setStatus(err.message, true);
  }
}

/* ---------- Events ---------- */
form.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch(1);
});

toggleKeyBtn.addEventListener("click", () => {
  keyInput.type = keyInput.type === "password" ? "text" : "password";
});

prevBtn.addEventListener("click", () => runSearch(currentPage - 1));
nextBtn.addEventListener("click", () => runSearch(currentPage + 1));

lightbox.addEventListener("click", closeLightbox);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lightbox.hidden) {
    closeLightbox();
    return;
  }
  // Arrow keys paginate, unless the user is typing in a field or viewing the lightbox.
  const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
  if (typing || !lightbox.hidden || pager.hidden) return;
  if (e.key === "ArrowLeft" && !prevBtn.disabled) runSearch(currentPage - 1);
  if (e.key === "ArrowRight" && !nextBtn.disabled) runSearch(currentPage + 1);
});
