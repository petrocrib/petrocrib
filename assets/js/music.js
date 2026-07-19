/* PETROCRIB — site music toggle. Off by default; remembers the visitor's choice.
   If they turned it on before, it resumes on their first tap/scroll (browsers
   block true autoplay, this is the closest respectful equivalent). */
(function () {
  var audio = new Audio("assets/audio/theme.mp3");
  audio.loop = true;
  audio.volume = 0.55;
  audio.preload = "none";

  var btn = document.createElement("button");
  btn.className = "music-btn";
  btn.setAttribute("aria-label", "Toggle music");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M11 5 6.5 8.5H3v7h3.5L11 19z"/>' +
    '<path class="mw1" d="M15 9.5a3.5 3.5 0 0 1 0 5"/>' +
    '<path class="mw2" d="M17.5 7a7 7 0 0 1 0 10"/>' +
    '<line class="moff" x1="4" y1="4" x2="20" y2="20"/></svg>';
  document.body.appendChild(btn);

  var on = false;
  function paint() {
    btn.classList.toggle("playing", on);
  }
  function play() {
    audio.play().then(function () { on = true; paint(); }).catch(function () {});
  }
  function stop() {
    audio.pause(); on = false; paint();
  }
  btn.addEventListener("click", function () {
    if (on) { stop(); try { localStorage.setItem("pc_music", "0"); } catch (e) {} }
    else { play(); try { localStorage.setItem("pc_music", "1"); } catch (e) {} }
  });

  var pref = null;
  try { pref = localStorage.getItem("pc_music"); } catch (e) {}
  if (pref === "1") {
    play(); /* may be blocked pre-interaction */
    var resume = function () {
      if (!on) play();
      removeEventListener("pointerdown", resume);
      removeEventListener("keydown", resume);
    };
    addEventListener("pointerdown", resume);
    addEventListener("keydown", resume);
  }
  paint();
})();
