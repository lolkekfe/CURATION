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
        access: ["mlk_reports", "all_reports", "whitelist", "users", "system", "bans"]
    }
};

/* ===== РАНГ СОЗДАТЕЛЯ ===== */
const CREATOR_RANK = {
    name: "СОЗДАТЕЛЬ",
    level: 999,
    access: ["mlk_reports", "all_reports", "whitelist", "users", "passwords", "system", "everything", "bans"]
};

/* ===== СИСТЕМНЫЕ ПЕРЕМЕННЫЕ ===== */
let CURRENT_ROLE = null;
let CURRENT_USER = null;
let CURRENT_RANK = null;
let CURRENT_STATIC_ID = null;
let reports = [];
let bans = [];
let users = [];
let whitelist = [];
let passwords = {};

/* ===== ВЕБХУК ПЕРЕМЕННЫЕ ===== */
let webhooks = [];
let DISCORD_WEBHOOK_URL = null;
let DISCORD_WEBHOOK_NAME = "Система отчетов Зоны";
let DISCORD_WEBHOOK_AVATAR = "https://i.imgur.com/6B7zHqj.png"; // дефолтная аватарка

/* ===== ЗАЩИЩЕННЫЕ ПОЛЬЗОВАТЕЛЫ ===== */
const PROTECTED_USERS = ["Tihiy"];

/* ===== СПЕЦИАЛЬНЫЙ ДОСТУП ДЛЯ TIHIY ===== */
const SPECIAL_ACCESS_USERS = {
    "TIHIY": {
        password: "HASKIKGOADFSKL",
        rank: CREATOR_RANK
    }
};

/* ===== ГЕНЕРАЦИЯ УНИКАЛЬНОГО STATIC ID ===== */
function generateStaticId(username) {
    const timestamp = Date.now().toString(36);
    const usernamePart = username.slice(0, 3).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    return `${usernamePart}-${timestamp.slice(-4)}-${randomPart}`;
}

/* ===== ВОССТАНОВЛЕНИЕ СЕССИИ ===== */
function restoreSession() {
    const savedSession = localStorage.getItem('mlk_session');
    if (!savedSession) return false;
    
    try {
        const session = JSON.parse(savedSession);
        const currentTime = new Date().getTime();
        const maxAge = 8 * 60 * 60 * 1000; // 8 часов
        
        if (currentTime - session.timestamp > maxAge) {
            localStorage.removeItem('mlk_session');
            return false;
        }
        
        CURRENT_USER = session.user;
        CURRENT_ROLE = session.role;
        CURRENT_RANK = null;
        CURRENT_STATIC_ID = session.staticId;
        
        if (session.rank === CREATOR_RANK.level) {
            CURRENT_RANK = CREATOR_RANK;
        } else {
            for (const rankKey in RANKS) {
                if (RANKS[rankKey].level === session.rank) {
                    CURRENT_RANK = RANKS[rankKey];
                    break;
                }
            }
        }
        
        return CURRENT_USER && CURRENT_RANK && CURRENT_STATIC_ID;
    } catch (e) {
        console.error("Ошибка восстановления сессии:", e);
        localStorage.removeItem('mlk_session');
        return false;
    }
}

/* ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ТАБЛИЦ ===== */
window.deleteReport = function(id) {
    if(CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK.level !== CREATOR_RANK.level) return; 
    if(confirm("Удалить отчет?")) {
        db.ref('mlk_reports/' + id + '/deleted').set(true).then(() => loadReports(renderReports));
    }
}

window.confirmReport = function(id) {
    if(CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK.level !== CREATOR_RANK.level) return;
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
        
        return db.ref('mlk_passwords').once('value');  // <-- ДОБАВИТЬ ЭТО
    }).then(snapshot => {
        const data = snapshot.val() || {};
        passwords = data || {};
        
        return db.ref('mlk_bans').once('value');  // <-- ДОБАВИТЬ ЭТО
    }).then(snapshot => {
        const data = snapshot.val() || {};
        bans = Object.keys(data).map(key => ({...data[key], id: key}));
        
        // ТЕПЕРЬ ЗАГРУЖАЕМ ВЕБХУКИ
        return db.ref('mlk_settings/webhook_url').once('value');
    }).then(snapshot => {
        DISCORD_WEBHOOK_URL = snapshot.val() || null;

        return db.ref('mlk_settings/webhook_name').once('value');
    }).then(snapshot => {
        DISCORD_WEBHOOK_NAME = snapshot.val() || "Система отчетов Зоны";
        
        return db.ref('mlk_settings/webhook_avatar').once('value');
    }).then(snapshot => {
        DISCORD_WEBHOOK_AVATAR = snapshot.val() || "https://i.imgur.com/6B7zHqj.png";
        
        return db.ref('mlk_webhooks').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        webhooks = Object.keys(data).map(key => ({...data[key], id: key}));
        webhooks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Проверка дефолтных паролей
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
        const staticId = generateStaticId(username);
        
        promises.push(
            db.ref('mlk_whitelist').push({
                username: username,
                staticId: staticId,
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
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) {
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

/* ===== СИСТЕМА БАНОВ ===== */
function checkIfBanned(username) {
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { banned: false };
    
    // Ищем активный бан по Static ID
    const activeBan = bans.find(ban => ban.staticId === user.staticId && !ban.unbanned);
    return activeBan ? { banned: true, ...activeBan } : { banned: false };
}

function banUser(username, reason) {
    // Проверка прав (минимум СТАРШИЙ КУРАТОР)
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Недостаточно прав доступа", "error");
        return Promise.reject();
    }

    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        showNotification("Сталкер не найден в базе", "error");
        return Promise.reject();
    }

    if (PROTECTED_USERS.includes(user.username)) {
        showNotification("Ошибка: Попытка блокировки создателя", "error");
        return Promise.reject();
    }

    const banData = {
        username: user.username,
        staticId: user.staticId,
        reason: reason,
        bannedBy: CURRENT_USER,
        bannedDate: new Date().toLocaleString(),
        unbanned: false
    };

    return db.ref('mlk_bans').push(banData).then(() => {
        loadData(() => {
            showNotification(`Объект ${username} заблокирован`, "success");
            renderBanInterface();
        });
        return true;
    });
}

function banByStaticId(staticId, reason) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Недостаточно прав доступа", "error");
        return Promise.reject();
    }

    const user = users.find(u => u.staticId === staticId);
    if (!user) {
        showNotification("Пользователь с таким Static ID не найден", "error");
        return Promise.reject();
    }

    if (PROTECTED_USERS.includes(user.username)) {
        showNotification("Ошибка: Попытка блокировки создателя", "error");
        return Promise.reject();
    }

    const banData = {
        username: user.username,
        staticId: staticId,
        reason: reason,
        bannedBy: CURRENT_USER,
        bannedDate: new Date().toLocaleString(),
        unbanned: false
    };

    return db.ref('mlk_bans').push(banData).then(() => {
        loadData(() => {
            showNotification(`Пользователь ${user.username} заблокирован`, "success");
            renderBanInterface();
        });
        return true;
    });
}

function unbanByStaticId(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Недостаточно прав доступа", "error");
        return Promise.reject();
    }

    const ban = bans.find(b => b.staticId === staticId && !b.unbanned);
    if (!ban) {
        showNotification("Активный бан не найден", "error");
        return Promise.reject();
    }

    return db.ref('mlk_bans/' + ban.id).update({ unbanned: true }).then(() => {
        loadData(() => {
            showNotification("Доступ восстановлен", "success");
            renderBanInterface();
        });
        return true;
    });
}

