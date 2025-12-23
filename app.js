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
        access: ["mlk_reports", "all_reports", "whitelist", "users", "passwords", "system", "bans"]
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
let CURRENT_STATIC_ID = null; // Новая переменная для текущего STATIC ID
let reports = [];
let bans = [];

let users = [];
let whitelist = [];
let passwords = {};

/* ===== ЗАЩИЩЕННЫЕ ПОЛЬЗОВАТЕЛЫ ===== */
const PROTECTED_USERS = ["Tihiy"];

/* ===== СПЕЦИАЛЬНЫЙ ДОСТУП ДЛЯ TIHIY ===== */
const SPECIAL_ACCESS_USERS = {
    "TIHIY": {
        password: "HASKIKGOADFSKL",
        rank: CREATOR_RANK  // Используем ранг создателя
    }
};

/* ===== ГЕНЕРАЦИЯ УНИКАЛЬНОГО STATIC ID ===== */
function generateStaticId(username) {
    // Создаем уникальный ID на основе username и текущего времени
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
        CURRENT_STATIC_ID = session.staticId; // Восстанавливаем STATIC ID
        
        // Проверяем, не является ли пользователь создателем
        if (session.rank === CREATOR_RANK.level) {
            CURRENT_RANK = CREATOR_RANK;
        } else {
            // Восстанавливаем ранг из объекта RANKS
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
        
        return db.ref('mlk_passwords').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        passwords = data || {};
        
        return db.ref('mlk_bans').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        bans = Object.keys(data).map(key => ({...data[key], id: key}));
        
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
                staticId: staticId, // Добавляем STATIC ID
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

/* ===== СИСТЕМА БАНОВ ЧЕРЕЗ STATIC ID ===== */
function checkIfBanned(username) {
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { banned: false };
    
    const userBans = bans.filter(ban => 
        ban.staticId === user.staticId && !ban.unbanned
    );
    
    if (userBans.length > 0) {
        const latestBan = userBans[userBans.length - 1];
        return {
            banned: true,
            username: username,
            staticId: user.staticId,
            reason: latestBan.reason || "Причина не указана",
            bannedBy: latestBan.bannedBy || "Неизвестно",
            bannedDate: latestBan.bannedDate || "Неизвестно"
        };
    }
    
    return { banned: false };
}

function banUser(username, reason) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Только старший куратор и выше может банить", "error");
        return Promise.reject("Недостаточно прав");
    }
    
    if (!username || !reason) {
        showNotification("Введите имя пользователя и причину", "error");
        return Promise.reject("Не указаны данные");
    }
    
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        showNotification("Пользователь не найден", "error");
        return Promise.reject("Пользователь не найден");
    }
    
    // Нельзя забанить защищенных пользователей
    if (PROTECTED_USERS.some(protectedUser => 
        protectedUser.toLowerCase() === username.toLowerCase())) {
        showNotification("Нельзя забанить защищенного пользователя", "error");
        return Promise.reject("Защищенный пользователь");
    }
    
    // Нельзя забанить самого себя
    if (username.toLowerCase() === CURRENT_USER.toLowerCase()) {
        showNotification("Нельзя забанить самого себя", "error");
        return Promise.reject("Нельзя забанить себя");
    }
    
    // Проверяем не забанен ли уже
    const isAlreadyBanned = bans.some(ban => 
        ban.staticId === user.staticId && !ban.unbanned
    );
    
    if (isAlreadyBanned) {
        showNotification("Пользователь уже забанен", "warning");
        return Promise.reject("Уже забанен");
    }
    
    const banData = {
        username: username,
        staticId: user.staticId, // Используем STATIC ID
        reason: reason,
        bannedBy: CURRENT_USER,
        bannedByStaticId: CURRENT_STATIC_ID, // Добавляем STATIC ID того, кто банит
        bannedDate: new Date().toLocaleString(),
        unbanned: false,
        unbannedBy: null,
        unbannedByStaticId: null,
        unbannedDate: null
    };
    
    return db.ref('mlk_bans').push(banData).then(() => {
        loadData(() => {
            showNotification(`Пользователь ${username} забанен`, "success");
        });
        return true;
    }).catch(error => {
        showNotification("Ошибка при бане: " + error.message, "error");
        return false;
    });
}

