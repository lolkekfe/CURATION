/* ===== AUTH SYSTEM ===== */
const HASH_ADMIN   = "10cda"; 
const HASH_CURATOR = "be32";  
let CURRENT_ROLE = null;

function simpleHash(str){
    let h=0;
    for(let i=0;i<str.length;i++){
        h=(h<<5)-h+str.charCodeAt(i);
        h|=0;
    }
    return h.toString(16);
}

function login(){
    const input=document.getElementById("password").value.trim();
    const hash=simpleHash(input);
    if(hash===HASH_ADMIN) CURRENT_ROLE="ADMIN";
    else if(hash===HASH_CURATOR) CURRENT_ROLE="CURATOR";
    else { document.getElementById("login-error").textContent="ACCESS DENIED"; return; }

    document.getElementById("login-screen").style.display="none";
    document.getElementById("terminal").style.display="flex";
    setupSidebar();
    
    if (CURRENT_ROLE === "ADMIN") {
        loadReports(renderReports);
    } else {
        loadReports(renderMLKScreen);
    }
}

document.getElementById("login-btn").onclick = login;

/* ===== SIDEBAR ===== */
function setupSidebar(){
    const sidebar=document.getElementById("sidebar");
    sidebar.innerHTML="";

    if(CURRENT_ROLE==="CURATOR"){
        const btnMLK=document.createElement("button");
        btnMLK.textContent="ОТЧЕТ МЛК";
        btnMLK.onclick=()=>renderMLKScreen();
        sidebar.appendChild(btnMLK);
    }

    if(CURRENT_ROLE==="ADMIN"){
        const btnReports=document.createElement("button");
        btnReports.textContent="REPORTS";
        btnReports.onclick=()=>renderReports();
        sidebar.appendChild(btnReports);

        const btnAdmin=document.createElement("button");
        btnAdmin.textContent="ADMIN";
        btnAdmin.onclick=()=>renderAdmin();
        sidebar.appendChild(btnAdmin);
    }
}

/* ===== LOAD REPORTS ===== */
let reports=[];

function loadReports(callback){
    db.ref('mlk_reports').once('value').then(snapshot=>{
        const data=snapshot.val()||{};
        reports = Object.keys(data).map(key => ({
            ...data[key],
            id: key 
        }));
        if(callback) callback();
    });
}

/* ===== MLK SCREEN (КУРАТОР) ===== */
function renderMLKScreen(){
    const content = document.getElementById("content");
    content.innerHTML = "";

    if(CURRENT_ROLE === "CURATOR") {
        const btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "flex-end";
        btnContainer.style.marginBottom = "10px";

        const addBtn = document.createElement("button");
        addBtn.id = "add-mlk-btn";
        addBtn.textContent = "+";
        addBtn.onclick = renderMLKForm;

        btnContainer.appendChild(addBtn);
        content.appendChild(btnContainer);
    }

    const listDiv = document.createElement("div");
    listDiv.id = "mlk-list";
    content.appendChild(listDiv);

    renderMLKList();
}

/* ===== MLK FORM (КУРАТОР) ===== */
function renderMLKForm(){
    const listDiv = document.getElementById("mlk-list");
    listDiv.innerHTML = `
        <h3>ОТЧЕТ МЛК</h3>
        <label>Discord тег игрока:</label><br>
        <input id="mlk-tag" placeholder="User#0000"><br><br>
        <label>Кратко что сделал:</label><br>
        <textarea id="mlk-action" rows="4"></textarea><br><br>
        <button id="submit-mlk-btn">Отправить отчет</button>
    `;
    document.getElementById("submit-mlk-btn").onclick = addMLKReport;
}