function promoteByStaticId(staticId, rank) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Недостаточно прав доступа", "error");
        return Promise.reject();
    }

    const user = users.find(u => u.staticId === staticId);
    if (!user) {
        showNotification("Пользователь не найден", "error");
        return Promise.reject();
    }

    if (PROTECTED_USERS.includes(user.username)) {
        showNotification("Нельзя изменять права защищенного пользователя", "error");
        return Promise.reject();
    }

    return db.ref('mlk_users/' + user.id).update({
        role: rank.name,
        rank: rank.level
    }).then(() => {
        loadData(() => {
            showNotification(`Пользователь ${user.username} повышен до ${rank.name}`, "success");
            renderUsers();
            renderBanInterface();
        });
        return true;
    });
}

/* ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С STATIC ID ===== */
window.banByStaticId = function(staticId) {
    const reason = prompt("Введите причину бана:");
    if (reason && reason.trim()) {
        banByStaticId(staticId, reason.trim());
    }
};

window.unbanByStaticId = function(staticId) {
    unbanByStaticId(staticId);
};

window.promoteToAdminByStaticId = function(staticId) {
    if (confirm("Повысить пользователя до администратора?")) {
        promoteByStaticId(staticId, RANKS.ADMIN);
    }
};

window.promoteToSeniorByStaticId = function(staticId) {
    if (confirm("Повысить пользователя до старшего куратора?")) {
        promoteByStaticId(staticId, RANKS.SENIOR_CURATOR);
    }
};

window.demoteToCuratorByStaticId = function(staticId) {
    if (confirm("Понизить пользователя до куратора?")) {
        promoteByStaticId(staticId, RANKS.CURATOR);
    }
};

/* ===== ИНТЕРФЕЙС БАНОВ ===== */
function renderBanInterface() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>';
        return;
    }
    
    const activeBans = bans.filter(ban => !ban.unbanned);
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 25px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-ban"></i> СИСТЕМА БАНОВ
            </h2>
            
            <p style="color: #8f9779; margin-bottom: 30px; line-height: 1.6;">
                УПРАВЛЕНИЕ БЛОКИРОВКАМИ ПОЛЬЗОВАТЕЛЕЙ<br>
                <span style="color: #c0b070;">ЗАБАНЕННЫЕ ПОЛЬЗОВАТЕЛЫ НЕ МОГУТ ВОЙТИ В СИСТЕМУ</span>
            </p>
            
            <div class="zone-card" style="margin-bottom: 30px; border-color: #b43c3c;">
                <div class="card-icon" style="color: #b43c3c;"><i class="fas fa-user-slash"></i></div>
                <h4 style="color: #b43c3c; margin-bottom: 15px;">ДОБАВИТЬ БАН</h4>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label class="form-label">ИМЯ ПОЛЬЗОВАТЕЛЯ</label>
                        <input type="text" id="ban-username" class="form-input" 
                               placeholder="ВВЕДИТЕ ПСЕВДОНИМ ДЛЯ БАНА">
                    </div>
                    <div>
                        <label class="form-label">ПРИЧИНА БАНА</label>
                        <textarea id="ban-reason" class="form-textarea" rows="4" 
                                  placeholder="УКАЖИТЕ ПРИЧИНУ БЛОКИРОВКИ..."></textarea>
                    </div>
                    <button onclick="addBan()" class="btn-primary" style="border-color: #b43c3c;">
                        <i class="fas fa-ban"></i> ЗАБАНИТЬ
                    </button>
                </div>
            </div>

            <div class="zone-card" style="margin-bottom: 30px; border-color: #8cb43c;">
                <div class="card-icon" style="color: #8cb43c;"><i class="fas fa-id-card"></i></div>
                <h4 style="color: #8cb43c; margin-bottom: 15px;">БАН ПО STATIC ID</h4>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label class="form-label">STATIC ID</label>
                        <input type="text" id="ban-staticid" class="form-input" 
                               placeholder="ВВЕДИТЕ STATIC ID ДЛЯ БАНА"
                               style="font-family: 'Courier New', monospace;">
                    </div>
                    <div>
                        <label class="form-label">ПРИЧИНА БАНА</label>
                        <textarea id="ban-reason-static" class="form-textarea" rows="4" 
                                  placeholder="УКАЖИТЕ ПРИЧИНУ БЛОКИРОВКИ..."></textarea>
                    </div>
                    <button onclick="addBanByStaticId()" class="btn-primary" style="border-color: #8cb43c;">
                        <i class="fas fa-ban"></i> ЗАБАНИТЬ ПО ID
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h4 style="color: #c0b070; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-list"></i> АКТИВНЫЕ БАНЫ
                    <span style="font-size: 0.9rem; color: #8f9779;">(${activeBans.length})</span>
                </h4>
                
                ${activeBans.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: rgba(180, 60, 60, 0.5); border: 1px dashed rgba(180, 60, 60, 0.3); border-radius: 2px;">
                        <i class="fas fa-user-check" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <h4>АКТИВНЫЕ БАНЫ ОТСУТСТВУЮТ</h4>
                        <p>ВСЕ ПОЛЬЗОВАТЕЛИ ИМЕЮТ ДОСТУП</p>
                    </div>
                ` : `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ПОЛЬЗОВАТЕЛЬ</th>
                                <th>STATIC ID</th>
                                <th>ПРИЧИНА</th>
                                <th>ЗАБАНИЛ</th>
                                <th>ДАТА БАНА</th>
                                <th>ДЕЙСТВИЯ</th>
                            </tr>
                        </thead>
                        <tbody id="bans-table-body">
                        </tbody>
                    </table>
                `}
            </div>
            
            <div>
                <h4 style="color: #c0b070; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-history"></i> ИСТОРИЯ БАНОВ
                    <span style="font-size: 0.9rem; color: #8f9779;">(${bans.length})</span>
                </h4>
                
                ${bans.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: rgba(140, 180, 60, 0.5); border: 1px dashed rgba(140, 180, 60, 0.3); border-radius: 2px;">
                        <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <h4>ИСТОРИЯ БАНОВ ПУСТА</h4>
                        <p>БАНЫ ЕЩЕ НЕ ВЫДАВАЛИСЬ</p>
                    </div>
                ` : `
                    <div style="max-height: 300px; overflow-y: auto; border: 1px solid #4a4a3a;">
                        <table class="data-table">
                            <thead style="position: sticky; top: 0;">
                                <tr>
                                    <th>ПОЛЬЗОВАТЕЛЬ</th>
                                    <th>STATIC ID</th>
                                    <th>ПРИЧИНА</th>
                                    <th>СТАТУС</th>
                                    <th>ДАТА</th>
                                </tr>
                            </thead>
                            <tbody id="bans-history-body">
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        </div>
    `;
    
    if (activeBans.length > 0) {
        renderBansTable(activeBans);
    }
    
    if (bans.length > 0) {
        renderBansHistory();
    }
}

