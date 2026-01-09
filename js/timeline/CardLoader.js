// CardLoader.js
// Cross-page card loader: given a button with data attributes, fetch master.html
// and inject the requested card-body into a target element.
// Matches your existing "copy-card-btn" behaviour.

export default class CardLoader {
  constructor() {
    // delegation for click handlers doesn't require constructor args
  }

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
          console.error("CardLoader error", err);
          target.innerHTML = `<p style="color:red;">Error loading card.</p>`;
        }
      });
    });

    // small helper for a dedicated "load1707" button (matches original)
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
}