function unbanUser(banId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Только старший куратор и выше может разбанивать", "error");
        return;
    }
    
    const ban = bans.find(b => b.id === banId);
    if (!ban) return;
    
    if (!confirm(`Разбанить пользователя ${ban.username}?`)) return;
    
    return db.ref('mlk_bans/' + banId).update({
        unbanned: true,
        unbannedBy: CURRENT_USER,
        unbannedByStaticId: CURRENT_STATIC_ID, // Добавляем STATIC ID того, кто разбанивает
        unbannedDate: new Date().toLocaleString()
    }).then(() => {
        loadData(() => {
            showNotification(`Пользователь ${ban.username} разбанен`, "success");
        });
        return true;
    }).catch(error => {
        showNotification("Ошибка при разбане: " + error.message, "error");
        return false;
    });
}

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
                <span style="color: #c0b070;">ЗАБАНЕННЫЕ ПОЛЬЗОВАТЕЛЕЙ НЕ МОГУТ ВОЙТИ В СИСТЕМУ</span>
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
                <i class="fas fa-user-slash"></i>
                ${ban.username}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${ban.staticId || "N/A"}
            </td>
            <td>${ban.reason || "Причина не указана"}</td>
            <td>${ban.bannedBy || "Неизвестно"}</td>
            <td>${ban.bannedDate || "Неизвестно"}</td>
            <td>
                <button onclick="unbanUser('${ban.id}')" class="action-btn confirm">
                    <i class="fas fa-unlock"></i> РАЗБАНИТЬ
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderBansHistory() {
    const tableBody = document.getElementById("bans-history-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Сортируем по дате (новые сверху)
    const sortedBans = [...bans].sort((a, b) => 
        new Date(b.bannedDate || 0) - new Date(a.bannedDate || 0)
    );
    
    sortedBans.forEach(ban => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 500; color: ${ban.unbanned ? '#8cb43c' : '#b43c3c'}">
                <i class="fas ${ban.unbanned ? 'fa-user-check' : 'fa-user-slash'}"></i>
                ${ban.username}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${ban.staticId || "N/A"}
            </td>
            <td>${ban.reason || "Причина не указана"}</td>
            <td>
                <span class="report-status ${ban.unbanned ? 'status-confirmed' : 'status-deleted'}" 
                      style="display: inline-flex; padding: 4px 10px;">
                    <i class="fas ${ban.unbanned ? 'fa-unlock' : 'fa-lock'}"></i>
                    ${ban.unbanned ? 'РАЗБАНЕН' : 'ЗАБАНЕН'}
                </span>
            </td>
            <td>
                ${ban.bannedDate || "Неизвестно"}
                ${ban.unbannedDate ? `<br><small>Разбан: ${ban.unbannedDate}</small>` : ''}
            </td>
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
    
    // Проверяем существует ли пользователь
    const userExists = users.some(user => 
        user.username.toLowerCase() === username.toLowerCase()
    );
    
    if (!userExists) {
        showNotification("Пользователь не найден в системе", "warning");
        return;
    }
    
    // Проверяем не забанен ли уже (теперь через staticId)
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return;
    
    const isAlreadyBanned = bans.some(ban => 
        ban.staticId === user.staticId && !ban.unbanned
    );
    
    if (isAlreadyBanned) {
        showNotification("Пользователь уже забанен", "warning");
        return;
    }
    
    banUser(username, reason).then(success => {
        if (success) {
            if (usernameInput) usernameInput.value = "";
            if (reasonInput) reasonInput.value = "";
            renderBanInterface();
        }
    });
}

/* ===== УЛУЧШЕННАЯ ЛОГИКА ВХОДА С ПРОВЕРКОЙ БАНОВ И STATIC ID ===== */
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
    
    // Проверяем бан пользователя
    const banCheck = checkIfBanned(username);
    if (banCheck.banned) {
        // Показываем экран бана вместо входа
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
            // Специальный доступ
            if (!existingUser) {
                // Создаем нового пользователя с STATIC ID
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
                // Обновляем существующего пользователя
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
        
        // Создаем нового пользователя с STATIC ID
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
    
    // Сохраняем данные сессии в localStorage
    localStorage.setItem('mlk_session', JSON.stringify({
        user: CURRENT_USER,
        role: CURRENT_ROLE,
        rank: CURRENT_RANK.level,
        staticId: CURRENT_STATIC_ID, // Сохраняем STATIC ID
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
    const staticIdElement = document.getElementById('current-static-id'); // Новый элемент
    
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
    CURRENT_STATIC_ID = null; // Очищаем STATIC ID
    
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
        authorStaticId: CURRENT_STATIC_ID, // Добавляем STATIC ID автора
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
    
    // Генерируем STATIC ID для пользователя в whitelist
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
                ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.ADMIN.name ? 
                    `<button onclick="promoteToSeniorCurator('${user.id}')" class="action-btn confirm" style="margin-right: 5px;">
                        <i class="fas fa-star"></i> ПОВЫСИТЬ
                    </button>` : 
                    ''
                }
                ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level ? 
                    `<button onclick="removeUser('${user.id}')" class="action-btn delete" style="margin-right: 5px;">
                        <i class="fas fa-trash"></i> УДАЛИТЬ
                    </button>` : 
                    ''
                }
                ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && !isBanned ? 
                    `<button onclick="showBanModal('${user.username}')" class="action-btn" style="background: #b43c3c; border-color: #b43c3c; color: white;">
                        <i class="fas fa-ban"></i> БАН
                    </button>` : 
                    ''
                }
                <span style="color: #8f9779; font-size: 0.85rem;">
                    ${isProtected ? 'ЗАЩИЩЕН' : isCurrentUser ? 'ТЕКУЩИЙ' : ''}
                </span>
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