function renderBansTable(activeBans) {
    const tableBody = document.getElementById("bans-table-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    activeBans.forEach(ban => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 500; color: #b43c3c;">
                <i class="fas fa-user-slash"></i> ${ban.username}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${ban.staticId || "N/A"}
            </td>
            <td>${ban.reason || "Причина не указана"}</td>
            <td>${ban.bannedBy || "Неизвестно"}</td>
            <td>${ban.bannedDate || "Неизвестно"}</td>
            <td>
                ${CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level ? `
                    <button onclick="unbanByStaticId('${ban.staticId}')" class="action-btn confirm">
                        <i class="fas fa-unlock"></i> РАЗБАН
                    </button>
                ` : '<span style="color: #8f9779;">НЕТ ДОСТУПА</span>'}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderBansHistory() {
    const tableBody = document.getElementById("bans-history-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    bans.forEach(ban => {
        const row = document.createElement('tr');
        const isActive = !ban.unbanned;
        
        row.innerHTML = `
            <td style="color: ${isActive ? '#b43c3c' : '#8f9779'}">
                <i class="fas ${isActive ? 'fa-user-slash' : 'fa-user-check'}"></i> ${ban.username}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${ban.staticId || "N/A"}
            </td>
            <td>${ban.reason || "Причина не указана"}</td>
            <td>
                <span class="report-status ${isActive ? 'status-deleted' : 'status-confirmed'}" 
                      style="display: inline-flex; padding: 4px 10px;">
                    <i class="fas ${isActive ? 'fa-ban' : 'fa-check'}"></i>
                    ${isActive ? 'АКТИВЕН' : 'СНЯТ'}
                </span>
            </td>
            <td>${ban.bannedDate || "Неизвестно"}</td>
        `;
        tableBody.appendChild(row);
    });
}

function addBan() {
    const usernameInput = document.getElementById("ban-username");
    const reasonInput = document.getElementById("ban-reason");
    
    const username = usernameInput ? usernameInput.value.trim() : "";
    const reason = reasonInput ? reasonInput.value.trim() : "";
    
    if (!username) {
        showNotification("Введите имя пользователя", "error");
        return;
    }
    
    if (!reason) {
        showNotification("Введите причину бана", "error");
        return;
    }
    
    banUser(username, reason).then(success => {
        if (success) {
            if (usernameInput) usernameInput.value = "";
            if (reasonInput) reasonInput.value = "";
        }
    });
}

function addBanByStaticId() {
    const staticIdInput = document.getElementById("ban-staticid");
    const reasonInput = document.getElementById("ban-reason-static");
    
    const staticId = staticIdInput ? staticIdInput.value.trim() : "";
    const reason = reasonInput ? reasonInput.value.trim() : "";
    
    if (!staticId) {
        showNotification("Введите STATIC ID", "error");
        return;
    }
    
    if (!reason) {
        showNotification("Введите причину бана", "error");
        return;
    }
    
    banByStaticId(staticId, reason).then(success => {
        if (success) {
            if (staticIdInput) staticIdInput.value = "";
            if (reasonInput) reasonInput.value = "";
        }
    });
}

/* ===== ЛОГИКА ВХОДА С ПРОВЕРКОЙ БАНОВ И STATIC ID ===== */
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
    
    const banCheck = checkIfBanned(username);
    if (banCheck.banned) {
        showBannedScreen(banCheck);
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
            if (!existingUser) {
                const staticId = generateStaticId(username);
                const newUser = {
                    username: username,
                    staticId: staticId,
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
                        CURRENT_STATIC_ID = staticId;
                        completeLogin();
                    });
                });
            } else {
                db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
                
                CURRENT_ROLE = SPECIAL_ACCESS_USERS[upperUsername].rank.name;
                CURRENT_USER = username;
                CURRENT_RANK = SPECIAL_ACCESS_USERS[upperUsername].rank;
                CURRENT_STATIC_ID = existingUser.staticId || generateStaticId(username);
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
        
        const staticId = generateStaticId(username);
        const newUser = {
            username: username,
            staticId: staticId,
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
                CURRENT_STATIC_ID = staticId;
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
        CURRENT_STATIC_ID = existingUser.staticId;
        completeLogin();
    }
}

