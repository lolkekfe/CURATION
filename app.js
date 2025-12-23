/* ===== СИСТЕМА РАНГОВ ЗОНЫ ===== */
const RANKS = {
    CURATOR: {
        name: "КУРАТОР",
        level: 1,
        access: ["mlk_reports"]
    },
    SENIOR_CURATOR: {
        name: "СТАРШИЙ КУРАТОР", 
        level: 2,
        access: ["mlk_reports", "all_reports", "users"]
    },
    ADMIN: {
        name: "АДМИНИСТРАТОР",
        level: 3,
        access: ["mlk_reports", "all_reports", "whitelist", "users", "passwords", "system"]
    }
};

/* ===== СИСТЕМНЫЕ ПЕРЕМЕННЫЕ ===== */
let CURRENT_ROLE = null;
let CURRENT_USER = null;
let CURRENT_RANK = null;
let reports = [];

let users = [];
let whitelist = [];
let passwords = {};

/* ===== ЗАЩИЩЕННЫЕ ПОЛЬЗОВАТЕЛИ ===== */
const PROTECTED_USERS = ["СИСТЕМНЫЙ", "ГЛАВНЫЙ", "РЕЗЕРВНЫЙ"];

/* ===== СПЕЦИАЛЬНЫЙ ДОСТУП ДЛЯ TIHIY ===== */
const SPECIAL_ACCESS_USERS = {
    "TIHIY": {
        password: "HASKIKGOADFSKL",
        rank: RANKS.CURATOR
    }
};

/* ===== ВОССТАНОВЛЕНИЕ СЕССИИ ===== */
function restoreSession() {
    const savedSession = localStorage.getItem('mlk_session');
    if (!savedSession) return false;
    
    try {
        const session = JSON.parse(savedSession);
        const currentTime = new Date().getTime();
        const maxAge = 8 * 60 * 60 * 1000; // 8 часов в миллисекундах
        
        // Проверяем срок сессии
        if (currentTime - session.timestamp > maxAge) {
            localStorage.removeItem('mlk_session');
            return false;
        }
        
        // Устанавливаем данные из сессии
        CURRENT_USER = session.user;
        CURRENT_ROLE = session.role;
        CURRENT_RANK = null;
        
        // Восстанавливаем ранг из объекта RANKS
        for (const rankKey in RANKS) {
            if (RANKS[rankKey].level === session.rank) {
                CURRENT_RANK = RANKS[rankKey];
                break;
            }
        }
        
        return CURRENT_USER && CURRENT_RANK;
    } catch (e) {
        console.error("Ошибка восстановления сессии:", e);
        localStorage.removeItem('mlk_session');
        return false;
    }
}

/* ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ТАБЛИЦ ===== */
window.deleteReport = function(id) {
    if(CURRENT_RANK.level < RANKS.ADMIN.level) return; 
    if(confirm("Удалить отчет?")) {
        db.ref('mlk_reports/' + id + '/deleted').set(true).then(() => loadReports(renderReports));
    }
}

window.confirmReport = function(id) {
    if(CURRENT_RANK.level < RANKS.ADMIN.level) return;
    db.ref('mlk_reports/' + id + '/confirmed').set(true).then(() => loadReports(renderReports));
}

