document.addEventListener("DOMContentLoaded", () => {

    const HASH_ADMIN   = "10cda"; // EOD
    const HASH_CURATOR = "be32";  // 123
    let CURRENT_ROLE = null;
    let reports = [];
    
    // Вспомогательные функции deleteReport и confirmReport должны быть доступны глобально 
    // для использования в HTML, который генерируется в renderReports.

    window.deleteReport = function(id) {
        if(CURRENT_ROLE !== "ADMIN") return; 
        if(confirm("Удалить отчет?")) {
            // Используем loadReports с renderReports в качестве коллбэка
            db.ref('mlk_reports/' + id + '/deleted').set(true).then(() => loadReports(renderReports));
        }
    }

    window.confirmReport = function(id) {
        if(CURRENT_ROLE !== "ADMIN") return;
        // Используем loadReports с renderReports в качестве коллбэка
        db.ref('mlk_reports/' + id + '/confirmed').set(true).then(() => loadReports(renderReports));
    }

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

        // Кнопка ОТЧЕТ МЛК видна ТОЛЬКО КУРАТОРУ
        if(CURRENT_ROLE==="CURATOR"){
            const btnMLK = document.createElement("button");
            btnMLK.textContent = "ОТЧЕТ МЛК";
            btnMLK.onclick = renderMLKScreen;
            sidebar.appendChild(btnMLK);
        }

        // Кнопки REPORTS и ADMIN видны ТОЛЬКО АДМИНУ
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
        // Убедитесь, что объект db виден в этой функции (проверьте firebase.js и index.html)
        db.ref('mlk_reports').once('value').then(snapshot=>{
            const data = snapshot.val() || {};
            // Сохраняем ID внутри объекта
            reports = Object.keys(data).map(key => ({...data[key], id:key}));
            if(callback) callback();
        });
    }

    function renderMLKScreen(){
        const content = document.getElementById("content");
        content.innerHTML = ""; // Очищаем весь контент

        // Кнопка "+" видна только Куратору
        if (CURRENT_ROLE === "CURATOR") {
            const btnContainer = document.createElement("div");
            btnContainer.style.display = "flex";
            btnContainer.style.justifyContent = "flex-end";
            btnContainer.style.marginBottom = "10px";

            const addBtn = document.createElement("button");
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

    function renderMLKForm(){
        const listDiv = document.getElementById("mlk-list");
        if (!listDiv) return; // Защита от ошибки

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
        if (!listDiv) return; // Защита от ошибки
        
        // Куратор видит только свои отчеты
        const filteredReports = (CURRENT_ROLE === "CURATOR") ? reports.filter(r=>r.author===CURRENT_ROLE) : reports;


        if(filteredReports.length===0){ 
            listDiv.innerHTML="<p>Нет отчетов</p>"; 
            return; 
        }

        listDiv.innerHTML = ""; // Очищаем перед добавлением новых элементов

        filteredReports.forEach(r=>{
            const div = document.createElement("div");
            div.className = "report";
            
            let status = r.deleted ? 'удален' : (r.confirmed?'подтвержден':'рассматривается');
            let statusClass = r.deleted ? 'deleted' : (r.confirmed?'confirmed':'pending');

            div.innerHTML = `
                <strong>DISCORD:</strong> ${r.tag}<br>
                <strong>ACTION:</strong> ${r.action}<br>
                <strong>ROLE:</strong> ${r.author}<br>
                <strong>TIME:</strong> ${r.time}<br>
                <strong>STATUS:</strong> <span class="status ${statusClass}">${status}</span>
            `;
            listDiv.appendChild(div);
        });
    }

    function renderReports(){
        const content = document.getElementById("content");
        if (!content) return; // Защита от ошибки

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

    function renderAdmin(){
        const content = document.getElementById("content");
        if (!content) return; // Защита от ошибки
        content.textContent = "ADMIN PANEL ACTIVE";
    }

}); // <-- Вот эти закрывающие скобки были пропущены
