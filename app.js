/* ===== AUTH SYSTEM ===== */
let CURRENT_ROLE = null;
let CURRENT_USER = null;
let reports = [];

let users = [];
let whitelist = [];
let passwords = {}; // Храним пароли из БД

// Специальные пользователи
const SPECIAL_USERS = ["ADMIN", "Tihiy", "System"];

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

/* ===== ЗАГРУЗКА ДАННЫХ ИЗ БАЗЫ ===== */
function loadData(callback) {
    // Загружаем пользователей
    db.ref('mlk_users').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        users = Object.keys(data).map(key => ({...data[key], id: key}));
        
        // Загружаем вайтлист
        return db.ref('mlk_whitelist').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        whitelist = Object.keys(data).map(key => ({...data[key], id: key}));
        
        // Загружаем пароли
        return db.ref('mlk_passwords').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        passwords = data || {};
        
        // Если пароли не установлены, создаем дефолтные
        if (!passwords.admin || !passwords.curator || !passwords.special) {
            return createDefaultPasswords().then(() => {
                if (callback) callback();
            });
        }
        
        // Если вайтлист пустой, добавляем специальных пользователей
        if (whitelist.length === 0) {
            return addSpecialUsersToWhitelist().then(() => {
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    }).catch(error => {
        console.error("Ошибка загрузки данных:", error);
        if (callback) callback();
    });
}

/* ===== СОЗДАНИЕ ДЕФОЛТНЫХ ПАРОЛЕЙ ===== */
function createDefaultPasswords() {
    const defaultPasswords = {
        admin: "EOD",           // Пароль для обычных админов
        curator: "123",         // Пароль для кураторов
        special: "HASKIKGOADFSKL" // Специальный пароль для ADMIN, Tihiy, System
    };
    
    return db.ref('mlk_passwords').set(defaultPasswords).then(() => {
        console.log("Созданы дефолтные пароли в БД");
        passwords = defaultPasswords;
    });
}

/* ===== ФУНКЦИЯ ДЛЯ ИЗМЕНЕНИЯ ПАРОЛЕЙ ===== */
function changePassword(type, newPassword) {
    if (CURRENT_ROLE !== "ADMIN") {
        showNotification("Только администратор может изменять пароли", "error");
        return;
    }
    
    if (!newPassword || newPassword.trim() === "") {
        showNotification("Введите новый пароль", "error");
        return;
    }
    
    const updates = {};
    updates[type] = newPassword.trim();
    
    return db.ref('mlk_passwords').update(updates).then(() => {
        passwords[type] = newPassword.trim();
        showNotification(`Пароль "${type}" успешно изменен`, "success");
        return true;
    }).catch(error => {
        showNotification("Ошибка изменения пароля: " + error.message, "error");
        return false;
    });
}

/* ===== ДОБАВЛЕНИЕ СПЕЦИАЛЬНЫХ ПОЛЬЗОВАТЕЛЕЙ ===== */
function addSpecialUsersToWhitelist() {
    const promises = [];
    
    SPECIAL_USERS.forEach(username => {
        promises.push(
            db.ref('mlk_whitelist').push({
                username: username,
                addedBy: "SYSTEM",
                addedDate: new Date().toLocaleString(),
                isSpecial: true,
                requiresSpecialPassword: true,
                canOnlyLoginAsAdmin: true
            })
        );
    });
    
    return Promise.all(promises).then(() => {
        console.log("Добавлены специальные пользователи:", SPECIAL_USERS);
        return loadData(); // Перезагружаем данные
    });
}

/* ===== УЛУЧШЕННАЯ ЛОГИКА ВХОДА ===== */
function login(){
    const input = document.getElementById("password").value.trim();
    const usernameInput = document.getElementById("username");
    const username = usernameInput ? usernameInput.value.trim() : "";
    const hash = simpleHash(input);
    
    const errorElement = document.getElementById("login-error");
    if (errorElement) errorElement.textContent = "";
    
    // Получаем хэши паролей из БД
    const adminHash = simpleHash(passwords.admin || "EOD");
    const curatorHash = simpleHash(passwords.curator || "123");
    const specialHash = simpleHash(passwords.special || "HASKIKGOADFSKL");
    
    // Проверяем, является ли пользователь специальным
    const isSpecialUser = SPECIAL_USERS.some(specialUser => 
        specialUser.toLowerCase() === username.toLowerCase()
    );
    
    // === СПЕЦИАЛЬНЫЕ ПОЛЬЗОВАТЕЛИ (ADMIN, Tihiy, System) ===
    if (isSpecialUser) {
        // Специальные пользователи могут войти ТОЛЬКО с специальным паролем как ADMIN
        if (hash === specialHash) {
            CURRENT_ROLE = "ADMIN";
            CURRENT_USER = username;
            completeLogin();
        } else {
            // Если введен пароль куратора или обычного админа - ОТКАЗ
            if (hash === curatorHash) {
                showLoginError("ЭТОТ ПОЛЬЗОВАТЕЛЬ НЕ МОЖЕТ ВОЙТИ КАК КУРАТОР");
            } else if (hash === adminHash) {
                showLoginError("ДЛЯ ЭТОГО АККАУНТА ТРЕБУЕТСЯ СПЕЦИАЛЬНЫЙ ПАРОЛЬ");
            } else {
                showLoginError("НЕВЕРНЫЙ ПАРОЛЬ ДЛЯ СПЕЦИАЛЬНОГО АККАУНТА");
            }
            return;
        }
    }
    // === ОБЫЧНЫЕ ПОЛЬЗОВАТЕЛИ ===
    else {
        // Если введен пароль обычного администратора
        if (hash === adminHash) {
            // Проверяем вайтлист
            const isInWhitelist = whitelist.some(user => 
                user.username.toLowerCase() === username.toLowerCase()
            );
            
            if (!isInWhitelist) {
                showLoginError("НЕТУ В ВАЙТЛИСТЕ");
                return;
            }
            
            CURRENT_ROLE = "ADMIN";
            CURRENT_USER = username;
        }
        // Если введен пароль куратора
        else if (hash === curatorHash) {
            if (!username) {
                showLoginError("ВВЕДИТЕ НИКНЕЙМ");
                return;
            }
            
            // Проверяем, не пытается ли куратор войти под именем специального пользователя
            if (isSpecialUser) {
                showLoginError("ЭТОТ ПОЛЬЗОВАТЕЛЬ НЕ МОЖЕТ ВОЙТИ КАК КУРАТОР");
                return;
            }
            
            // Регистрация/вход куратора
            const existingUser = users.find(user => 
                user.username.toLowerCase() === username.toLowerCase()
            );
            
            if (!existingUser) {
                const newUser = {
                    username: username,
                    role: "CURATOR",
                    registrationDate: new Date().toLocaleString()
                };
                
                db.ref('mlk_users').push(newUser).then(() => {
                    loadData(() => {
                        CURRENT_ROLE = "CURATOR";
                        CURRENT_USER = username;
                        completeLogin();
                    });
                });
                return;
            } else {
                CURRENT_ROLE = existingUser.role;
                CURRENT_USER = existingUser.username;
            }
        }
        else { 
            showLoginError("ACCESS DENIED"); 
            return; 
        }
        
        completeLogin();
    }
}

function showLoginError(message) {
    const errorElement = document.getElementById("login-error");
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = "block";
    }
}

