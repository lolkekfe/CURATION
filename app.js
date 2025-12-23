/* ===== AUTH SYSTEM ===== */
const HASH_ADMIN   = "10cda"; // EOD
const HASH_CURATOR = "be32";  // 123
let CURRENT_ROLE = null;

/* ===== LOGIN ===== */
function login() {
    const input = document.getElementById("password").value.trim();
    const hash = simpleHash(input);

    if (hash === HASH_ADMIN) {
        CURRENT_ROLE = "ADMIN";
        enterSystem();
    } else if (hash === HASH_CURATOR) {
        CURRENT_ROLE = "CURATOR";
        enterSystem();
    } else {
        document.getElementById("login-error").textContent = "ACCESS DENIED";
    }
}

function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return h.toString(16);
}

/* ===== TERMINAL & SIDEBAR ===== */
let reports = [];
let reportsFirebase = {};

function setupSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.innerHTML = "";

    const btnMLK = document.createElement("button");
    btnMLK.textContent = "ОТЧЕТ МЛК";
    btnMLK.onclick = () => openSection("mlk");
    sidebar.appendChild(btnMLK);

    if (CURRENT_ROLE === "ADMIN") {
        const btnReports = document.createElement("button");
        btnReports.textContent = "REPORTS";
        btnReports.onclick = () => openSection("reports");
        sidebar.appendChild(btnReports);

        const btnAdmin = document.createElement("button");
        btnAdmin.textContent = "ADMIN";
        btnAdmin.onclick = () => openSection("admin");
        sidebar.appendChild(btnAdmin);
    }
}

function enterSystem() {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("terminal").style.display = "flex";

    setupSidebar();
    loadReports(() => {
        if (CURRENT_ROLE === "CURATOR") openSection("mlk");
        else openSection("reports");
    });
}

/* ===== FIREBASE ===== */
function loadReports(callback) {
    db.ref('mlk_reports').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        reportsFirebase = data;
        reports = Object.values(data);
        if (callback) callback();
    });
}

/* ===== NAVIGATION ===== */
function openSection(name) {
    if (name === "mlk") return renderMLK();
    if (name === "reports") return renderReports();
    if (name === "admin") {
        if (CURRENT_ROLE !== "ADMIN") {
            document.getElementById("content").textContent = "ACCESS RESTRICTED";
            return;
        }
        return renderAdmin();
    }
    document.getElementById("content").textContent = "MODULE NOT FOUND";
}

/* ===== MLK REPORT ===== */
function renderMLK() {
    document.getElementById("content").innerHTML = `
        <h3>ОТЧЕТ МЛК</h3>
        <label>Discord тег игрока:</label><br>
        <input id="mlk-tag"><br><br>
        <label>Кратко что сделал:</label><br>
        <textarea id="mlk-action" rows="4"></textarea><br><br>
        <button onclick="addMLKReport()">Отправить отчет</button>
    `;
}

function addMLKReport() {
    const tag = document.getElementById("mlk-tag").value.trim();
    const action = document.getElementById("mlk-action").value.trim();

    if (!tag || !action) {
        alert("Заполните все поля");
        return;
    }

    const newReportRef = db.ref('mlk_reports').push();
    const report = {
        tag,
        action,
        author: CURRENT_ROLE,
        time: new Date().toLocaleString(),
        confirmed: false
    };
    newReportRef.set(report).then(() => {
        alert("Отчет сохранен");
        document.getElementById("mlk-tag").value = "";
        document.getElementById("mlk-action").value = "";
        loadReports(() => { if (CURRENT_ROLE === "ADMIN") renderReports(); });
    });
}

/* ===== REPORTS (ADMIN ONLY) ===== */
function renderReports() {
    if (CURRENT_ROLE !== "ADMIN") {
        document.getElementById("content").textContent =
            "REPORT LIST AVAILABLE FOR ADMIN ONLY";
        return;
    }

    let html = `<h3>MLK REPORTS</h3>`;
    if (reports.length === 0) {
        html += `<p>No reports</p>`;
    } else {
        html += `<table>
            <tr>
                <th>DISCORD</th>
                <th>ACTION</th>
                <th>ROLE</th>
                <th>TIME</th>
                <th>ACTIONS</th>
            </tr>`;
        Object.keys(reportsFirebase).forEach(key => {
            const r = reportsFirebase[key];
            html += `<tr>
                <td>${r.tag}</td>
                <td>${r.action}</td>
                <td>${r.author}</td>
                <td>${r.time}</td>
                <td>
                    <button onclick="deleteReport('${key}')">Удалить</button>
                    <button onclick="confirmReport('${key}')">Подтвердить</button>
                </td>
            </tr>`;
        });
        html += `</table>`;
    }
    document.getElementById("content").innerHTML = html;
}

/* ===== DELETE & CONFIRM ===== */
function deleteReport(key) {
    if (!confirm("Удалить этот отчет?")) return;
    db.ref('mlk_reports/' + key).remove().then(() => loadReports(renderReports));
}

function confirmReport(key) {
    db.ref('mlk_reports/' + key + '/confirmed').set(true).then(() => loadReports(renderReports));
}

/* ===== ADMIN PANEL ===== */
function renderAdmin() {
    document.getElementById("content").textContent = "ADMIN PANEL ACTIVE";
}

