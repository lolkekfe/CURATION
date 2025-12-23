/* ===== AUTH SYSTEM ===== */
const HASH_ADMIN   = "10cda"; // EOD
const HASH_CURATOR = "be32";  // 123
let CURRENT_ROLE = null;
let CURRENT_USER = null;
let reports = []; // Делаем reports глобальным

// База данных для пользователей и вайтлиста
let users = [];
let whitelist = [];

// Глобальные функции для кнопок в таблице ADMIN
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

function simpleHash(str){
    let h=0;
    for(let i=0;i<str.length;i++){
        h=(h<<5)-h+str.charCodeAt(i);
        h|=0;
    }
    return h.toString(16);
}

/* ===== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ И ВАЙТЛИСТА ===== */
function loadUsersAndWhitelist(callback) {
    // Загружаем пользователей
    db.ref('mlk_users').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        users = Object.keys(data).map(key => ({...data[key], id: key}));
        
        // Загружаем вайтлист
        return db.ref('mlk_whitelist').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        whitelist = Object.keys(data).map(key => ({...data[key], id: key}));
        
        // Если вайтлист пустой, добавляем первого администратора по умолчанию
        if (whitelist.length === 0) {
            addDefaultAdminToWhitelist().then(() => {
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    }).catch(error => {
        console.error("Ошибка загрузки пользователей:", error);
        if (callback) callback();
    });
}

/* ===== ДОБАВЛЕНИЕ ПЕРВОГО АДМИНА ПО УМОЛЧАНИЮ ===== */
function addDefaultAdminToWhitelist() {
    // Здесь укажите ник администратора по умолчанию
    const DEFAULT_ADMIN_USERNAME = "Тихий"; // <--- ВПИШИТЕ СЮДА НИК АДМИНА
    
    return db.ref('mlk_whitelist').push({
        username: DEFAULT_ADMIN_USERNAME,
        addedBy: "SYSTEM",
        addedDate: new Date().toLocaleString(),
        isDefault: true
    }).then(() => {
        console.log("Добавлен администратор по умолчанию:", DEFAULT_ADMIN_USERNAME);
        return loadUsersAndWhitelist(); // Перезагружаем данные
    });
}

/* ===== ЛОГИН С РЕГИСТРАЦИЕЙ ===== */
function login(){
    const input = document.getElementById("password").value.trim();
    const usernameInput = document.getElementById("username");
    const username = usernameInput ? usernameInput.value.trim() : "";
    const hash = simpleHash(input);
    
    // Очищаем предыдущие ошибки
    document.getElementById("login-error").textContent = "";
    
    // Если введен пароль администратора
    if(hash === HASH_ADMIN) {
        // Проверяем вайтлист для админа
        const isInWhitelist = whitelist.some(user => 
            user.username.toLowerCase() === username.toLowerCase()
        );
        
        if (!isInWhitelist) {
            document.getElementById("login-error").textContent = "НЕТУ В ВАЙТЛИСТЕ";
            return;
        }
        
        CURRENT_ROLE = "ADMIN";
        CURRENT_USER = username;
    }
    // Если введен пароль куратора
    else if(hash === HASH_CURATOR) {
        // Если username пустой - просим ввести
        if (!username) {
            document.getElementById("login-error").textContent = "ВВЕДИТЕ НИКНЕЙМ";
            return;
        }
        
        // Проверяем, есть ли уже такой пользователь
        const existingUser = users.find(user => 
            user.username.toLowerCase() === username.toLowerCase()
        );
        
        if (!existingUser) {
            // Регистрируем нового куратора
            const newUser = {
                username: username,
                role: "CURATOR",
                registrationDate: new Date().toLocaleString()
            };
            
            db.ref('mlk_users').push(newUser).then(() => {
                // Перезагружаем пользователей и логинимся
                loadUsersAndWhitelist(() => {
                    CURRENT_ROLE = "CURATOR";
                    CURRENT_USER = username;
                    completeLogin();
                });
            });
            return;
        } else {
            // Если пользователь уже есть
            CURRENT_ROLE = existingUser.role;
            CURRENT_USER = existingUser.username;
        }
    }
    else { 
        document.getElementById("login-error").textContent = "ACCESS DENIED"; 
        return; 
    }
    
    completeLogin();
}

function completeLogin() {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("terminal").style.display = "flex";
    setupSidebar();
    
    if (CURRENT_ROLE === "ADMIN") {
        loadReports(renderReports);
    } else {
        loadReports(renderMLKScreen);
    }
}

/* ===== ИНИЦИАЛИЗАЦИЯ ===== */
document.addEventListener('DOMContentLoaded', function() {
    // Создаем поле для ввода никнейма в форме логина
    const loginForm = document.getElementById("login-screen");
    if (loginForm) {
        // Находим все inputs в форме логина
        const existingInputs = loginForm.querySelectorAll('input');
        
        // Создаем поле для никнейма
        const usernameInput = document.createElement("input");
        usernameInput.type = "text";
        usernameInput.id = "username";
        usernameInput.placeholder = "Введите ваш никнейм";
        usernameInput.className = "login-input";
        
        // Если уже есть поля ввода, добавляем перед первым
        if (existingInputs.length > 0) {
            const passwordInput = existingInputs[0];
            passwordInput.parentNode.insertBefore(usernameInput, passwordInput);
        } else {
            // Если нет полей ввода, добавляем перед кнопкой
            const loginBtn = document.getElementById("login-btn");
            loginBtn.parentNode.insertBefore(usernameInput, loginBtn);
        }
        
        // Добавляем обработчик нажатия Enter
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
        
        document.getElementById("password").addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
    }
    
    document.getElementById("login-btn").onclick = login;
    
    // Загружаем пользователей и вайтлист при загрузке страницы
    loadUsersAndWhitelist();
});

/* ===== SIDEBAR ===== */
function setupSidebar(){
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.innerHTML = "";

    // Добавляем отображение текущего пользователя
    const userInfo = document.createElement("div");
    userInfo.className = "user-info";
    userInfo.innerHTML = `
        <strong>Пользователь:</strong> ${CURRENT_USER}<br>
        <strong>Роль:</strong> ${CURRENT_ROLE}
    `;
    sidebar.appendChild(userInfo);

    if(CURRENT_ROLE === "CURATOR"){
        const btnMLK = document.createElement("button");
        btnMLK.textContent = "ОТЧЕТ МЛК";
        btnMLK.onclick = renderMLKScreen;
        sidebar.appendChild(btnMLK);
    }

    if(CURRENT_ROLE === "ADMIN"){
        const btnReports = document.createElement("button");
        btnReports.textContent = "REPORTS";
        btnReports.onclick = renderReports;
        sidebar.appendChild(btnReports);

        const btnAdmin = document.createElement("button");
        btnAdmin.textContent = "ADMIN";
        btnAdmin.onclick = renderAdmin;
        sidebar.appendChild(btnAdmin);

        const btnWhitelist = document.createElement("button");
        btnWhitelist.textContent = "ВАЙТЛИСТ";
        btnWhitelist.onclick = renderWhitelist;
        sidebar.appendChild(btnWhitelist);
        
        const btnUsers = document.createElement("button");
        btnUsers.textContent = "ПОЛЬЗОВАТЕЛИ";
        btnUsers.onclick = renderUsers;
        sidebar.appendChild(btnUsers);
    }
    
    const btnLogout = document.createElement("button");
    btnLogout.textContent = "ВЫЙТИ";
    btnLogout.className = "logout-btn";
    btnLogout.onclick = function() {
        CURRENT_ROLE = null;
        CURRENT_USER = null;
        document.getElementById("terminal").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        document.getElementById("password").value = "";
        const usernameInput = document.getElementById("username");
        if (usernameInput) usernameInput.value = "";
        document.getElementById("login-error").textContent = "";
    };
    sidebar.appendChild(btnLogout);
}

/* ===== LOAD REPORTS ===== */
function loadReports(callback){
    db.ref('mlk_reports').once('value').then(snapshot=>{
        const data = snapshot.val() || {};
        reports = Object.keys(data).map(key => ({...data[key], id:key}));
        if(callback) callback();
    }).catch(error => {
        console.error("Ошибка загрузки отчетов:", error);
        if(callback) callback();
    });
}

/* ===== MLK SCREEN (КУРАТОР) ===== */
function renderMLKScreen(){
    const content = document.getElementById("content");
    if (!content) return;
    content.innerHTML = ""; 

    if (CURRENT_ROLE === "CURATOR") {
        const btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "flex-end";
        btnContainer.style.marginBottom = "10px";

        const addBtn = document.createElement("button");
        addBtn.textContent = "+ ДОБАВИТЬ ОТЧЕТ";
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
    const content = document.getElementById("content");
    if (!content) return; 

    content.innerHTML = `
        <div style="max-width: 600px; margin: 0 auto;">
            <h3 style="text-align: center; margin-bottom: 20px;">НОВЫЙ ОТЧЕТ МЛК</h3>
            <label>Discord тег игрока:</label><br>
            <input id="mlk-tag" placeholder="User#0000 или username"><br><br>
            <label>Кратко что сделал:</label><br>
            <textarea id="mlk-action" rows="4" placeholder="Опишите нарушение или действие..."></textarea><br><br>
            <div style="display: flex; gap: 10px;">
                <button onclick="renderMLKScreen()" style="background: #333;">Назад</button>
                <button id="submit-mlk-btn" style="flex: 1;">Отправить отчет</button>
            </div>
        </div>
    `;
    document.getElementById("submit-mlk-btn").onclick = addMLKReport;
    
    // Добавляем обработчик Enter для удобства
    document.getElementById("mlk-action").addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            addMLKReport();
        }
    });
}

