// master.bootstrap.js
// Entry point: imports modules, wires them up and starts the timeline.
// Include this in your page with:
// <script type="module" src="js/master.bootstrap.js" defer></script>

import TimelineCore from "./timeline/TimelineCore.js";
import TrackDuplicator from "./timeline/TrackDuplicator.js";
import Controls from "./timeline/Controls.js";
import SliderController from "./timeline/SliderController.js";
import ExternalLinks from "./timeline/ExternalLinks.js";
import CardLoader from "./timeline/CardLoader.js";

document.addEventListener("DOMContentLoaded", () => {
  // DOM refs (these IDs must exist in your HTML)
  const wrap = document.getElementById("autoTimelineWrap");
  const track = document.getElementById("autoTimelineTrack");
  const scrollUp = document.getElementById("scrollUp");
  const scrollDown = document.getElementById("scrollDown");
  const sidebar = document.querySelector(".sidebar");

  // sanity check — original code aborted if missing
  if (!wrap || !track) {
    console.warn("bootstrap: required #autoTimelineWrap or #autoTimelineTrack missing — aborting.");
    return;
  }

  // 1) make sure the track is duplicated (for infinite scroll)
  const duplicator = new TrackDuplicator(track);
  duplicator.duplicate(); // idempotent

  // 2) instantiate core timeline
  const core = new TimelineCore({ wrap, track });
  core.originalCount = duplicator.originalCount(); // let core know how many original cards
  core.computeOffsetsNow();

  // 3) create UI controls (pause icon, arrow behaviour)
  const controls = new Controls({ timeline: core, wrap, upButton: scrollUp, downButton: scrollDown });
  controls.bind();

  // 4) slider + tooltip
  const slider = new SliderController({ timeline: core, wrap, sidebar });
  slider.ensureExists();
  slider.layout();

  // keep slider positioned on resize/scroll
  window.addEventListener(
    "resize",
    () => {
      core.computeOffsetsNow();
      slider.layout();
    },
    { passive: true }
  );
  window.addEventListener("scroll", () => slider.layout(), { passive: true });

  // 5) external links safety
  const ext = new ExternalLinks();
  ext.bind();

  // 6) card loader for accordion
  const loader = new CardLoader();
  loader.bind();

  // 7) start the timeline animation
  core.start();

  // expose useful API for debugging
  window.SBTL = window.SBTL || {};
  window.SBTL.core = core;
  window.SBTL.recompute = () => {
    duplicator.duplicate();
    core.originalCount = duplicator.originalCount();
    core.computeOffsetsNow();
    slider.layout();
  };
});
