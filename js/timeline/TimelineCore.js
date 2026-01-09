// TimelineCore.js
// Main class that manages the timeline track position, animation loop,
// offsets calculation, and provides an API to move to card indices.
//
// Usage:
//   const core = new TimelineCore({ wrap: elWrap, track: elTrack });
//   core.start();          // begins internal animation loop
//   core.setAutoScroll(true/false); // toggle auto-scroll
//   core.jumpToIndex(i);   // snap to card i

export default class TimelineCore {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.wrap  - the visible viewport container (#autoTimelineWrap)
   * @param {HTMLElement} opts.track - the vertical track that is translated (#autoTimelineTrack)
   */
  constructor({ wrap, track }) {
    // elements references
    this.wrap = wrap;
    this.track = track;

    // translation state (posY is the transform Y applied to track)
    // We keep posY in pixels; negative values = scrolled down the timeline.
    this.posY = 0;

    // auto-scroll flag & speeds
    this.autoScroll = true;
    this.BASE_SPEED = 0.75; // px per frame when auto-scrolling (tweakable)

    // layout metadata
    this.cards = []; // array of original (first-half) cards
    this.offsets = []; // offsets (px) of each original card relative to first
    this.originalCount = 0; // number of unique cards
    this.halfTrackHeight = 0;

    // internal flags
    this._running = false;
    this._boundAnimate = this._animate.bind(this); // requestAnimationFrame handler
  }

  // ---------- measurements ----------
  /**
   * Reads DOM and computes offsets for the *original* set of cards.
   * Must be called any time layout/size changes (images load, resize).
   */
  computeOffsetsNow() {
    // read current card set (first half only)
    const all = Array.from(this.track.querySelectorAll(".card"));
    if (all.length === 0) {
      this.offsets = [];
      this.originalCount = 0;
      this.cards = [];
      this.halfTrackHeight = Math.round(this.track.scrollHeight / 2);
      return;
    }

    // if we've duplicated the track (common approach), we want only the first half
    // originalCount should have been set by duplication; if not, assume all are original
    const firstCount = this.originalCount || all.length;
    this.cards = all.slice(0, firstCount);

    // first card top: base reference point
    const firstTop = this.cards[0]?.offsetTop || 0;

    // offsets measured relative to first card top
    this.offsets = this.cards.map((c) => c.offsetTop - firstTop);

    // recompute halfTrackHeight for wrap-around logic
    this.halfTrackHeight = Math.round(this.track.scrollHeight / 2);
  }

  /**
   * Helper: get card index nearest to current posY.
   */
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

  // ---------- translation API ----------
  /**
   * Apply translateY to the track (mutates DOM).
   * We keep no transition here; call setTransition if you want animation.
   */
  _applyTransform() {
    // set transform using translateY
    this.track.style.transform = `translateY(${this.posY}px)`;
  }

  /**
   * Programmatic snap to a card index (instant or animated depending on transition CSS).
   * @param {number} idx - index in [0..originalCount-1]
   */
  jumpToIndex(idx) {
    if (!this.offsets || this.offsets.length === 0) return;
    idx = Math.max(0, Math.min(this.offsets.length - 1, idx));
    // desired posY places the card at top of wrap: negative offset
    const desired = -this.offsets[idx];
    // normalize into duplicated track space (-halfTrackHeight .. 0]
    let val = desired;
    while (this.halfTrackHeight > 0 && val < -this.halfTrackHeight) val += this.halfTrackHeight;
    while (this.halfTrackHeight > 0 && val > 0) val -= this.halfTrackHeight;
    this.posY = val;
    this._applyTransform();
  }

  /**
   * Returns the posY that would align with a card index (useful to compute sliders).
   */
  posYForIndex(i) {
    if (!this.offsets || this.offsets.length === 0) return 0;
    i = Math.max(0, Math.min(this.offsets.length - 1, i));
    return -this.offsets[i];
  }

  // ---------- auto-scroll control ----------
  setAutoScroll(enabled) {
    this.autoScroll = !!enabled;
  }

  // ---------- animation loop ----------
  /**
   * Internal animation frame callback. It performs:
   *  - optionally advance posY when autoScroll is true
   *  - wrap posY when passing halfTrackHeight to create seamless loop
   *  - apply the transform into the DOM
   */
  _animate() {
    // if running and autoScroll is on we advance by BASE_SPEED pixels per frame
    if (this._running) {
      if (this.autoScroll) {
        this.posY -= this.BASE_SPEED;
      }
      // wrap logic: keep posY inside (-halfTrackHeight, 0] to loop seamlessly
      if (this.halfTrackHeight > 0) {
        if (this.posY <= -this.halfTrackHeight) this.posY += this.halfTrackHeight;
        if (this.posY > 0) this.posY -= this.halfTrackHeight;
      }
      // write transform
      this._applyTransform();
      // schedule next frame
      requestAnimationFrame(this._boundAnimate);
    }
  }

  /**
   * Start the animation loop and compute initial layout.
   */
  start() {
    if (this._running) return;
    this._running = true;
    // compute measurements now
    this.computeOffsetsNow();
    // ensure transform matches state then start RAF loop
    this._applyTransform();
    requestAnimationFrame(this._boundAnimate);
  }

  /**
   * Stop the requested animation loop.
   */
  stop() {
    this._running = false;
  }
}