function addMLKReport(){
    const tag = document.getElementById("mlk-tag").value.trim();
    const action = document.getElementById("mlk-action").value.trim();
    if(!tag){ alert("Введите Discord тег игрока"); return; }
    if(!action){ alert("Опишите действие игрока"); return; }

    const report = {
        tag, 
        action, 
        author: CURRENT_USER,
        role: CURRENT_ROLE,
        time: new Date().toLocaleString(), 
        confirmed: false, 
        deleted: false
    };
    
    db.ref('mlk_reports').push(report).then(()=>{
        alert("Отчет сохранен");
        loadReports(renderMLKScreen);
    }).catch(error => {
        alert("Ошибка при сохранении: " + error.message);
    });
}

function renderMLKList(){
    const listDiv = document.getElementById("mlk-list");
    if (!listDiv) return; 
    
    const filteredReports = (CURRENT_ROLE === "CURATOR") 
        ? reports.filter(r => r.author === CURRENT_USER)
        : reports;

    if(filteredReports.length===0){ 
        listDiv.innerHTML="<p style='text-align: center; color: #888;'>Нет отчетов</p>"; 
        return; 
    }

    listDiv.innerHTML = ""; 

    filteredReports.forEach(r=>{
        const div = document.createElement("div");
        div.className = "report";
        
        let status = r.deleted ? 'удален' : (r.confirmed?'подтвержден':'рассматривается');
        let statusClass = r.deleted ? 'deleted' : (r.confirmed?'confirmed':'pending');

        div.innerHTML = `
            <strong>DISCORD:</strong> ${r.tag}<br>
            <strong>ACTION:</strong> ${r.action}<br>
            <strong>АВТОР:</strong> ${r.author || r.role || 'неизвестно'}<br>
            <strong>ВРЕМЯ:</strong> ${r.time}<br>
            <strong>СТАТУС:</strong> <span class="status ${statusClass}">${status}</span>
        `;
        listDiv.appendChild(div);
    });
}

