/* ===== FIREBASE INIT ===== */
const firebaseConfig = {
  apiKey: "AIzaSyCGqNn_jx13SKHBYMZLhUJ7nEbK32vAJx4",
  authDomain: "curatorterminal.firebaseapp.com",
  databaseURL: "https://curatorterminal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "curatorterminal",
  storageBucket: "curatorterminal.appspot.com",
  messagingSenderId: "577721444184",
  appId: "1:577721444184:web:58f4d0aeede9a8c0ba672d",
  measurementId: "G-X0N5JT0K8D"
};
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ===== AUTH SYSTEM ===== */
const HASH_ADMIN   = "10cda"; // EOD
const HASH_CURATOR = "be32";  // 123
let CURRENT_ROLE = null;

function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return h.toString(16);
}

function login() {
    const input = document.getElementById("password").value.trim();
    const hash = simpleHash(input);

    if (hash === HASH_ADMIN) CURRENT_ROLE="ADMIN";
    else if (hash === HASH_CURATOR) CURRENT_ROLE="CURATOR";
    else { document.getElementById("login-error").textContent="ACCESS DENIED"; return; }

    document.getElementById("login-screen").style.display="none";
    document.getElementById("terminal").style.display="flex";
    setupSidebar();
    loadReports(renderMLKScreen);
}

/* ===== SIDEBAR ===== */
function setupSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.innerHTML="";

    const btnMLK = document.createElement("button");
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
let reportsFirebase={};

function loadReports(callback){
    db.ref('mlk_reports').once('value').then(snapshot=>{
        const data = snapshot.val()||{};
        reportsFirebase=data;
        reports=Object.values(data);
        if(callback) callback();
    });
}

/* ===== MLK SCREEN ===== */
function renderMLKScreen(){
    document.getElementById("content").innerHTML=`
        <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
            <button id="add-mlk-btn">+</button>
        </div>
        <div id="mlk-list"></div>
    `;
    document.getElementById("add-mlk-btn").onclick=()=>renderMLKForm();
    renderMLKList();
}

/* ===== MLK LIST ===== */
function renderMLKList(){
    const listDiv=document.getElementById("mlk-list");
    listDiv.innerHTML="";
    const filteredReports=(CURRENT_ROLE==="CURATOR")?reports.filter(r=>r.author===CURRENT_ROLE):reports;
    if(filteredReports.length===0){ listDiv.innerHTML="<p>Нет отчетов</p>"; return; }

    filteredReports.forEach((r,index)=>{
        const key=Object.keys(reportsFirebase)[index];
        let status="рассматривается";
        if(r.deleted) status="удален";
        else if(r.confirmed) status="подтвержден";

        const reportDiv=document.createElement("div");
        reportDiv.style.border="1px solid #0f0";
        reportDiv.style.marginBottom="10px";
        reportDiv.style.padding="8px";
        reportDiv.innerHTML=`
            <strong>DISCORD:</strong> ${r.tag}<br>
            <strong>ACTION:</strong> ${r.action}<br>
            <strong>ROLE:</strong> ${r.author}<br>
            <strong>TIME:</strong> ${r.time}<br>
            <strong>STATUS:</strong> ${status}
        `;

        if(CURRENT_ROLE==="ADMIN" && !r.deleted && !r.confirmed){
            const btnDel=document.createElement("button");
            btnDel.textContent="Удалить"; btnDel.style.marginRight="5px";
            btnDel.onclick=()=>{ db.ref('mlk_reports/'+key+'/deleted').set(true).then(()=>loadReports(renderMLKList)); }

            const btnConfirm=document.createElement("button");
            btnConfirm.textContent="Подтвердить";
            btnConfirm.onclick=()=>{ db.ref('mlk_reports/'+key+'/confirmed').set(true).then(()=>loadReports(renderMLKList)); }

            reportDiv.appendChild(btnDel);
            reportDiv.appendChild(btnConfirm);
        }

        listDiv.appendChild(reportDiv);
    });
}

/* ===== MLK FORM ===== */
function renderMLKForm(){
    document.getElementById("mlk-list").innerHTML=`
        <h3>ОТЧЕТ МЛК</h3>
        <label>Discord тег игрока:</label><br>
        <input id="mlk-tag"><br><br>
        <label>Кратко что сделал:</label><br>
        <textarea id="mlk-action" rows="4"></textarea><br><br>
        <button onclick="addMLKReport()">Отправить отчет</button>
    `;
}

/* ===== ADD MLK REPORT ===== */
function addMLKReport(){
    const tag=document.getElementById("mlk-tag").value.trim();
    const action=document.getElementById("mlk-action").value.trim();
    if(!tag||!action){ alert("Заполните все поля"); return; }

    const newReportRef=db.ref('mlk_reports').push();
    const report={tag,action,author:CURRENT_ROLE,time:new Date().toLocaleString(),confirmed:false,deleted:false};
    newReportRef.set(report).then(()=>{
        alert("Отчет сохранен");
        renderMLKScreen();
        loadReports(renderMLKList);
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
        Object.keys(reportsFirebase).forEach(key=>{
            const r=reportsFirebase[key];
            let status="рассматривается";
            if(r.deleted) status="удален";
            else if(r.confirmed) status="подтвержден";

            html+=`<tr>
                <td>${r.tag}</td><td>${r.action}</td><td>${r.author}</td><td>${r.time}</td><td>${status}</td>
                <td>${(!r.deleted&&!r.confirmed)?`<button onclick="deleteReport('${key}')">Удалить</button>
                <button onclick="confirmReport('${key}')">Подтвердить</button>`:""}</td>
            </tr>`;
        });
        html+="</table>";
    }
    document.getElementById("content").innerHTML=html;
}

/* ===== DELETE & CONFIRM ===== */
function deleteReport(key){ if(!confirm("Удалить этот отчет?")) return; db.ref('mlk_reports/'+key+'/deleted').set(true).then(()=>loadReports(renderMLKList)); }
function confirmReport(key){ db.ref('mlk_reports/'+key+'/confirmed').set(true).then(()=>loadReports(renderMLKList)); }

/* ===== ADMIN PANEL ===== */
function renderAdmin(){ document.getElementById("content").textContent="ADMIN PANEL ACTIVE"; }
