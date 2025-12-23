/* ===== PASSWORD SYSTEM ===== */

const PASSWORD_HASH = "-56a05bd9"; // НЕ пароль

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
    if (name === "admin") return renderAdmin();
    document.getElementById("content").textContent = sections[name] || "MODULE NOT FOUND";
}

/* ===== REPORTS SYSTEM ===== */

let reports = [];

function renderReports() {
    let html = `<button onclick="addReport()">+ ADD REPORT</button>
    <table>
        <tr>
            <th>DATE</th>
            <th>SUBJECT</th>
            <th>CURATOR</th>
            <th>STATUS</th>
        </tr>`;

    reports.forEach(() => {
        html += `<tr><td></td><td></td><td></td><td></td></tr>`;
    });

    html += `</table>`;
    document.getElementById("content").innerHTML = html;
}

function addReport() {
    reports.push({});
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
