// Timeline Viewer JavaScript - yearmaster.js
// Handles searching, filtering, and displaying timeline entries from timeline.html

(function () {
  const output = document.getElementById("output");
  const yearInput = document.getElementById("year");
  const btn = document.getElementById("show");
  const exampleBtn = document.getElementById("example");

  let parsedDoc = null;

  async function loadTimelineHtml() {
    try {
      const resp = await fetch("./timeline.html", { cache: "no-store" });
      if (!resp.ok) {
        output.innerHTML = `<div class="notice">Could not load <code>timeline.html</code> (HTTP ${resp.status}). Ensure this file is served from the repository root.</div>`;
        return;
      }
      const text = await resp.text();
      const parser = new DOMParser();
      parsedDoc = parser.parseFromString(text, "text/html");
      const cards = parsedDoc.querySelectorAll(".card");
      output.innerHTML = `<div class="notice">Loaded <code>timeline.html</code> with ${cards.length} cards. Enter a year and click Show.</div>`;
    } catch (err) {
      output.innerHTML = `<div class="notice">Error fetching <code>timeline.html</code>: ${escapeHtml(err.message)}</div>`;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function normalizeInput(raw) {
    if (!raw) return "";
    let s = raw.trim().toUpperCase();
    s = s.replace(/\s+/g, "");
    return s;
  }

  function tryFindById(doc, yearInput) {
    if (!doc) return null;
    const candidates = [];
    const norm = normalizeInput(yearInput);
    if (!norm) return null;
    candidates.push(norm);
    const digits = norm.replace(/[^0-9]/g, "");
    if (digits && digits.length <= 4) {
      candidates.push(digits.padStart(4, "0"));
    }
    if (!/BC$/.test(norm)) candidates.push(norm + "BC");
    if (digits && digits.length <= 4) candidates.push(digits.padStart(4, "0") + "BC");

    for (const id of candidates) {
      const el = doc.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  // Find all cards matching the first 4 digits of the year
  function findAllMatchingCards(doc, yearInput) {
    if (!doc) return [];
    const norm = normalizeInput(yearInput);
    const digits = norm.replace(/[^0-9]/g, "");
    if (!digits || digits.length === 0) return [];

    const first4 = digits.padStart(4, "0");
    const allCards = Array.from(doc.querySelectorAll(".card"));
    const matches = [];

    allCards.forEach((card) => {
      const cardId = card.id || "";
      // Check if card ID starts with the 4-digit year pattern
      if (cardId.match(new RegExp(`^${first4}`))) {
        matches.push(card);
      }
    });

    return matches;
  }

  function tryFindByHeadingText(doc, yearInput) {
    if (!doc) return null;
    const norm = normalizeInput(yearInput).replace(/BC$/, "");
    const headings = Array.from(doc.querySelectorAll(".timeline-h1"));
    const digits = norm.replace(/[^0-9]/g, "");
    if (digits) {
      const match = headings.find((h) => (h.textContent || "").replace(/\s+/g, "").includes(digits));
      if (match) return match.closest(".card");
    }
    const match2 = headings.find((h) => (h.textContent || "").toUpperCase().includes(yearInput.toUpperCase()));
    if (match2) return match2.closest(".card");
    return null;
  }

  function extractAndRender(card, yearInput) {
    if (!card) {
      output.innerHTML = `<div class="no-data-message">Sorry we have no information currently recorded about that year.</div>`;
      return;
    }

    const cardBody = card.querySelector(".card-body");
    const contentElement = cardBody || card;

    const h1 = contentElement.querySelector(".timeline-h1");
    const p = contentElement.querySelector(".timeline-p");
    const copy = contentElement.querySelector(".copyright-text");
    const romhm = contentElement.querySelector(".romhm-text");
    const linkContainer = contentElement.querySelector(".link-container");

    // Get image containers - handle both centered-figure and image-row
    const imageRows = contentElement.querySelectorAll(".image-row");
    const figures = contentElement.querySelectorAll("figure");

    const parts = [];
    if (h1) parts.push(`<div class="timeline-h1">${h1.innerHTML}</div>`);
    if (p) parts.push(`<div class="timeline-p">${p.innerHTML}</div>`);

    // Include image-row containers if they exist
    if (imageRows.length > 0) {
      imageRows.forEach((row) => {
        parts.push(`<div class="image-row">${row.innerHTML}</div>`);
      });
    } else {
      // Otherwise include individual figures
      figures.forEach((fig) => {
        const img = fig.querySelector("img");
        const caption = fig.querySelector("figcaption");
        if (img) {
          let figClass = fig.className ? fig.className : "centered-figure";
          let figHtml = `<figure class="${escapeHtml(figClass)}">`;
          figHtml += `<img src="${escapeHtml(img.src)}" width="${img.width || 300}" alt="${escapeHtml(img.alt || "")}">`;
          if (caption) {
            figHtml += `<figcaption>${caption.innerHTML}</figcaption>`;
          }
          figHtml += `</figure>`;
          parts.push(figHtml);
        }
      });
    }

    if (romhm) parts.push(`<div class="romhm-text">${romhm.innerHTML}</div>`);
    if (linkContainer) parts.push(`<div class="link-container">${linkContainer.innerHTML}</div>`);
    if (copy) parts.push(`<div class="copyright-text">${copy.innerHTML}</div>`);

    if (parts.length === 0) {
      parts.push(`<div class="notice">Found a card for <strong>${escapeHtml(yearInput)}</strong> but it contains no recognized fields. Showing raw HTML of the card:</div>`);
      parts.push(`<pre>${escapeHtml(card.innerHTML)}</pre>`);
    }

    output.innerHTML = parts.join("\n");
  }

  // Render dropdown menu for multiple matches
  function renderDropdownMenu(matchingCards, yearInput) {
    if (!matchingCards || matchingCards.length === 0) {
      output.innerHTML = `<div class="notice">No entries found for <strong>${escapeHtml(yearInput)}</strong>.</div>`;
      return;
    }

    if (matchingCards.length === 1) {
      extractAndRender(matchingCards[0], yearInput);
      return;
    }

    // Multiple matches: show dropdown
    let dropdownHtml = `<div class="match-dropdown">
      <strong>Multiple entries found for year ${escapeHtml(yearInput)}. Select one:</strong><br><br>
      <select id="matchSelect">`;

    matchingCards.forEach((card, idx) => {
      const h1 = card.querySelector(".timeline-h1");
      const title = h1 ? (h1.textContent || "").trim().substring(0, 80) : `Entry ${idx + 1}`;
      dropdownHtml += `<option value="${idx}">${escapeHtml(title)}</option>`;
    });

    dropdownHtml += `</select>
      <button id="selectBtn">Show Selected</button>
    </div>
    <div id="selectedContent"></div>`;

    output.innerHTML = dropdownHtml;

    const selectElem = document.getElementById("matchSelect");
    const selectBtn = document.getElementById("selectBtn");
    const selectedContent = document.getElementById("selectedContent");

    function showSelected() {
      const idx = parseInt(selectElem.value, 10);
      const card = matchingCards[idx];

      const cardBody = card.querySelector(".card-body");
      const contentElement = cardBody || card;

      const h1 = contentElement.querySelector(".timeline-h1");
      const p = contentElement.querySelector(".timeline-p");
      const copy = contentElement.querySelector(".copyright-text");
      const romhm = contentElement.querySelector(".romhm-text");
      const linkContainer = contentElement.querySelector(".link-container");

      // Get image containers - handle both centered-figure and image-row
      const imageRows = contentElement.querySelectorAll(".image-row");
      const figures = contentElement.querySelectorAll("figure");

      const parts = [];
      if (h1) parts.push(`<div class="timeline-h1">${h1.innerHTML}</div>`);
      if (p) parts.push(`<div class="timeline-p">${p.innerHTML}</div>`);

      // Include image-row containers if they exist
      if (imageRows.length > 0) {
        imageRows.forEach((row) => {
          parts.push(`<div class="image-row">${row.innerHTML}</div>`);
        });
      } else {
        // Otherwise include individual figures
        figures.forEach((fig) => {
          const img = fig.querySelector("img");
          const caption = fig.querySelector("figcaption");
          if (img) {
            let figClass = fig.className ? fig.className : "centered-figure";
            let figHtml = `<figure class="${escapeHtml(figClass)}">`;
            figHtml += `<img src="${escapeHtml(img.src)}" width="${img.width || 300}" alt="${escapeHtml(img.alt || "")}">`;
            if (caption) {
              figHtml += `<figcaption>${caption.innerHTML}</figcaption>`;
            }
            figHtml += `</figure>`;
            parts.push(figHtml);
          }
        });
      }

      if (romhm) parts.push(`<div class="romhm-text">${romhm.innerHTML}</div>`);
      if (linkContainer) parts.push(`<div class="link-container">${linkContainer.innerHTML}</div>`);
      if (copy) parts.push(`<div class="copyright-text">${copy.innerHTML}</div>`);

      selectedContent.innerHTML = parts.join("\n");
    }

    selectBtn.addEventListener("click", showSelected);
    selectElem.addEventListener("change", showSelected);

    // Auto-show first match
    showSelected();
  }

  // Execute search - called by Show button and Enter key
  function executeSearch() {
    const year = String(yearInput.value || "").trim();
    if (!year) {
      output.innerHTML = `<div class="notice">Please enter a year (e.g. 1833 or "49 BC").</div>`;
      return;
    }

    if (!parsedDoc) {
      output.innerHTML = `<div class="notice">timeline.html not loaded yet. Trying again...</div>`;
      loadTimelineHtml().then(() => {
        performSearch(year);
      });
      return;
    }

    performSearch(year);
  }

  // Search logic: try exact match, then multi-match, then heading match
  function performSearch(year) {
    // First, try to find an exact ID match
    const exactCard = tryFindById(parsedDoc, year);
    if (exactCard) {
      extractAndRender(exactCard, year);
      return;
    }

    // If no exact ID, look for all cards with matching first 4 digits
    const multiMatches = findAllMatchingCards(parsedDoc, year);
    if (multiMatches.length > 0) {
      renderDropdownMenu(multiMatches, year);
      return;
    }

    // Finally, try heading text match
    const headingCard = tryFindByHeadingText(parsedDoc, year);
    if (headingCard) {
      extractAndRender(headingCard, year);
      return;
    }

    // No matches found
    output.innerHTML = `<div class="no-data-message">Sorry we have no information currently recorded about that year.</div>`;
  }

  // Event listeners
  btn.addEventListener("click", executeSearch);

  // Pressing Enter in year input triggers search
  yearInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      executeSearch();
    }
  });

  exampleBtn.addEventListener("click", () => {
    output.innerHTML = `<div class="notice">Example inputs: <code>1833</code>, <code>946</code> (matches id "0946"), <code>49 BC</code> (matches "49BC").</div>`;
  });

  // Load timeline on page start
  loadTimelineHtml();
})();
