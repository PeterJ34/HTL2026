/********************************************************************************************
 * master.single.js
 * ------------------------------------------------------------------------------------------
 * A fully concatenated SINGLE-FILE rewrite of the modular ES6 code provided earlier.
 *
 * All classes and logic are wrapped into one file under the namespace:
 *      window.TimelineApp = { TimelineCore, TrackDuplicator, Controls, SliderController, ExternalLinks, CardLoader }
 *
 * The bootstrap runs automatically on DOMContentLoaded.
 *
 * Each class retains inline comments explaining every step, so you can learn from it.
 ********************************************************************************************/

// ==================================================================================================
// Create namespace container
// ==================================================================================================
window.TimelineApp = {};

// ==================================================================================================
//  CLASS 1: TimelineCore
// ==================================================================================================
window.TimelineApp.TimelineCore = class TimelineCore {
  constructor({ wrap, track }) {
    this.wrap = wrap; // visible container (#autoTimelineWrap)
    this.track = track; // scrolling track (#autoTimelineTrack)

    this.posY = 0; // current translateY position
    this.autoScroll = true; // auto scroll enabled?
    this.BASE_SPEED = 0.75; // pixels per frame

    this.cards = []; // first-half card set
    this.offsets = []; // pixel offsets for each card
    this.originalCount = 0; // number of unique cards before duplication
    this.halfTrackHeight = 0; // half of track height for wrapping

    this._running = false; // is animation loop running?
    this._boundAnimate = this._animate.bind(this);
  }

  computeOffsetsNow() {
    // Read all cards
    const all = Array.from(this.track.querySelectorAll(".card"));
    if (all.length === 0) {
      this.offsets = [];
      this.originalCount = 0;
      this.cards = [];
      this.halfTrackHeight = Math.round(this.track.scrollHeight / 2);
      return;
    }

    const firstCount = this.originalCount || all.length;
    this.cards = all.slice(0, firstCount);

    const firstTop = this.cards[0]?.offsetTop || 0;
    this.offsets = this.cards.map((c) => c.offsetTop - firstTop);

    this.halfTrackHeight = Math.round(this.track.scrollHeight / 2);
  }

  nearestCardIndex() {
    if (!this.offsets || this.offsets.length === 0) return 0;
    const dist = Math.abs(this.posY);
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < this.offsets.length; i++) {
      const d = Math.abs(dist - this.offsets[i]);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    return nearest;
  }

  _applyTransform() {
    this.track.style.transform = `translateY(${this.posY}px)`;
  }

  jumpToIndex(idx) {
    if (!this.offsets || this.offsets.length === 0) return;
    idx = Math.max(0, Math.min(this.offsets.length - 1, idx));
    let desired = -this.offsets[idx];

    while (this.halfTrackHeight > 0 && desired < -this.halfTrackHeight) desired += this.halfTrackHeight;

    while (this.halfTrackHeight > 0 && desired > 0) desired -= this.halfTrackHeight;

    this.posY = desired;
    this._applyTransform();
  }

  posYForIndex(i) {
    if (!this.offsets || this.offsets.length === 0) return 0;
    i = Math.max(0, Math.min(this.offsets.length - 1, i));
    return -this.offsets[i];
  }

  setAutoScroll(enabled) {
    this.autoScroll = !!enabled;
  }

  _animate() {
    if (this._running) {
      // auto-scroll movement
      if (this.autoScroll) this.posY -= this.BASE_SPEED;

      // wrap-around loop
      if (this.halfTrackHeight > 0) {
        if (this.posY <= -this.halfTrackHeight) this.posY += this.halfTrackHeight;

        if (this.posY > 0) this.posY -= this.halfTrackHeight;
      }

      // apply transform to DOM
      this._applyTransform();

      // next frame
      requestAnimationFrame(this._boundAnimate);
    }
  }

  start() {
    if (this._running) return;
    this._running = true;

    this.computeOffsetsNow();
    this._applyTransform();
    requestAnimationFrame(this._boundAnimate);
  }

  stop() {
    this._running = false;
  }
};