/* ===== ADD MLK REPORT (КУРАТОР) ===== */
function addMLKReport(){
    const tag = document.getElementById("mlk-tag").value.trim();
    const action = document.getElementById("mlk-action").value.trim();
    if(!tag||!action){ alert("Заполните все поля"); return; }

    const report = {tag, action, author: CURRENT_ROLE, time: new Date().toLocaleString(), confirmed: false, deleted: false};

    db.ref('mlk_reports').push(report).then(()=>{
        alert("Отчет сохранен");
        loadReports(renderMLKScreen);
    });
}

/* ===== TYPE EFFECT (Можно удалить, так как больше не используется для отчетов) ===== */
function typeText(element, text, index = 0, callback) {
    if(index < text.length){
        element.innerHTML += text.charAt(index);
        setTimeout(()=>typeText(element,text,index+1,callback), 5);
    } else if(callback) callback();
}

/* ===== MLK LIST SCREEN (ИСПРАВЛЕНО ОТОБРАЖЕНИЕ HTML) ===== */
function renderMLKList(){
    const listDiv = document.getElementById("mlk-list");
    listDiv.innerHTML = "";

    const filteredReports = (CURRENT_ROLE === "CURATOR") ? reports.filter(r=>r.author===CURRENT_ROLE) : reports;

    if(filteredReports.length === 0){
        listDiv.innerHTML = "<p>Нет отчетов</p>";
        return;
    }

    filteredReports.forEach((r)=>{
        let statusClass = "pending";
        if(r.deleted) statusClass="deleted";
        else if(r.confirmed) statusClass="confirmed";

        const reportDiv = document.createElement("div");
        reportDiv.className = "report";
        listDiv.appendChild(reportDiv);

        // ИСПРАВЛЕНИЕ: Используем innerHTML напрямую, без typeText
        reportDiv.innerHTML = `
<strong>DISCORD:</strong> ${r.tag}<br>
<strong>ACTION:</strong> ${r.action}<br>
<strong>ROLE:</strong> ${r.author}<br>
<strong>TIME:</strong> ${r.time}<br>
<strong>STATUS:</strong> <span class="status ${statusClass}">${statusClass}</span><br>
        `;
    });
}

/* ===== REPORTS (ADMIN) ===== */
function renderReports(){
    const content = document.getElementById("content");
    if(CURRENT_ROLE!=="ADMIN"){ content.textContent="ACCESS DENIED"; return; }
    
    let html=`<h3>MLK REPORTS (ADMIN VIEW)</h3>`;
    if(reports.length===0){ html+="<p>No reports</p>"; }
    else{
        html+=`<table>
            <tr><th>DISCORD</th><th>ACTION</th><th>ROLE</th><th>TIME</th><th>STATUS</th><th>ACTIONS</th></tr>`;
        reports.forEach(r=>{
            let status = r.deleted ? "удален" : (r.confirmed ? "подтвержден" : "рассматривается");
            
            const actionsHtml = (!r.deleted && !r.confirmed) ?
                `<button onclick="confirmReport('${r.id}')">Подтвердить</button>
                 <button onclick="deleteReport('${r.id}')">Удалить</button>` :
                '';

            html+=`<tr>
                <td>${r.tag}</td><td>${r.action}</td><td>${r.author}</td><td>${r.time}</td><td>${status}</td>
                <td>${actionsHtml}</td>
            </tr>`;
        });
        html+="</table>";
    }
    content.innerHTML=html;
}

/* ===== ADMIN ACTIONS (Глобальные функции для совместимости) ===== */
window.deleteReport = function(id) {
    if(CURRENT_ROLE !== "ADMIN") return; 
    if(confirm("Удалить отчет?")) {
        db.ref('mlk_reports/' + id + '/deleted').set(true).then(() => loadReports(renderReports));
    }
}

window.confirmReport = function(id) {
    if(CURRENT_ROLE !== "ADMIN") return;
    db.ref('mlk_reports/' + id + '/confirmed').set(true).then(() => loadReports(renderReports));
}

/* ===== ADMIN PANEL ===== */
function renderAdmin(){ document.getElementById("content").textContent="ADMIN PANEL ACTIVE"; }
