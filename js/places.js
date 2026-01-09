document.addEventListener("DOMContentLoaded", async () => {
  console.log("Loading timeline data (HTML + JSON)…");

  const accordion = document.getElementById("places");

  // Master cache — everything ends up here
  const timelineCache = {};

  /* ----------------------------------------------------
     1. LOAD sbtimeline.html (HTML CARDS)
  ---------------------------------------------------- */
  try {
    const htmlResponse = await fetch("sbtimeline.html");
    const html = await htmlResponse.text();

    const temp = document.createElement("div");
    temp.innerHTML = html;

    temp.querySelectorAll(".card[id]").forEach(card => {
      const id = card.getAttribute("id");
      timelineCache[id] = card.innerHTML;
    });

    console.log("Loaded HTML cards:", Object.keys(timelineCache));
  } catch (err) {
    console.error("Failed to load sbtimeline.html:", err);
  }



  /* ----------------------------------------------------
     2. LOAD timeline.json (JSON CARDS)
     (JSON will override HTML if IDs overlap — change this
      if you prefer HTML to override JSON)
  ---------------------------------------------------- */
  try {
    const jsonResponse = await fetch("timeline.json");
    const json = await jsonResponse.json();

    for (const id in json) {
      if (json[id].content) {
        timelineCache[id] = json[id].content; // JSON overrides HTML
      }
    }

    console.log("Loaded JSON cards:", Object.keys(json));
  } catch (err) {
    console.error("Failed to load timeline.json:", err);
  }



  /* ----------------------------------------------------
     3. Accordion handler — inject cached content
  ---------------------------------------------------- */
  accordion.addEventListener("shown.bs.collapse", event => {
    const panel = event.target;
    const target = panel.querySelector("[data-auto-load]");
    if (!target) return;

    const id = target.getAttribute("data-auto-load");

    target.innerHTML = timelineCache[id] || "<p>Not found</p>";

    // Scroll into view with navbar offset
    const navbar = document.querySelector("nav") || document.querySelector("#nav-placeholder");
    const navHeight = navbar ? navbar.offsetHeight : 0;

    const y = panel.getBoundingClientRect().top + window.scrollY - navHeight - 10;
    window.scrollTo({ top: y, behavior: "smooth" });
  });

});
