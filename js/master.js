// master.js - corrected, robust version
// Replaces previous master.js.  Keep as a standalone file and include with <script defer>.

document.addEventListener("DOMContentLoaded", () => {
  // --------------------
  // Basic DOM refs
  // --------------------
  const wrap = document.getElementById("autoTimelineWrap");
  const track = document.getElementById("autoTimelineTrack");
  const scrollUp = document.getElementById("scrollUp");
  const scrollDown = document.getElementById("scrollDown");
  const sidebar = document.querySelector(".sidebar");

  if (!wrap || !track) {
    console.warn("master.js: #autoTimelineWrap or #autoTimelineTrack missing — aborting.");
    return;
  }

  // --------------------
  // State vars
  // --------------------
  let posY = 0; // current translateY position (px)
  let autoScroll = true; // auto-scroll running
  let userPaused = false; // user paused (click / nav)
  let arrowSpeed = 0; // manual arrow speed applied while holding arrow
  const BASE_SPEED = 0.75; // px per frame when auto-scrolling
  const FAST_SPEED = 25; // px per frame when holding arrow
  const AUTO_RESUME_MS = 5000; // resume auto scroll after this milleseconds when user pauses

  let originalCount = 0; // number of unique cards (first half)
  let cards = []; // array of original first-half card elements
  let offsets = []; // offsets (px) of cards relative to first card top
  let lastIndex = 0;
  let halfTrackHeight = 0;
  let resumeTimer = null;

  // --------------------
  // Duplication - safe (idempotent)
  // --------------------
  function safeDuplicateTrack() {
    const all = Array.from(track.querySelectorAll(".card"));
    if (all.length === 0) return;
    // If already duplicated (even number & second half matches first), bail
    // Heuristic: if there are an even number and second half ids equal first half ids -> already duplicated
    if (all.length % 2 === 0) {
      const half = all.length / 2;
      let maybeDup = true;
      for (let i = 0; i < half; i++) {
        if (all[i].id !== all[i + half].id) {
          maybeDup = false;
          break;
        }
      }
      if (maybeDup) {
        originalCount = half;
        cards = all.slice(0, originalCount);
        return;
      }
    }

    // Not duplicated yet: clone originals and append clones
    const originals = Array.from(track.querySelectorAll(".card"));
    originalCount = originals.length;
    for (const c of originals) {
      const clone = c.cloneNode(true);
      track.appendChild(clone);
    }
    cards = Array.from(track.querySelectorAll(".card")).slice(0, originalCount);
  }

  safeDuplicateTrack();

  // --------------------
  // Offsets computation (robust)
  // --------------------
  function computeOffsetsNow() {
    // Re-read first-half cards (in case recompute is called after dynamic insertion)
    cards = Array.from(track.querySelectorAll(".card")).slice(0, originalCount || undefined);
    if (!cards || cards.length === 0) {
      offsets = [];
      lastIndex = -1;
      halfTrackHeight = track.scrollHeight / 2;
      return;
    }
    const firstTop = cards[0].offsetTop;
    offsets = cards.map((c) => c.offsetTop - firstTop);
    lastIndex = cards.length - 1;
    // halfTrackHeight depends on duplication
    halfTrackHeight = Math.round(track.scrollHeight / 2);
  }

  function computeOffsets() {
    // schedule after paint to allow images/DOM to settle
    requestAnimationFrame(() => {
      try {
        computeOffsetsNow();
      } catch (e) {
        console.warn("master: computeOffsets error", e);
      }
    });
  }

  computeOffsets();
  window.addEventListener("resize", computeOffsets);
  // Recompute when images finish loading inside the track
  Array.from(track.querySelectorAll("img")).forEach((img) => {
    if (!img.complete) img.addEventListener("load", computeOffsets);
  });

  // Expose recompute for dynamic additions
  window.SBTL = window.SBTL || {};
  window.SBTL.recompute = () => {
    safeDuplicateTrack();
    computeOffsets();
    positionSlider(); // ensure slider placement adjusts if track size changed
  };

  // --------------------
  // Scroll arrow behavior
  // --------------------
  [wrap, scrollUp, scrollDown].forEach((el) => {
    if (!el) return;
    el.addEventListener("mouseenter", () => (autoScroll = false));
    el.addEventListener("mouseleave", () => {
      if (!userPaused) autoScroll = true;
    });
  });

  if (scrollUp) {
    scrollUp.addEventListener("mousedown", () => (arrowSpeed = FAST_SPEED));
    scrollUp.addEventListener("touchstart", () => (arrowSpeed = FAST_SPEED), { passive: true });
  }
  if (scrollDown) {
    scrollDown.addEventListener("mousedown", () => (arrowSpeed = -FAST_SPEED));
    scrollDown.addEventListener("touchstart", () => (arrowSpeed = -FAST_SPEED), { passive: true });
  }
  document.addEventListener("mouseup", () => (arrowSpeed = 0));
  document.addEventListener("touchend", () => (arrowSpeed = 0));

  // --------------------
  // Pause icon (small UX)
  // --------------------
  const pauseIcon = document.createElement("i");
  pauseIcon.id = "pauseIcon";
  pauseIcon.className = "fas fa-pause";
  Object.assign(pauseIcon.style, {
    position: "absolute",
    top: "50%", //vertical position of pause button midway between scroll arrows
    right: "29px", //horizontal position of pause button
    fontSize: "28px",
    color: "#9e1b32", //Pause/play button colour
    cursor: "pointer",
    zIndex: "2000",
    opacity: "0.9",
    transition: "opacity 0.4s ease",
  });
  wrap.appendChild(pauseIcon);

  let fadeTimer = null;
  function scheduleFadeOut() {
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => (pauseIcon.style.opacity = "0"), 2500);
  }
  wrap.addEventListener("click", () => {
    userPaused = !userPaused;
    autoScroll = !userPaused;
    pauseIcon.className = userPaused ? "fas fa-play" : "fas fa-pause";
    pauseIcon.style.opacity = "0.9";
    scheduleFadeOut();
  });
  wrap.addEventListener("mouseenter", () => {
    pauseIcon.style.opacity = "0.9";
    clearTimeout(fadeTimer);
  });
  wrap.addEventListener("mouseleave", scheduleFadeOut);
  scheduleFadeOut();

  // --------------------
  // Slider + tooltip creation & logic
  // --------------------
  let slider = document.getElementById("timelineSlider");
  let tooltip = document.getElementById("sliderTooltip");

  function createSliderIfNeeded() {
    if (!slider) {
      slider = document.createElement("input");
      slider.type = "range";
      slider.id = "timelineSlider";
      slider.min = 0;
      slider.max = 100;
      slider.step = 0.1;
      slider.value = 0;
      Object.assign(slider.style, {
        position: "fixed",
        transform: "rotate(-90deg)",
        cursor: "pointer",
        zIndex: "1600",
        background: "transparent",
        appearance: "none",
        height: "10px",
      });
      document.body.appendChild(slider);
    }

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "sliderTooltip";
      Object.assign(tooltip.style, {
        position: "fixed",
        background: "#9e1b32",
        color: "#fff",
        padding: "6px 10px",
        borderRadius: "6px",
        fontSize: "0.9rem",
        pointerEvents: "none",
        zIndex: "1700",
        opacity: "0",
        transition: "opacity 0.15s ease, transform 0.15s ease",
      });
      document.body.appendChild(tooltip);
    }

    // inject minimal slider thumb CSS for visibility on all browsers
    // Slider colours set by this line of code:  linear-gradient(to right, #9e1b32 var(--sx, 0%), white var(--sx, 0%)); below
    if (!document.getElementById("sbt-slider-css")) {
      const style = document.createElement("style");
      style.id = "sbt-slider-css";
style.textContent = `
    /* Base element background (Firefox uses this) */
    #timelineSlider {
        background: linear-gradient(to right, #9e1b32 var(--sx, 0%), white var(--sx, 0%));
        outline: none;
    }

    /* WebKit browsers (Chrome, Edge, DuckDuckGo, Safari) */
    #timelineSlider::-webkit-slider-runnable-track {
        height: 10px;
        background: linear-gradient(to right, #9e1b32 var(--sx, 0%), white var(--sx, 0%));
    }

    #timelineSlider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #9e1b32;
        margin-top: -4px;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
    }

    /* Firefox track */
    #timelineSlider::-moz-range-track {
        height: 10px;
        background: linear-gradient(to right, #9e1b32 var(--sx, 0%), white var(--sx, 0%));
        border: none;
    }

    /* Firefox thumb */
    #timelineSlider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #9e1b32;
        border: none;
    }
`;

      document.head.appendChild(style);
    }
    // ensure CSS var has an initial value so the track shows correctly immediately
    if (slider) slider.style.setProperty("--sx", slider.value + "%");
  }

  createSliderIfNeeded();

  // Position slider flush to the right of sidebar and vertically centered on wrap
  function positionSlider() {
    if (!slider) return;
    const wrapRect = wrap.getBoundingClientRect();
    const sidebarWidth = sidebar?.offsetWidth || 0;
    const gap = 18;
    // We want the slider to be placed just to the right of the sidebar (on left side of timeline)
    const leftPos = Math.max(sidebarWidth + gap, 36);
    // center along wrap height
    const topPos = wrapRect.top + wrapRect.height / 2;
    // Limit slider "length" so it fits in viewport; width because element is rotated
    const sliderLength = Math.min(Math.max(wrapRect.height * 0.9, 200), window.innerHeight * 0.9);
    slider.style.width = `${sliderLength}px`;
    slider.style.left = `${leftPos}px`;
    slider.style.top = `${topPos}px`;
    // maintain rotate with a translate to center
    slider.style.transform = `translate(-50%, -50%) rotate(-90deg)`;
    // tooltip baseline approx to slider left
    tooltip.style.left = `${leftPos + 26}px`;
  }

  positionSlider();
  window.addEventListener("resize", positionSlider);
  window.addEventListener("scroll", positionSlider, { passive: true });

  // compute fractional index for a posY (distance absolute from first card)
  function fractionalIndexForPosY(y) {
    if (!offsets || offsets.length === 0) return 0;
    const dist = Math.abs(y);
    if (dist <= offsets[0]) return 0;
    if (dist >= offsets[offsets.length - 1]) return offsets.length - 1;
    for (let i = 0; i < offsets.length - 1; i++) {
      const a = offsets[i],
        b = offsets[i + 1];
      if (dist >= a && dist <= b) {
        const t = (dist - a) / (b - a);
        return i + t;
      }
    }
    return 0;
  }
  function nearestCardIndexForPosY(y) {
    if (!offsets || offsets.length === 0) return 0;
    let nearest = 0;
    let best = Infinity;
    const dist = Math.abs(y);
    for (let i = 0; i < offsets.length; i++) {
      const d = Math.abs(dist - offsets[i]);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    return nearest;
  }
  function posYForCardIndex(i) {
    if (!offsets || offsets.length === 0) return 0;
    i = Math.max(0, Math.min(offsets.length - 1, i));
    return -offsets[i];
  }

  // slider tick marks reflecting card positions
  function updateTickMarks() {
    if (!slider) return;
    const n = offsets.length;
    if (n < 2) {
      slider.style.background = "transparent";
      return;
    }
    const spacing = 100 / (n - 1);
    const stops = [];
    for (let i = 0; i < n; i++) {
      const pos = i * spacing;
      stops.push(`#9e1b32 ${pos}%`, `#9e1b32 ${Math.min(pos + 0.5, 100)}%`, `transparent ${Math.min(pos + 0.5, 100)}%`);
    }
    const gradient = `repeating-linear-gradient(to right, ${stops.join(", ")})`;
  // slider.style.background = gradient;
  }

  // show tooltip content for a slider value
  function updateTooltipForValue(val) {
    if (!tooltip || !cards.length) return;
    const percent = val / 100;
    const fracIndex = (1 - percent) * (cards.length - 1);
    const idx = Math.round(fracIndex);
    const title = (cards[idx]?.querySelector(".timeline-h1")?.textContent || `Card ${idx + 1}`).trim();
    const wrapRect = wrap.getBoundingClientRect();
    // compute Y position: map percentage along wrap height
    const tooltipY = wrapRect.top + wrapRect.height * (1 - percent);
    tooltip.style.top = `${tooltipY - tooltip.offsetHeight / 2}px`;
    tooltip.textContent = title;
  }

  // slider input: user dragging
  slider.addEventListener("input", () => {
    if (!offsets || offsets.length === 0) return;
    const val = Number(slider.value);
    const frac = (1 - val / 100) * (offsets.length - 1);
    const iL = Math.floor(frac);
    const iU = Math.min(offsets.length - 1, iL + 1);
    const t = frac - iL;
    const interp = offsets[iL] + (offsets[iU] - offsets[iL]) * t;
    posY = -interp;
    track.style.transform = `translateY(${posY}px)`;
    track.style.transition = "none";
    autoScroll = false;
    userPaused = true;
    tooltip.style.opacity = "1";
    updateTooltipForValue(val);

    // update track gradient so the portion above the thumb turns white while dragging
    slider.style.setProperty("--sx", slider.value + "%");
  });

  // slider change (release): snap to nearest card & hide tooltip
  slider.addEventListener("change", () => {
    if (!offsets || offsets.length === 0) return;
    const nearest = nearestCardIndexForPosY(posY);
    posY = posYForCardIndex(nearest);
    const newSliderValue = 100 - (nearest / (offsets.length - 1)) * 100;
    track.style.transition = "transform 0.45s ease-in-out";
    track.style.transform = `translateY(${posY}px)`;
    slider.value = newSliderValue;
    setTimeout(() => {
      track.style.transition = "none";
    }, 500);
    setTimeout(() => {
      tooltip.style.opacity = "0";
    }, 700);
    // ensure gradient stop matches final value
    slider.style.setProperty("--sx", slider.value + "%");
  });

  // keep slider synced to timeline continually
  function syncSliderLoop() {
    if (!slider || !offsets || offsets.length === 0) {
      requestAnimationFrame(syncSliderLoop);
      return;
    }
    const frac = fractionalIndexForPosY(posY);
    const val = 100 - (frac / (offsets.length - 1)) * 100;
    if (!slider.matches(":focus")) slider.value = val;

    // NEW: update gradient stop so the track above the thumb is white
    const pct = slider.value + "%";
    slider.style.setProperty("--sx", pct);
    requestAnimationFrame(syncSliderLoop);
  }
  syncSliderLoop();

  // --------------------
  // Sidebar links clicking --> navigate to card
  // --------------------
  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (!cards || cards.length === 0) return;

      // get target id from href or text
      const href = link.getAttribute("href");
      const targetId = href && href.startsWith("#") ? href.slice(1) : null;

      // try find index in original cards
      let idx = -1;
      if (targetId) {
        idx = cards.findIndex((c) => c.id === targetId);
      }
      if (idx === -1) {
        // fallback to match by heading text
        const txt = link.textContent.trim();
        idx = cards.findIndex((c) => (c.querySelector(".timeline-h1")?.textContent?.trim() || "") === txt);
      }
      if (idx === -1) return;

      // desired pos so that card appears at top of wrap with a little offset
      const wrapRect = wrap.getBoundingClientRect();
      const visibleTopOffset = Math.round(wrapRect.height * 0.05);
      let desiredPos = -offsets[idx] + visibleTopOffset;

      // normalize desiredPos into duplicated range (-halfTrackHeight .. 0]
      // use while loops to wrap; do NOT reset to 0 as that can jump wrong when further down
      while (desiredPos < -halfTrackHeight) desiredPos += halfTrackHeight;
      while (desiredPos > 0) desiredPos -= halfTrackHeight;

      // apply transform
      track.style.transition = "transform 0.5s ease-in-out";
      track.style.transform = `translateY(${desiredPos}px)`;
      setTimeout(() => {
        track.style.transition = "none";
        posY = desiredPos;
      }, 520);

      // pause and schedule resume
      autoScroll = false;
      userPaused = true;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        autoScroll = true;
        userPaused = false;
      }, AUTO_RESUME_MS);

      // temporary tooltip display
      slider.value = 100 - (idx / (offsets.length - 1)) * 100;
      tooltip.textContent = cards[idx]?.querySelector(".timeline-h1")?.textContent?.trim() || `Card ${idx + 1}`;
      tooltip.style.opacity = "1";
      
      setTimeout(() => {
        tooltip.style.opacity = "0";
      }, 1000);
    });
  });

  // --------------------
  // Auto animation loop (continuous)
  // --------------------
  function animate() {
    if (autoScroll && arrowSpeed === 0) posY -= BASE_SPEED;
    if (arrowSpeed !== 0) posY += arrowSpeed;

    // continuous wrap logic:
    // When we scroll past the halfHeight (i.e. past end of first copy), wrap by adding half height
    if (halfTrackHeight > 0) {
      if (posY <= -halfTrackHeight) posY += halfTrackHeight;
      if (posY > 0) posY -= halfTrackHeight;
    }

    // apply transform
    track.style.transform = `translateY(${posY}px)`;
    requestAnimationFrame(animate);
  }
  animate();

  // --------------------
  // initial tick/placement and sanity log
  // --------------------
  setTimeout(() => {
    computeOffsetsNow();
    halfTrackHeight = track.scrollHeight / 2;
    updateTickMarks();
    positionSlider();
    if (!offsets || offsets.length === 0) {
      console.warn("master: offsets missing - check cards markup.");
    } else {
      console.info("master: loaded", { originalCount, lastIndex, halfTrackHeight, offsetsCount: offsets.length });
    }
  }, 300);

  // --------------------
  // external links in content open in new tab for safety
  // --------------------
  function updateExternalLinks() {
    document.querySelectorAll(".link-container a[href]").forEach((link) => {
      try {
        if (!link.hostname || link.hostname === window.location.hostname) return;
      } catch (e) {
        /* malformed anchor */
      }
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }
  updateExternalLinks();
  new MutationObserver(updateExternalLinks).observe(document.body, { childList: true, subtree: true });

  // Accordion
  // --------------------------------------
  // COPY CARD CONTENT INTO ACCORDION
  // --------------------------------------
  const load1707Btn = document.getElementById("load1707");
  const copyTarget = document.getElementById("card1707copy");

  if (load1707Btn && copyTarget) {
    load1707Btn.addEventListener("click", () => {
      const originalCard = document.querySelector("#autoTimelineTrack .card#1707");

      if (!originalCard) {
        copyTarget.innerHTML = "<p style='color:red;'>Card #1707 not found.</p>";
        return;
      }

      // Clone only .card-body (not outer .card)
      const cardBody = originalCard.querySelector(".card-body");
      if (cardBody) {
        copyTarget.innerHTML = cardBody.innerHTML; // copy its contents
      }
    });
  }

  // part2 of accordion
  // ----------------------------------------------------------
  // CROSS-PAGE CARD LOADER
  // Loads card content from master.html and inserts into accordion
  // ----------------------------------------------------------

  document.querySelectorAll(".copy-card-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cardId = btn.getAttribute("data-copy-card");
      const targetSelector = btn.getAttribute("data-copy-target");
      const target = document.querySelector(targetSelector);

      if (!target) return;

      try {
        // Fetch the entire timeline page
        const response = await fetch("/master.html");
        const htmlText = await response.text();

        // Parse the HTML into a DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");

        // Look for the correct card inside master.html
        const card = doc.querySelector(`#autoTimelineTrack .card#${cardId}`);

        if (!card) {
          target.innerHTML = `<p style="color:red;">Card ${cardId} not found.</p>`;
          return;
        }

        // Copy ONLY the card-body
        const body = card.querySelector(".card-body");
        target.innerHTML = body ? body.innerHTML : "No card-body found.";
      } catch (err) {
        console.error(err);
        target.innerHTML = `<p style="color:red;">Error loading card.</p>`;
      }
    });
  });

  /*
  Utility to show images for a selected timeline entry.
  - If the value is a plain year (e.g. "1928") then images inside ALL cards whose id starts with that year are shown.
  - If the value contains letters after the year (e.g. "1928rh" or "1928ic") it is treated as an exact card id and
    only images inside that card are shown.
  - All other card images are hidden.
*/
function showImagesForSelection(value) {
  const track = document.getElementById('autoTimelineTrack');
  if (!track) return;

  // hide all images inside timeline cards
  const allCardImgs = track.querySelectorAll('.card img, .card figure img');
  allCardImgs.forEach(img => { img.style.display = 'none'; });

  if (!value) return;

  const yearOnly = /^\d{3,4}$/.test(value);
  const specificId = /^[0-9]{3,4}[A-Za-z]+$/.test(value) ? value : null;

  if (specificId) {
    // exact card id requested (e.g. "1928rh")
    const card = document.getElementById(specificId);
    if (card) {
      const imgs = card.querySelectorAll('img');
      imgs.forEach(img => { img.style.display = ''; });
      return;
    }
  }

  // fallback: show images for any card whose id starts with the year (e.g. "1928", matches "1928rh","1928ma"...)
  const yearMatch = value.match(/^(\d{3,4})/);
  if (yearMatch) {
    const year = yearMatch[1];
    const matches = track.querySelectorAll(`[id^="${year}"]`);
    matches.forEach(card => {
      const imgs = card.querySelectorAll('img');
      imgs.forEach(img => { img.style.display = ''; });
    });
  }
}

/*
  Auto-hook: attach change listeners to any select element that should control which images display.
  Add the class "year-class-selector" to the <select> element in your HTML (or adjust the selector below).
  The select's option values should be the id or year you want to show (e.g. value="1928rh" or value="1928").
*/
document.addEventListener('DOMContentLoaded', () => {
  const selectors = document.querySelectorAll('select.year-class-selector');
  selectors.forEach(sel => {
    sel.addEventListener('change', (e) => {
      showImagesForSelection(e.target.value);
    });

    // initialize on current value
    if (sel.value) showImagesForSelection(sel.value);
  });

  // If your existing code calls a function by year (e.g. showYear('1928')), make it compatible:
  window.showImagesForSelection = showImagesForSelection;
});
}); // end DOMContentLoaded
