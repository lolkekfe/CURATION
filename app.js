/* ===== PASSWORD SYSTEM ===== *//* ===== PASSWORD SYSTEM ===== */

const PASSWORD_HASH = "f4c3b00c"; // НЕ пароль

function login() {
    const input = document.getElementById("password").value;
    const hash = simpleHash(input);

    if (hash === PASSWORD_HASH) {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("terminal").style.display = "flex";
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

/* ===== NAVIGATION ===== */

function openSection(name) {
    if (name === "reports") return renderReports();
    if (name === "mlk") return renderMLK();
    if (name === "admin") return renderAdmin();
    document.getElementById("content").textContent = sections[name] || "MODULE NOT FOUND";
}

/* ===== REPORTS SYSTEM ===== */

let reports = [];

function renderReports() {
    let html = `<button onclick="openSection('mlk')">ОТЧЕТ МЛК</button>`;
    html += `<div id="report-list">`;
    if(reports.length === 0){
        html += `<p>Пока нет отчетов</p>`;
    } else {
        html += `<table>
            <tr><th>DISCORD TAG</th><th>ACTIONS</th></tr>`;
        reports.forEach(r => {
            html += `<tr><td>${r.tag}</td><td>${r.action}</td></tr>`;
        });
        html += `</table>`;
    }
    html += `</div>`;
    document.getElementById("content").innerHTML = html;
}

/* ===== MLK REPORT FORM ===== */

function renderMLK() {
    const html = `
    <h3>Добавить отчет МЛК</h3>
    <label>Discord тег игрока:</label><br>
    <input type="text" id="mlk-tag" placeholder="Username#0000"><br><br>
    <label>Кратко что сделал:</label><br>
    <textarea id="mlk-action" rows="4" placeholder="Описание действий"></textarea><br><br>
    <button onclick="addMLKReport()">Добавить отчет</button>
    <button onclick="openSection('reports')">Назад</button>
    `;
    document.getElementById("content").innerHTML = html;
}

function addMLKReport() {
    const tag = document.getElementById("mlk-tag").value.trim();
    const action = document.getElementById("mlk-action").value.trim();

    if(tag === "" || action === "") {
        alert("Заполните все поля!");
        return;
    }

    reports.push({ tag, action });
    alert("Отчет добавлен!");
    renderReports();
}

/* ===== ADMIN SYSTEM ===== */

let users = [];

function renderAdmin() {
    let html = `<button onclick="addUser()">+ ADD USER</button>
    <table>
        <tr>
            <th>NAME</th>
            <th>ROLE</th>
            <th>STATUS</th>
        </tr>`;

    users.forEach(u => {
        html += `<tr>
            <td>${u.name}</td>
            <td>${u.role}</td>
            <td>${u.banned ? "BANNED" : "ACTIVE"}</td>
        </tr>`;
    });

    html += `</table>`;
    document.getElementById("content").innerHTML = html;
}

function addUser() {
    users.push({ name: "", role: "USER", banned: false });
    renderAdmin();
}


