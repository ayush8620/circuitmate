const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let image = null, last = null;
const arr = (a) => (Array.isArray(a) ? a : a ? [a] : []); // models sometimes return a string instead of a list

function loadImage(file) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => fail(new Error("Could not read that image"));
    img.src = URL.createObjectURL(file);
  });
}
async function setFile(f) { if (!f || !f.type.startsWith("image/")) return; image = await loadImage(f); $("#preview").innerHTML = `<img src="${image}" alt="Parts photo">`; $("#dropText").innerHTML = `<span class="small">Tap to change photo</span>`; }
const drop = $("#drop");
drop.onclick = () => $("#file").click();
drop.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && $("#file").click();
$("#file").onchange = (e) => setFile(e.target.files[0]);
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); setFile(e.dataTransfer.files[0]); };
$("#sample").onclick = () => { $("#idea").value = "A parking sensor that beeps faster and lights red/yellow/green LEDs as an object gets closer"; $("#board").value = "Arduino Uno"; $("#level").value = "beginner"; $("#parts").value = "HC-SR04 ultrasonic sensor, active buzzer, red/yellow/green LEDs, 220Ω resistors, breadboard, jumper wires"; };

document.addEventListener("click", async (e) => {
  if (!last) return;
  if (e.target.id === "copy") { await navigator.clipboard.writeText(last.code || ""); e.target.textContent = "Copied ✓"; }
  if (e.target.id === "dl") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([last.code || ""], { type: "text/plain" })); a.download = last.filename || "project.ino"; a.click(); }
});

function render(d) {
  last = d;
  const total = arr(d.parts).reduce((a, p) => a + (Number(p.approxINR) || 0) * (Number(p.qty) || 1), 0);
  const parts = arr(d.parts).map((p) => `<tr><td>${esc(p.qty)}×</td><td><b>${esc(p.name)}</b><div class="muted small">${esc(p.note)}</div></td><td>₹${esc(p.approxINR)}</td></tr>`).join("");
  const wiring = arr(d.wiring).map((w) => `<tr><td>${esc(w.from)}</td><td>→</td><td><b>${esc(w.to)}</b></td><td class="muted small">${esc(w.note)}</td></tr>`).join("");
  const li = (a) => arr(a).map((x) => `<li>${esc(x)}</li>`).join("");
  $("#out").innerHTML = `
    <div class="row" style="justify-content:space-between"><div style="font-size:20px;font-weight:800">${esc(d.title)}</div>
      <div class="chips"><span class="badge ok">${esc(d.board)}</span><span class="badge warn">${esc(d.difficulty)}</span><span class="badge">⏱ ${esc(d.timeMinutes)} min</span></div></div>
    <p class="muted">${esc(d.summary)}</p>
    ${arr(d.seenInPhoto).length ? `<div class="sec"><h3>Seen in your photo</h3><div class="chips">${arr(d.seenInPhoto).map((s) => `<span class="badge ok">${esc(s)}</span>`).join("")}</div>${d.photoFeedback ? `<p class="small">${esc(d.photoFeedback)}</p>` : ""}</div>` : ""}
    <div class="sec"><h3>Parts · about ₹${total}</h3><table>${parts}</table></div>
    <div class="sec"><h3>Wiring</h3><table><tr><th>Component pin</th><th></th><th>Board pin</th><th>Note</th></tr>${wiring}</table></div>
    <div class="sec"><h3>Build steps</h3><ol>${li(d.steps)}</ol></div>
    <div class="sec"><div class="row" style="justify-content:space-between"><h3>Code · ${esc(d.filename)}</h3><div class="row"><button class="ghost" id="copy" type="button" style="padding:6px 10px;font-size:12px">Copy</button><button class="ghost" id="dl" type="button" style="padding:6px 10px;font-size:12px">Download</button></div></div>
      ${arr(d.libraries).length ? `<p class="small muted">Install libraries: ${esc(arr(d.libraries).join(", "))}</p>` : ""}<pre style="max-height:360px">${esc(d.code)}</pre></div>
    <div class="sec"><h3>Test it</h3><ul>${li(d.test)}</ul></div>
    ${arr(d.safety).length ? `<div class="sec"><h3>⚠ Safety</h3><ul class="warn">${li(d.safety)}</ul></div>` : ""}
    ${arr(d.nextIdeas).length ? `<div class="sec"><h3>Level up</h3><ul>${li(d.nextIdeas)}</ul></div>` : ""}
    <p class="muted small">Model: ${esc(d.model)} · Always double-check pins against your board's pinout.</p>`;
}

$("#go").onclick = async () => {
  $("#error").innerHTML = "";
  const idea = $("#idea").value.trim();
  if (!idea && !image) { $("#error").innerHTML = `<div class="err">Describe your idea or add a photo first.</div>`; return; }
  const btn = $("#go"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Designing circuit with Gemma 4…`;
  $("#out").innerHTML = `<div class="empty">Picking parts and writing code…</div>`;
  try {
    const r = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea, image, board: $("#board").value, level: $("#level").value, parts: $("#parts").value.trim() }) });
    const d = await r.json().catch(() => ({ error: "Server returned an invalid response" }));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    render(d);
  } catch (e) { $("#out").innerHTML = `<div class="empty">No plan yet.</div>`; $("#error").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  finally { btn.disabled = false; btn.textContent = "Plan my circuit"; }
};