function renderReports(){
    const content = document.getElementById("content");
    if (!content) return;
    if(CURRENT_ROLE!=="ADMIN"){ content.textContent="ACCESS DENIED"; return; }

    let html=`<h3>MLK REPORTS (ADMIN VIEW)</h3>`;
    if(reports.length===0){ html+="<p>No reports</p>"; }
    else{
        html+=`<table>
            <tr><th>DISCORD</th><th>ACTION</th><th>АВТОР</th><th>TIME</th><th>STATUS</th><th>ACTIONS</th></tr>`;
        reports.forEach(r=>{
            let status = r.deleted ? "удален" : (r.confirmed ? "подтвержден" : "рассматривается");
            let statusClass = r.deleted ? "deleted" : (r.confirmed?"confirmed":"pending");
            
            const actionsHtml = (!r.deleted && !r.confirmed) ?
                `<button onclick="confirmReport('${r.id}')">Подтвердить</button>
                 <button onclick="deleteReport('${r.id}')" style="background: #300; border-color: #f44;">Удалить</button>` :
                '';

            html+=`<tr>
                <td>${r.tag || '—'}</td>
                <td>${r.action || '—'}</td>
                <td>${r.author || r.role || 'неизвестно'}</td>
                <td>${r.time || '—'}</td>
                <td><span class="status ${statusClass}">${status}</span></td>
                <td>${actionsHtml}</td>
            </tr>`;
        });
        html+="</table>";
    }
    content.innerHTML=html;
}