/* ===== ХЕШИРОВАНИЕ ===== */
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
    db.ref('mlk_users').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        users = Object.keys(data).map(key => ({...data[key], id: key}));
        
        return db.ref('mlk_whitelist').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        whitelist = Object.keys(data).map(key => ({...data[key], id: key}));
        
        return db.ref('mlk_passwords').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        passwords = data || {};
        
        if (!passwords.curator || !passwords.admin || !passwords.special) {
            return createDefaultPasswords().then(() => {
                if (callback) callback();
            });
        }
        
        if (whitelist.length === 0) {
            return addProtectedUsersToWhitelist().then(() => {
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

/* ===== СОЗДАНИЕ ДЕФОЛТНЫХ КОДОВ ===== */
function createDefaultPasswords() {
    const defaultPasswords = {
        curator: "123",
        admin: "EOD",
        special: "HASKIKGOADFSKL"
    };
    
    return db.ref('mlk_passwords').set(defaultPasswords).then(() => {
        console.log("Созданы коды доступа по умолчанию");
        passwords = defaultPasswords;
    });
}

/* ===== ДОБАВЛЕНИЕ ЗАЩИЩЕННЫХ ПОЛЬЗОВАТЕЛЕЙ ===== */
function addProtectedUsersToWhitelist() {
    const promises = [];
    
    PROTECTED_USERS.forEach(username => {
        promises.push(
            db.ref('mlk_whitelist').push({
                username: username,
                addedBy: "СИСТЕМА",
                addedDate: new Date().toLocaleString(),
                isProtected: true
            })
        );
    });
    
    return Promise.all(promises).then(() => {
        console.log("Добавлены защищенные пользователи:", PROTECTED_USERS);
        return loadData();
    });
}

/* ===== ИЗМЕНЕНИЕ КОДОВ ДОСТУПА ===== */
function changePassword(type, newPassword) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level) {
        showNotification("Только администратор может изменять коды доступа", "error");
        return;
    }
    
    if (!newPassword || newPassword.trim() === "") {
        showNotification("Введите новый код", "error");
        return;
    }
    
    const updates = {};
    updates[type] = newPassword.trim();
    
    return db.ref('mlk_passwords').update(updates).then(() => {
        passwords[type] = newPassword.trim();
        showNotification(`Код доступа изменен`, "success");
        return true;
    }).catch(error => {
        showNotification("Ошибка изменения кода: " + error.message, "error");
        return false;
    });
}

/* ===== УЛУЧШЕННАЯ ЛОГИКА ВХОДА С ПРОВЕРКОЙ ДУБЛИКАТОВ ===== */
function login(){
    const input = document.getElementById("password").value.trim();
    const usernameInput = document.getElementById("username");
    const username = usernameInput ? usernameInput.value.trim() : "";
    const hash = simpleHash(input);
    
    const errorElement = document.getElementById("login-error");
    if (errorElement) errorElement.textContent = "";
    
    if (!username) {
        showLoginError("ВВЕДИТЕ ПСЕВДОНИМ");
        return;
    }
    
    const curatorHash = simpleHash(passwords.curator || "123");
    const adminHash = simpleHash(passwords.admin || "EOD");
    const specialHash = simpleHash(passwords.special || "HASKIKGOADFSKL");
    
    const existingUser = users.find(user => 
        user.username.toLowerCase() === username.toLowerCase()
    );
    
    /* === ПРОВЕРКА СПЕЦИАЛЬНОГО ДОСТУПА ДЛЯ TIHIY === */
    const upperUsername = username.toUpperCase();
    if (SPECIAL_ACCESS_USERS[upperUsername]) {
        if (input === SPECIAL_ACCESS_USERS[upperUsername].password) {
            // Специальный доступ
            if (!existingUser) {
                // Создаем нового пользователя
                const newUser = {
                    username: username,
                    role: SPECIAL_ACCESS_USERS[upperUsername].rank.name,
                    rank: SPECIAL_ACCESS_USERS[upperUsername].rank.level,
                    registrationDate: new Date().toLocaleString(),
                    lastLogin: new Date().toLocaleString()
                };
                
                db.ref('mlk_users').push(newUser).then(() => {
                    loadData(() => {
                        CURRENT_ROLE = SPECIAL_ACCESS_USERS[upperUsername].rank.name;
                        CURRENT_USER = username;
                        CURRENT_RANK = SPECIAL_ACCESS_USERS[upperUsername].rank;
                        completeLogin();
                    });
                });
            } else {
                // Обновляем существующего пользователя
                db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
                
                CURRENT_ROLE = SPECIAL_ACCESS_USERS[upperUsername].rank.name;
                CURRENT_USER = username;
                CURRENT_RANK = SPECIAL_ACCESS_USERS[upperUsername].rank;
                completeLogin();
            }
            return;
        }
    }
    
    /* === НОВЫЙ ПОЛЬЗОВАТЕЛЬ === */
    if (!existingUser) {
        let userRank = RANKS.CURATOR;
        
        if (hash === adminHash) {
            const isInWhitelist = whitelist.some(user => 
                user.username.toLowerCase() === username.toLowerCase()
            );
            
            if (!isInWhitelist) {
                showLoginError("ДОСТУП ЗАПРЕЩЕН");
                return;
            }
            userRank = RANKS.ADMIN;
        } else if (hash === curatorHash) {
            userRank = RANKS.CURATOR;
        } else if (hash === specialHash) {
            const isProtected = PROTECTED_USERS.some(protectedUser => 
                protectedUser.toLowerCase() === username.toLowerCase()
            );
            
            if (!isProtected) {
                showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА");
                return;
            }
            userRank = RANKS.ADMIN;
        } else {
            showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА");
            return;
        }
        
        const newUser = {
            username: username,
            role: userRank.name,
            rank: userRank.level,
            registrationDate: new Date().toLocaleString(),
            lastLogin: new Date().toLocaleString()
        };
        
        db.ref('mlk_users').push(newUser).then(() => {
            loadData(() => {
                CURRENT_ROLE = userRank.name;
                CURRENT_USER = username;
                CURRENT_RANK = userRank;
                completeLogin();
            });
        });
        return;
    }
    
    /* === СУЩЕСТВУЮЩИЙ ПОЛЬЗОВАТЕЛЬ === */
    else {
        let isValidPassword = false;
        let userRank = RANKS.CURATOR;
        
        if (existingUser.role === RANKS.ADMIN.name) {
            userRank = RANKS.ADMIN;
        } else if (existingUser.role === RANKS.SENIOR_CURATOR.name) {
            userRank = RANKS.SENIOR_CURATOR;
        } else {
            userRank = RANKS.CURATOR;
        }
        
        if (userRank.level >= RANKS.ADMIN.level && hash === adminHash) {
            isValidPassword = true;
        } else if (userRank.level >= RANKS.SENIOR_CURATOR.level && hash === adminHash) {
            isValidPassword = true;
        } else if (hash === curatorHash) {
            isValidPassword = true;
        } else if (hash === specialHash) {
            const isProtected = PROTECTED_USERS.some(protectedUser => 
                protectedUser.toLowerCase() === username.toLowerCase()
            );
            if (isProtected) {
                isValidPassword = true;
                userRank = RANKS.ADMIN;
            }
        }
        
        if (!isValidPassword) {
            showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА");
            return;
        }
        
        db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
        
        CURRENT_ROLE = userRank.name;
        CURRENT_USER = username;
        CURRENT_RANK = userRank;
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
    
    // Сохраняем данные сессии в localStorage
    localStorage.setItem('mlk_session', JSON.stringify({
        user: CURRENT_USER,
        role: CURRENT_ROLE,
        rank: CURRENT_RANK.level,
        timestamp: new Date().getTime()
    }));
    
    setupSidebar();
    updateSystemPrompt(`ПОДКЛЮЧЕНИЕ УСПЕШНО. ДОБРО ПОЖАЛОВАТЬ, ${CURRENT_USER}`);
    
    if (CURRENT_RANK.level >= RANKS.ADMIN.level) {
        loadReports(renderSystem);
    } else {
        loadReports(renderMLKScreen);
    }
}

/* ===== UI ИНИЦИАЛИЗАЦИЯ ===== */
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Пытаемся восстановить сессию
    if (restoreSession()) {
        // Сессия восстановлена - загружаем данные и показываем интерфейс
        loadData(() => {
            const loginScreen = document.getElementById("login-screen");
            const terminal = document.getElementById("terminal");
            
            if (loginScreen && terminal) {
                loginScreen.style.display = "none";
                terminal.style.display = "flex";
            }
            
            setupSidebar();
            updateSystemPrompt(`СЕССИЯ ВОССТАНОВЛЕНА. ДОБРО ПОЖАЛОВАТЬ, ${CURRENT_USER}`);
            
            if (CURRENT_RANK.level >= RANKS.ADMIN.level) {
                loadReports(renderSystem);
            } else {
                loadReports(renderMLKScreen);
            }
        });
    } else {
        // Сессия не восстановлена - показываем обычный экран входа
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.onclick = function() {
                loginBtn.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    loginBtn.style.transform = '';
                    login();
                }, 150);
            };
        }
        
        document.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.id === 'password' || activeElement.id === 'username')) {
                    login();
                }
            }
        });
        
        loadData();
    }
});

