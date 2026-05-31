// A self-contained mock of the member site + Google Voice, used to exercise the
// whole flow locally with no real data or accounts. Run it directly to explore
// it in a browser (`npm run mock:serve`), or import startMockServer() in tests.
import http from "node:http";

/** The fake membership data. Mirrors the real shape: folders → members, some
 * members have a phone, some only an email (those must be skipped). */
const FOLDERS = [
  {
    id: "new-signups",
    name: "New Signups",
    members: ["alice", "bob", "carol"],
  },
  {
    id: "returning",
    name: "Returning Members",
    members: ["dave", "erin", "frank", "grace"],
  },
];

const MEMBERS = {
  alice: { name: "Alice Adams", phone: "(555) 010-1001", email: null },
  bob: { name: "Bob Brown", phone: null, email: "bob@example.com" },
  carol: { name: "Carol Clark", phone: "555-010-1003", email: null },
  dave: { name: "Dave Diaz", phone: "5550101004", email: null },
  erin: { name: "Erin Estrada", phone: null, email: "erin@example.com" },
  frank: { name: "Frank Foster", phone: "+1 555 010 1006", email: null },
  grace: { name: "Grace Gomez", phone: "555.010.1007", email: null },
};

function initialMessage(member) {
  return `Hi ${member.name.split(" ")[0]}! Thanks for signing up. Reply STOP to opt out.`;
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5}
a{display:block;margin:8px 0;font-size:18px} button{font-size:16px;padding:8px 14px;margin:6px 0;cursor:pointer}
.hidden{display:none}</style></head><body>${body}</body></html>`;
}

function homePage() {
  const links = FOLDERS.map(
    (f) => `<a class="folder" href="/folder/${f.id}">${f.name} (${f.members.length})</a>`,
  ).join("");
  return page("Member App — Home", `<h1>Member App</h1><p>Folders:</p>${links}`);
}

function folderPage(folderId) {
  const folder = FOLDERS.find((f) => f.id === folderId);
  if (!folder) return null;
  const links = folder.members
    .map((id) => `<a class="member" href="/member/${id}">${MEMBERS[id].name}</a>`)
    .join("");
  return page(`Folder — ${folder.name}`, `<h1>${folder.name}</h1>${links}`);
}

function memberPage(memberId) {
  const m = MEMBERS[memberId];
  if (!m) return null;
  const contact = m.phone
    ? `<div id="member-phone">${m.phone}</div>`
    : `<div id="member-email">${m.email}</div>`;
  const msg = initialMessage(m);
  return page(
    `Member — ${m.name}`,
    `<h1 id="member-name">${m.name}</h1>
${contact}
<button id="copy-message" data-msg="${msg.replace(/"/g, "&quot;")}">copy initial message</button>
<section id="survey">
  <p>Did you reach out to this member?</p>
  <label><input type="radio" name="reached" id="survey-yes" value="yes"> Yes</label>
  <label><input type="radio" name="reached" value="no"> No</label>
  <button id="survey-submit">Save</button>
  <span id="survey-saved" class="hidden">Saved ✓</span>
</section>
<script>
  const memberId = ${JSON.stringify(memberId)};
  document.getElementById('copy-message').addEventListener('click', async (e) => {
    await navigator.clipboard.writeText(e.currentTarget.dataset.msg);
  });
  document.getElementById('survey-submit').addEventListener('click', async () => {
    const reachedOut = document.getElementById('survey-yes').checked;
    await fetch('/api/survey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberId, reachedOut }),
    });
    document.getElementById('survey-saved').classList.remove('hidden');
  });
</script>`,
  );
}

function googleVoicePage() {
  return page(
    "Mock Google Voice",
    `<h1>Mock Google Voice</h1>
<button id="gv-compose">Send new message</button>
<div>
  <input id="gv-recipient" placeholder="To" autocomplete="off" style="width:100%;margin:6px 0">
  <input id="gv-message" placeholder="Type a message" autocomplete="off" style="width:100%;margin:6px 0">
  <button id="gv-send">Send</button>
  <span id="gv-sent" class="hidden">Sent ✓</span>
</div>
<script>
  const sent = document.getElementById('gv-sent');
  document.getElementById('gv-compose').addEventListener('click', () => {
    document.getElementById('gv-recipient').value = '';
    document.getElementById('gv-message').value = '';
    sent.classList.add('hidden');
    document.getElementById('gv-recipient').focus();
  });
  document.getElementById('gv-send').addEventListener('click', async () => {
    const to = document.getElementById('gv-recipient').value;
    const body = document.getElementById('gv-message').value;
    await fetch('/api/record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, body }),
    });
    sent.classList.remove('hidden');
  });
</script>`,
  );
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

export async function startMockServer(port = 0) {
  const sentMessages = [];
  const surveys = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;

    const html = (body) => {
      if (body == null) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
    };
    const json = (obj, code = 200) => {
      res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(obj));
    };

    if (req.method === "POST" && path === "/api/record") {
      sentMessages.push(JSON.parse(await readBody(req)));
      return json({ ok: true });
    }
    if (req.method === "POST" && path === "/api/survey") {
      surveys.push(JSON.parse(await readBody(req)));
      return json({ ok: true });
    }
    if (path === "/api/records") return json(sentMessages);
    if (path === "/api/surveys") return json(surveys);
    if (req.method === "POST" && path === "/api/reset") {
      sentMessages.length = 0;
      surveys.length = 0;
      return json({ ok: true });
    }

    if (path === "/") return html(homePage());
    if (path === "/gv") return html(googleVoicePage());
    if (path.startsWith("/folder/")) return html(folderPage(path.slice("/folder/".length)));
    if (path.startsWith("/member/")) return html(memberPage(path.slice("/member/".length)));

    res.writeHead(404).end("not found");
  });

  await new Promise((resolve) => server.listen(port, resolve));
  const actualPort = server.address().port;
  const base = `http://127.0.0.1:${actualPort}`;

  return {
    port: actualPort,
    base,
    homeUrl: `${base}/`,
    gvUrl: `${base}/gv`,
    async records() {
      const r = await fetch(`${base}/api/records`);
      return r.json();
    },
    async surveys() {
      const r = await fetch(`${base}/api/surveys`);
      return r.json();
    },
    async reset() {
      await fetch(`${base}/api/reset`, { method: "POST" });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

// Run standalone for manual exploration.
const isMain = import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const port = Number(process.env.MOCK_PORT ?? 8787);
  const srv = await startMockServer(port);
  console.log(`Mock member app:   ${srv.homeUrl}`);
  console.log(`Mock Google Voice: ${srv.gvUrl}`);
  console.log("Press Ctrl+C to stop.");
}
