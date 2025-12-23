/* ===== AUTH SYSTEM ===== */
const HASH_ADMIN   = "10cda"; // EOD
const HASH_CURATOR = "be32";  // 123
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
    loadReports(renderMLKScreen);
}

document.getElementById("login-btn").onclick = login;

/* ===== SIDEBAR ===== */
function setupSidebar(){
    const sidebar=document.getElementById("sidebar");
    sidebar.innerHTML="";

    const btnMLK=document.createElement("button");
    btnMLK.textContent="ОТЧЕТ МЛК";
    btnMLK.onclick=()=>renderMLKScreen();
    sidebar.appendChild(btnMLK);

    if(CURRENT_ROLE==="ADMIN"){
        const btnReports=document.createElement("button");
        btnReports.textContent="REPORTS";
        btnReports.onclick=()=>openSection("reports");
        sidebar.appendChild(btnReports);

        const btnAdmin=document.createElement("button");
        btnAdmin.textContent="ADMIN";
        btnAdmin.onclick=()=>openSection("admin");
        sidebar.appendChild(btnAdmin);
    }
}

/* ===== LOAD REPORTS ===== */
let reports=[];

function loadReports(callback){
    // Используем .once для получения данных из Firebase
    db.ref('mlk_reports').once('value').then(snapshot=>{
        const data=snapshot.val()||{};
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сохраняем ID (ключ) вместе с данными
        reports = Object.keys(data).map(key => ({
            ...data[key],
            id: key
        }));
        if(callback) callback();
    });
}

/* ===== MLK SCREEN ===== */
function renderMLKScreen(){
    const content = document.getElementById("content");
    content.innerHTML = "";

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

    const listDiv = document.createElement("div");
    listDiv.id = "mlk-list";
    content.appendChild(listDiv);

    renderMLKList();
}

/* ===== MLK FORM ===== */
function renderMLKForm(){
    const listDiv = document.getElementById("mlk-list");
    listDiv.innerHTML = `
        <h3>ОТЧЕТ МЛК</h3>
        <label>Discord тег игрока:</label><br>
        <input id="mlk-tag"><br><br>
        <label>Кратко что сделал:</label><br>
        <textarea id="mlk-action" rows="4"></textarea><br><br>
        <button id="submit-mlk-btn">Отправить отчет</button>
    `;

    document.getElementById("submit-mlk-btn").onclick = addMLKReport;
}

/* ===== ADD MLK REPORT ===== */
function addMLKReport(){
    const tag = document.getElementById("mlk-tag").value.trim();
    const action = document.getElementById("mlk-action").value.trim();
    if(!tag||!action){ alert("Заполните все поля"); return; }

    const newReportRef = db.ref('mlk_reports').push();
    const report = {tag, action, author: CURRENT_ROLE, time: new Date().toLocaleString(), confirmed: false, deleted: false};

    newReportRef.set(report).then(()=>{
        alert("Отчет сохранен");
        loadReports(renderMLKScreen);
    });
}

/* ===== TYPE EFFECT ===== */
// Исправлено: работаем с отдельным контейнером для текста, чтобы не затирать кнопки
function typeText(element, text, index = 0, callback) {
    if(index < text.length){
        element.innerHTML += text.charAt(index);
        setTimeout(()=>typeText(element,text,index+1,callback), 5);
    } else if(callback) callback();
}

/* ===== MLK LIST ===== */
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
        
        // Создаем контейнер для текста (чтобы анимация не ломала кнопки)
        const textSpan = document.createElement("div");
        reportDiv.appendChild(textSpan);
        listDiv.appendChild(reportDiv);

        const htmlContent = `
<strong>DISCORD:</strong> ${r.tag}<br>
<strong>ACTION:</strong> ${r.action}<br>
<strong>ROLE:</strong> ${r.author}<br>
<strong>TIME:</strong> ${r.time}<br>
<strong>STATUS:</strong> <span class="status ${statusClass}">${statusClass}</span><br>
        `;
        
        // Запускаем печать
        typeText(textSpan, htmlContent, 0, () => {
            // Добавляем кнопки только ПОСЛЕ завершения печати или отдельно
            if(CURRENT_ROLE==="ADMIN" && !r.deleted && !r.confirmed){
                const actionsDiv = document.createElement("div");
                actionsDiv.style.marginTop = "10px";

                const btnDel=document.createElement("button");
                btnDel.textContent="Удалить"; btnDel.style.marginRight="5px";
                btnDel.onclick=()=> deleteReport(r.id);

                const btnConfirm=document.createElement("button");
                btnConfirm.textContent="Подтвердить";
                btnConfirm.onclick=()=> confirmReport(r.id);

                actionsDiv.appendChild(btnDel);
                actionsDiv.appendChild(btnConfirm);
                reportDiv.appendChild(actionsDiv);
            }
        });
    });
}

/* ===== REPORTS (ADMIN) ===== */
function renderReports(){
    if(CURRENT_ROLE!=="ADMIN"){ document.getElementById("content").textContent="REPORT LIST AVAILABLE FOR ADMIN ONLY"; return; }
    let html=`<h3>MLK REPORTS</h3>`;
    if(reports.length===0){ html+="<p>No reports</p>"; }
    else{
        html+=`<table>
            <tr><th>DISCORD</th><th>ACTION</th><th>ROLE</th><th>TIME</th><th>STATUS</th><th>ACTIONS</th></tr>`;
        reports.forEach(r => {
            let status="рассматривается";
            if(r.deleted) status="удален";
            else if(r.confirmed) status="подтвержден";

            html+=`<tr>
                <td>${r.tag}</td><td>${r.action}</td><td>${r.author}</td><td>${r.time}</td><td>${status}</td>
                <td>${(!r.deleted&&!r.confirmed)?`<button onclick="confirmReport('${r.id}')">Подтвердить</button>
                <button onclick="deleteReport('${r.id}')">Удалить</button>`:""}</td>
            </tr>`;
        });
        html+="</table>";
    }
    document.getElementById("content").innerHTML=html;
}

/* ===== DELETE & CONFIRM ===== */
// Делаем функции глобальными, чтобы onclick в строках таблицы их видел
window.deleteReport = function(key){ 
    if(!confirm("Удалить этот отчет?")) return; 
    db.ref('mlk_reports/'+key+'/deleted').set(true).then(()=>loadReports(() => {
        // Перерисовываем тот экран, на котором находимся
        if(document.querySelector('table')) renderReports(); else renderMLKList();
    })); 
}

window.confirmReport = function(key){ 
    db.ref('mlk_reports/'+key+'/confirmed').set(true).then(()=>loadReports(() => {
        if(document.querySelector('table')) renderReports(); else renderMLKList();
    })); 
}

/* ===== ADMIN PANEL ===== */
function renderAdmin(){ document.getElementById("content").textContent="ADMIN PANEL ACTIVE"; }

/* ===== NAVIGATION ===== */
function openSection(name){
    if(name==="mlk") return renderMLKScreen();
    if(name==="reports") return renderReports();
    if(name==="admin") return renderAdmin();
    document.getElementById("content").textContent="MODULE NOT FOUND";
}