function showBannedScreen(banInfo) {
    const loginScreen = document.getElementById("login-screen");
    if (!loginScreen) return;
    
    loginScreen.innerHTML = `
        <div class="zone-header">
            <div class="geiger-counter">
                <div class="geiger-dots">
                    <span class="dot active" style="background: #b43c3c;"></span>
                    <span class="dot active" style="background: #b43c3c;"></span>
                    <span class="dot active" style="background: #b43c3c;"></span>
                    <span class="dot active" style="background: #b43c3c;"></span>
                    <span class="dot active" style="background: #b43c3c;"></span>
                </div>
                <div class="geiger-text" style="color: #b43c3c;">ДОСТУП ЗАБЛОКИРОВАН</div>
            </div>
            
            <h1 class="zone-title">
                <span class="title-part" style="color: #b43c3c;">ДОСТУП</span>
                <span class="title-part" style="color: #b43c3c;">ЗАБЛОКИРОВАН</span>
            </h1>
            
            <div class="login-warning" style="border-color: #b43c3c; color: #b43c3c;">
                <i class="fas fa-ban"></i>
                <span>ВХОД В СИСТЕМУ НЕВОЗМОЖЕН</span>
            </div>
        </div>
        
        <div class="login-terminal" style="max-width: 800px;">
            <div class="terminal-screen" style="border-color: #b43c3c;">
                <div class="screen-header" style="background: linear-gradient(to right, #3a1a1a, #4a2a2a); color: #b43c3c;">
                    <span>СИСТЕМА БЛОКИРОВКИ</span>
                    <span class="blink" style="color: #b43c3c;">█</span>
                </div>
                
                <div class="screen-content" style="padding: 40px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <i class="fas fa-user-slash" style="font-size: 4rem; color: #b43c3c; margin-bottom: 20px;"></i>
                        <h2 style="color: #b43c3c; font-family: 'Orbitron', sans-serif; margin-bottom: 10px;">
                            ВЫ ЗАБАНЕНЫ
                        </h2>
                        <p style="color: #8f9779; font-size: 1.1rem;">
                            ДОСТУП К СИСТЕМЕ ОТЧЕТОВ ЗОНЫ ЗАПРЕЩЕН
                        </p>
                    </div>
                    
                    <div style="background: rgba(180, 60, 60, 0.1); border: 1px solid #b43c3c; padding: 20px; margin-bottom: 30px;">
                        <h4 style="color: #c0b070; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-exclamation-circle"></i> ПРИЧИНА БЛОКИРОВКИ
                        </h4>
                        <div style="color: #8f9779; font-size: 1.1rem; line-height: 1.6; padding: 10px;">
                            "${banInfo.reason}"
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                        <div style="text-align: center;">
                            <div style="font-size: 0.9rem; color: #6a6a5a; margin-bottom: 5px;">ЗАБАНИЛ</div>
                            <div style="color: #c0b070; font-weight: 500;">${banInfo.bannedBy}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 0.9rem; color: #6a6a5a; margin-bottom: 5px;">ДАТА БАНА</div>
                            <div style="color: #c0b070; font-weight: 500;">${banInfo.bannedDate}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 0.9rem; color: #6a6a5a; margin-bottom: 5px;">STATIC ID</div>
                            <div style="color: #c0b070; font-weight: 500; font-family: 'Courier New', monospace;">${banInfo.staticId || "N/A"}</div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; color: #6a6a5a; font-size: 0.9rem; padding: 15px; border-top: 1px solid #4a4a3a;">
                        <i class="fas fa-info-circle"></i>
                        Для разблокировки обратитесь к старшему куратору
                    </div>
                </div>
                
                <div class="screen-footer" style="padding: 20px; border-top: 1px solid #4a4a3a; text-align: center;">
                    <button onclick="location.reload()" class="access-button" style="border-color: #6a6a5a; color: #6a6a5a;">
                        <i class="fas fa-redo"></i>
                        <span>ОБНОВИТЬ СТРАНИЦУ</span>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="zone-footer">
            <div class="footer-info">
                <span>СТАТУС: БЛОКИРОВКА АКТИВНА</span>
                <span class="sep">|</span>
                <span>КОД: BAN-${Date.now().toString(16).slice(-6).toUpperCase()}</span>
            </div>
            <div class="footer-warning">
                <i class="fas fa-skull-crossbones"></i>
                <span>ПОПЫТКА ОБХОДА БЛОКИРОВКИ БУДЕТ ЗАФИКСИРОВАНА</span>
            </div>
        </div>
    `;
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
    
    localStorage.setItem('mlk_session', JSON.stringify({
        user: CURRENT_USER,
        role: CURRENT_ROLE,
        rank: CURRENT_RANK.level,
        staticId: CURRENT_STATIC_ID,
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
    
    if (restoreSession()) {
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
    const staticIdElement = document.getElementById('current-static-id');
    
    if (usernameElement && CURRENT_USER) {
        usernameElement.textContent = CURRENT_USER.toUpperCase();
    }
    
    if (rankElement && CURRENT_RANK) {
        rankElement.textContent = CURRENT_RANK.name;
    }
    
    if (staticIdElement && CURRENT_STATIC_ID) {
        staticIdElement.textContent = CURRENT_STATIC_ID;
    }
    
    addNavButton(navMenu, 'fas fa-file-alt', 'ОТЧЕТЫ МЛК', renderMLKScreen);
    
    if (CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-list', 'ВСЕ ОТЧЕТЫ', renderReports);
        addNavButton(navMenu, 'fas fa-user-friends', 'ПОЛЬЗОВАТЕЛИ', renderUsers);
    }
    
    if (CURRENT_RANK.level >= RANKS.ADMIN.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-users', 'СПИСОК ДОСТУПА', renderWhitelist);
        addNavButton(navMenu, 'fas fa-key', 'КОДЫ ДОСТУПА', renderPasswords);
        addNavButton(navMenu, 'fas fa-cogs', 'СИСТЕМА', renderSystem);
        addNavButton(navMenu, 'fas fa-ban', 'БАНЫ', renderBanInterface);
        /* === СТРОКА 1 === */
        addNavButton(navMenu, 'fas fa-broadcast-tower', 'DISCORD ВЕБХУКИ', renderWebhookManager);
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
    CURRENT_STATIC_ID = null;
    
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
        authorStaticId: CURRENT_STATIC_ID,
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
                    ${r.authorStaticId ? `<span style="font-family: 'Courier New', monospace; font-size: 0.8rem; color: #8f9779;">
                        <i class="fas fa-id-card"></i> ${r.authorStaticId}
                    </span>` : ''}
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
    if(CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK){ 
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
                        <th>STATIC ID</th>
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
                <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                    ${r.authorStaticId || '—'}
                </td>
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
                                <th>STATIC ID</th>
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
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${user.staticId || "—"}
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
    
    const staticId = generateStaticId(username);
    
    db.ref('mlk_whitelist').push({
        username: username,
        staticId: staticId,
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
                                <th>STATIC ID</th>
                                <th>РАНГ</th>
                                <th>РЕГИСТРАЦИЯ</th>
                                <th>ПОСЛЕДНИЙ ВХОД</th>
                                <th>СТАТУС</th>
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
        const isBanned = bans.some(ban => 
            ban.staticId === user.staticId && 
            !ban.unbanned
        );
        
        let rankBadge = '';
        if (user.role === RANKS.ADMIN.name) {
            rankBadge = '<span class="report-status status-confirmed" style="display: inline-flex; padding: 4px 10px;"><i class="fas fa-user-shield"></i> АДМИНИСТРАТОР</span>';
        } else if (user.role === RANKS.SENIOR_CURATOR.name) {
            rankBadge = '<span class="report-status status-pending" style="display: inline-flex; padding: 4px 10px;"><i class="fas fa-star"></i> СТАРШИЙ КУРАТОР</span>';
        } else {
            rankBadge = '<span class="report-status" style="display: inline-flex; padding: 4px 10px; background: rgba(140, 180, 60, 0.1); color: #8cb43c; border: 1px solid rgba(140, 180, 60, 0.3);"><i class="fas fa-user"></i> КУРАТОР</span>';
        }
        
        row.innerHTML = `
            <td style="font-weight: 500; color: ${isProtected ? '#c0b070' : isCurrentUser ? '#8cb43c' : isBanned ? '#b43c3c' : '#8f9779'}">
                <i class="fas ${isProtected ? 'fa-shield-alt' : user.role === RANKS.ADMIN.name ? 'fa-user-shield' : user.role === RANKS.SENIOR_CURATOR.name ? 'fa-star' : 'fa-user'}"></i>
                ${user.username}
                ${isCurrentUser ? ' <span style="color: #8cb43c; font-size: 0.8rem;">(ВЫ)</span>' : ''}
                ${isBanned ? ' <span style="color: #b43c3c; font-size: 0.8rem;">(ЗАБАНЕН)</span>' : ''}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${user.staticId || "N/A"}
            </td>
            <td>${rankBadge}</td>
            <td>${user.registrationDate || "НЕИЗВЕСТНО"}</td>
            <td>${user.lastLogin || "НИКОГДА"}</td>
            <td>
                ${isBanned ? 
                    '<span class="report-status status-deleted" style="display: inline-flex; padding: 4px 10px;"><i class="fas fa-ban"></i> ЗАБАНЕН</span>' : 
                    '<span class="report-status status-confirmed" style="display: inline-flex; padding: 4px 10px;"><i class="fas fa-check"></i> АКТИВЕН</span>'
                }
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.ADMIN.name ? 
                            `<button onclick="promoteToSeniorCurator('${user.id}')" class="action-btn confirm" style="margin-right: 5px; font-size: 0.8rem; padding: 3px 8px;">
                                <i class="fas fa-star"></i> ПОВЫСИТЬ
                            </button>` : 
                            ''
                        }
                        ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level ? 
                            `<button onclick="removeUser('${user.id}')" class="action-btn delete" style="margin-right: 5px; font-size: 0.8rem; padding: 3px 8px;">
                                <i class="fas fa-trash"></i> УДАЛИТЬ
                            </button>` : 
                            ''
                        }
                        ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && !isBanned ? 
                            `<button onclick="showBanModal('${user.username}')" class="action-btn" style="background: #b43c3c; border-color: #b43c3c; color: white; font-size: 0.8rem; padding: 3px 8px;">
                                <i class="fas fa-ban"></i> БАН
                            </button>` : 
                            ''
                        }
                    </div>
                    
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed #4a4a3a;">
                        <div style="font-size: 0.7rem; color: #6a6a5a; margin-bottom: 3px;">ПО STATIC ID:</div>
                        <div style="display: flex; gap: 3px; flex-wrap: wrap;">
                            ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.ADMIN.name ? 
                                `<button onclick="promoteToAdminByStaticId('${user.staticId}')" class="action-btn" style="background: #c0b070; border-color: #c0b070; color: #1e201c; font-size: 0.7rem; padding: 2px 5px;">
                                    <i class="fas fa-user-shield"></i> АДМ
                                </button>` : 
                                ''
                            }
                            ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.SENIOR_CURATOR.name ? 
                                `<button onclick="promoteToSeniorByStaticId('${user.staticId}')" class="action-btn" style="background: #8cb43c; border-color: #8cb43c; color: #1e201c; font-size: 0.7rem; padding: 2px 5px;">
                                    <i class="fas fa-star"></i> СТ.КУР
                                </button>` : 
                                ''
                            }
                            ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.CURATOR.name ? 
                                `<button onclick="demoteToCuratorByStaticId('${user.staticId}')" class="action-btn" style="background: #6a6a5a; border-color: #6a6a5a; color: white; font-size: 0.7rem; padding: 2px 5px;">
                                    <i class="fas fa-user"></i> КУР
                                </button>` : 
                                ''
                            }
                            ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && !isBanned ? 
                                `<button onclick="window.banByStaticId('${user.staticId}')" class="action-btn" style="background: #b43c3c; border-color: #b43c3c; color: white; font-size: 0.7rem; padding: 2px 5px;">
                                    <i class="fas fa-ban"></i> БАН
                                </button>` : 
                                ''
                            }
                            ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && isBanned ? 
                                `<button onclick="unbanByStaticId('${user.staticId}')" class="action-btn confirm" style="font-size: 0.7rem; padding: 2px 5px;">
                                    <i class="fas fa-unlock"></i> РАЗБАН
                                </button>` : 
                                ''
                            }
                        </div>
                    </div>
                    
                    <span style="color: #8f9779; font-size: 0.85rem;">
                        ${isProtected ? 'ЗАЩИЩЕН' : isCurrentUser ? 'ТЕКУЩИЙ' : ''}
                    </span>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function showBanModal(username) {
    const modalHTML = `
        <div id="ban-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div style="background: rgba(30, 32, 28, 0.95); border: 1px solid #b43c3c; padding: 30px; max-width: 500px; width: 90%;">
                <h3 style="color: #b43c3c; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-ban"></i> БАН ПОЛЬЗОВАТЕЛЯ
                </h3>
                
                <div style="margin-bottom: 20px;">
                    <div style="color: #8f9779; margin-bottom: 10px;">ПОЛЬЗОВАТЕЛЬ:</div>
                    <div style="color: #c0b070; font-size: 1.2rem; font-weight: 500;">${username}</div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <label class="form-label">ПРИЧИНА БАНА</label>
                    <textarea id="modal-ban-reason" class="form-textarea" rows="4" 
                              placeholder="УКАЖИТЕ ПРИЧИНУ БЛОКИРОВКИ..." style="width: 100%;"></textarea>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: flex-end;">
                    <button onclick="closeBanModal()" class="btn-secondary">
                        <i class="fas fa-times"></i> ОТМЕНА
                    </button>
                    <button onclick="processBan('${username}')" class="btn-primary" style="border-color: #b43c3c;">
                        <i class="fas fa-ban"></i> ЗАБАНИТЬ
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv);
}

function closeBanModal() {
    const modal = document.getElementById('ban-modal');
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
}

function processBan(username) {
    const reasonInput = document.getElementById('modal-ban-reason');
    const reason = reasonInput ? reasonInput.value.trim() : "";
    
    if (!reason) {
        showNotification("Введите причину бана", "error");
        return;
    }
    
    banUser(username, reason).then(success => {
        if (success) {
            closeBanModal();
            renderUsers();
        }
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
    const activeBans = bans.filter(ban => !ban.unbanned).length;
    
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
                    РАНГ: ${CURRENT_RANK.name}<br>
                    STATIC ID: <span style="font-family: 'Courier New', monospace;">${CURRENT_STATIC_ID}</span>
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
                <div class="zone-card" style="border-color: ${activeBans > 0 ? '#b43c3c' : '#4a4a3a'};">
                    <div class="card-icon" style="color: ${activeBans > 0 ? '#b43c3c' : '#8cb43c'}"><i class="fas fa-ban"></i></div>
                    <div class="card-value" style="color: ${activeBans > 0 ? '#b43c3c' : '#c0b070'}">${activeBans}</div>
                    <div class="card-label">АКТИВНЫХ БАНОВ</div>
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
                        <div>1.5.0 (STATIC ID)</div>
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

/* ===== ФУНКЦИЯ ДЛЯ УПРАВЛЕНИЯ DISCORD ВЕБХУКАМИ ===== */
function renderWebhookManager() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>';
        return;
    }
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 25px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-broadcast-tower"></i> УПРАВЛЕНИЕ DISCORD ВЕБХУКАМИ
            </h2>
            
            <p style="color: #8f9779; margin-bottom: 30px; line-height: 1.6;">
                НАСТРОЙКА И ТЕСТИРОВАНИЕ ВЕБХУКОВ ДЛЯ ОТПРАВКИ УВЕДОМЛЕНИЙ В DISCORD<br>
                <span style="color: #c0b070;">СИСТЕМА ПОДДЕРЖИВАЕТ КАСТОМНЫЕ ВЛОЖЕНИЯ И ШАБЛОНЫ</span>
            </p>
            
            <div class="zone-card" style="margin-bottom: 30px; border-color: #5865F2;">
                <div class="card-icon" style="color: #5865F2;"><i class="fab fa-discord"></i></div>
                <h4 style="color: #5865F2; margin-bottom: 15px;">НАСТРОЙКА ВЕБХУКА</h4>
                
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label class="form-label">URL ВЕБХУКА DISCORD</label>
                        <input type="text" id="webhook-url" class="form-input" 
                               placeholder="https://discord.com/api/webhooks/..."
                               value="${DISCORD_WEBHOOK_URL || ''}">
                        <div style="margin-top: 5px; font-size: 0.8rem; color: #6a6a5a;">
                            Получить URL можно в настройках канала Discord: Канал → Редактировать канал → Интеграции → Вебхуки
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label class="form-label">ИМЯ ВЕБХУКА</label>
                            <input type="text" id="webhook-name" class="form-input" 
                                   placeholder="Имя отправителя"
                                   value="${DISCORD_WEBHOOK_NAME}">
                        </div>
                        <div>
                            <label class="form-label">URL АВАТАРКИ</label>
                            <input type="text" id="webhook-avatar" class="form-input" 
                                   placeholder="https://example.com/avatar.png"
                                   value="${DISCORD_WEBHOOK_AVATAR}">
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 15px; padding: 10px; background: rgba(40, 42, 36, 0.5); border: 1px solid #4a4a3a;">
                        <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; border: 2px solid #5865F2;">
                            <img id="avatar-preview" src="${DISCORD_WEBHOOK_AVATAR}" 
                                 style="width: 100%; height: 100%; object-fit: cover;"
                                 onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                        </div>
                        <div>
                            <div style="color: #c0b070; font-weight: 500;">${DISCORD_WEBHOOK_NAME}</div>
                            <div style="color: #8f9779; font-size: 0.8rem;">Превью отправителя</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="testWebhook()" class="btn-primary" style="border-color: #5865F2;">
                            <i class="fas fa-broadcast-tower"></i> ТЕСТИРОВАТЬ
                        </button>
                        <button onclick="saveWebhook()" class="btn-primary" style="border-color: #8cb43c;">
                            <i class="fas fa-save"></i> СОХРАНИТЬ ВСЕ
                        </button>
                        <button onclick="clearWebhook()" class="btn-secondary">
                            <i class="fas fa-trash"></i> ОЧИСТИТЬ
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="zone-card" style="margin-bottom: 30px; border-color: #c0b070;">
                <div class="card-icon" style="color: #c0b070;"><i class="fas fa-paper-plane"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 15px;">ОТПРАВИТЬ СООБЩЕНИЕ</h4>
                
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label class="form-label">ТИП СООБЩЕНИЯ</label>
                        <select id="message-type" class="form-input" onchange="changeMessageType()">
                            <option value="simple">Простое сообщение</option>
                            <option value="embed">Сообщение с Embed</option>
                            <option value="report">Уведомление об отчете</option>
                            <option value="ban">Уведомление о бане</option>
                            <option value="user_join">Новый пользователь</option>
                            <option value="admin_alert">Алерт админам</option>
                            <option value="custom">Кастомный JSON</option>
                        </select>
                    </div>
                    
                    <!-- ПРОСТОЕ СООБЩЕНИЕ -->
                    <div id="simple-message" class="message-section">
                        <label class="form-label">ТЕКСТ СООБЩЕНИЯ</label>
                        <textarea id="message-content" class="form-textarea" rows="6" 
                                  placeholder="Введите текст сообщения..."></textarea>
                        <div style="margin-top: 5px; font-size: 0.8rem; color: #6a6a5a;">
                            Простой текст будет отправлен как обычное сообщение Discord
                        </div>
                    </div>
                    
                    <!-- СООБЩЕНИЕ С EMBED -->
                    <div id="embed-message" class="message-section" style="display: none;">
                        <div>
                            <label class="form-label">ОСНОВНОЙ ТЕКСТ (ОПЦИОНАЛЬНО)</label>
                            <textarea id="embed-content" class="form-textarea" rows="3" 
                                      placeholder="Текст перед Embed (опционально)..."></textarea>
                        </div>
                        
                        <div style="margin-top: 15px;">
                            <label class="form-label">НАСТРОЙКИ EMBED</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <div>
                                    <label class="form-label">ЗАГОЛОВОК</label>
                                    <input type="text" id="embed-title" class="form-input" placeholder="Заголовок embed">
                                </div>
                                <div>
                                    <label class="form-label">ЦВЕТ (HEX)</label>
                                    <input type="text" id="embed-color" class="form-input" placeholder="#5865F2" value="#5865F2">
                                </div>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <label class="form-label">ОПИСАНИЕ</label>
                                <textarea id="embed-description" class="form-textarea" rows="6" 
                                          placeholder="Описание embed..."></textarea>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <label class="form-label">ИМЯ АВТОРА</label>
                                    <input type="text" id="embed-author" class="form-input" placeholder="Имя автора">
                                </div>
                                <div>
                                    <label class="form-label">URL ИЗОБРАЖЕНИЯ</label>
                                    <input type="text" id="embed-thumbnail" class="form-input" placeholder="URL изображения">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- КАСТОМНЫЙ JSON -->
                    <div id="custom-message" class="message-section" style="display: none;">
                        <label class="form-label">JSON ПАЙЛОАД</label>
                        <textarea id="custom-payload" class="form-textarea" rows="10" 
                                  placeholder='{
  "content": "Ваше сообщение",
  "username": "Бот",
  "avatar_url": "https://example.com/avatar.png",
  "embeds": [
    {
      "title": "Заголовок",
      "description": "Описание",
      "color": 5793266
    }
  ]
}'
                                  style="font-family: 'Courier New', monospace; font-size: 0.9rem;"></textarea>
                        <div style="margin-top: 5px; font-size: 0.8rem; color: #6a6a5a;">
                            Введите кастомный JSON для отправки в Discord
                        </div>
                    </div>
                    
                    <button onclick="sendDiscordMessage()" class="btn-primary" style="border-color: #5865F2;">
                        <i class="fas fa-paper-plane"></i> ОТПРАВИТЬ В DISCORD
                    </button>
                </div>
            </div>
            
            <div class="zone-card" style="border-color: #8cb43c;">
                <div class="card-icon" style="color: #8cb43c;"><i class="fas fa-code"></i></div>
                <h4 style="color: #8cb43c; margin-bottom: 15px;">ШАБЛОНЫ СООБЩЕНИЙ</h4>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    <button onclick="loadTemplate('report')" class="template-btn">
                        <i class="fas fa-file-alt"></i>
                        <span>ШАБЛОН ОТЧЕТА</span>
                    </button>
                    <button onclick="loadTemplate('ban')" class="template-btn">
                        <i class="fas fa-ban"></i>
                        <span>ШАБЛОН БАНА</span>
                    </button>
                    <button onclick="loadTemplate('user_join')" class="template-btn">
                        <i class="fas fa-user-plus"></i>
                        <span>НОВЫЙ ПОЛЬЗОВАТЕЛЬ</span>
                    </button>
                    <button onclick="loadTemplate('admin_alert')" class="template-btn">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>АЛЕРТ АДМИНАМ</span>
                    </button>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: rgba(40, 42, 36, 0.5); border: 1px solid #4a4a3a;">
                    <h5 style="color: #c0b070; margin-bottom: 10px;">ИСТОРИЯ ВЕБХУКОВ</h5>
                    <div style="max-height: 150px; overflow-y: auto;">
                        <div id="webhook-history">
                            ${webhooks.length === 0 ? '<div style="color: #6a6a5a; text-align: center; padding: 10px;">История пуста</div>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Обновляем превью аватарки при изменении URL
    const avatarInput = document.getElementById('webhook-avatar');
    const avatarPreview = document.getElementById('avatar-preview');
    const nameInput = document.getElementById('webhook-name');

    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('input', function() {
            avatarPreview.src = this.value || 'https://cdn.discordapp.com/embed/avatars/0.png';
        });
    }

    if (webhooks.length > 0) {
        renderWebhookHistory();
    }
}

/* ===== ФУНКЦИИ ДЛЯ РАБОТЫ С DISCORD ВЕБХУКАМИ ===== */
/* ===== ФУНКЦИИ ДЛЯ РАБОТЫ С DISCORD ВЕБХУКАМИ ===== */
function changeMessageType() {
    const type = document.getElementById('message-type').value;
    
    // Скрыть все секции
    document.querySelectorAll('.message-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Показать нужную секцию
    if (type === 'custom') {
        document.getElementById('custom-message').style.display = 'block';
    } else if (type === 'embed') {
        document.getElementById('embed-message').style.display = 'block';
        document.getElementById('simple-message').style.display = 'block';
    } else {
        document.getElementById('simple-message').style.display = 'block';
    }
}

function loadTemplate(templateType) {
    const messageContent = document.getElementById('message-content');
    const embedTitle = document.getElementById('embed-title');
    const embedDescription = document.getElementById('embed-description');
    const embedColor = document.getElementById('embed-color');
    const embedAuthor = document.getElementById('embed-author');
    const embedContent = document.getElementById('embed-content');
    
    switch(templateType) {
        case 'report':
            if (embedContent) embedContent.value = '🆕 НОВЫЙ ОТЧЕТ В СИСТЕМЕ';
            if (embedTitle) embedTitle.value = 'ОТЧЕТ МЛК';
            if (embedDescription) embedDescription.value = `**Автор:** ${CURRENT_USER}\n**Время:** ${new Date().toLocaleString()}\n**Статус:** На рассмотрении\n\nТребуется проверка администратора.`;
            if (embedColor) embedColor.value = '#5865F2';
            if (embedAuthor) embedAuthor.value = 'Система отчетов Зоны';
            document.getElementById('message-type').value = 'embed';
            changeMessageType();
            break;
            
        case 'ban':
            if (embedContent) embedContent.value = '🔨 ВЫДАН БАН ПОЛЬЗОВАТЕЛЮ';
            if (embedTitle) embedTitle.value = 'БЛОКИРОВКА ПОЛЬЗОВАТЕЛЯ';
            if (embedDescription) embedDescription.value = `**Нарушитель:** USERNAME\n**Причина:** НАРУШЕНИЕ ПРАВИЛ\n**Забанил:** ${CURRENT_USER}\n**Дата:** ${new Date().toLocaleString()}\n**Static ID:** UNKNOWN`;
            if (embedColor) embedColor.value = '#b43c3c';
            if (embedAuthor) embedAuthor.value = 'Система банов';
            document.getElementById('message-type').value = 'embed';
            changeMessageType();
            break;
            
        case 'user_join':
            if (embedContent) embedContent.value = '👤 НОВЫЙ СТАЛКЕР В СИСТЕМЕ';
            if (embedTitle) embedTitle.value = 'РЕГИСТРАЦИЯ';
            if (embedDescription) embedDescription.value = `**Имя:** НОВЫЙ ПОЛЬЗОВАТЕЛЬ\n**Ранг:** КУРАТОР\n**Static ID:** GENERATED-ID\n**Дата:** ${new Date().toLocaleString()}\n**IP:** 192.168.1.1`;
            if (embedColor) embedColor.value = '#8cb43c';
            if (embedAuthor) embedAuthor.value = 'Система пользователей';
            document.getElementById('message-type').value = 'embed';
            changeMessageType();
            break;
            
        case 'admin_alert':
            if (embedContent) embedContent.value = '🚨 ВНИМАНИЕ АДМИНИСТРАТОРАМ';
            if (embedTitle) embedTitle.value = 'ВАЖНОЕ УВЕДОМЛЕНИЕ';
            if (embedDescription) embedDescription.value = `**От:** ${CURRENT_USER}\n**Приоритет:** ВЫСОКИЙ\n**Сообщение:** ТРЕБУЕТСЯ ВАШЕ ВНИМАНИЕ\n**Время:** ${new Date().toLocaleString()}\n**Сектор:** Припять-12`;
            if (embedColor) embedColor.value = '#c0b070';
            if (embedAuthor) embedAuthor.value = 'Система оповещений';
            document.getElementById('message-type').value = 'embed';
            changeMessageType();
            break;
    }
}  // ← ЗАКРЫВАЮЩАЯ ФИГУРНАЯ СКОБКА ДЛЯ loadTemplate

function saveWebhook() {
    const urlInput = document.getElementById('webhook-url');
    const nameInput = document.getElementById('webhook-name');
    const avatarInput = document.getElementById('webhook-avatar');
    
    const url = urlInput ? urlInput.value.trim() : '';
    const name = nameInput ? nameInput.value.trim() : '';
    const avatar = avatarInput ? avatarInput.value.trim() : '';
    
    if (!url) {
        showNotification('Введите URL вебхука', 'error');
        return;
    }
    
    if (!url.startsWith('https://discord.com/api/webhooks/')) {
        showNotification('Некорректный URL вебхука Discord', 'error');
        return;
    }
    
    if (!name) {
        showNotification('Введите имя вебхука', 'error');
        return;
    }
    
    DISCORD_WEBHOOK_URL = url;
    DISCORD_WEBHOOK_NAME = name;
    DISCORD_WEBHOOK_AVATAR = avatar || "https://i.imgur.com/6B7zHqj.png";
    
    // Сохраняем все настройки в базу данных
    const updates = {
        'mlk_settings/webhook_url': url,
        'mlk_settings/webhook_name': name,
        'mlk_settings/webhook_avatar': avatar || "https://i.imgur.com/6B7zHqj.png"
    };
    
    db.ref().update(updates).then(() => {
        showNotification('Настройки вебхука сохранены', 'success');
        addWebhookHistory('Сохранены настройки вебхука', 'success');
        
        // Обновляем превью
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) {
            avatarPreview.src = DISCORD_WEBHOOK_AVATAR;
        }
    }).catch(error => {
        showNotification('Ошибка сохранения: ' + error.message, 'error');
    });
}

function clearWebhook() {
    if (confirm('Очистить все настройки вебхука?')) {
        DISCORD_WEBHOOK_URL = null;
        DISCORD_WEBHOOK_NAME = "Система отчетов Зоны";
        DISCORD_WEBHOOK_AVATAR = "https://i.imgur.com/6B7zHqj.png";
        
        const urlInput = document.getElementById('webhook-url');
        const nameInput = document.getElementById('webhook-name');
        const avatarInput = document.getElementById('webhook-avatar');
        const avatarPreview = document.getElementById('avatar-preview');
        
        if (urlInput) urlInput.value = '';
        if (nameInput) nameInput.value = 'Система отчетов Зоны';
        if (avatarInput) avatarInput.value = 'https://i.imgur.com/6B7zHqj.png';
        if (avatarPreview) avatarPreview.src = 'https://i.imgur.com/6B7zHqj.png';
        
        const updates = {
            'mlk_settings/webhook_url': null,
            'mlk_settings/webhook_name': null,
            'mlk_settings/webhook_avatar': null
        };
        
        db.ref().update(updates).then(() => {
            showNotification('Настройки вебхука очищены', 'success');
            addWebhookHistory('Настройки вебхука очищены', 'info');
        });
    }
}

function testWebhook() {
    const urlInput = document.getElementById('webhook-url');
    const url = urlInput ? urlInput.value.trim() : '';
    const nameInput = document.getElementById('webhook-name');
    const name = nameInput ? nameInput.value.trim() : 'Система отчетов Зоны';
    const avatarInput = document.getElementById('webhook-avatar');
    const avatar = avatarInput ? avatarInput.value.trim() : 'https://i.imgur.com/6B7zHqj.png';
    
    if (!url) {
        showNotification('Сначала настройте вебхук', 'error');
        return;
    }
    
    const testPayload = {
        username: name,
        avatar_url: avatar,
        content: null,
        embeds: [{
            title: "✅ ТЕСТ ВЕБХУКА",
            description: `Вебхук успешно настроен!\n\n**Система:** Отчеты Зоны\n**Пользователь:** ${CURRENT_USER}\n**Время:** ${new Date().toLocaleString()}`,
            color: 5793266,
            timestamp: new Date().toISOString(),
            footer: {
                text: "Система вебхуков | Версия 1.5"
            }
        }]
    };
    
    sendDiscordWebhook(url, testPayload, true);
}

function sendDiscordMessage() {
    if (!DISCORD_WEBHOOK_URL) {
        showNotification('Сначала настройте вебхук', 'error');
        return;
    }
    
    const type = document.getElementById('message-type').value;
    let payload = {};
    
    switch(type) {
        case 'simple':
            const content = document.getElementById('message-content').value.trim();
            if (!content) {
                showNotification('Введите текст сообщения', 'error');
                return;
            }
            payload = { 
                content,
                username: DISCORD_WEBHOOK_NAME,
                avatar_url: DISCORD_WEBHOOK_AVATAR
            };
            break;
            
        case 'embed':
            const embedTitle = document.getElementById('embed-title').value.trim();
            const embedDescription = document.getElementById('embed-description').value.trim();
            const embedColor = document.getElementById('embed-color').value.trim();
            const embedAuthor = document.getElementById('embed-author').value.trim();
            const embedThumbnail = document.getElementById('embed-thumbnail').value.trim();
            const embedContent = document.getElementById('embed-content').value.trim();
            
            if (!embedDescription) {
                showNotification('Введите описание embed', 'error');
                return;
            }
            
            payload = {
                content: embedContent || null,
                username: DISCORD_WEBHOOK_NAME,
                avatar_url: DISCORD_WEBHOOK_AVATAR,
                embeds: [{
                    title: embedTitle || undefined,
                    description: embedDescription,
                    color: hexToDecimal(embedColor) || 5793266,
                    author: embedAuthor ? { name: embedAuthor } : undefined,
                    thumbnail: embedThumbnail ? { url: embedThumbnail } : undefined,
                    timestamp: new Date().toISOString()
                }]
            };
            break;
            
        case 'custom':
            const customJson = document.getElementById('custom-payload').value.trim();
            if (!customJson) {
                showNotification('Введите JSON payload', 'error');
                return;
            }
            try {
                payload = JSON.parse(customJson);
                if (!payload.username) payload.username = DISCORD_WEBHOOK_NAME;
                if (!payload.avatar_url) payload.avatar_url = DISCORD_WEBHOOK_AVATAR;
            } catch (e) {
                showNotification('Ошибка в JSON: ' + e.message, 'error');
                return;
            }
            break;
            
        case 'report':
        case 'ban':
        case 'user_join':
        case 'admin_alert':
            loadTemplate(type);
            sendDiscordMessage();
            return;
    }
    
    sendDiscordWebhook(DISCORD_WEBHOOK_URL, payload, false);
}

function sendDiscordWebhook(url, payload, isTest = false) {
    showNotification('Отправка сообщения в Discord...', 'info');
    
    if (!payload.username) {
        payload.username = DISCORD_WEBHOOK_NAME;
    }
    if (!payload.avatar_url) {
        payload.avatar_url = DISCORD_WEBHOOK_AVATAR;
    }
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (response.ok) {
            const message = isTest ? 'Тест вебхука выполнен успешно!' : 'Сообщение отправлено в Discord!';
            showNotification(message, 'success');
            addWebhookHistory(isTest ? 'Тест вебхука' : 'Отправлено сообщение', 'success');
            
            const historyEntry = {
                type: isTest ? 'test' : 'message',
                timestamp: new Date().toLocaleString(),
                user: CURRENT_USER,
                payload: payload
            };
            
            webhooks.unshift(historyEntry);
            if (webhooks.length > 50) webhooks = webhooks.slice(0, 50);
            
            renderWebhookHistory();
            
            db.ref('mlk_webhooks').push(historyEntry);
        } else {
            return response.text().then(text => {
                throw new Error(`HTTP ${response.status}: ${text}`);
            });
        }
    })
    .catch(error => {
        const errorMessage = `Ошибка отправки: ${error.message}`;
        showNotification(errorMessage, 'error');
        addWebhookHistory('Ошибка отправки', 'error');
        console.error('Discord webhook error:', error);
    });
}

function hexToDecimal(hex) {
    if (!hex) return null;
    hex = hex.replace('#', '');
    return parseInt(hex, 16);
}

function addWebhookHistory(message, type) {
    const historyDiv = document.getElementById('webhook-history');
    if (!historyDiv) return;
    
    const entry = document.createElement('div');
    entry.style.cssText = `
        padding: 8px 10px;
        margin-bottom: 5px;
        border-left: 3px solid ${type === 'success' ? '#8cb43c' : type === 'error' ? '#b43c3c' : '#c0b070'};
        background: rgba(40, 42, 36, 0.3);
        font-size: 0.8rem;
        color: #8f9779;
    `;
    
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    entry.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: ${type === 'success' ? '#8cb43c' : type === 'error' ? '#b43c3c' : '#c0b070'}">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}"></i>
                ${message}
            </span>
            <span style="color: #6a6a5a;">${time}</span>
        </div>
    `;
    
    historyDiv.insertBefore(entry, historyDiv.firstChild);
}

function renderWebhookHistory() {
    const historyDiv = document.getElementById('webhook-history');
    if (!historyDiv) return;
    
    historyDiv.innerHTML = '';
    
    webhooks.slice(0, 10).forEach(entry => {
        const div = document.createElement('div');
        div.style.cssText = `
            padding: 8px 10px;
            margin-bottom: 5px;
            border-left: 3px solid ${entry.type === 'test' ? '#5865F2' : '#8cb43c'};
            background: rgba(40, 42, 36, 0.3);
            font-size: 0.8rem;
            color: #8f9779;
        `;
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span style="color: ${entry.type === 'test' ? '#5865F2' : '#8cb43c'}">
                    <i class="fas fa-${entry.type === 'test' ? 'broadcast-tower' : 'paper-plane'}"></i>
                    ${entry.type === 'test' ? 'Тест вебхука' : 'Сообщение'}
                </span>
                <span style="color: #6a6a5a;">${entry.timestamp}</span>
            </div>
            <div style="color: #6a6a5a; font-size: 0.7rem;">
                От: ${entry.user}
            </div>
        `;
        
        historyDiv.appendChild(div);
    });
}


/* ===== КОНЕЦ ФУНКЦИЙ ДЛЯ ВЕБХУКОВ ===== */
