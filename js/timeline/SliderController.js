// SliderController.js
// Creates and manages the vertical slider (rotated range input)
// and the tooltip that shows the active card title when dragging.
// This mirrors the custom slider in your original master.js.

export default class SliderController {
  /**
   * @param {Object} opts
   * @param {TimelineCore} opts.timeline
   * @param {HTMLElement} opts.wrap - used for measurements
   * @param {HTMLElement|null} opts.sidebar - sidebar reference to layout slider position
   */
  constructor({ timeline, wrap, sidebar = null }) {
    this.timeline = timeline;
    this.wrap = wrap;
    this.sidebar = sidebar;

    this.slider = null; // <input type="range">
    this.tooltip = null; // floating tooltip div

    // bind handlers
    this._onInput = this._onInput.bind(this);
    this._onChange = this._onChange.bind(this);
  }

  /**
   * Ensure the slider + tooltip exist; create if needed and append to body.
   */
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

    // bind events
    this.slider.addEventListener("input", this._onInput);
    this.slider.addEventListener("change", this._onChange);
  }

  /**
   * Position the slider next to the sidebar and vertically centered along the wrap.
   * This mirrors the positionSlider() logic in the original.
   */
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
    // tooltip baseline approx to slider left
    this.tooltip.style.left = `${leftPos + 26}px`;
  }

  // compute title from slider value and update tooltip position/content
  _updateTooltipForValue(val) {
    if (!this.tooltip || !this.timeline.cards?.length) return;
    const percent = val / 100;
    const fracIndex = (1 - percent) * (this.timeline.cards.length - 1);
    const idx = Math.round(fracIndex);
    const title = (this.timeline.cards[idx]?.querySelector(".timeline-h1")?.textContent || `Card ${idx + 1}`).trim();
    const wrapRect = this.wrap.getBoundingClientRect();
    const tooltipY = wrapRect.top + wrapRect.height * (1 - percent);
    this.tooltip.style.top = `${tooltipY - this.tooltip.offsetHeight / 2}px`;
    this.tooltip.textContent = title;
  }

  // user is dragging the slider: update timeline position live
  _onInput() {
    if (!this.timeline.offsets || this.timeline.offsets.length === 0) return;
    const val = Number(this.slider.value);
    const frac = (1 - val / 100) * (this.timeline.offsets.length - 1);
    const iL = Math.floor(frac);
    const iU = Math.min(this.timeline.offsets.length - 1, iL + 1);
    const t = frac - iL;
    const interp = this.timeline.offsets[iL] + (this.timeline.offsets[iU] - this.timeline.offsets[iL]) * t;
    // update timeline posY directly and show tooltip
    this.timeline.posY = -interp;
    this.timeline._applyTransform();
    this.timeline.setAutoScroll(false); // user is interacting -> pause auto-scroll
    this.tooltip.style.opacity = "1";
    this._updateTooltipForValue(val);
    // update slider CSS var for gradient if desired
    this.slider.style.setProperty("--sx", this.slider.value + "%");
  }

  // when user releases slider: snap to nearest card and hide tooltip
  _onChange() {
    if (!this.timeline.offsets || this.timeline.offsets.length === 0) return;
    const nearest = this.timeline.nearestCardIndex();
    this.timeline.jumpToIndex(nearest);
    // hide tooltip after short delay
    setTimeout(() => (this.tooltip.style.opacity = "0"), 500);
  }
}
