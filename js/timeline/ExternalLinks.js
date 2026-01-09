// ExternalLinks.js
// Ensures external links (links with different hostname) open in new tabs
// and include safe rel attributes. This mirrors the MutationObserver logic.

export default class ExternalLinks {
  constructor() {
    // nothing to init
  }

  update() {
    document.querySelectorAll(".link-container a[href]").forEach((link) => {
      try {
        // Skip if anchor is relative or same-host
        if (!link.hostname || link.hostname === window.location.hostname) return;
      } catch (e) {
        // malformed anchor - ignore
        return;
      }
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }

  bind() {
    // run once then observe for DOM changes
    this.update();
    new MutationObserver(() => this.update()).observe(document.body, { childList: true, subtree: true });
  }
}