/* ===== НАВИГАЦИЯ И SIDEBAR ===== */
function setupSidebar(){
    const sidebar = document.getElementById("sidebar");
    const navMenu = document.getElementById("nav-menu");
    
    if (!sidebar || !navMenu) return;
    
    navMenu.innerHTML = '';
    
    const usernameElement = document.getElementById('current-username');
    const rankElement = document.getElementById('current-rank');
    
    if (usernameElement && CURRENT_USER) {
        usernameElement.textContent = CURRENT_USER.toUpperCase();
    }
    
    if (rankElement && CURRENT_RANK) {
        rankElement.textContent = CURRENT_RANK.name;
    }
    
    addNavButton(navMenu, 'fas fa-file-alt', 'ОТЧЕТЫ МЛК', renderMLKScreen);
    
    if (CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level) {
        addNavButton(navMenu, 'fas fa-list', 'ВСЕ ОТЧЕТЫ', renderReports);
        addNavButton(navMenu, 'fas fa-user-friends', 'ПОЛЬЗОВАТЕЛИ', renderUsers);
    }
    
    if (CURRENT_RANK.level >= RANKS.ADMIN.level) {
        addNavButton(navMenu, 'fas fa-users', 'СПИСОК ДОСТУПА', renderWhitelist);
        addNavButton(navMenu, 'fas fa-key', 'КОДЫ ДОСТУПА', renderPasswords);
        addNavButton(navMenu, 'fas fa-cogs', 'СИСТЕМА', renderSystem);
    }
    
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
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        onClick();
        const titleElement = document.getElementById('content-title');
        if (titleElement) {
            titleElement.textContent = text;
        }
        updateSystemPrompt(`ЗАГРУЖЕН РАЗДЕЛ: ${text}`);
    };
    container.appendChild(button);
}