function completeLogin() {
    const loginScreen = document.getElementById("login-screen");
    const terminal = document.getElementById("terminal");
    
    if (loginScreen && terminal) {
        loginScreen.style.display = "none";
        terminal.style.display = "flex";
    }
    
    setupSidebar();
    
    if (CURRENT_ROLE === "ADMIN") {
        loadReports(renderAdmin);
    } else {
        loadReports(renderMLKScreen);
    }
}

/* ===== UI УЛУШЕНИЯ И НАВИГАЦИЯ ===== */
document.addEventListener('DOMContentLoaded', function() {
    // Обновление времени в реальном времени
    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    }
    
    setInterval(updateTime, 1000);
    updateTime();
    
    // Добавляем анимацию для кнопки входа
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.onclick = function() {
            // Анимация нажатия
            loginBtn.style.transform = 'scale(0.98)';
            setTimeout(() => {
                loginBtn.style.transform = '';
                login();
            }, 150);
        };
    }
    
    // Добавляем поддержку Enter в форме
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.id === 'password' || activeElement.id === 'username')) {
                login();
            }
        }
    });
    
    // Инициализация
    loadData();
});

/* ===== SIDEBAR И НАВИГАЦИЯ ===== */
function setupSidebar(){
    const sidebar = document.getElementById("sidebar");
    const navMenu = document.getElementById("nav-menu");
    
    if (!sidebar || !navMenu) return;
    
    // Очищаем навигацию
    navMenu.innerHTML = '';
    
    // Обновляем информацию пользователя
    const usernameElement = document.getElementById('current-username');
    const roleElement = document.getElementById('current-role');
    
    if (usernameElement && CURRENT_USER) {
        usernameElement.textContent = CURRENT_USER.toUpperCase();
    }
    
    if (roleElement && CURRENT_ROLE) {
        roleElement.textContent = CURRENT_ROLE === 'ADMIN' ? 'ADMIN_ACCESS' : 'CURATOR_ACCESS';
    }
    
    // Добавляем навигационные кнопки
    if (CURRENT_ROLE === 'CURATOR') {
        addNavButton(navMenu, 'fas fa-file-alt', 'ОТЧЕТ МЛК', renderMLKScreen);
    }
    
    if (CURRENT_ROLE === 'ADMIN') {
        addNavButton(navMenu, 'fas fa-list', 'ВСЕ ОТЧЕТЫ', renderReports);
        addNavButton(navMenu, 'fas fa-users', 'ВАЙТЛИСТ', renderWhitelist);
        addNavButton(navMenu, 'fas fa-user-friends', 'ПОЛЬЗОВАТЕЛИ', renderUsers);
        addNavButton(navMenu, 'fas fa-key', 'ПАРОЛИ', renderPasswords);
        addNavButton(navMenu, 'fas fa-cogs', 'СИСТЕМА', renderAdmin);
    }
    
    // Добавляем кнопку выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }
}

