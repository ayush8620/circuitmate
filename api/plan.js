// POST /api/plan { idea, board, level, parts?, image?: dataURL (photo of parts or breadboard) }
const { gemmaJSON, readBody, parseImage } = require("./_gemma");
const BOARDS = ["Arduino Uno", "Arduino Nano", "ESP32", "ESP8266 (NodeMCU)", "Raspberry Pi Pico", "Raspberry Pi Pico W"];
const LEVELS = ["beginner", "intermediate", "advanced"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const b = readBody(req);
    const idea = String(b.idea || "").slice(0, 1500).trim();
    const image = parseImage(b.image);
    if (!idea && !image) return res.status(400).json({ error: "Describe what you want to build (or add a photo of your parts)" });
    const board = BOARDS.includes(b.board) ? b.board : "Arduino Uno";
    const level = LEVELS.includes(b.level) ? b.level : "beginner";
    const parts = String(b.parts || "").slice(0, 800);
    const lang = board.startsWith("Raspberry") ? "MicroPython" : "Arduino C++ (.ino)";

    const prompt = `You are CircuitMate, a patient electronics mentor for ${level} makers.
Board: ${board}. Code language: ${lang}.
Project idea: ${idea || "(see photo)"}
${parts ? `Parts the maker already has: ${parts}` : ""}
${image ? "The attached photo shows the maker's parts or breadboard. Identify the visible components, use them where possible, and point out any wiring mistakes you can see." : ""}
Use real pin names for ${board} (e.g. D2, A0, GPIO4, GP15). Respect voltage levels (3.3V vs 5V) and add resistors where needed.
Return ONLY JSON:
{"title":"project name","summary":"1-2 sentences","difficulty":"easy|medium|hard","timeMinutes":30,
"seenInPhoto":["components identified in the photo, empty if no photo"],
"parts":[{"name":"HC-SR04 ultrasonic sensor","qty":1,"note":"why / alternative","approxINR":120}],
"wiring":[{"from":"HC-SR04 VCC","to":"5V","note":""}],
"steps":["short build steps"],
"code":"complete, compilable ${lang} with comments",
"filename":"${lang.startsWith("Micro") ? "main.py" : "project.ino"}",
"libraries":["library names to install, empty if none"],
"test":["how to check it works, e.g. Serial Monitor at 9600 baud"],
"safety":["important cautions"],
"photoFeedback":"what looks right/wrong in the photo, or empty",
"nextIdeas":["2 upgrades"]}`;
    const { data, model } = await gemmaJSON(prompt, { images: image ? [image] : [], maxOutputTokens: 3500 });
    res.status(200).json({ ...data, board, model });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Something went wrong" });
  }
};