function logout() {
    CURRENT_ROLE = null;
    CURRENT_USER = null;
    CURRENT_RANK = null;
    
    // Удаляем сохраненную сессию
    localStorage.removeItem('mlk_session');
    
    const terminal = document.getElementById('terminal');
    const loginScreen = document.getElementById('login-screen');
    
    if (terminal && loginScreen) {
        terminal.style.display = 'none';
        loginScreen.style.display = 'flex';
    }
    
    document.getElementById('password').value = '';
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.value = '';
    
    const errorElement = document.getElementById('login-error');
    if (errorElement) errorElement.textContent = '';
    
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active');
    });
}

/* ===== УВЕДОМЛЕНИЯ ===== */
function showNotification(message, type = "info") {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

function updateSystemPrompt(message) {
    const promptElement = document.getElementById('system-prompt');
    if (promptElement) {
        promptElement.textContent = message;
    }
}

/* ===== ЗАГРУЗКА ОТЧЕТОВ ===== */
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

/* ===== СТРАНИЦА ОТЧЕТОВ МЛК ===== */
function renderMLKScreen(){
    const content = document.getElementById("content-body");
    if (!content) return;
    content.innerHTML = ''; 

    if (CURRENT_RANK.level === RANKS.CURATOR.level) {
        const btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "flex-end";
        btnContainer.style.marginBottom = "20px";

        const addBtn = document.createElement("button");
        addBtn.className = "btn-primary";
        addBtn.innerHTML = '<i class="fas fa-plus"></i> НОВЫЙ ОТЧЕТ';
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
            <h2 style="color: #c0b070; margin-bottom: 25px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-file-medical"></i> НОВЫЙ ОТЧЕТ
            </h2>
            
            <div class="form-group">
                <label class="form-label">ИДЕНТИФИКАТОР НАРУШИТЕЛЯ</label>
                <input type="text" id="mlk-tag" class="form-input" placeholder="УКАЖИТЕ ИДЕНТИФИКАТОР">
            </div>
            
            <div class="form-group">
                <label class="form-label">ОПИСАНИЕ НАРУШЕНИЯ</label>
                <textarea id="mlk-action" class="form-textarea" rows="6" placeholder="ПОДРОБНО ОПИШИТЕ НАРУШЕНИЕ..."></textarea>
            </div>
            
            <div class="form-actions">
                <button onclick="renderMLKScreen()" class="btn-secondary">
                    <i class="fas fa-arrow-left"></i> ОТМЕНА
                </button>
                <button id="submit-mlk-btn" class="btn-primary">
                    <i class="fas fa-paper-plane"></i> ОТПРАВИТЬ ОТЧЕТ
                </button>
            </div>
        </div>
    `;
    
    document.getElementById("submit-mlk-btn").onclick = addMLKReport;
    
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
        showNotification("Введите идентификатор нарушителя", "error");
        return; 
    }
    if(!action){ 
        showNotification("Опишите нарушение", "error");
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
    
    const filteredReports = (CURRENT_RANK.level === RANKS.CURATOR.level) 
        ? reports.filter(r => r.author === CURRENT_USER)
        : reports;

    if(filteredReports.length===0){ 
        listDiv.innerHTML=`
            <div style="text-align: center; padding: 50px; color: rgba(140, 180, 60, 0.5);">
                <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>ОТЧЕТЫ ОТСУТСТВУЮТ</h3>
                <p>СОЗДАЙТЕ ПЕРВЫЙ ОТЧЕТ</p>
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
                ${CURRENT_RANK.level >= RANKS.ADMIN.level && !r.confirmed && !r.deleted ? `
                <div class="table-actions">
                    <button onclick="confirmReport('${r.id}')" class="action-btn confirm">
                        <i class="fas fa-check"></i> ПОДТВЕРДИТЬ
                    </button>
                    <button onclick="deleteReport('${r.id}')" class="action-btn delete">
                        <i class="fas fa-trash"></i> УДАЛИТЬ
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        listDiv.appendChild(card);
    });
}

/* ===== СТРАНИЦА ВСЕХ ОТЧЕТОВ ===== */
function renderReports(){
    const content = document.getElementById("content-body");
    if (!content) return;
    if(CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level){ 
        content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>'; 
        return; 
    }

    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #c0b070; margin-bottom: 10px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-list-alt"></i> АРХИВ ОТЧЕТОВ
            </h2>
            <p style="color: rgba(192, 176, 112, 0.7);">ОБЩЕЕ КОЛИЧЕСТВО: ${reports.length}</p>
        </div>
    `;
    
    if(reports.length===0){ 
        html+=`
            <div style="text-align: center; padding: 50px; color: rgba(140, 180, 60, 0.5);">
                <i class="fas fa-database" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>БАЗА ДАННЫХ ПУСТА</h3>
                <p>ОТЧЕТЫ ЕЩЕ НЕ СОЗДАНЫ</p>
            </div>
        `; 
    }
    else{
        html+=`
            <div class="dashboard-grid" style="margin-bottom: 30px;">
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-clock"></i></div>
                    <div class="card-value">${reports.filter(r => !r.confirmed && !r.deleted).length}</div>
                    <div class="card-label">НА РАССМОТРЕНИИ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-check"></i></div>
                    <div class="card-value">${reports.filter(r => r.confirmed).length}</div>
                    <div class="card-label">ПОДТВЕРЖДЕНО</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-trash"></i></div>
                    <div class="card-value">${reports.filter(r => r.deleted).length}</div>
                    <div class="card-label">УДАЛЕНО</div>
                </div>
            </div>
            
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ИДЕНТИФИКАТОР</th>
                        <th>НАРУШЕНИЕ</th>
                        <th>АВТОР</th>
                        <th>ВРЕМЯ</th>
                        <th>СТАТУС</th>
                        <th>ДЕЙСТВИЯ</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        reports.forEach(r=>{
            let status = r.deleted ? "удален" : (r.confirmed ? "подтвержден" : "рассматривается");
            let statusClass = r.deleted ? "status-deleted" : (r.confirmed?"status-confirmed":"status-pending");
            let statusIcon = r.deleted ? "fa-trash" : (r.confirmed?"fa-check":"fa-clock");
            
            const actionsHtml = (!r.deleted && !r.confirmed && CURRENT_RANK.level >= RANKS.ADMIN.level) ?
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

/* ===== СТРАНИЦА КОДОВ ДОСТУПА ===== */
function renderPasswords() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 25px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-key"></i> УПРАВЛЕНИЕ КОДАМИ ДОСТУПА
            </h2>
            
            <p style="color: #8f9779; margin-bottom: 30px; line-height: 1.6;">
                ИЗМЕНЕНИЕ КОДОВ ДОСТУПА В СИСТЕМУ<br>
                <span style="color: #c0b070;">ИЗМЕНЕНИЯ ВСТУПАЮТ В СИЛУ НЕМЕДЛЕННО</span>
            </p>
            
            <div class="zone-card" style="margin-bottom: 25px;">
                <div class="card-icon"><i class="fas fa-users"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 15px;">КОД ДЛЯ КУРАТОРОВ</h4>
                <p style="color: #8f9779; margin-bottom: 15px;">
                    ИСПОЛЬЗУЕТСЯ КУРАТОРАМИ ДЛЯ ВХОДА В СИСТЕМУ
                </p>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="password" id="curator-password" class="form-input" 
                           value="${passwords.curator || ''}" placeholder="НОВЫЙ КОД">
                    <button onclick="updatePassword('curator')" class="btn-primary">
                        <i class="fas fa-save"></i> ИЗМЕНИТЬ
                    </button>
                </div>
            </div>
            
            <div class="zone-card" style="margin-bottom: 25px;">
                <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 15px;">КОД ДЛЯ СТАРШИХ КУРАТОРОВ</h4>
                <p style="color: #8f9779; margin-bottom: 15px;">
                    ИСПОЛЬЗУЕТСЯ СТАРШИМИ КУРАТОРАМИ ДЛЯ ВХОДА
                </p>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="password" id="admin-password" class="form-input" 
                           value="${passwords.admin || ''}" placeholder="НОВЫЙ КОД">
                    <button onclick="updatePassword('admin')" class="btn-primary">
                        <i class="fas fa-save"></i> ИЗМЕНИТЬ
                    </button>
                </div>
            </div>
            
            <div class="zone-card" style="border-color: #c0b070;">
                <div class="card-icon" style="color: #c0b070;"><i class="fas fa-shield-alt"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 15px;">СИСТЕМНЫЙ КОД</h4>
                <p style="color: #8f9779; margin-bottom: 15px;">
                    ДЛЯ СИСТЕМНЫХ ОПЕРАЦИЙ
                </p>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="password" id="special-password" class="form-input" 
                           value="${passwords.special || ''}" placeholder="НОВЫЙ КОД"
                           style="border-color: #c0b070;">
                    <button onclick="updatePassword('special')" class="btn-primary" 
                            style="border-color: #c0b070;">
                        <i class="fas fa-save"></i> ИЗМЕНИТЬ
                    </button>
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
        showNotification("Введите новый код", "error");
        return;
    }
    
    if (newPassword.length < 3) {
        showNotification("Код должен содержать минимум 3 символа", "error");
        return;
    }
    
    let confirmMessage = `Изменить код доступа?\nНовый код: ${'*'.repeat(newPassword.length)}`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    changePassword(type, newPassword).then(success => {
        if (success) {
            renderPasswords();
        }
    });
}

/* ===== СТРАНИЦА СПИСКА ДОСТУПА ===== */
function renderWhitelist() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 20px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-users"></i> СПИСОК ДОСТУПА
            </h2>
            
            <p style="color: #8f9779; margin-bottom: 30px; line-height: 1.6;">
                ТОЛЬКО ПОЛЬЗОВАТЕЛИ ИЗ ЭТОГО СПИСКА МОГУТ ВХОДИТЬ КАК АДМИНИСТРАТОРЫ
            </p>
            
            <div class="zone-card" style="margin-bottom: 30px;">
                <div class="card-icon"><i class="fas fa-user-plus"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 15px;">ДОБАВИТЬ В СПИСКА ДОСТУПА</h4>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="text" id="new-whitelist-user" class="form-input" 
                           placeholder="ВВЕДИТЕ ПСЕВДОНИМ">
                    <button onclick="addToWhitelist()" class="btn-primary">
                        <i class="fas fa-plus"></i> ДОБАВИТЬ
                    </button>
                </div>
            </div>
            
            <div>
                <h4 style="color: #c0b070; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-list"></i> ТЕКУЩИЙ СПИСОК
                    <span style="font-size: 0.9rem; color: #8f9779;">(${whitelist.length})</span>
                </h4>
                
                ${whitelist.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: rgba(140, 180, 60, 0.5); border: 1px dashed rgba(140, 180, 60, 0.3); border-radius: 2px;">
                        <i class="fas fa-user-slash" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <h4>СПИСОК ПУСТ</h4>
                        <p>ДОБАВЬТЕ ПЕРВОГО ПОЛЬЗОВАТЕЛЯ</p>
                    </div>
                ` : `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ПСЕВДОНИМ</th>
                                <th>ДОБАВИЛ</th>
                                <th>ДАТА ДОБАВЛЕНИЯ</th>
                                <th>ДЕЙСТВИЯ</th>
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
        const isProtected = PROTECTED_USERS.some(protectedUser => 
            protectedUser.toLowerCase() === user.username.toLowerCase()
        );
        
        row.innerHTML = `
            <td style="font-weight: 500; color: ${isProtected ? '#c0b070' : '#8cb43c'}">
                <i class="fas ${isProtected ? 'fa-shield-alt' : 'fa-user'}"></i>
                ${user.username}
            </td>
            <td>${user.addedBy || "СИСТЕМА"}</td>
            <td>${user.addedDate || "НЕИЗВЕСТНО"}</td>
            <td>
                ${isProtected ? 
                    `<span style="color: #8f9779; font-size: 0.85rem;">ЗАЩИЩЕН</span>` : 
                    `<button onclick="removeFromWhitelist('${user.id}')" class="action-btn delete">
                        <i class="fas fa-trash"></i> УДАЛИТЬ
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
        showNotification("Введите псевдоним", "error");
        return;
    }
    
    if (PROTECTED_USERS.some(protectedUser => 
        protectedUser.toLowerCase() === username.toLowerCase())) {
        showNotification("Этот пользователь уже в системе", "warning");
        return;
    }
    
    if (whitelist.some(user => user.username.toLowerCase() === username.toLowerCase())) {
        showNotification("Пользователь уже в списке доступа", "warning");
        return;
    }
    
    db.ref('mlk_whitelist').push({
        username: username,
        addedBy: CURRENT_USER,
        addedDate: new Date().toLocaleString(),
        isProtected: false
    }).then(() => {
        loadData(() => {
            renderWhitelist();
            showNotification(`Пользователь "${username}" добавлен в список доступа`, "success");
            if (input) input.value = "";
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

function removeFromWhitelist(id) {
    const userToRemove = whitelist.find(user => user.id === id);
    
    if (!userToRemove) return;
    
    if (userToRemove.isProtected) {
        showNotification("Нельзя удалить защищенного пользователя", "error");
        return;
    }
    
    if (!confirm(`Удалить пользователя "${userToRemove.username}" из списка доступа?`)) return;
    
    db.ref('mlk_whitelist/' + id).remove().then(() => {
        loadData(() => {
            renderWhitelist();
            showNotification("Пользователь удален из списка доступа", "success");
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

/* ===== СТРАНИЦА ПОЛЬЗОВАТЕЛЕЙ ===== */
function renderUsers() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 20px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-user-friends"></i> РЕГИСТРИРОВАННЫЕ СТАЛКЕРЫ
            </h2>
            
            <p style="color: #8f9779; margin-bottom: 30px;">
                ВСЕ ПОЛЬЗОВАТЕЛИ, КОТОРЫЕ ВОШЛИ В СИСТЕМУ
            </p>
            
            <div style="margin-bottom: 30px;">
                <div class="dashboard-grid">
                    <div class="zone-card">
                        <div class="card-icon"><i class="fas fa-users"></i></div>
                        <div class="card-value">${users.length}</div>
                        <div class="card-label">ВСЕГО СТАЛКЕРОВ</div>
                    </div>
                    <div class="zone-card">
                        <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                        <div class="card-value">${users.filter(u => u.role === RANKS.ADMIN.name).length}</div>
                        <div class="card-label">АДМИНИСТРАТОРЫ</div>
                    </div>
                    <div class="zone-card">
                        <div class="card-icon"><i class="fas fa-star"></i></div>
                        <div class="card-value">${users.filter(u => u.role === RANKS.SENIOR_CURATOR.name).length}</div>
                        <div class="card-label">СТАРШИЕ КУРАТОРЫ</div>
                    </div>
                    <div class="zone-card">
                        <div class="card-icon"><i class="fas fa-user"></i></div>
                        <div class="card-value">${users.filter(u => u.role === RANKS.CURATOR.name).length}</div>
                        <div class="card-label">КУРАТОРЫ</div>
                    </div>
                </div>
            </div>
            
            <div>
                <h4 style="color: #c0b070; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-list"></i> СПИСОК СТАЛКЕРОВ
                    <span style="font-size: 0.9rem; color: #8f9779;">(${users.length})</span>
                </h4>
                
                ${users.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: rgba(140, 180, 60, 0.5); border: 1px dashed rgba(140, 180, 60, 0.3); border-radius: 2px;">
                        <i class="fas fa-user-friends" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <h4>НЕТ ПОЛЬЗОВАТЕЛЕЙ</h4>
                        <p>ПОЛЬЗОВАТЕЛИ ПОЯВЯТСЯ ПОСЛЕ РЕГИСТРАЦИИ</p>
                    </div>
                ` : `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ПСЕВДОНИМ</th>
                                <th>РАНГ</th>
                                <th>РЕГИСТРАЦИЯ</th>
                                <th>ПОСЛЕДНИЙ ВХОД</th>
                                <th>ДЕЙСТВИЯ</th>
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
        const isProtected = PROTECTED_USERS.some(protectedUser => 
            protectedUser.toLowerCase() === user.username.toLowerCase()
        );
        const isCurrentUser = user.username === CURRENT_USER;
        
        let rankBadge = '';
        if (user.role === RANKS.ADMIN.name) {
            rankBadge = '<span class="report-status status-confirmed" style="display: inline-flex; padding: 4px 10px;"><i class="fas fa-user-shield"></i> АДМИНИСТРАТОР</span>';
        } else if (user.role === RANKS.SENIOR_CURATOR.name) {
            rankBadge = '<span class="report-status status-pending" style="display: inline-flex; padding: 4px 10px;"><i class="fas fa-star"></i> СТАРШИЙ КУРАТОР</span>';
        } else {
            rankBadge = '<span class="report-status" style="display: inline-flex; padding: 4px 10px; background: rgba(140, 180, 60, 0.1); color: #8cb43c; border: 1px solid rgba(140, 180, 60, 0.3);"><i class="fas fa-user"></i> КУРАТОР</span>';
        }
        
        row.innerHTML = `
            <td style="font-weight: 500; color: ${isProtected ? '#c0b070' : isCurrentUser ? '#8cb43c' : '#8f9779'}">
                <i class="fas ${isProtected ? 'fa-shield-alt' : user.role === RANKS.ADMIN.name ? 'fa-user-shield' : user.role === RANKS.SENIOR_CURATOR.name ? 'fa-star' : 'fa-user'}"></i>
                ${user.username}
                ${isCurrentUser ? ' <span style="color: #8cb43c; font-size: 0.8rem;">(ВЫ)</span>' : ''}
            </td>
            <td>${rankBadge}</td>
            <td>${user.registrationDate || "НЕИЗВЕСТНО"}</td>
            <td>${user.lastLogin || "НИКОГДА"}</td>
            <td>
                ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.ADMIN.level && user.role !== RANKS.ADMIN.name ? 
                    `<button onclick="promoteToSeniorCurator('${user.id}')" class="action-btn confirm" style="margin-right: 5px;">
                        <i class="fas fa-star"></i> ПОВЫСИТЬ
                    </button>` : 
                    ''
                }
                ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.ADMIN.level ? 
                    `<button onclick="removeUser('${user.id}')" class="action-btn delete">
                        <i class="fas fa-trash"></i> УДАЛИТЬ
                    </button>` : 
                    `<span style="color: #8f9779; font-size: 0.85rem;">
                        ${isProtected ? 'ЗАЩИЩЕН' : isCurrentUser ? 'ТЕКУЩИЙ' : ''}
                    </span>`
                }
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function promoteToSeniorCurator(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (!confirm(`Повысить ${user.username} до старшего куратора?`)) return;
    
    db.ref('mlk_users/' + userId).update({
        role: RANKS.SENIOR_CURATOR.name,
        rank: RANKS.SENIOR_CURATOR.level
    }).then(() => {
        loadData(() => {
            renderUsers();
            showNotification("Ранг успешно повышен", "success");
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

function removeUser(id) {
    const userToRemove = users.find(user => user.id === id);
    
    if (!userToRemove) return;
    
    const isProtected = PROTECTED_USERS.some(protectedUser => 
        protectedUser.toLowerCase() === userToRemove.username.toLowerCase()
    );
    
    if (isProtected) {
        showNotification("Нельзя удалить защищенного пользователя", "error");
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

/* ===== СТРАНИЦА СИСТЕМЫ ===== */
function renderSystem(){
    const content = document.getElementById("content-body");
    if (!content) return;
    
    const pendingReports = reports.filter(r => !r.confirmed && !r.deleted).length;
    const confirmedReports = reports.filter(r => r.confirmed).length;
    const deletedReports = reports.filter(r => r.deleted).length;
    const adminUsers = users.filter(u => u.role === RANKS.ADMIN.name).length;
    const seniorCurators = users.filter(u => u.role === RANKS.SENIOR_CURATOR.name).length;
    const curators = users.filter(u => u.role === RANKS.CURATOR.name).length;
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 25px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-cogs"></i> СИСТЕМА ЗОНЫ
            </h2>
            
            <div class="zone-card" style="margin-bottom: 30px;">
                <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                <div class="card-value">${CURRENT_USER}</div>
                <div class="card-label">ТЕКУЩИЙ ОПЕРАТОР</div>
                <div style="margin-top: 10px; color: #8cb43c; font-size: 0.9rem;">
                    РАНГ: ${CURRENT_RANK.name}
                </div>
            </div>
            
            <h3 style="color: #c0b070; margin-bottom: 20px; border-bottom: 1px solid #4a4a3a; padding-bottom: 10px;">
                <i class="fas fa-chart-bar"></i> СТАТИСТИКА СИСТЕМЫ
            </h3>
            
            <div class="dashboard-grid" style="margin-bottom: 30px;">
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-database"></i></div>
                    <div class="card-value">${reports.length}</div>
                    <div class="card-label">ВСЕГО ОТЧЕТОВ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-users"></i></div>
                    <div class="card-value">${users.length}</div>
                    <div class="card-label">СТАЛКЕРОВ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                    <div class="card-value">${whitelist.length}</div>
                    <div class="card-label">В СПИСКЕ ДОСТУПА</div>
                </div>
            </div>
            
            <div class="dashboard-grid" style="margin-bottom: 30px;">
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-clock"></i></div>
                    <div class="card-value">${pendingReports}</div>
                    <div class="card-label">НА РАССМОТРЕНИИ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-check"></i></div>
                    <div class="card-value">${confirmedReports}</div>
                    <div class="card-label">ПОДТВЕРЖДЕНО</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-trash"></i></div>
                    <div class="card-value">${deletedReports}</div>
                    <div class="card-label">УДАЛЕНО</div>
                </div>
            </div>
            
            <h3 style="color: #c0b070; margin-bottom: 20px; border-bottom: 1px solid #4a4a3a; padding-bottom: 10px;">
                <i class="fas fa-users-cog"></i> РАСПРЕДЕЛЕНИЕ ПО РАНГАМ
            </h3>
            
            <div class="dashboard-grid">
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                    <div class="card-value">${adminUsers}</div>
                    <div class="card-label">АДМИНИСТРАТОРЫ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-star"></i></div>
                    <div class="card-value">${seniorCurators}</div>
                    <div class="card-label">СТАРШИЕ КУРАТОРЫ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user"></i></div>
                    <div class="card-value">${curators}</div>
                    <div class="card-label">КУРАТОРЫ</div>
                </div>
            </div>
            
            <div style="margin-top: 40px; padding: 20px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a;">
                <h4 style="color: #c0b070; margin-bottom: 15px;">
                    <i class="fas fa-info-circle"></i> ИНФОРМАЦИЯ О СИСТЕМЕ
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; color: #8f9779;">
                    <div>
                        <div style="font-size: 0.9rem; color: #6a6a5a;">ВЕРСИЯ СИСТЕМЫ</div>
                        <div>1.3.7</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; color: #6a6a5a;">БАЗА ДАННЫХ</div>
                        <div>ОПЕРАТИВНАЯ</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; color: #6a6a5a;">ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ</div>
                        <div>${new Date().toLocaleDateString('ru-RU')}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; color: #6a6a5a;">СТАТУС</div>
                        <div style="color: #8cb43c;">АКТИВЕН</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
