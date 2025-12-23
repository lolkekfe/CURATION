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
        // ИСПРАВЛЕНИЕ: Сохраняем ключ (id) внутри каждого объекта
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
        <input id="mlk-tag" placeholder="User#0000"><br><br>
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

    const report = {
        tag, 
        action, 
        author: CURRENT_ROLE, 
        time: new Date().toLocaleString(), 
        confirmed: false, 
        deleted: false
    };

    // ИСПРАВЛЕНИЕ: Прямой пуш объекта
    db.ref('mlk_reports').push(report).then(()=>{
        alert("Отчет сохранен");
        loadReports(renderMLKScreen); // Перерисовываем весь экран
    });
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
        
        reportDiv.innerHTML = `
<strong>DISCORD:</strong> ${r.tag}<br>
<strong>ACTION:</strong> ${r.action}<br>
<strong>ROLE:</strong> ${r.author}<br>
<strong>TIME:</strong> ${r.time}<br>
<strong>STATUS:</strong> <span class="status ${statusClass}">${statusClass}</span><br>
        `;

        // ИСПРАВЛЕНИЕ: Используем r.id, который мы сохранили в loadReports
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
        listDiv.appendChild(reportDiv);
    });
}

/* ===== ADMIN ACTIONS ===== */
window.deleteReport = function(id) {
    if(confirm("Удалить отчет?")) {
        db.ref('mlk_reports/' + id + '/deleted').set(true).then(() => loadReports(renderMLKScreen));
    }
}

window.confirmReport = function(id) {
    db.ref('mlk_reports/' + id + '/confirmed').set(true).then(() => loadReports(renderMLKScreen));
}

/* ===== REPORTS (ADMIN) ===== */
function renderReports(){
    if(CURRENT_ROLE!=="ADMIN"){ document.getElementById("content").textContent="ACCESS DENIED"; return; }
    const content=document.getElementById("content");
    content.innerHTML="<h3>MLK REPORTS</h3>";
    // Тут можно добавить логику таблицы, если нужно
}

/* ===== ADMIN PANEL ===== */
function renderAdmin(){ document.getElementById("content").textContent="ADMIN PANEL ACTIVE"; }