function addNavButton(container, icon, text, onClick) {
    const button = document.createElement('button');
    button.className = 'nav-button';
    button.innerHTML = `
        <i class="${icon}"></i>
        <span>${text}</span>
    `;
    button.onclick = function() {
        // Убираем active у всех кнопок
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.remove('active');
        });
        // Добавляем active текущей
        button.classList.add('active');
        // Выполняем действие
        onClick();
        // Обновляем заголовок
        const titleElement = document.getElementById('content-title');
        if (titleElement) {
            titleElement.textContent = text;
        }
    };
    container.appendChild(button);
}

function logout() {
    CURRENT_ROLE = null;
    CURRENT_USER = null;
    
    const terminal = document.getElementById('terminal');
    const loginScreen = document.getElementById('login-screen');
    
    if (terminal && loginScreen) {
        terminal.style.display = 'none';
        loginScreen.style.display = 'flex';
    }
    
    // Сбрасываем форму
    document.getElementById('password').value = '';
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.value = '';
    
    const errorElement = document.getElementById('login-error');
    if (errorElement) errorElement.textContent = '';
    
    // Сбрасываем активные кнопки
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active');
    });
}

/* ===== УВЕДОМЛЕНИЯ ===== */
function showNotification(message, type = "info") {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Добавляем в body
    document.body.appendChild(notification);
    
    // Показываем с анимацией
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Удаляем через 5 секунд
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

/* ===== LOAD REPORTS ===== */
function loadReports(callback){
    db.ref('mlk_reports').once('value').then(snapshot=>{
        const data = snapshot.val() || {};
        reports = Object.keys(data).map(key => ({...data[key], id:key}));
        if(callback) callback();
    }).catch(error => {
        console.error("Ошибка загрузки отчетов:", error);
        showNotification("Ошибка загрузки отчетов", "error");
        if(callback) callback();
    });
}

/* ===== MLK SCREEN (КУРАТОР) ===== */
function renderMLKScreen(){
    const content = document.getElementById("content-body");
    if (!content) return;
    content.innerHTML = ''; 

    if (CURRENT_ROLE === "CURATOR") {
        const btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "flex-end";
        btnContainer.style.marginBottom = "20px";

        const addBtn = document.createElement("button");
        addBtn.className = "btn-primary";
        addBtn.innerHTML = '<i class="fas fa-plus"></i> ДОБАВИТЬ ОТЧЕТ';
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
    const content = document.getElementById("content-body");
    if (!content) return; 

    content.innerHTML = `
        <div class="form-container">
            <h3 style="color: #00ff9d; margin-bottom: 25px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-file-medical"></i> НОВЫЙ ОТЧЕТ МЛК
            </h3>
            
            <div class="form-group">
                <label class="form-label">Discord тег игрока</label>
                <input type="text" id="mlk-tag" class="form-input" placeholder="User#0000 или username">
            </div>
            
            <div class="form-group">
                <label class="form-label">Кратко что сделал</label>
                <textarea id="mlk-action" class="form-textarea" rows="6" placeholder="Опишите нарушение или действие..."></textarea>
            </div>
            
            <div class="form-actions">
                <button onclick="renderMLKScreen()" class="btn-secondary">
                    <i class="fas fa-arrow-left"></i> Назад
                </button>
                <button id="submit-mlk-btn" class="btn-primary">
                    <i class="fas fa-paper-plane"></i> Отправить отчет
                </button>
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
    
    if(!tag){ 
        showNotification("Введите Discord тег игрока", "error");
        return; 
    }
    if(!action){ 
        showNotification("Опишите действие игрока", "error");
        return; 
    }

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
        showNotification("Отчет успешно сохранен", "success");
        loadReports(renderMLKScreen);
    }).catch(error => {
        showNotification("Ошибка при сохранении: " + error.message, "error");
    });
}

function renderMLKList(){
    const listDiv = document.getElementById("mlk-list");
    if (!listDiv) return; 
    
    const filteredReports = (CURRENT_ROLE === "CURATOR") 
        ? reports.filter(r => r.author === CURRENT_USER)
        : reports;

    if(filteredReports.length===0){ 
        listDiv.innerHTML=`
            <div style="text-align: center; padding: 50px; color: rgba(0, 255, 157, 0.5);">
                <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>Нет отчетов</h3>
                <p>Создайте свой первый отчет МЛК</p>
            </div>
        `; 
        return; 
    }

    listDiv.innerHTML = ''; 

    filteredReports.forEach(r=>{
        const card = document.createElement("div");
        card.className = "report-card";
        
        let status = r.deleted ? 'удален' : (r.confirmed?'подтвержден':'рассматривается');
        let statusClass = r.deleted ? 'status-deleted' : (r.confirmed?'status-confirmed':'status-pending');
        let statusIcon = r.deleted ? 'fa-trash' : (r.confirmed?'fa-check':'fa-clock');

        card.innerHTML = `
            <div class="report-header">
                <div class="report-title">
                    <i class="fas fa-user-tag"></i> ${r.tag}
                </div>
                <div class="report-meta">
                    <span><i class="far fa-clock"></i> ${r.time}</span>
                    <span><i class="fas fa-user"></i> ${r.author || r.role || 'неизвестно'}</span>
                </div>
            </div>
            
            <div class="report-content">
                ${r.action}
            </div>
            
            <div class="report-footer">
                <div class="report-status ${statusClass}">
                    <i class="fas ${statusIcon}"></i>
                    ${status}
                </div>
                ${CURRENT_ROLE === 'ADMIN' && !r.confirmed && !r.deleted ? `
                <div class="table-actions">
                    <button onclick="confirmReport('${r.id}')" class="action-btn confirm">
                        <i class="fas fa-check"></i> Подтвердить
                    </button>
                    <button onclick="deleteReport('${r.id}')" class="action-btn delete">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        listDiv.appendChild(card);
    });
}

function renderReports(){
    const content = document.getElementById("content-body");
    if (!content) return;
    if(CURRENT_ROLE!=="ADMIN"){ 
        content.innerHTML = '<div class="error-message">ACCESS DENIED</div>'; 
        return; 
    }

    let html = `
        <div style="margin-bottom: 30px;">
            <h3 style="color: #00ff9d; margin-bottom: 10px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-list-alt"></i> ВСЕ ОТЧЕТЫ МЛК
            </h3>
            <p style="color: rgba(0, 255, 157, 0.7);">Общее количество: ${reports.length}</p>
        </div>
    `;
    
    if(reports.length===0){ 
        html+=`
            <div style="text-align: center; padding: 50px; color: rgba(0, 255, 157, 0.5);">
                <i class="fas fa-database" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>База данных пуста</h3>
                <p>Отчеты еще не созданы</p>
            </div>
        `; 
    }
    else{
        html+=`
            <div class="dashboard-grid" style="margin-bottom: 30px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-value">${reports.filter(r => !r.confirmed && !r.deleted).length}</div>
                    <div class="stat-label">На рассмотрении</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check"></i></div>
                    <div class="stat-value">${reports.filter(r => r.confirmed).length}</div>
                    <div class="stat-label">Подтверждено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-trash"></i></div>
                    <div class="stat-value">${reports.filter(r => r.deleted).length}</div>
                    <div class="stat-label">Удалено</div>
                </div>
            </div>
            
            <table class="data-table">
                <thead>
                    <tr>
                        <th>DISCORD</th>
                        <th>ACTION</th>
                        <th>АВТОР</th>
                        <th>TIME</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        reports.forEach(r=>{
            let status = r.deleted ? "удален" : (r.confirmed ? "подтвержден" : "рассматривается");
            let statusClass = r.deleted ? "status-deleted" : (r.confirmed?"status-confirmed":"status-pending");
            let statusIcon = r.deleted ? "fa-trash" : (r.confirmed?"fa-check":"fa-clock");
            
            const actionsHtml = (!r.deleted && !r.confirmed) ?
                `<div class="table-actions">
                    <button onclick="confirmReport('${r.id}')" class="action-btn confirm">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="deleteReport('${r.id}')" class="action-btn delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>` :
                '';

            html+=`<tr>
                <td><i class="fas fa-user-tag"></i> ${r.tag || '—'}</td>
                <td>${r.action || '—'}</td>
                <td><i class="fas fa-user"></i> ${r.author || r.role || 'неизвестно'}</td>
                <td><i class="far fa-clock"></i> ${r.time || '—'}</td>
                <td><span class="report-status ${statusClass}" style="display: inline-flex; padding: 4px 10px;">
                    <i class="fas ${statusIcon}"></i> ${status}
                </span></td>
                <td>${actionsHtml}</td>
            </tr>`;
        });
        
        html+="</tbody></table>";
    }
    
    content.innerHTML=html;
}

/* ===== ADMIN PANEL - ПАРОЛИ ===== */
function renderPasswords() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h3 style="color: #00ff9d; margin-bottom: 25px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-key"></i> УПРАВЛЕНИЕ ПАРОЛЯМИ
            </h3>
            
            <p style="color: rgba(0, 255, 157, 0.7); margin-bottom: 30px; line-height: 1.6;">
                Здесь можно изменить пароли для входа в систему<br>
                <span style="color: #ff0;">⚠️ Изменения вступят в силу немедленно</span>
            </p>
            
            <div class="stat-card" style="margin-bottom: 25px;">
                <div class="stat-icon"><i class="fas fa-user-shield"></i></div>
                <h4 style="color: #00ff9d; margin-bottom: 15px;">Пароль для администраторов</h4>
                <p style="color: rgba(0, 255, 157, 0.7); margin-bottom: 15px;">
                    Используется обычными администраторами из вайтлиста
                </p>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="password" id="admin-password" class="form-input" 
                           value="${passwords.admin || ''}" placeholder="Новый пароль">
                    <button onclick="updatePassword('admin')" class="btn-primary">
                        <i class="fas fa-save"></i> Изменить
                    </button>
                </div>
            </div>
            
            <div class="stat-card" style="margin-bottom: 25px;">
                <div class="stat-icon"><i class="fas fa-users"></i></div>
                <h4 style="color: #00ff9d; margin-bottom: 15px;">Пароль для кураторов</h4>
                <p style="color: rgba(0, 255, 157, 0.7); margin-bottom: 15px;">
                    Используется обычными кураторами для входа
                </p>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="password" id="curator-password" class="form-input" 
                           value="${passwords.curator || ''}" placeholder="Новый пароль">
                    <button onclick="updatePassword('curator')" class="btn-primary">
                        <i class="fas fa-save"></i> Изменить
                    </button>
                </div>
            </div>
            
            <div class="stat-card" style="border-color: #ff0; background: rgba(255, 255, 0, 0.05);">
                <div class="stat-icon" style="color: #ff0;"><i class="fas fa-shield-alt"></i></div>
                <h4 style="color: #ff0; margin-bottom: 15px;">Специальный пароль</h4>
                <p style="color: rgba(255, 255, 0, 0.8); margin-bottom: 15px;">
                    Только для защищенных аккаунтов: ADMIN, Tihiy, System
                </p>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="password" id="special-password" class="form-input" 
                           value="${passwords.special || ''}" placeholder="Новый пароль"
                           style="border-color: #ff0;">
                    <button onclick="updatePassword('special')" class="btn-primary" 
                            style="border-color: #ff0; color: #ff0; background: rgba(255, 255, 0, 0.1);">
                        <i class="fas fa-save"></i> Изменить
                    </button>
                </div>
                <p style="color: #ff0; font-size: 0.85rem; margin-top: 15px;">
                    ⚠️ Этот пароль используется только специальными пользователями и НЕ работает для обычных администраторов
                </p>
            </div>
            
            <div style="margin-top: 40px; padding: 20px; background: rgba(0, 255, 157, 0.05); border-radius: 4px; border: 1px solid rgba(0, 255, 157, 0.2);">
                <h4 style="color: #00ff9d; margin-bottom: 15px;"><i class="fas fa-info-circle"></i> Текущие пароли</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <div style="color: rgba(0, 255, 157, 0.7); font-size: 0.9rem;">Администраторы</div>
                        <div style="color: #00ff9d; font-family: 'Orbitron', sans-serif; font-size: 1.1rem;">${passwords.admin || 'не установлен'}</div>
                    </div>
                    <div>
                        <div style="color: rgba(0, 255, 157, 0.7); font-size: 0.9rem;">Кураторы</div>
                        <div style="color: #00ff9d; font-family: 'Orbitron', sans-serif; font-size: 1.1rem;">${passwords.curator || 'не установлен'}</div>
                    </div>
                    <div>
                        <div style="color: rgba(255, 255, 0, 0.7); font-size: 0.9rem;">Защищенные аккаунты</div>
                        <div style="color: #ff0; font-family: 'Orbitron', sans-serif; font-size: 1.1rem;">${passwords.special || 'не установлен'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updatePassword(type) {
    const inputId = type + "-password";
    const input = document.getElementById(inputId);
    const newPassword = input ? input.value.trim() : "";
    
    if (!newPassword) {
        showNotification("Введите новый пароль", "error");
        return;
    }
    
    if (newPassword.length < 3) {
        showNotification("Пароль должен содержать минимум 3 символа", "error");
        return;
    }
    
    let typeName = getPasswordTypeName(type);
    let confirmMessage = `Изменить пароль для ${typeName}?\nНовый пароль: ${'*'.repeat(newPassword.length)}`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    changePassword(type, newPassword).then(success => {
        if (success) {
            renderPasswords();
        }
    });
}

function getPasswordTypeName(type) {
    switch(type) {
        case 'admin': return 'администраторов';
        case 'curator': return 'кураторов';
        case 'special': return 'защищенных аккаунтов';
        default: return type;
    }
}

/* ===== ADMIN PANEL - ВАЙТЛИСТ ===== */
function renderWhitelist() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h3 style="color: #00ff9d; margin-bottom: 20px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-users"></i> УПРАВЛЕНИЕ ВАЙТЛИСТОМ
            </h3>
            
            <p style="color: rgba(0, 255, 157, 0.7); margin-bottom: 30px; line-height: 1.6;">
                Только пользователи из этого списка могут входить как администраторы<br>
                <span style="color: #ff0;">🔒 Специальные пользователи: только со специальным паролем (${passwords.special || 'не установлен'})</span><br>
                <span style="color: #0f0;">👑 Обычные администраторы: пароль (${passwords.admin || 'EOD'})</span>
            </p>
            
            <div class="stat-card" style="margin-bottom: 30px;">
                <div class="stat-icon"><i class="fas fa-user-plus"></i></div>
                <h4 style="color: #00ff9d; margin-bottom: 15px;">Добавить в вайтлист</h4>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="text" id="new-whitelist-user" class="form-input" 
                           placeholder="Введите никнейм для вайтлиста">
                    <button onclick="addToWhitelist()" class="btn-primary">
                        <i class="fas fa-plus"></i> Добавить
                    </button>
                </div>
            </div>
            
            <div>
                <h4 style="color: #00ff9d; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-list"></i> Текущий вайтлист
                    <span style="font-size: 0.9rem; color: rgba(0, 255, 157, 0.7);">(${whitelist.length} пользователей)</span>
                </h4>
                
                ${whitelist.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: rgba(0, 255, 157, 0.5); border: 1px dashed rgba(0, 255, 157, 0.3); border-radius: 4px;">
                        <i class="fas fa-user-slash" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <h4>Вайтлист пуст</h4>
                        <p>Добавьте первого пользователя выше</p>
                    </div>
                ` : `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Никнейм</th>
                                <th>Тип</th>
                                <th>Добавил</th>
                                <th>Дата добавления</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="whitelist-table-body">
                        </tbody>
                    </table>
                `}
            </div>
        </div>
    `;
    
    if (whitelist.length > 0) {
        renderWhitelistTable();
    }
}

function renderWhitelistTable() {
    const tableBody = document.getElementById("whitelist-table-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    whitelist.forEach(user => {
        const row = document.createElement('tr');
        const isSpecial = SPECIAL_USERS.some(specialUser => 
            specialUser.toLowerCase() === user.username.toLowerCase()
        );
        
        row.innerHTML = `
            <td style="font-weight: 500; color: ${isSpecial ? '#ff0' : '#00ff9d'}">
                <i class="fas ${isSpecial ? 'fa-shield-alt' : 'fa-user'}"></i>
                ${user.username}
            </td>
            <td>
                ${isSpecial ? 
                    `<span style="color: #ff0;"><i class="fas fa-key"></i> Пароль: ${passwords.special || 'специальный'}</span>` : 
                    `<span style="color: #0f0;"><i class="fas fa-unlock"></i> Пароль: ${passwords.admin || 'EOD'}</span>`
                }
            </td>
            <td>${user.addedBy || "система"}</td>
            <td>${user.addedDate || "неизвестно"}</td>
            <td>
                ${isSpecial ? 
                    `<span style="color: #888; font-size: 0.85rem;"><i class="fas fa-lock"></i> защищен</span>` : 
                    `<button onclick="removeFromWhitelist('${user.id}')" class="action-btn delete">
                        <i class="fas fa-trash"></i> Удалить
                    </button>`
                }
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function addToWhitelist() {
    const input = document.getElementById("new-whitelist-user");
    const username = input ? input.value.trim() : "";
    
    if (!username) {
        showNotification("Введите никнейм", "error");
        return;
    }
    
    if (SPECIAL_USERS.some(specialUser => 
        specialUser.toLowerCase() === username.toLowerCase())) {
        showNotification("Это системный аккаунт, уже добавлен", "warning");
        return;
    }
    
    if (whitelist.some(user => user.username.toLowerCase() === username.toLowerCase())) {
        showNotification("Пользователь уже в вайтлисте", "warning");
        return;
    }
    
    db.ref('mlk_whitelist').push({
        username: username,
        addedBy: CURRENT_USER,
        addedDate: new Date().toLocaleString(),
        isSpecial: false
    }).then(() => {
        loadData(() => {
            renderWhitelist();
            showNotification(`Пользователь "${username}" добавлен в вайтлист\nПароль для входа: ${passwords.admin || 'EOD'}`, "success");
            if (input) input.value = "";
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

function removeFromWhitelist(id) {
    const userToRemove = whitelist.find(user => user.id === id);
    
    if (!userToRemove) return;
    
    if (userToRemove.isSpecial) {
        showNotification("Нельзя удалить системный аккаунт", "error");
        return;
    }
    
    if (!confirm(`Удалить пользователя "${userToRemove.username}" из вайтлиста?`)) return;
    
    db.ref('mlk_whitelist/' + id).remove().then(() => {
        loadData(() => {
            renderWhitelist();
            showNotification("Пользователь удален из вайтлиста", "success");
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

/* ===== ADMIN PANEL - ПОЛЬЗОВАТЕЛИ ===== */
function renderUsers() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h3 style="color: #00ff9d; margin-bottom: 20px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-user-friends"></i> ЗАРЕГИСТРИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ
            </h3>
            
            <p style="color: rgba(0, 255, 157, 0.7); margin-bottom: 30px;">
                Все пользователи, которые вошли в систему
            </p>
            
            <div style="margin-bottom: 30px;">
                <div class="dashboard-grid">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-users"></i></div>
                        <div class="stat-value">${users.length}</div>
                        <div class="stat-label">Всего пользователей</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-user-shield"></i></div>
                        <div class="stat-value">${users.filter(u => u.role === 'ADMIN').length}</div>
                        <div class="stat-label">Администраторов</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-user-tie"></i></div>
                        <div class="stat-value">${users.filter(u => u.role === 'CURATOR').length}</div>
                        <div class="stat-label">Кураторов</div>
                    </div>
                </div>
            </div>
            
            <div>
                <h4 style="color: #00ff9d; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-list"></i> Список пользователей
                    <span style="font-size: 0.9rem; color: rgba(0, 255, 157, 0.7);">(${users.length} записей)</span>
                </h4>
                
                ${users.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: rgba(0, 255, 157, 0.5); border: 1px dashed rgba(0, 255, 157, 0.3); border-radius: 4px;">
                        <i class="fas fa-user-friends" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <h4>Нет пользователей</h4>
                        <p>Пользователи появятся после регистрации</p>
                    </div>
                ` : `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Никнейм</th>
                                <th>Роль</th>
                                <th>Дата регистрации</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="users-table-body">
                        </tbody>
                    </table>
                `}
            </div>
        </div>
    `;
    
    if (users.length > 0) {
        renderUsersTable();
    }
}

function renderUsersTable() {
    const tableBody = document.getElementById("users-table-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const isSpecial = SPECIAL_USERS.some(specialUser => 
            specialUser.toLowerCase() === user.username.toLowerCase()
        );
        const isCurrentUser = user.username === CURRENT_USER;
        
        row.innerHTML = `
            <td style="font-weight: 500; color: ${isSpecial ? '#ff0' : isCurrentUser ? '#00ff9d' : 'rgba(0, 255, 157, 0.9)'}">
                <i class="fas ${isSpecial ? 'fa-shield-alt' : user.role === 'ADMIN' ? 'fa-user-shield' : 'fa-user-tie'}"></i>
                ${user.username}
                ${isCurrentUser ? ' <span style="color: #00ff9d; font-size: 0.8rem;">(вы)</span>' : ''}
            </td>
            <td>
                <span class="report-status ${user.role === 'ADMIN' ? 'status-confirmed' : 'status-pending'}" 
                      style="display: inline-flex; padding: 4px 10px;">
                    <i class="fas ${user.role === 'ADMIN' ? 'fa-user-shield' : 'fa-user-tie'}"></i>
                    ${user.role === 'ADMIN' ? 'Администратор' : 'Куратор'}
                </span>
            </td>
            <td>${user.registrationDate || "неизвестно"}</td>
            <td>
                ${!isSpecial && !isCurrentUser ? 
                    `<button onclick="removeUser('${user.id}')" class="action-btn delete">
                        <i class="fas fa-trash"></i> Удалить
                    </button>` : 
                    `<span style="color: #888; font-size: 0.85rem;">
                        <i class="fas ${isSpecial ? 'fa-lock' : 'fa-info-circle'}"></i>
                        ${isSpecial ? 'защищен' : 'текущий'}
                    </span>`
                }
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function removeUser(id) {
    const userToRemove = users.find(user => user.id === id);
    
    if (!userToRemove) return;
    
    const isSpecial = SPECIAL_USERS.some(specialUser => 
        specialUser.toLowerCase() === userToRemove.username.toLowerCase()
    );
    
    if (isSpecial) {
        showNotification("Нельзя удалить системного пользователя", "error");
        return;
    }
    
    if (!confirm(`Удалить пользователя "${userToRemove.username}"? Все его отчеты останутся в системе.`)) return;
    
    db.ref('mlk_users/' + id).remove().then(() => {
        loadData(() => {
            renderUsers();
            showNotification("Пользователь удален", "success");
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

/* ===== ADMIN PANEL - СИСТЕМА ===== */
function renderAdmin(){
    const content = document.getElementById("content-body");
    if (!content) return;
    
    const isSpecial = SPECIAL_USERS.some(specialUser => 
        specialUser.toLowerCase() === CURRENT_USER.toLowerCase()
    );
    
    // Подсчитываем статистику
    const pendingReports = reports.filter(r => !r.confirmed && !r.deleted).length;
    const confirmedReports = reports.filter(r => r.confirmed).length;
    const deletedReports = reports.filter(r => r.deleted).length;
    const adminUsers = users.filter(u => u.role === 'ADMIN').length;
    const curatorUsers = users.filter(u => u.role === 'CURATOR').length;
    
    content.innerHTML = `
        <div class="form-container">
            <h3 style="color: #00ff9d; margin-bottom: 25px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-cogs"></i> СИСТЕМА
                ${isSpecial ? '<span style="color: #ff0; font-size: 1.5rem; margin-left: 10px;">🔒</span>' : ''}
            </h3>
            
            <div style="margin-bottom: 30px; padding: 20px; background: rgba(0, 255, 157, 0.05); border-radius: 4px; border: 1px solid rgba(0, 255, 157, 0.2);">
                <p style="color: #00ff9d; font-size: 1.1rem; margin-bottom: 10px;">
                    Добро пожаловать, <strong>${CURRENT_USER}</strong>${isSpecial ? ' (Защищенный аккаунт)' : ''}!
                </p>
                <p style="color: rgba(0, 255, 157, 0.7);">
                    Выберите раздел в боковой панели для управления системой.
                </p>
            </div>
            
            <h4 style="color: #00ff9d; margin-bottom: 20px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-chart-bar"></i> Статистика системы
            </h4>
            
            <div class="dashboard-grid" style="margin-bottom: 30px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-database"></i></div>
                    <div class="stat-value">${reports.length}</div>
                    <div class="stat-label">Всего отчетов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-value">${users.length}</div>
                    <div class="stat-label">Пользователей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-user-shield"></i></div>
                    <div class="stat-value">${whitelist.length}</div>
                    <div class="stat-label">В вайтлисте</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-shield-alt"></i></div>
                    <div class="stat-value">${SPECIAL_USERS.length}</div>
                    <div class="stat-label">Защищенных</div>
                </div>
            </div>
            
            <div class="dashboard-grid" style="margin-bottom: 30px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-value">${pendingReports}</div>
                    <div class="stat-label">На рассмотрении</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check"></i></div>
                    <div class="stat-value">${confirmedReports}</div>
                    <div class="stat-label">Подтверждено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-trash"></i></div>
                    <div class="stat-value">${deletedReports}</div>
                    <div class="stat-label">Удалено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-user-tie"></i></div>
                    <div class="stat-value">${curatorUsers}</div>
                    <div class="stat-label">Кураторов</div>
                </div>
            </div>
            
            ${isSpecial ? `
            <div style="margin-top: 30px; padding: 20px; background: rgba(255, 255, 0, 0.1); border-radius: 4px; border: 1px solid #ff0;">
                <h4 style="color: #ff0; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                    <i class="fas fa-shield-alt"></i> Защищенный аккаунт
                </h4>
                <div style="color: rgba(255, 255, 0, 0.9); line-height: 1.6;">
                    <p><i class="fas fa-key"></i> Может входить ТОЛЬКО с паролем: <strong>${passwords.special || 'не установлен'}</strong></p>
                    <p><i class="fas fa-ban"></i> Не может войти как куратор (пароль ${passwords.curator || '123'} не работает)</p>
                    <p><i class="fas fa-ban"></i> Не может войти с обычным паролем админа (${passwords.admin || 'EOD'} не работает)</p>
                    <p><i class="fas fa-lock"></i> Не может быть удален из системы</p>
                </div>
            </div>
            ` : ''}
            
            <div style="margin-top: 30px; padding: 20px; background: rgba(10, 15, 20, 0.7); border-radius: 4px; border: 1px solid rgba(0, 255, 157, 0.2);">
                <h4 style="color: #00ff9d; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                    <i class="fas fa-info-circle"></i> Информация о системе
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; color: rgba(0, 255, 157, 0.8);">
                    <div>
                        <div style="font-size: 0.9rem; color: rgba(0, 255, 157, 0.6);">Версия системы</div>
                        <div>v2.0.4</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; color: rgba(0, 255, 157, 0.6);">База данных</div>
                        <div>Firebase Realtime</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; color: rgba(0, 255, 157, 0.6);">Последнее обновление</div>
                        <div>${new Date().toLocaleDateString('ru-RU')}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; color: rgba(0, 255, 157, 0.6);">Статус</div>
                        <div style="color: #00ff9d;"><i class="fas fa-circle" style="font-size: 0.7rem;"></i> Активен</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
