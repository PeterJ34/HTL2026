// TrackDuplicator.js
// Ensures the .card elements are duplicated so infinite scrolling can work.
// The original master.js duplicated the track; this class makes it explicit.

export default class TrackDuplicator {
  /**
   * @param {HTMLElement} track - the element containing the .card children
   */
  constructor(track) {
    this.track = track;
  }

  /**
   * Heuristic to detect whether the track is already duplicated:
   * - if card count is even and the second half IDs match first half IDs -> duplicated
   * Returns true/false.
   */
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

  /**
   * Duplicate the current sequence of cards by appending clones.
   * This method is idempotent: it checks duplication first.
   */
  duplicate() {
    if (!this.track) return;
    const all = Array.from(this.track.querySelectorAll(".card"));
    if (all.length === 0) return;
    if (this.isAlreadyDuplicated()) return; // already done

    // clone each card node and append
    for (const c of all) {
      const clone = c.cloneNode(true);
      this.track.appendChild(clone);
    }
  }

  /**
   * Returns the count of original elements (half of total if duplicated)
   */
  originalCount() {
    const all = Array.from(this.track.querySelectorAll(".card"));
    if (this.isAlreadyDuplicated()) return all.length / 2;
    return all.length;
  }
}