/* ===== ADMIN PANEL - ВАЙТЛИСТ ===== */
function renderWhitelist() {
    const content = document.getElementById("content");
    if (!content) return;
    
    content.innerHTML = `
        <h3>УПРАВЛЕНИЕ ВАЙТЛИСТОМ</h3>
        <p style="color: #aaa; margin-bottom: 20px;">Только пользователи из этого списка могут входить как администраторы</p>
        <div style="margin-bottom: 20px; display: flex; align-items: center;">
            <input id="new-whitelist-user" placeholder="Введите никнейм для вайтлиста" style="flex: 1; max-width: 300px;">
            <button onclick="addToWhitelist()" style="margin-left: 10px;">Добавить</button>
        </div>
        <div id="whitelist-container">
            <h4>Текущий вайтлист:</h4>
            ${whitelist.length === 0 ? '<p style="color: #888;">Вайтлист пуст</p>' : ''}
            <table id="whitelist-table" style="width: 100%; margin-top: 10px; display: ${whitelist.length === 0 ? 'none' : 'table'}">
                <tr><th>Никнейм</th><th>Добавил</th><th>Дата добавления</th><th>Действия</th></tr>
            </table>
        </div>
    `;
    
    if (whitelist.length > 0) {
        renderWhitelistTable();
    }
}

function renderWhitelistTable() {
    const table = document.getElementById("whitelist-table");
    if (!table) return;
    
    // Очищаем таблицу, кроме заголовка
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    
    whitelist.forEach(user => {
        const row = table.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);
        const cell4 = row.insertCell(3);
        
        cell1.textContent = user.username;
        cell2.textContent = user.addedBy || "система";
        cell3.textContent = user.addedDate || "неизвестно";
        
        // Не позволяем удалять администратора по умолчанию
        if (user.isDefault) {
            cell4.innerHTML = `<span style="color: #0f0; font-size: 12px;">(админ по умолчанию)</span>`;
        } else {
            cell4.innerHTML = `<button onclick="removeFromWhitelist('${user.id}')" style="background: #300; border-color: #f44;">Удалить</button>`;
        }
    });
}

function addToWhitelist() {
    const input = document.getElementById("new-whitelist-user");
    const username = input.value.trim();
    
    if (!username) {
        alert("Введите никнейм");
        return;
    }
    
    // Проверяем, нет ли уже такого пользователя в вайтлисте
    if (whitelist.some(user => user.username.toLowerCase() === username.toLowerCase())) {
        alert("Пользователь уже в вайтлисте");
        return;
    }
    
    db.ref('mlk_whitelist').push({
        username: username,
        addedBy: CURRENT_USER,
        addedDate: new Date().toLocaleString()
    }).then(() => {
        loadUsersAndWhitelist(() => {
            renderWhitelist();
            input.value = "";
            alert("Пользователь добавлен в вайтлист");
        });
    }).catch(error => {
        alert("Ошибка: " + error.message);
    });
}

