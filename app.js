document.addEventListener("DOMContentLoaded", () => {

    const HASH_ADMIN   = "10cda"; // EOD
    const HASH_CURATOR = "be32";  // 123
    let CURRENT_ROLE = null;
    let reports = [];

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
        if(CURRENT_ROLE==="ADMIN") loadReports(renderReports);
        else loadReports(renderMLKScreen);
    }

    document.getElementById("login-btn").onclick = login;

    function setupSidebar(){
        const sidebar = document.getElementById("sidebar");
        sidebar.innerHTML = "";

        const btnMLK = document.createElement("button");
        btnMLK.textContent = "ОТЧЕТ МЛК";
        btnMLK.onclick = renderMLKScreen;
        sidebar.appendChild(btnMLK);

        if(CURRENT_ROLE==="ADMIN"){
            const btnReports = document.createElement("button");
            btnReports.textContent = "REPORTS";
            btnReports.onclick = renderReports;
            sidebar.appendChild(btnReports);

            const btnAdmin = document.createElement("button");
            btnAdmin.textContent = "ADMIN";
            btnAdmin.onclick = renderAdmin;
            sidebar.appendChild(btnAdmin);
        }
    }

    function loadReports(callback){
        db.ref('mlk_reports').once('value').then(snapshot=>{
            const data = snapshot.val() || {};
            reports = Object.keys(data).map(key => ({...data[key], id:key}));
            if(callback) callback();
        });
    }

    function renderMLKScreen(){
        const content = document.getElementById("content");
        content.innerHTML = "";

        const btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "flex-end";
        btnContainer.style.marginBottom = "10px";

        const addBtn = document.createElement("button");
        addBtn.textContent = "+";
        addBtn.onclick = renderMLKForm;

        btnContainer.appendChild(addBtn);
        content.appendChild(btnContainer);

        const listDiv = document.createElement("div");
        listDiv.id = "mlk-list";
        content.appendChild(listDiv);

        renderMLKList();
    }

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

    function addMLKReport(){
        const tag = document.getElementById("mlk-tag").value.trim();
        const action = document.getElementById("mlk-action").value.trim();
        if(!tag||!action){ alert("Заполните все поля"); return; }

        const report = {tag, action, author: CURRENT_ROLE, time: new Date().toLocaleString(), confirmed:false, deleted:false};
        db.ref('mlk_reports').push(report).then(()=>{
            alert("Отчет сохранен");
            loadReports(renderMLKScreen);
        });
    }

    function renderMLKList(){
        const listDiv = document.getElementById("mlk-list");
        if(reports.length===0){ listDiv.innerHTML="<p>Нет отчетов</p>"; return; }

        reports.forEach(r=>{
            const div = document.createElement("div");
            div.className = "report";
            div.innerHTML = `
                <strong>DISCORD:</strong> ${r.tag}<br>
                <strong>ACTION:</strong> ${r.action}<br>
                <strong>ROLE:</strong> ${r.author}<br>
                <strong>TIME:</strong> ${r.time}<br>
                <strong>STATUS:</strong> ${r.deleted ? 'удален' : (r.confirmed?'подтвержден':'рассматривается')}
            `;
            listDiv.appendChild(div);
        });
    }

    function renderReports(){
        const content = document.getElementById("content");
        content.innerHTML = "<h3>ADMIN REPORTS</h3>";
    }

    function renderAdmin(){
        const content = document.getElementById("content");
        content.textContent = "ADMIN PANEL ACTIVE";
    }

});
