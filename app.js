/* ===== AUTH SYSTEM ===== */

const HASH_ADMIN   = "-2d1f59c9"; // пароль: ADMPSS
const HASH_CURATOR = "be32";      // пароль: 123

let CURRENT_ROLE = null;

/* ===== LOGIN ===== */

function login() {
    const input = document.getElementById("password").value;
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

function enterSystem() {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("terminal").style.display = "flex";
    openSection("overview");
}

function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return h.toString(16);
}

/* ===== STORAGE ===== */

let reports = JSON.parse(localStorage.getItem("mlk_reports")) || [];

function saveReports() {
    localStorage.setItem("mlk_reports", JSON.stringify(reports));
}

/* ===== NAVIGATION ===== */

function openSection(name) {

    if (name === "mlk") {
        return renderMLK(); // доступно куратору и админу
    }

    if (name === "reports") {
        return renderReports(); // ТОЛЬКО АДМИН
    }

    if (name === "admin") {
        if (CURRENT_ROLE !== "ADMIN") {
            document.getElementById("content").textContent =
                "ACCESS RESTRICTED";
            return;
        }
        return renderAdmin();
    }

    document.getElementById("content").textContent =
        sections[name] || "MODULE NOT FOUND";
}

/* ===== MLK FORM (CURATOR + ADMIN) ===== */

function renderMLK() {
    let html = `
        <h3>ОТЧЕТ МЛК</h3>

        <label>Discord тег игрока:</label><br>
        <input type="text" id="mlk-tag"><br><br>

        <label>Кратко что сделал:</label><br>
        <textarea id="mlk-action" rows="4"></textarea><br><br>

        <button onclick="addMLKReport()">Отправить отчет</button>
    `;

    document.getElementById("content").innerHTML = html;
}

function addMLKReport() {
    const tag = document.getElementById("mlk-tag").value.trim();
    const action = document.getElementById("mlk-action").value.trim();

    if (!tag || !action) {
        alert("Заполните все поля");
        return;
    }

    reports.push({
        tag,
        action,
        author: CURRENT_ROLE,
        time: new Date().toLocaleString()
    });

    saveReports();

    alert("Отчет сохранен");

    document.getElementById("mlk-tag").value = "";
    document.getElementById("mlk-action").value = "";
}

/* ===== REPORT LIST (ADMIN ONLY) ===== */

function renderReports() {
    if (CURRENT_ROLE !== "ADMIN") {
        document.getElementById("content").textContent =
            "REPORT LIST AVAILABLE FOR ADMIN ONLY";
        return;
    }

    let html = `<h3>MLK REPORTS</h3>`;

    if (reports.length === 0) {
        html += `<p>No reports found</p>`;
    } else {
        html += `
        <table>
            <tr>
                <th>DISCORD TAG</th>
                <th>ACTIONS</th>
                <th>ROLE</th>
                <th>TIME</th>
            </tr>`;

        reports.forEach(r => {
            html += `
            <tr>
                <td>${r.tag}</td>
                <td>${r.action}</td>
                <td>${r.author}</td>
                <td>${r.time}</td>
            </tr>`;
        });

        html += `</table>`;
    }

    document.getElementById("content").innerHTML = html;
}

/* ===== ADMIN PANEL ===== */

function renderAdmin() {
    document.getElementById("content").textContent =
        "ADMIN PANEL ACTIVE";
}
