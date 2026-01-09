// Controls.js
// Handles pause/resume, arrow buttons, pointer interactions, and the pause icon UI.
// This collects user input and modifies TimelineCore state (posY / autoScroll).

export default class Controls {
  /**
   * @param {Object} opts
   * @param {TimelineCore} opts.timeline - instance of TimelineCore
   * @param {HTMLElement} opts.wrap - the visible wrap element
   * @param {HTMLElement|null} opts.upButton - "scroll up" button element (optional)
   * @param {HTMLElement|null} opts.downButton - "scroll down" button element (optional)
   */
  constructor({ timeline, wrap, upButton = null, downButton = null }) {
    this.timeline = timeline;
    this.wrap = wrap;
    this.up = upButton;
    this.down = downButton;

    // hold state for manual arrow acceleration
    this.arrowSpeed = 0;
    this.FAST_SPEED = 25;

    // pause/play icon element created dynamically
    this.pauseIcon = null;

    // timers
    this._resumeTimer = null;
    this.AUTO_RESUME_MS = 5000; // resume auto-scroll after 5s if paused by user
  }

  /**
   * Initialize event listeners and the pause icon.
   */
  bind() {
    // create pause icon UI and append to wrap
    this._createPauseIcon();

    // toggles autoScroll and updates icon when wrap is clicked
    this.wrap.addEventListener("click", () => {
      // toggle paused state
      const wasPaused = !this.timeline.autoScroll;
      this.timeline.setAutoScroll(wasPaused);
      // show icon feedback
      this._showPauseIconTemporarily();
      // if paused schedule resume
      clearTimeout(this._resumeTimer);
      if (!wasPaused) {
        // user paused -> resume after AUTO_RESUME_MS
        this._resumeTimer = setTimeout(() => {
          this.timeline.setAutoScroll(true);
        }, this.AUTO_RESUME_MS);
      }
    });

    // arrow buttons (press and hold behaviour)
    if (this.up) {
      this.up.addEventListener("mousedown", () => (this.arrowSpeed = this.FAST_SPEED));
      this.up.addEventListener("touchstart", () => (this.arrowSpeed = this.FAST_SPEED), { passive: true });
    }
    if (this.down) {
      this.down.addEventListener("mousedown", () => (this.arrowSpeed = -this.FAST_SPEED));
      this.down.addEventListener("touchstart", () => (this.arrowSpeed = -this.FAST_SPEED), { passive: true });
    }
    // stop arrow movement on mouseup / touchend
    document.addEventListener("mouseup", () => (this.arrowSpeed = 0));
    document.addEventListener("touchend", () => (this.arrowSpeed = 0));

    // integrate arrowSpeed into timeline by using a RAF loop that adjusts posY directly
    // We use requestAnimationFrame to smoothly apply arrowSpeed when it is non-zero
    const tick = () => {
      if (this.arrowSpeed !== 0) {
        // apply speed directly to timeline position and temporarily disable auto-scroll
        this.timeline.posY += this.arrowSpeed;
        this.timeline.setAutoScroll(false);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _createPauseIcon() {
    // create an <i> element (fontawesome class expected by original)
    this.pauseIcon = document.createElement("i");
    this.pauseIcon.id = "pauseIcon";
    this.pauseIcon.className = "fas fa-pause"; // requires font-awesome loaded
    // inline styles to match original look
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
    // add to the wrap so it moves with the timeline (original appended to wrap)
    this.wrap.appendChild(this.pauseIcon);

    // hover and fade behaviour
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
    // swap icon class to indicate play/pause
    this.pauseIcon.className = this.timeline.autoScroll ? "fas fa-pause" : "fas fa-play";
    this.pauseIcon.style.opacity = "0.95";
    // fade out later
    setTimeout(() => {
      this.pauseIcon.style.opacity = "0";
    }, 1800);
  }
}