function removeFromWhitelist(id) {
    const userToRemove = whitelist.find(user => user.id === id);
    
    if (!userToRemove) return;
    
    // Не позволяем удалять администратора по умолчанию
    if (userToRemove.isDefault) {
        alert("Нельзя удалить администратора по умолчанию");
        return;
    }
    
    if (!confirm(`Удалить пользователя "${userToRemove.username}" из вайтлиста?`)) return;
    
    db.ref('mlk_whitelist/' + id).remove().then(() => {
        loadUsersAndWhitelist(() => {
            renderWhitelist();
            alert("Пользователь удален из вайтлиста");
        });
    }).catch(error => {
        alert("Ошибка: " + error.message);
    });
}

/* ===== ADMIN PANEL - ПОЛЬЗОВАТЕЛИ ===== */
function renderUsers() {
    const content = document.getElementById("content");
    if (!content) return;
    
    content.innerHTML = `
        <h3>ЗАРЕГИСТРИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ</h3>
        <p style="color: #aaa; margin-bottom: 20px;">Все пользователи, которые вошли в систему</p>
        <div id="users-container">
            ${users.length === 0 ? '<p style="color: #888;">Нет зарегистрированных пользователей</p>' : ''}
            <table id="users-table" style="width: 100%; display: ${users.length === 0 ? 'none' : 'table'}">
                <tr><th>Никнейм</th><th>Роль</th><th>Дата регистрации</th><th>Действия</th></tr>
            </table>
        </div>
    `;
    
    if (users.length > 0) {
        renderUsersTable();
    }
}

function renderUsersTable() {
    const table = document.getElementById("users-table");
    if (!table) return;
    
    // Очищаем таблицу, кроме заголовка
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    
    users.forEach(user => {
        const row = table.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);
        const cell4 = row.insertCell(3);
        
        cell1.textContent = user.username;
        cell2.textContent = user.role;
        cell3.textContent = user.registrationDate;
        
        // Не показываем кнопку удаления для самого себя
        if (user.username !== CURRENT_USER) {
            cell4.innerHTML = `<button onclick="removeUser('${user.id}')" style="background: #300; border-color: #f44;">Удалить</button>`;
        }
    });
}

function removeUser(id) {
    const userToRemove = users.find(user => user.id === id);
    
    if (!userToRemove) return;
    
    if (!confirm(`Удалить пользователя "${userToRemove.username}"? Все его отчеты останутся в системе.`)) return;
    
    db.ref('mlk_users/' + id).remove().then(() => {
        loadUsersAndWhitelist(() => {
            renderUsers();
            alert("Пользователь удален");
        });
    }).catch(error => {
        alert("Ошибка: " + error.message);
    });
}

function renderAdmin(){
    const content = document.getElementById("content");
    if (!content) return;
    content.innerHTML = `
        <h3>ADMIN PANEL</h3>
        <p>Добро пожаловать, ${CURRENT_USER}!</p>
        <p>Выберите раздел в боковой панели для управления системой.</p>
        <div class="stats-panel">
            <h4>Статистика системы:</h4>
            <p>📊 Всего отчетов: <strong>${reports.length}</strong></p>
            <p>👥 Зарегистрированных пользователей: <strong>${users.length}</strong></p>
            <p>👑 Пользователей в вайтлисте: <strong>${whitelist.length}</strong></p>
            <p>✅ Подтвержденных отчетов: <strong>${reports.filter(r => r.confirmed).length}</strong></p>
            <p>⏳ Отчетов на рассмотрении: <strong>${reports.filter(r => !r.confirmed && !r.deleted).length}</strong></p>
        </div>
    `;

}