// ==================================================================================================
//  CLASS 2: TrackDuplicator
// ==================================================================================================
window.TimelineApp.TrackDuplicator = class TrackDuplicator {
  constructor(track) {
    this.track = track;
  }

  isAlreadyDuplicated() {
    const all = Array.from(this.track.querySelectorAll(".card"));
    if (all.length < 2) return false;

    if (all.length % 2 !== 0) return false;

    const half = all.length / 2;
    for (let i = 0; i < half; i++) {
      if (all[i].id !== all[i + half].id) return false;
    }
    return true;
  }

  duplicate() {
    if (!this.track) return;

    const all = Array.from(this.track.querySelectorAll(".card"));
    if (all.length === 0) return;
    if (this.isAlreadyDuplicated()) return;

    for (const c of all) {
      const clone = c.cloneNode(true);
      // keeps same ID (original behaviour)
      this.track.appendChild(clone);
    }
  }

  originalCount() {
    const all = Array.from(this.track.querySelectorAll(".card"));
    if (this.isAlreadyDuplicated()) return all.length / 2;
    return all.length;
  }
};

// ==================================================================================================
//  CLASS 3: Controls (Pause/Arrows/Pointer)
// ==================================================================================================
window.TimelineApp.Controls = class Controls {
  constructor({ timeline, wrap, upButton = null, downButton = null }) {
    this.timeline = timeline;
    this.wrap = wrap;
    this.up = upButton;
    this.down = downButton;

    this.arrowSpeed = 0;
    this.FAST_SPEED = 25;

    this.pauseIcon = null;

    this._resumeTimer = null;
    this.AUTO_RESUME_MS = 5000;
  }

  bind() {
    this._createPauseIcon();

    this.wrap.addEventListener("click", () => {
      const wasPaused = !this.timeline.autoScroll;
      this.timeline.setAutoScroll(wasPaused);
      this._showPauseIconTemporarily();

      clearTimeout(this._resumeTimer);
      if (!wasPaused) {
        this._resumeTimer = setTimeout(() => {
          this.timeline.setAutoScroll(true);
        }, this.AUTO_RESUME_MS);
      }
    });

    if (this.up) {
      this.up.addEventListener("mousedown", () => (this.arrowSpeed = this.FAST_SPEED));
      this.up.addEventListener("touchstart", () => (this.arrowSpeed = this.FAST_SPEED), { passive: true });
    }

    if (this.down) {
      this.down.addEventListener("mousedown", () => (this.arrowSpeed = -this.FAST_SPEED));
      this.down.addEventListener("touchstart", () => (this.arrowSpeed = -this.FAST_SPEED), { passive: true });
    }

    document.addEventListener("mouseup", () => (this.arrowSpeed = 0));
    document.addEventListener("touchend", () => (this.arrowSpeed = 0));

    const tick = () => {
      if (this.arrowSpeed !== 0) {
        this.timeline.posY += this.arrowSpeed;
        this.timeline.setAutoScroll(false);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _createPauseIcon() {
    this.pauseIcon = document.createElement("i");
    this.pauseIcon.id = "pauseIcon";
    this.pauseIcon.className = "fas fa-pause";

    Object.assign(this.pauseIcon.style, {
      position: "absolute",
      top: "50%",
      right: "29px",
      fontSize: "28px",
      color: "#9e1b32",
      cursor: "pointer",
      zIndex: "2000",
      opacity: "0.9",
      transition: "opacity 0.4s ease",
    });

    this.wrap.appendChild(this.pauseIcon);

    let fadeTimer = null;
    const scheduleFade = () => {
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => (this.pauseIcon.style.opacity = "0"), 2500);
    };

    this.wrap.addEventListener("mouseenter", () => {
      this.pauseIcon.style.opacity = "0.9";
      clearTimeout(fadeTimer);
    });

    this.wrap.addEventListener("mouseleave", scheduleFade);

    scheduleFade();
  }

  _showPauseIconTemporarily() {
    if (!this.pauseIcon) return;

    this.pauseIcon.className = this.timeline.autoScroll ? "fas fa-pause" : "fas fa-play";
    this.pauseIcon.style.opacity = "0.95";

    setTimeout(() => {
      this.pauseIcon.style.opacity = "0";
    }, 1800);
  }
};

// ==================================================================================================
//  CLASS 4: SliderController
// ==================================================================================================
window.TimelineApp.SliderController = class SliderController {
  constructor({ timeline, wrap, sidebar = null }) {
    this.timeline = timeline;
    this.wrap = wrap;
    this.sidebar = sidebar;

    this.slider = null;
    this.tooltip = null;

    this._onInput = this._onInput.bind(this);
    this._onChange = this._onChange.bind(this);
  }

  ensureExists() {
    if (!this.slider) {
      this.slider = document.createElement("input");
      this.slider.type = "range";
      this.slider.id = "timelineSlider";
      this.slider.min = 0;
      this.slider.max = 100;
      this.slider.step = 0.1;
      this.slider.value = 0;

      Object.assign(this.slider.style, {
        position: "fixed",
        transform: "rotate(-90deg)",
        cursor: "pointer",
        zIndex: "1600",
        background: "transparent",
        appearance: "none",
        height: "10px",
      });

      document.body.appendChild(this.slider);
    }

    if (!this.tooltip) {
      this.tooltip = document.createElement("div");
      this.tooltip.id = "sliderTooltip";

      Object.assign(this.tooltip.style, {
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

      document.body.appendChild(this.tooltip);
    }

    this.slider.addEventListener("input", this._onInput);
    this.slider.addEventListener("change", this._onChange);
  }

  layout() {
    if (!this.slider || !this.wrap) return;

    const wrapRect = this.wrap.getBoundingClientRect();
    const sidebarWidth = this.sidebar?.offsetWidth || 0;
    const gap = 18;

    const leftPos = Math.max(sidebarWidth + gap, 36);
    const topPos = wrapRect.top + wrapRect.height / 2;

    const sliderLength = Math.min(Math.max(wrapRect.height * 0.9, 200), window.innerHeight * 0.9);

    this.slider.style.width = `${sliderLength}px`;
    this.slider.style.left = `${leftPos}px`;
    this.slider.style.top = `${topPos}px`;
    this.slider.style.transform = `translate(-50%, -50%) rotate(-90deg)`;

    this.tooltip.style.left = `${leftPos + 26}px`;
  }

  _updateTooltipForValue(val) {
    if (!this.tooltip || !this.timeline.cards?.length) return;

    const percent = val / 100;
    const fracIndex = (1 - percent) * (this.timeline.cards.length - 1);
    const idx = Math.round(fracIndex);

    const title = this.timeline.cards[idx]?.querySelector(".timeline-h1")?.textContent?.trim() || `Card ${idx + 1}`;

    const wrapRect = this.wrap.getBoundingClientRect();
    const tooltipY = wrapRect.top + wrapRect.height * (1 - percent);

    this.tooltip.style.top = `${tooltipY - this.tooltip.offsetHeight / 2}px`;
    this.tooltip.textContent = title;
  }

  _onInput() {
    if (!this.timeline.offsets || this.timeline.offsets.length === 0) return;

    const val = Number(this.slider.value);
    const frac = (1 - val / 100) * (this.timeline.offsets.length - 1);

    const iL = Math.floor(frac);
    const iU = Math.min(this.timeline.offsets.length - 1, iL + 1);

    const t = frac - iL;

    const interp = this.timeline.offsets[iL] + (this.timeline.offsets[iU] - this.timeline.offsets[iL]) * t;

    this.timeline.posY = -interp;
    this.timeline._applyTransform();
    this.timeline.setAutoScroll(false);

    this.tooltip.style.opacity = "1";
    this._updateTooltipForValue(val);
  }

  _onChange() {
    if (!this.timeline.offsets || this.timeline.offsets.length === 0) return;

    const nearest = this.timeline.nearestCardIndex();
    this.timeline.jumpToIndex(nearest);

    setTimeout(() => (this.tooltip.style.opacity = "0"), 500);
  }
};

// ==================================================================================================
// CLASS 5: ExternalLinks
// ==================================================================================================
window.TimelineApp.ExternalLinks = class ExternalLinks {
  constructor() {}

  update() {
    document.querySelectorAll(".link-container a[href]").forEach((link) => {
      try {
        if (!link.hostname || link.hostname === window.location.hostname) return;
      } catch (e) {
        return;
      }

      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }

  bind() {
    this.update();

    new MutationObserver(() => this.update()).observe(document.body, { childList: true, subtree: true });
  }
};

// ==================================================================================================
// CLASS 6: CardLoader
// ==================================================================================================
window.TimelineApp.CardLoader = class CardLoader {
  bind() {
    document.querySelectorAll(".copy-card-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const cardId = btn.getAttribute("data-copy-card");
        const targetSelector = btn.getAttribute("data-copy-target");
        const target = document.querySelector(targetSelector);

        if (!target || !cardId) return;

        try {
          const resp = await fetch("/master.html");
          const text = await resp.text();

          const parser = new DOMParser();
          const doc = parser.parseFromString(text, "text/html");

          const card = doc.querySelector(`#autoTimelineTrack .card#${cardId}`);

          if (!card) {
            target.innerHTML = `<p style="color:red;">Card ${cardId} not found.</p>`;
            return;
          }

          const body = card.querySelector(".card-body");
          target.innerHTML = body ? body.innerHTML : "No card-body found.";
        } catch (err) {
          target.innerHTML = `<p style="color:red;">Error loading card.</p>`;
        }
      });
    });

    const load1707Btn = document.getElementById("load1707");
    const copyTarget = document.getElementById("card1707copy");

    if (load1707Btn && copyTarget) {
      load1707Btn.addEventListener("click", () => {
        const original = document.querySelector("#autoTimelineTrack .card#1707");
        if (!original) {
          copyTarget.innerHTML = "<p style='color:red;'>Card #1707 not found.</p>";
          return;
        }
        const cardBody = original.querySelector(".card-body");
        copyTarget.innerHTML = cardBody ? cardBody.innerHTML : "<p style='color:red;'>No card-body.</p>";
      });
    }
  }
};

// ==================================================================================================
// BOOTSTRAP — RUN EVERYTHING (automatically on DOMContentLoaded)
// ==================================================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Fetch DOM references
  const wrap = document.getElementById("autoTimelineWrap");
  const track = document.getElementById("autoTimelineTrack");
  const scrollUp = document.getElementById("scrollUp");
  const scrollDown = document.getElementById("scrollDown");
  const sidebar = document.querySelector(".sidebar");

  if (!wrap || !track) {
    console.warn("Timeline wrap/track not found.");
    return;
  }

  // Make instances
  const duplicator = new window.TimelineApp.TrackDuplicator(track);
  duplicator.duplicate();

  const core = new window.TimelineApp.TimelineCore({ wrap, track });
  core.originalCount = duplicator.originalCount();
  core.computeOffsetsNow();

  const controls = new window.TimelineApp.Controls({
    timeline: core,
    wrap: wrap,
    upButton: scrollUp,
    downButton: scrollDown,
  });
  controls.bind();

  const slider = new window.TimelineApp.SliderController({ timeline: core, wrap, sidebar });
  slider.ensureExists();
  slider.layout();

  window.addEventListener("resize", () => {
    core.computeOffsetsNow();
    slider.layout();
  });

  window.addEventListener("scroll", () => slider.layout());

  const ext = new window.TimelineApp.ExternalLinks();
  ext.bind();

  const loader = new window.TimelineApp.CardLoader();
  loader.bind();

  core.start();

  window.SBTL = window.SBTL || {};
  window.SBTL.core = core;
  window.SBTL.recompute = () => {
    duplicator.duplicate();
    core.originalCount = duplicator.originalCount();
    core.computeOffsetsNow();
    slider.layout();
  };
});
