/* ===== СИСТЕМА РАНГОВ ЗОНЫ ===== */
const RANKS = {
    JUNIOR_CURATOR: {
        name: "МЛАДШИЙ КУРАТОР",
        level: 1,
        access: ["mlk_reports"]
    },
    CURATOR: {
        name: "КУРАТОР", 
        level: 2,
        access: ["mlk_reports"]
    },
    SENIOR_CURATOR: {
        name: "СТАРШИЙ КУРАТОР",
        level: 3,
        access: ["mlk_reports", "all_reports", "users"]
    },
    ADMIN: {
        name: "АДМИНИСТРАТОР",
        level: 4,
        access: ["mlk_reports", "all_reports", "whitelist", "users", "system", "bans", "ip_monitoring", "webhooks"]
    }
};

/* ===== РАНГ СОЗДАТЕЛЯ ===== */
const CREATOR_RANK = {
    name: "СОЗДАТЕЛЬ",
    level: 999,
    access: ["mlk_reports", "all_reports", "whitelist", "users", "passwords", "system", "everything", "bans", "ip_monitoring", "webhooks"]
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

/* ===== ДОПОЛНИТЕЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ БЕЗОПАСНОСТИ ===== */
const MAX_ATTEMPTS = 3; // Максимальное количество попыток входа
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 минут блокировки
let loginAttempts = {}; // Хранение попыток входа по IP


/* ===== УЛУЧШЕННОЕ ХЕШИРОВАНИЕ С СОЛЬЮ ===== */
function generateSalt() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateStrongPassword() {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    let password = "";
    for (let i = 0; i < 12; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

/* ===== ПРОВЕРКА И ПОЛУЧЕНИЕ IP АДРЕСА ===== */
async function getUserIP() {
    try {
        // Используем сервис для получения IP
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error("Ошибка получения IP:", error);
        // Резервный метод через WebRTC (только для локальной сети)
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({iceServers: [{urls: "stun:stun.l.google.com:19302"}]});
            pc.createDataChannel("");
            pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => resolve("unknown"));
            pc.onicecandidate = (ice) => {
                if (!ice.candidate) return;
                const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
                const match = ipRegex.exec(ice.candidate.candidate);
                if (match) {
                    resolve(match[1]);
                    pc.close();
                }
            };
            setTimeout(() => resolve("unknown"), 1000);
        });
    }
}

/* ===== ПРОВЕРКА НА МНОГОКРАТНУЮ РЕГИСТРАЦИЮ С ОДНОГО IP ===== */
async function checkIPLimit(username) {
    try {
        const userIP = await getUserIP();
        if (userIP === "unknown") return { allowed: true, ip: userIP };
        
        // Проверяем, есть ли уже пользователь с таким IP
        const ipSnapshot = await db.ref('mlk_ip_tracking').once('value');
        const ipData = ipSnapshot.val() || {};
        
        for (const key in ipData) {
            if (ipData[key].ip === userIP && ipData[key].username !== username) {
                return {
                    allowed: false,
                    ip: userIP,
                    message: `С IP-адреса ${userIP} уже зарегистрирован пользователь ${ipData[key].username}`
                };
            }
        }
        
        return { allowed: true, ip: userIP };
    } catch (error) {
        console.error("Ошибка проверки IP:", error);
        return { allowed: true, ip: "error" };
    }
}

/* ===== ЗАПИСЬ IP АДРЕСА ПРИ РЕГИСТРАЦИИ ===== */
async function registerIP(username, staticId) {
    try {
        const userIP = await getUserIP();
        if (userIP === "unknown" || userIP === "error") return;
        
        const ipRecord = {
            ip: userIP,
            username: username,
            staticId: staticId,
            registrationDate: new Date().toLocaleString(),
            lastActive: new Date().toLocaleString()
        };
        
        await db.ref('mlk_ip_tracking').push(ipRecord);
        
        // Также обновляем запись пользователя
        const usersSnapshot = await db.ref('mlk_users').once('value');
        const usersData = usersSnapshot.val() || {};
        
        for (const userId in usersData) {
            if (usersData[userId].username === username) {
                await db.ref(`mlk_users/${userId}`).update({
                    registrationIP: userIP,
                    lastIP: userIP
                });
                break;
            }
        }
    } catch (error) {
        console.error("Ошибка записи IP:", error);
    }
}

/* ===== ОБНОВЛЕНИЕ АКТИВНОСТИ ПО IP ===== */
async function updateIPActivity(username) {
    try {
        const userIP = await getUserIP();
        if (userIP === "unknown" || userIP === "error") return;
        
        const ipSnapshot = await db.ref('mlk_ip_tracking').once('value');
        const ipData = ipSnapshot.val() || {};
        
        for (const key in ipData) {
            if (ipData[key].username === username) {
                await db.ref(`mlk_ip_tracking/${key}`).update({
                    lastIP: userIP,
                    lastActive: new Date().toLocaleString(),
                    lastLogin: new Date().toLocaleString()
                });
                break;
            }
        }
    } catch (error) {
        console.error("Ошибка обновления IP:", error);
    }
}

/* ===== МОНИТОРИНГ ПОПЫТОК ВХОДА ===== */
function trackLoginAttempt(ip, success = false) {
    const now = Date.now();
    
    if (!loginAttempts[ip]) {
        loginAttempts[ip] = {
            attempts: 0,
            firstAttempt: now,
            lastAttempt: now,
            lockedUntil: 0
        };
    }
    
    if (success) {
        loginAttempts[ip].attempts = 0;
        loginAttempts[ip].lockedUntil = 0;
    } else {
        loginAttempts[ip].attempts++;
        loginAttempts[ip].lastAttempt = now;
        
        if (loginAttempts[ip].attempts >= MAX_ATTEMPTS) {
            loginAttempts[ip].lockedUntil = now + LOCKOUT_TIME;
            showNotification(`Слишком много попыток входа. IP заблокирован на 15 минут`, "error");
        }
    }
    
    // Очистка старых записей (старше 24 часов)
    for (const ipKey in loginAttempts) {
        if (now - loginAttempts[ipKey].lastAttempt > 24 * 60 * 60 * 1000) {
            delete loginAttempts[ipKey];
        }
    }
}

function isIPLocked(ip) {
    if (!loginAttempts[ip]) return false;
    
    const now = Date.now();
    if (loginAttempts[ip].lockedUntil > now) {
        const minutesLeft = Math.ceil((loginAttempts[ip].lockedUntil - now) / 60000);
        return `IP временно заблокирован. Попробуйте через ${minutesLeft} минут`;
    }
    
    return false;
}

/* ===== ВАЛИДАЦИЯ ПОЛЬЗОВАТЕЛЬСКОГО ВВОДА ===== */
function validateUsername(username) {
    // Проверка на undefined или null
    if (!username) {
        return { valid: false, message: "Имя пользователя не указано" };
    }
    
    const trimmedUsername = username.trim();
    
    // Проверка длины
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        return { valid: false, message: "Имя пользователя должно быть от 3 до 20 символов" };
    }
    
    // Проверка символов (только буквы, цифры, подчеркивание)
    const usernameRegex = /^[a-zA-Zа-яА-Я0-9_]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
        return { valid: false, message: "Имя пользователя может содержать только буквы, цифры и подчеркивание" };
    }
    
    // Запрещенные имена
    const forbiddenNames = ['admin', 'root', 'system', 'administrator', 'модератор', 'куратор'];
    if (forbiddenNames.includes(trimmedUsername.toLowerCase())) {
        return { valid: false, message: "Это имя пользователя запрещено" };
    }
    
    return { valid: true, message: "" };
}

function validatePassword(password) {
    // Проверка на undefined или null
    if (!password) {
        return { valid: false, message: "Пароль не указан" };
    }
    
    // Проверка длины
    if (password.length < 6) {
        return { valid: false, message: "Пароль должен содержать минимум 6 символов" };
    }
    
    // Проверка сложности (опционально)
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        return { 
            valid: false, 
            message: "Пароль должен содержать заглавные и строчные буквы, а также цифры" 
        };
    }
    
    return { valid: true, message: "" };
}

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
    if(CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK.level !== CREATOR_RANK.level) {
        showNotification("Недостаточно прав", "error");
        return;
    }
    
    if(confirm("Удалить отчет?")) {
        db.ref('mlk_reports/' + id + '/deleted').set(true).then(() => loadReports(renderReports));
    }
}

window.confirmReport = function(id) {
    if(CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK.level !== CREATOR_RANK.level) {
        showNotification("Недостаточно прав", "error");
        return;
    }
    
    if(confirm("Подтвердить отчет?")) {
        db.ref('mlk_reports/' + id + '/confirmed').set(true).then(() => {
            loadReports(renderReports);
            showNotification("Отчет подтвержден", "success");
        });
    }
}

/* ===== ХЕШИРОВАНИЕ ===== */
function simpleHash(str){
    let h = 0;
    for(let i = 0; i < str.length; i++){
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return h.toString(16);
}

/* ===== ПРОВЕРКА ПАРОЛЯ С ШИФРОВАНИЕМ ===== */
async function verifyPassword(inputPassword, storedPassword) {
    // Поддержка старого формата (обычный текст)
    if (typeof storedPassword === 'string') {
        return inputPassword === storedPassword;
    }
    
    // Новый формат (объект с хешем и солью)
    if (storedPassword && storedPassword.hash && storedPassword.salt) {
        const inputHash = await hashPassword(inputPassword, storedPassword.salt);
        return inputHash === storedPassword.hash;
    }
    
    return false;
}

/* ===== ЗАГРУЗКА ДАННЫХ ИЗ БАЗЫ ===== */
function loadData(callback) {
    db.ref('mlk_users').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        users = Object.keys(data).map(key => {
            const userData = data[key] || {};
            return {
                ...userData,
                id: key,
                username: userData.username || '',
                staticId: userData.staticId || '',
                role: userData.role || '',
                rank: userData.rank || 1
            };
        });
        
        return db.ref('mlk_whitelist').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        whitelist = Object.keys(data).map(key => {
            const wlData = data[key] || {};
            return {
                ...wlData,
                id: key,
                username: wlData.username || '',
                staticId: wlData.staticId || '',
                addedBy: wlData.addedBy || 'СИСТЕМА'
            };
        });
        
        return db.ref('mlk_passwords').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        passwords = data || {};
        
        // Проверяем наличие всех необходимых паролей
        if (!passwords.junior || !passwords.curator || !passwords.senior || !passwords.admin || !passwords.special) {
            console.log("Не все пароли найдены, создаем недостающие...");
            return createOrUpdatePasswords().then(() => {
                return db.ref('mlk_passwords').once('value'); // Перезагружаем пароли
            }).then(snapshot => {
                passwords = snapshot.val() || {};
                return db.ref('mlk_bans').once('value');
            });
        }
        
        return db.ref('mlk_bans').once('value');
    }).then(snapshot => {
        const data = snapshot.val() || {};
        bans = Object.keys(data).map(key => {
            const banData = data[key] || {};
            return {
                ...banData,
                id: key,
                username: banData.username || '',
                staticId: banData.staticId || '',
                reason: banData.reason || 'Причина не указана',
                bannedBy: banData.bannedBy || 'Система'
            };
        });
        
        // Загружаем вебхуки
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

        console.log("Система безопасности инициализирована");

        if (whitelist.length === 0) {
            return addProtectedUsersToWhitelist().then(() => {
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    }).catch(error => {
        console.error("Ошибка загрузки данных:", error);
        showNotification("Ошибка загрузки данных", "error");
        if (callback) callback();
    });
}

/* ===== СОЗДАНИЕ ИЛИ ОБНОВЛЕНИЕ ПАРОЛЕЙ ===== */
function createOrUpdatePasswords() {
    const defaultPasswords = {
        junior: "junior123",
        curator: "curator123",
        senior: "senior123",
        admin: "admin123",
        special: "special123"
    };
    
    return db.ref('mlk_passwords').set(defaultPasswords);
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
        return Promise.reject("Недостаточно прав");
    }
    
    if (!newPassword || newPassword.trim() === "") {
        showNotification("Введите новый код", "error");
        return Promise.reject("Пустой пароль");
    }
    
    const updates = {};
    updates[type] = newPassword.trim();
    
    return db.ref('mlk_passwords').update(updates).then(() => {
        passwords[type] = newPassword.trim();
        showNotification(`Код доступа изменен`, "success");
        
        // Логируем изменение пароля
        const logData = {
            type: type,
            changedBy: CURRENT_USER,
            changedAt: new Date().toLocaleString()
        };
        db.ref('mlk_password_logs').push(logData);
        
        return true;
    }).catch(error => {
        showNotification("Ошибка изменения кода: " + error.message, "error");
        return false;
    });
}

/* ===== СИСТЕМА БАНОВ ===== */
function checkIfBanned(username) {
    // Проверяем, передан ли username
    if (!username || typeof username !== 'string' || username.trim() === '') {
        return { banned: false };
    }
    
    // Приводим к нижнему регистру для сравнения
    const usernameLower = username.toLowerCase().trim();
    
    // Ищем пользователя (используем trim для сравнения)
    const user = users.find(u => {
        if (!u || !u.username || typeof u.username !== 'string') return false;
        return u.username.toLowerCase().trim() === usernameLower;
    });
    
    if (!user) {
        // Пользователь не найден - не забанен
        return { banned: false };
    }
    
    // Ищем активный бан
    const activeBan = bans.find(ban => {
        if (!ban) return false;
        
        // Проверяем по username (с учетом регистра)
        const banUsername = ban.username && typeof ban.username === 'string' 
            ? ban.username.toLowerCase().trim() 
            : '';
        const banUsernameMatch = banUsername === usernameLower;
        
        // Проверяем по staticId
        const staticIdMatch = ban.staticId && user.staticId && ban.staticId === user.staticId;
        
        return (banUsernameMatch || staticIdMatch) && !ban.unbanned;
    });
    
    return activeBan ? { banned: true, ...activeBan } : { banned: false };
}

/* ===== ФУНКЦИИ ДЛЯ БАНОВ ===== */
window.banByStaticId = async function(staticId, reason = "Причина не указана") {
    const user = users.find(u => u.staticId === staticId);
    if (!user) {
        showNotification("Пользователь не найден", "error");
        return false;
    }
    
    return banUser(user.username, reason);
}

window.unbanByStaticId = async function(staticId) {
    const activeBan = bans.find(ban => ban.staticId === staticId && !ban.unbanned);
    if (!activeBan) {
        showNotification("Активный бан не найден", "error");
        return false;
    }
    
    if (!confirm(`Разбанить пользователя ${activeBan.username}?`)) return false;
    
    return db.ref('mlk_bans/' + activeBan.id).update({
        unbanned: true,
        unbannedBy: CURRENT_USER,
        unbannedDate: new Date().toLocaleString()
    }).then(() => {
        loadData(() => {
            if (window.renderBanInterface) window.renderBanInterface();
            showNotification("Пользователь разбанен", "success");
        });
        return true;
    }).catch(error => {
        showNotification("Ошибка разбана: " + error.message, "error");
        return false;
    });
}

async function banUser(username, reason) {
    // Проверяем права
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Недостаточно прав для выдачи бана", "error");
        return false;
    }
    
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        showNotification("Пользователь не найден", "error");
        return false;
    }
    
    // Проверяем, является ли пользователь защищенным
    const isProtected = PROTECTED_USERS.some(protectedUser => 
        protectedUser.toLowerCase() === username.toLowerCase()
    );
    
    if (isProtected) {
        showNotification("Нельзя забанить защищенного пользователя", "error");
        return false;
    }
    
    // Проверяем, не забанен ли уже
    const existingBan = bans.find(ban => 
        (ban.username.toLowerCase() === username.toLowerCase() || ban.staticId === user.staticId) && 
        !ban.unbanned
    );
    
    if (existingBan) {
        showNotification("Пользователь уже забанен", "warning");
        return false;
    }
    
    const banData = {
        username: username,
        staticId: user.staticId,
        reason: reason,
        bannedBy: CURRENT_USER,
        bannedDate: new Date().toLocaleString(),
        unbanned: false
    };
    
    return db.ref('mlk_bans').push(banData).then(() => {
        loadData(() => {
            if (window.renderBanInterface) window.renderBanInterface();
            if (window.renderUsers) window.renderUsers();
            showNotification(`Пользователь ${username} забанен`, "success");
        });
        return true;
    }).catch(error => {
        showNotification("Ошибка бана: " + error.message, "error");
        return false;
    });
}

/* ===== ЗАЩИЩЕННЫЕ ПОЛЬЗОВАТЕЛЫ ===== */
const PROTECTED_USERS = ["Tihiy"];

/* ===== СПЕЦИАЛЬНЫЙ ДОСТУП ДЛЯ ЗАЩИЩЕННЫХ ПОЛЬЗОВАТЕЛЕЙ ===== */
function checkSpecialAccess(username, password) {
    return new Promise((resolve) => {
        // Проверяем, передан ли username
        if (!username || !password) {
            resolve({ access: false });
            return;
        }
        
        const usernameLower = username.toLowerCase().trim();
        
        db.ref('mlk_passwords').once('value').then(snapshot => {
            const passwords = snapshotSnapshot.val() || {};
            const specialPassword = passwords.special;
            
            if (!specialPassword) {
                resolve({ access: false });
                return;
            }
            
            // Проверяем, является ли пользователь защищенным
            const isProtected = PROTECTED_USERS.some(protectedUser => {
                if (!protectedUser) return false;
                return protectedUser.toLowerCase().trim() === usernameLower;
            });
            
            if (isProtected && password === specialPassword) {
                resolve({ access: true, rank: CREATOR_RANK });
            } else {
                resolve({ access: false });
            }
        }).catch(() => {
            resolve({ access: false });
        });
    });
}

/* ===== ИНТЕРФЕЙС УПРАВЛЕНИЯ БАНАМИ ===== */
window.renderBanInterface = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>';
        return;
    }
    
    const activeBans = bans.filter(ban => !ban.unbanned);
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #b43c3c; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-ban"></i> СИСТЕМА БЛОКИРОВКИ
            </h2>
            
            <div class="zone-card" style="margin-bottom: 20px; border-color: #b43c3c;">
                <div class="card-icon" style="color: #b43c3c;"><i class="fas fa-user-slash"></i></div>
                <h4 style="color: #b43c3c; margin-bottom: 10px;">НОВЫЙ БАН</h4>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                        <label class="form-label">БАН ПО ИМЕНИ ПОЛЬЗОВАТЕЛЯ</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="ban-username" class="form-input" placeholder="Введите имя пользователя" style="flex: 2;">
                            <input type="text" id="ban-reason" class="form-input" placeholder="Причина бана" style="flex: 3;">
                            <button onclick="addBan()" class="btn-primary" style="border-color: #b43c3c; padding: 10px 15px;">
                                <i class="fas fa-ban"></i> ЗАБАНИТЬ
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <label class="form-label">БАН ПО STATIC ID</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="ban-staticid" class="form-input" placeholder="Введите STATIC ID" style="font-family: 'Courier New', monospace; flex: 2;">
                            <input type="text" id="ban-reason-static" class="form-input" placeholder="Причина бана" style="flex: 3;">
                            <button onclick="addBanByStaticId()" class="btn-primary" style="border-color: #b43c3c; padding: 10px 15px;">
                                <i class="fas fa-id-card"></i> БАН ПО ID
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; gap: 20px; overflow: hidden;">
                <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                    <h4 style="color: #b43c3c; margin-bottom: 10px;">АКТИВНЫЕ БАНЫ (${activeBans.length})</h4>
                    <div class="table-container" style="flex: 1;">
                        ${activeBans.length === 0 ? `
                            <div style="text-align: center; padding: 30px; color: #8f9779;">
                                <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                                <p>АКТИВНЫХ БАНОВ НЕТ</p>
                            </div>
                        ` : `
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ПОЛЬЗОВАТЕЛЬ</th>
                                        <th>STATIC ID</th>
                                        <th>ПРИЧИНА</th>
                                        <th>ЗАБАНИЛ</th>
                                        <th>ДАТА</th>
                                        <th>ДЕЙСТВИЯ</th>
                                    </tr>
                                </thead>
                                <tbody id="bans-table-body">
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
                
                <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                    <h4 style="color: #c0b070; margin-bottom: 10px;">ИСТОРИЯ БАНОВ (${bans.length})</h4>
                    <div class="table-container" style="flex: 1;">
                        ${bans.length === 0 ? `
                            <div style="text-align: center; padding: 30px; color: #8f9779;">
                                <i class="fas fa-history" style="font-size: 2rem; margin-bottom: 10px;"></i>
                                <p>ИСТОРИЯ ПУСТА</p>
                            </div>
                        ` : `
                            <table class="data-table">
                                <thead>
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
                        `}
                    </div>
                </div>
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
        const isActive = !ban.unbanned;
        const bannedDate = ban.bannedDate || "Неизвестно";
        const unbannedDate = ban.unbannedDate || "";
        
        const row = document.createElement('tr');
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
            <td>
                ${bannedDate}
                ${unbannedDate ? `<br><small style="color: #6a6a5a;">Снят: ${unbannedDate}</small>` : ''}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

window.addBan = function() {
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

window.addBanByStaticId = function() {
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

/* ===== ФУНКЦИИ ПОВЫШЕНИЯ/ПОНИЖЕНИЯ РАНГА ===== */
window.promoteToAdminByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Только администратор может повышать до администратора", "error");
        return;
    }
    
    if (!confirm("Повысить пользователя до администратора?")) return;
    
    const user = users.find(u => u.staticId === staticId);
    if (!user) {
        showNotification("Пользователь не найден", "error");
        return;
    }
    
    db.ref('mlk_users/' + user.id).update({
        role: RANKS.ADMIN.name,
        rank: RANKS.ADMIN.level
    }).then(() => {
        loadData(() => {
            renderUsers();
            showNotification("Пользователь повышен до администратора", "success");
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

window.promoteToSeniorByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Только администратор может повышать до старшего куратора", "error");
        return;
    }
    
    if (!confirm("Повысить пользователя до старшего куратора?")) return;
    
    const user = users.find(u => u.staticId === staticId);
    if (!user) {
        showNotification("Пользователь не найден", "error");
        return;
    }
    
    db.ref('mlk_users/' + user.id).update({
        role: RANKS.SENIOR_CURATOR.name,
        rank: RANKS.SENIOR_CURATOR.level
    }).then(() => {
        loadData(() => {
            renderUsers();
            showNotification("Пользователь повышен до старшего куратора", "success");
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

window.promoteToCuratorByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Только старший куратор или выше может повышать до куратора", "error");
        return;
    }
    
    if (!confirm("Повысить пользователя до куратора?")) return;
    
    const user = users.find(u => u.staticId === staticId);
    if (!user) {
        showNotification("Пользователь не найден", "error");
        return;
    }
    
    db.ref('mlk_users/' + user.id).update({
        role: RANKS.CURATOR.name,
        rank: RANKS.CURATOR.level
    }).then(() => {
        loadData(() => {
            renderUsers();
            showNotification("Пользователь повышен до куратора", "success");
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

window.demoteToJuniorByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        showNotification("Только старший куратор или выше может понижать", "error");
        return;
    }
    
    if (!confirm("Понизить пользователя до младшего куратора?")) return;
    
    const user = users.find(u => u.staticId === staticId);
    if (!user) {
        showNotification("Пользователь не найден", "error");
        return;
    }
    
    db.ref('mlk_users/' + user.id).update({
        role: RANKS.JUNIOR_CURATOR.name,
        rank: RANKS.JUNIOR_CURATOR.level
    }).then(() => {
        loadData(() => {
            renderUsers();
            showNotification("Пользователь понижен до младшего куратора", "success");
        });
    }).catch(error => {
        showNotification("Ошибка: " + error.message, "error");
    });
}

window.login = async function() {
    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value.trim();
    const errorElement = document.getElementById("login-error");
    
    if (errorElement) errorElement.textContent = "";
    
    // Валидация имени пользователя
    const usernameValidation = validateUsername(usernameInput);
    if (!usernameValidation.valid) {
        showLoginError(usernameValidation.message);
        return;
    }
    
    // Валидация пароля
    const passwordValidation = validatePassword(passwordInput);
    if (!passwordValidation.valid) {
        showLoginError(passwordValidation.message);
        return;
    }
    
    try {
        // Проверка IP блокировки
        const userIP = await getUserIP();
        if (userIP !== "unknown") {
            // Проверка локальной блокировки
            const ipLockStatus = isIPLocked(userIP);
            if (ipLockStatus) {
                showLoginError(ipLockStatus);
                return;
            }
            
            // Проверка IP бана в базе данных
            const ipBanCheck = await checkIPBan(userIP);
            if (ipBanCheck.banned) {
                showLoginError(`IP адрес ${userIP} заблокирован. Причина: ${ipBanCheck.reason}`);
                return;
            }
        }
        
        // Проверка на бан пользователя
        const banCheck = checkIfBanned(usernameInput);
        if (banCheck.banned) {
            showBannedScreen(banCheck);
            return;
        }
        
        
        // Проверка ограничения по IP для новых пользователей
        const existingUser = users.find(user => 
            user.username.toLowerCase() === usernameInput.toLowerCase()
        );
        
        // Загружаем пароли из БД
        const passwordsSnapshot = await db.ref('mlk_passwords').once('value');
        const passwords = passwordsSnapshot.val() || {};
        
        /* === ПРОВЕРКА СПЕЦИАЛЬНОГО ДОСТУПА ДЛЯ ЗАЩИЩЕННЫХ ПОЛЬЗОВАТЕЛЕЙ === */
        const isProtectedUser = PROTECTED_USERS.some(protectedUser => 
            protectedUser.toLowerCase() === usernameInput.toLowerCase()
        );

        if (isProtectedUser) {
            const isSpecialValid = await verifyPassword(passwordInput, passwords.special);
            if (isSpecialValid) {
                if (!existingUser) {
                    const ipCheck = await checkIPLimit(usernameInput);
                    if (!ipCheck.allowed) {
                        showLoginError(ipCheck.message);
                        return;
                    }
                    
                    const staticId = generateStaticId(usernameInput);
                    const newUser = {
                        username: usernameInput,
                        staticId: staticId,
                        role: CREATOR_RANK.name,
                        rank: CREATOR_RANK.level,
                        registrationDate: new Date().toLocaleString(),
                        lastLogin: new Date().toLocaleString(),
                        registrationIP: ipCheck.ip
                    };
                    
                    await db.ref('mlk_users').push(newUser);
                    await registerIP(usernameInput, staticId);
                    
                    // Загружаем обновленные данные
                    await new Promise(resolve => loadData(resolve));
                    
                    CURRENT_ROLE = CREATOR_RANK.name;
                    CURRENT_USER = usernameInput;
                    CURRENT_RANK = CREATOR_RANK;
                    CURRENT_STATIC_ID = staticId;
                    
                    // Сбрасываем счетчик попыток
                    trackLoginAttempt(userIP, true);
                    
                    completeLogin();
                } else {
                    await db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
                    await updateIPActivity(usernameInput);
                    
                    CURRENT_ROLE = CREATOR_RANK.name;
                    CURRENT_USER = usernameInput;
                    CURRENT_RANK = CREATOR_RANK;
                    CURRENT_STATIC_ID = existingUser.staticId || generateStaticId(usernameInput);
                    
                    // Сбрасываем счетчик попыток
                    trackLoginAttempt(userIP, true);
                    completeLogin();
                }
                return;
            } else {
                trackLoginAttempt(userIP, false);
                showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА");
                return;
            }
        }
        
        /* === НОВЫЙ ПОЛЬЗОВАТЕЛЬ === */
        if (!existingUser) {
            let userRank = RANKS.JUNIOR_CURATOR;
            let isValidPassword = false;
            
            // Проверяем пароли
            const adminValid = await verifyPassword(passwordInput, passwords.admin);
            const seniorValid = await verifyPassword(passwordInput, passwords.senior);
            const curatorValid = await verifyPassword(passwordInput, passwords.curator);
            const juniorValid = await verifyPassword(passwordInput, passwords.junior);
            
            if (adminValid) {
                const isInWhitelist = whitelist.some(user => 
                    user.username.toLowerCase() === usernameInput.toLowerCase()
                );
                
                if (!isInWhitelist) {
                    trackLoginAttempt(userIP, false);
                    showLoginError("ДОСТУП ЗАПРЕЩЕН");
                    return;
                }
                userRank = RANKS.ADMIN;
                isValidPassword = true;
            } else if (seniorValid) {
                const isInWhitelist = whitelist.some(user => 
                    user.username.toLowerCase() === usernameInput.toLowerCase()
                );
                
                if (!isInWhitelist) {
                    trackLoginAttempt(userIP, false);
                    showLoginError("ДОСТУП ЗАПРЕЩЕН");
                    return;
                }
                userRank = RANKS.SENIOR_CURATOR;
                isValidPassword = true;
            } else if (curatorValid) {
                userRank = RANKS.CURATOR;
                isValidPassword = true;
            } else if (juniorValid) {
                userRank = RANKS.JUNIOR_CURATOR;
                isValidPassword = true;
            }
            
            if (!isValidPassword) {
                trackLoginAttempt(userIP, false);
                showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА");
                return;
            }
            
            // Проверка IP лимита
            const ipCheck = await checkIPLimit(usernameInput);
            if (!ipCheck.allowed) {
                showLoginError(ipCheck.message);
                return;
            }
            
            const staticId = generateStaticId(usernameInput);
            const newUser = {
                username: usernameInput,
                staticId: staticId,
                role: userRank.name,
                rank: userRank.level,
                registrationDate: new Date().toLocaleString(),
                lastLogin: new Date().toLocaleString(),
                registrationIP: ipCheck.ip
            };
            
            await db.ref('mlk_users').push(newUser);
            await registerIP(usernameInput, staticId);
            
            // Загружаем обновленные данные
            await new Promise(resolve => loadData(resolve));
            
            CURRENT_ROLE = userRank.name;
            CURRENT_USER = usernameInput;
            CURRENT_RANK = userRank;
            CURRENT_STATIC_ID = staticId;
            
            trackLoginAttempt(userIP, true);
            completeLogin();
            return;
        }
        
        /* === СУЩЕСТВУЮЩИЙ ПОЛЬЗОВАТЕЛЬ === */
        else {
            let isValidPassword = false;
            let userRank = RANKS.JUNIOR_CURATOR;
            
            // Определяем текущий ранг пользователя
            if (existingUser.role === RANKS.ADMIN.name) {
                userRank = RANKS.ADMIN;
            } else if (existingUser.role === RANKS.SENIOR_CURATOR.name) {
                userRank = RANKS.SENIOR_CURATOR;
            } else if (existingUser.role === RANKS.CURATOR.name) {
                userRank = RANKS.CURATOR;
            } else {
                userRank = RANKS.JUNIOR_CURATOR;
            }
            
            // Проверяем пароль в зависимости от ранга
            if (userRank.level >= RANKS.ADMIN.level) {
                isValidPassword = await verifyPassword(passwordInput, passwords.admin);
            } else if (userRank.level >= RANKS.SENIOR_CURATOR.level) {
                isValidPassword = await verifyPassword(passwordInput, passwords.senior);
            } else if (userRank.level >= RANKS.CURATOR.level) {
                isValidPassword = await verifyPassword(passwordInput, passwords.curator);
            } else {
                isValidPassword = await verifyPassword(passwordInput, passwords.junior);
            }
            
            if (!isValidPassword) {
                trackLoginAttempt(userIP, false);
                showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА");
                return;
            }
            
            await db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
            await updateIPActivity(usernameInput);
            
            CURRENT_ROLE = userRank.name;
            CURRENT_USER = usernameInput;
            CURRENT_RANK = userRank;
            CURRENT_STATIC_ID = existingUser.staticId;
            
            trackLoginAttempt(userIP, true);
            completeLogin();
        }
    } catch (error) {
        console.error("Ошибка входа:", error);
        showLoginError("ОШИБКА СИСТЕМЫ");
    }
}
    
/* ===== ЭКРАН БАНА ===== */
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
    } else if (CURRENT_RANK.level >= RANKS.CURATOR.level) {
        loadReports(renderMLKScreen);
    } else {
        // Для младших кураторов
        loadReports(renderMLKScreen);
    }
}

/* ===== UI ИНИЦИАЛИЗАЦИЯ ===== */
document.addEventListener('DOMContentLoaded', function() {
    // Обновление времени
    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const dateString = now.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        const timeElement = document.getElementById('current-time');
        const dateElement = document.getElementById('current-date');
        
        if (timeElement) timeElement.textContent = timeString;
        if (dateElement) dateElement.textContent = dateString;
    }
    
    setInterval(updateTime, 1000);
    updateTime();
    
    // Восстановление сессии или настройка входа
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
            } else if (CURRENT_RANK.level >= RANKS.CURATOR.level) {
                loadReports(renderMLKScreen);
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
function setupSidebar() {
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
        addNavButton(navMenu, 'fas fa-network-wired', 'IP МОНИТОРИНГ', renderIPStats);
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
    
    showNotification("Сессия завершена", "info");
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
function loadReports(callback) {
    db.ref('mlk_reports').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        reports = Object.keys(data).map(key => ({...data[key], id: key}));
        if (callback) callback();
    }).catch(error => {
        console.error("Ошибка загрузки отчетов:", error);
        showNotification("Ошибка загрузки отчетов", "error");
        if (callback) callback();
    });
}

/* ===== СТРАНИЦА ОТЧЕТОВ МЛК ===== */
function renderMLKForm() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-file-medical"></i> СОЗДАНИЕ ОТЧЕТА
            </h2>
            
            <div class="report-creation-container" style="flex: 1; overflow-y: auto; min-height: 0; padding-right: 10px;">
                <div class="zone-card" style="margin-bottom: 15px;">
                    <div class="card-icon"><i class="fas fa-user-tag"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">ИНФОРМАЦИЯ О НАРУШИТЕЛЕ</h4>
                    
                    <div class="form-group">
                        <label class="form-label">ИДЕНТИФИКАТОР НАРУШИТЕЛЯ</label>
                        <div style="position: relative;">
                            <input type="text" id="mlk-tag" class="form-input" 
                                   placeholder="@никнейм / STEAM_1:0:123456 / ID игрока"
                                   style="padding-left: 40px;">
                            <i class="fas fa-user-secret" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #8cb43c;"></i>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">ТИП НАРУШИТЕЛЯ</label>
                        <div class="tag-selector">
                            <button type="button" class="tag-option active" data-value="player">Игрок</button>
                            <button type="button" class="tag-option" data-value="admin">Админ</button>
                            <button type="button" class="tag-option" data-value="curator">Куратор</button>
                            <button type="button" class="tag-option" data-value="other">Другое</button>
                        </div>
                    </div>
                </div>
                
                <div class="zone-card" style="margin-bottom: 15px; border-color: #c0b070;">
                    <div class="card-icon" style="color: #c0b070;"><i class="fas fa-exclamation-triangle"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">КАТЕГОРИЯ НАРУШЕНИЯ</h4>
                    
                    <div class="form-group">
                        <label class="form-label">ВЫБЕРИТЕ КАТЕГОРИЮ</label>
                        <div class="category-grid" id="violation-categories" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                            <div class="category-card" data-category="cheat" data-color="#b43c3c">
                                <div class="category-icon">
                                    <i class="fas fa-skull-crossbones"></i>
                                </div>
                                <span class="category-name">ЧИТЫ</span>
                                <span class="category-desc">Использование ПО</span>
                            </div>
                            <div class="category-card" data-category="toxic" data-color="#b43c3c">
                                <div class="category-icon">
                                    <i class="fas fa-comment-slash"></i>
                                </div>
                                <span class="category-name">ТОКСИЧНОСТЬ</span>
                                <span class="category-desc">Оскорбления</span>
                            </div>
                            <div class="category-card" data-category="spam" data-color="#b43c3c">
                                <div class="category-icon">
                                    <i class="fas fa-comment-dots"></i>
                                </div>
                                <span class="category-name">СПАМ</span>
                                <span class="category-desc">Флуд в чате</span>
                            </div>
                            <div class="category-card" data-category="bug" data-color="#c0b070">
                                <div class="category-icon">
                                    <i class="fas fa-bug"></i>
                                </div>
                                <span class="category-name">БАГИ</span>
                                <span class="category-desc">Использование багов</span>
                            </div>
                            <div class="category-card" data-category="grief" data-color="#c0b070">
                                <div class="category-icon">
                                    <i class="fas fa-user-slash"></i>
                                </div>
                                <span class="category-name">ГРИФ</span>
                                <span class="category-desc">Вредительство</span>
                            </div>
                            <div class="category-card" data-category="other" data-color="#8f9779">
                                <div class="category-icon">
                                    <i class="fas fa-question-circle"></i>
                                </div>
                                <span class="category-name">ДРУГОЕ</span>
                                <span class="category-desc">Иные нарушения</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">ПРИОРИТЕТ ОТЧЕТА</label>
                        <div class="priority-selector" style="display: flex; gap: 15px;">
                            <div class="priority-option" data-priority="low" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <div class="priority-dot" style="width: 12px; height: 12px; background: #8cb43c; border-radius: 50%;"></div>
                                <span style="color: #8f9779;">НИЗКИЙ</span>
                            </div>
                            <div class="priority-option active" data-priority="medium" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <div class="priority-dot" style="width: 12px; height: 12px; background: #c0b070; border-radius: 50%;"></div>
                                <span style="color: #c0b070;">СРЕДНИЙ</span>
                            </div>
                            <div class="priority-option" data-priority="high" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <div class="priority-dot" style="width: 12px; height: 12px; background: #b43c3c; border-radius: 50%;"></div>
                                <span style="color: #b43c3c;">ВЫСОКИЙ</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="zone-card" style="margin-bottom: 15px; border-color: #8cb43c;">
                    <div class="card-icon"><i class="fas fa-align-left"></i></div>
                    <h4 style="color: #8cb43c; margin-bottom: 10px;">ДЕТАЛЬНОЕ ОПИСАНИЕ</h4>
                    
                    <div class="form-group">
                        <label class="form-label">ПОДРОБНОЕ ОПИСАНИЕ НАРУШЕНИЯ</label>
                        <div style="position: relative;">
                            <textarea id="mlk-action" class="form-textarea" rows="6" 
                                      placeholder="Опишите нарушение максимально подробно..."></textarea>
                            <div class="char-counter" style="position: absolute; bottom: 10px; right: 10px; color: #8f9779; font-size: 0.8rem;">
                                <span id="char-count">0</span>/2000 символов
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">ССЫЛКИ НА ДОКАЗАТЕЛЬСТВА</label>
                        <div id="proof-links-container">
                            <div class="proof-link-input" style="display: flex; gap: 10px;">
                                <input type="text" class="form-input proof-link" placeholder="https://imgur.com/... или steam://..." style="flex: 1;">
                                <button type="button" class="btn-secondary add-proof-btn" onclick="addProofField()" style="padding: 8px 12px;">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                        <div style="margin-top: 5px; font-size: 0.8rem; color: #8f9779;">
                            Можно добавить ссылки на скриншоты, видео, демо-записи
                        </div>
                    </div>
                </div>
                
                <div class="zone-card" style="background: rgba(40, 42, 36, 0.8); margin-bottom: 15px;">
                    <div class="card-icon"><i class="fas fa-preview"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР</h4>
                    
                    <div id="report-preview" class="report-preview" style="background: rgba(20, 18, 15, 0.8); padding: 15px; border: 1px solid #4a4a3a; border-radius: 4px;">
                        <div class="preview-header" style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #4a4a3a;">
                            <div class="preview-badge" style="display: flex; gap: 10px;">
                                <span class="preview-category" style="background: rgba(180, 60, 60, 0.1); color: #b43c3c; padding: 4px 10px; border-radius: 3px; font-size: 0.8rem;">ЧИТЫ</span>
                                <span class="preview-priority" style="background: rgba(192, 176, 112, 0.1); color: #c0b070; padding: 4px 10px; border-radius: 3px; font-size: 0.8rem;">СРЕДНИЙ</span>
                            </div>
                            <div class="preview-time" style="color: #8f9779; font-size: 0.8rem;">${new Date().toLocaleString()}</div>
                        </div>
                        <div class="preview-content">
                            <div class="preview-violator" style="margin-bottom: 15px;">
                                <i class="fas fa-user-tag" style="color: #8f9779; margin-right: 8px;"></i> <span id="preview-tag" style="color: #c0b070;">[не указано]</span>
                            </div>
                            <div class="preview-description" id="preview-description" style="color: #8f9779; line-height: 1.5;">
                                [описание появится здесь]
                            </div>
                        </div>
                        <div class="preview-footer" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #4a4a3a; display: flex; justify-content: space-between;">
                            <div class="preview-author" style="color: #8f9779; font-size: 0.9rem;">
                                <i class="fas fa-user" style="margin-right: 8px;"></i> ${CURRENT_USER}
                            </div>
                            <div class="preview-status">
                                <span class="status-pending" style="background: rgba(192, 176, 112, 0.1); color: #c0b070; padding: 4px 10px; border-radius: 3px; font-size: 0.8rem;">ОЖИДАЕТ ПРОВЕРКИ</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions" style="display: flex; gap: 15px; padding-top: 15px; border-top: 1px solid #4a4a3a;">
                    <button onclick="renderMLKScreen()" class="btn-secondary" style="flex: 1; padding: 12px;">
                        <i class="fas fa-arrow-left"></i> ОТМЕНА
                    </button>
                    <button id="submit-mlk-btn" class="btn-primary" style="flex: 2; padding: 12px;">
                        <i class="fas fa-paper-plane"></i> ОТПРАВИТЬ ОТЧЕТ
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем обработчики
    setupReportFormHandlers();
    
    document.getElementById("submit-mlk-btn").onclick = addMLKReport;
    
    const actionTextarea = document.getElementById("mlk-action");
    if (actionTextarea) {
        actionTextarea.addEventListener('input', function(e) {
            updatePreview();
            updateCharCount();
        });
    }
    
    const tagInput = document.getElementById("mlk-tag");
    if (tagInput) {
        tagInput.addEventListener('input', updatePreview);
    }
}

window.renderMLKScreen = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    loadReports(function() {
        content.innerHTML = `
            <div class="form-container">
                <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                    <i class="fas fa-file-alt"></i> ОТЧЕТЫ МЛК
                </h2>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h3 style="color: #c0b070; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-bottom: 5px;">АРХИВ ОТЧЕТОВ</h3>
                        <p style="color: #8f9779; font-size: 0.9rem;">СИСТЕМА ФИКСАЦИИ НАРУШЕНИЙ</p>
                    </div>
                    <button onclick="renderMLKForm()" class="btn-primary" style="padding: 10px 20px; font-size: 0.9rem;">
                        <i class="fas fa-plus"></i> НОВЫЙ ОТЧЕТ
                    </button>
                </div>
                
                <div id="mlk-list" style="flex: 1; overflow-y: auto; min-height: 0;">
                    <!-- Здесь будет список отчетов -->
                </div>
            </div>
        `;
        renderMLKList();
    });
}

function updateCharCount() {
    const textarea = document.getElementById('mlk-action');
    const counter = document.getElementById('char-count');
    if (textarea && counter) {
        const count = textarea.value.length;
        counter.textContent = count;
        counter.style.color = count > 1800 ? '#b43c3c' : count > 1500 ? '#c0b070' : '#8cb43c';
    }
}

function addProofField() {
    const container = document.getElementById('proof-links-container');
    const newInput = document.createElement('div');
    newInput.className = 'proof-link-input';
    newInput.innerHTML = `
        <input type="text" class="form-input proof-link" placeholder="https://imgur.com/... или steam://...">
        <button type="button" class="btn-secondary remove-proof-btn" onclick="removeProofField(this)">
            <i class="fas fa-minus"></i>
        </button>
    `;
    container.appendChild(newInput);
}

function removeProofField(button) {
    const container = document.getElementById('proof-links-container');
    if (container.children.length > 1) {
        button.closest('.proof-link-input').remove();
    }
}

function updatePreview() {
    const tagInput = document.getElementById('mlk-tag');
    const descriptionInput = document.getElementById('mlk-action');
    const selectedCategory = document.querySelector('.category-card.active');
    const selectedPriority = document.querySelector('.priority-option.active');
    
    const previewTag = document.getElementById('preview-tag');
    const previewDescription = document.getElementById('preview-description');
    const previewCategory = document.querySelector('.preview-category');
    const previewPriority = document.querySelector('.preview-priority');
    
    if (previewTag) {
        previewTag.textContent = tagInput.value || '[не указано]';
    }
    
    if (previewDescription) {
        previewDescription.textContent = descriptionInput.value || '[описание появится здесь]';
    }
    
    if (selectedCategory && previewCategory) {
        const categoryName = selectedCategory.querySelector('.category-name').textContent;
        const categoryColor = selectedCategory.dataset.color;
        previewCategory.textContent = categoryName;
        previewCategory.style.color = categoryColor;
    }
    
    if (selectedPriority && previewPriority) {
        const priorityText = selectedPriority.querySelector('span').textContent;
        const priorityColor = selectedPriority.querySelector('.priority-dot').style.background;
        previewPriority.textContent = priorityText;
        previewPriority.style.color = priorityColor;
    }
}

function addMLKReport() {
    const tag = document.getElementById("mlk-tag")?.value.trim() || "";
    const action = document.getElementById("mlk-action")?.value.trim() || "";
    const selectedCategory = document.querySelector('.category-card.active');
    const selectedPriority = document.querySelector('.priority-option.active');
    const selectedViolatorType = document.querySelector('.tag-option.active');
    
    // Собираем ссылки на доказательства
    const proofLinks = Array.from(document.querySelectorAll('.proof-link'))
        .map(input => input.value.trim())
        .filter(link => link.length > 0);
    
    if (!tag) {
        showNotification("Введите идентификатор нарушителя", "error");
        return;
    }
    
    if (!action) {
        showNotification("Опишите нарушение", "error");
        return;
    }
    
    if (action.length < 20) {
        showNotification("Описание должно содержать минимум 20 символов", "error");
        return;
    }
    
    const report = {
        tag,
        action,
        category: selectedCategory ? selectedCategory.dataset.category : "other",
        categoryName: selectedCategory ? selectedCategory.querySelector('.category-name').textContent : "Другое",
        priority: selectedPriority ? selectedPriority.dataset.priority : "medium",
        priorityName: selectedPriority ? selectedPriority.querySelector('span').textContent : "СРЕДНИЙ",
        violatorType: selectedViolatorType ? selectedViolatorType.dataset.value : "player",
        proofLinks: proofLinks,
        author: CURRENT_USER,
        authorStaticId: CURRENT_STATIC_ID,
        role: CURRENT_ROLE,
        time: new Date().toLocaleString(),
        timestamp: Date.now(),
        confirmed: false,
        deleted: false
    };
    
    db.ref('mlk_reports').push(report).then(() => {
        showNotification("✅ Отчет успешно сохранен", "success");
        
        // Отправка в Discord вебхук, если настроен
        if (DISCORD_WEBHOOK_URL) {
            sendReportToDiscord(report);
        }
        
        loadReports(renderMLKScreen);
    }).catch(error => {
        showNotification("Ошибка при сохранении: " + error.message, "error");
    });
}

function sendReportToDiscord(report) {
    if (!DISCORD_WEBHOOK_URL) return;
    
    const colorMap = {
        'cheat': 0xb43c3c,
        'toxic': 0xb43c3c,
        'spam': 0xb43c3c,
        'bug': 0xc0b070,
        'grief': 0xc0b070,
        'other': 0x8f9779
    };
    
    const priorityColorMap = {
        'low': 0x8cb43c,
        'medium': 0xc0b070,
        'high': 0xb43c3c
    };
    
    const payload = {
        username: DISCORD_WEBHOOK_NAME,
        avatar_url: DISCORD_WEBHOOK_AVATAR,
        embeds: [{
            title: "📄 НОВЫЙ ОТЧЕТ МЛК",
            description: `**Нарушитель:** \`${report.tag}\`\n**Категория:** ${report.categoryName}\n**Приоритет:** ${report.priorityName}`,
            color: colorMap[report.category] || 0x8f9779,
            fields: [
                {
                    name: "📝 Описание",
                    value: report.action.length > 1024 ? report.action.substring(0, 1021) + "..." : report.action
                },
                {
                    name: "👤 Автор отчета",
                    value: `${report.author} (${report.role})`,
                    inline: true
                },
                {
                    name: "🕐 Время",
                    value: report.time,
                    inline: true
                }
            ],
            footer: {
                text: `Static ID: ${report.authorStaticId} | Система отчетов Зоны`
            },
            timestamp: new Date().toISOString()
        }]
    };
    
    // Добавляем ссылки на доказательства, если есть
    if (report.proofLinks && report.proofLinks.length > 0) {
        payload.embeds[0].fields.push({
            name: "🔗 Доказательства",
            value: report.proofLinks.map((link, i) => `${i+1}. ${link}`).join('\n')
        });
    }
    
    fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).catch(error => console.error('Discord webhook error:', error));
}
window.renderMLKList = function() {
    const listDiv = document.getElementById("mlk-list");
    if (!listDiv) return;
    
    const filteredReports = (CURRENT_RANK.level <= RANKS.CURATOR.level)
        ? reports.filter(r => r.author === CURRENT_USER)
        : reports;
    
    if (filteredReports.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-reports">
                <div class="empty-icon">
                    <i class="fas fa-inbox"></i>
                </div>
                <h3>ОТЧЕТЫ ОТСУТСТВУЮТ</h3>
                <p>СОЗДАЙТЕ ПЕРВЫЙ ОТЧЕТ, НАЖАВ НА КНОПКУ "НОВЫЙ ОТЧЕТ"</p>
            </div>
        `;
        return;
    }
    
    listDiv.innerHTML = '';
    
    // Сортируем по времени (новые сверху)
    const sortedReports = [...filteredReports].sort((a, b) => {
        const timeA = a.timestamp || new Date(a.time).getTime() || 0;
        const timeB = b.timestamp || new Date(b.time).getTime() || 0;
        return timeB - timeA;
    });
    
    sortedReports.forEach(r => {
        const card = document.createElement("div");
        card.className = "report-card-enhanced";
        
        let status = r.deleted ? 'удален' : (r.confirmed ? 'подтвержден' : 'рассматривается');
        let statusClass = r.deleted ? 'status-deleted' : (r.confirmed ? 'status-confirmed' : 'status-pending');
        let statusIcon = r.deleted ? 'fa-trash' : (r.confirmed ? 'fa-check-circle' : 'fa-clock');
        
        // Определяем цвет категории
        const categoryColors = {
            'cheat': '#b43c3c',
            'toxic': '#b43c3c',
            'spam': '#b43c3c',
            'bug': '#c0b070',
            'grief': '#c0b070',
            'other': '#8f9779'
        };
        
        const categoryColor = categoryColors[r.category] || '#8f9779';
        
        // Определяем цвет приоритета
        const priorityColors = {
            'low': '#8cb43c',
            'medium': '#c0b070',
            'high': '#b43c3c'
        };
        
        const priorityColor = priorityColors[r.priority] || '#c0b070';
        
        card.innerHTML = `
            <div class="report-card-header">
                <div class="report-category-badge" style="background: ${categoryColor}20; border-left-color: ${categoryColor};">
                    <span class="category-name" style="color: ${categoryColor};">${r.categoryName || 'Другое'}</span>
                    <div class="report-priority" style="color: ${priorityColor};">
                        <div class="priority-dot" style="background: ${priorityColor};"></div>
                        ${r.priorityName || 'СРЕДНИЙ'}
                    </div>
                </div>
                <div class="report-meta">
                    <span class="meta-item"><i class="far fa-clock"></i> ${r.time}</span>
                    <span class="meta-item"><i class="fas fa-user"></i> ${r.author || r.role || 'неизвестно'}</span>
                </div>
            </div>
            
            <div class="report-card-body">
                <div class="violator-info">
                    <div class="violator-icon">
                        <i class="fas fa-user-tag"></i>
                    </div>
                    <div class="violator-details">
                        <h4 class="violator-tag">${r.tag || '—'}</h4>
                        <span class="violator-type">Тип: ${r.violatorType === 'admin' ? 'Администратор' : r.violatorType === 'curator' ? 'Куратор' : 'Игрок'}</span>
                    </div>
                </div>
                
                <div class="report-description">
                    ${r.action.replace(/\n/g, '<br>')}
                </div>
                
                ${r.proofLinks && r.proofLinks.length > 0 ? `
                <div class="proof-links">
                    <h5><i class="fas fa-link"></i> ДОКАЗАТЕЛЬСТВА</h5>
                    <div class="links-list">
                        ${r.proofLinks.map(link => `
                            <a href="${link}" target="_blank" class="proof-link">
                                <i class="fas fa-external-link-alt"></i> ${link.length > 40 ? link.substring(0, 40) + '...' : link}
                            </a>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="report-card-footer">
                <div class="report-status ${statusClass}">
                    <i class="fas ${statusIcon}"></i>
                    <span>${status.toUpperCase()}</span>
                </div>
                
                <div class="report-actions">
                    ${r.authorStaticId ? `
                    <div class="static-id-display">
                        <i class="fas fa-id-card"></i>
                        <span class="static-id">${r.authorStaticId}</span>
                    </div>
                    ` : ''}
                    
                    ${CURRENT_RANK.level >= RANKS.ADMIN.level && !r.confirmed && !r.deleted ? `
                    <div class="admin-actions">
                        <button onclick="confirmReport('${r.id}')" class="action-btn confirm">
                            <i class="fas fa-check"></i> ПОДТВЕРДИТЬ
                        </button>
                        <button onclick="deleteReport('${r.id}')" class="action-btn delete">
                            <i class="fas fa-trash"></i> УДАЛИТЬ
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        listDiv.appendChild(card);
    });
}
/* ===== УЛУЧШЕННЫЙ ИНТЕРФЕЙС ВСЕХ ОТЧЕТОВ ===== */
/* ===== ВСЕ ОТЧЕТЫ (исправленная версия) ===== */
function renderReports() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) {
        content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>';
        return;
    }
    
    const pendingReports = reports.filter(r => !r.confirmed && !r.deleted).length;
    const confirmedReports = reports.filter(r => r.confirmed).length;
    const deletedReports = reports.filter(r => r.deleted).length;
    
    content.innerHTML = `
        <div class="form-container with-table">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-list-alt"></i> АРХИВ ОТЧЕТОВ
            </h2>
            <p style="color: #8f9779; margin-bottom: 15px; font-size: 0.9rem;">ОБЩЕЕ КОЛИЧЕСТВО: ${reports.length}</p>
            
            <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
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
            
            <h4 style="color: #c0b070; margin-bottom: 15px; font-size: 1rem;">ВСЕ ОТЧЕТЫ (${reports.length})</h4>
            
            <div class="table-container">
                ${reports.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: #8f9779;">
                        <i class="fas fa-database" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p>ОТЧЕТЫ ЕЩЕ НЕ СОЗДАНЫ</p>
                    </div>
                ` : `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ИДЕНТИФИКАТОР</th>
                                <th>НАРУШЕНИЕ</th>
                                <th>АВТОР</th>
                                <th>ВРЕМЯ</th>
                                <th>СТАТУС</th>
                                <th class="actions">ДЕЙСТВИЯ</th>
                            </tr>
                        </thead>
                        <tbody id="all-reports-body">
                        </tbody>
                    </table>
                `}
            </div>
        </div>
    `;
    
    if (reports.length > 0) {
        renderAllReportsTable();
    }
}

function renderAllReportsTable() {
    const tableBody = document.getElementById("all-reports-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    reports.forEach(r => {
        let status = r.deleted ? "удален" : (r.confirmed ? "подтвержден" : "рассматривается");
        let statusClass = r.deleted ? "status-deleted" : (r.confirmed ? "status-confirmed" : "status-pending");
        
        const actionsHtml = (!r.deleted && !r.confirmed && CURRENT_RANK.level >= RANKS.ADMIN.level) ?
            `<div class="action-buttons">
                <button onclick="confirmReport('${r.id}')" class="action-btn confirm">
                    <i class="fas fa-check"></i> Подтвердить
                </button>
                <button onclick="deleteReport('${r.id}')" class="action-btn delete">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </div>` : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="max-width: 150px;">
                <i class="fas fa-user-tag fa-icon"></i>${r.tag || '—'}
            </td>
            <td style="max-width: 200px;" class="truncate" title="${r.action || ''}">
                ${(r.action || '').substring(0, 50)}${r.action && r.action.length > 50 ? '...' : ''}
            </td>
            <td>${r.author || 'неизвестно'}</td>
            <td style="font-size: 0.85rem;">${r.time || '—'}</td>
            <td class="status-cell">
                <span class="report-status ${statusClass}">
                    ${status}
                </span>
            </td>
            <td class="actions">${actionsHtml}</td>
        `;
        tableBody.appendChild(row);
    });
}
/* ===== СТРАНИЦА КОДОВ ДОСТУПА ===== */
window.renderPasswords = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) {
        content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>';
        return;
    }
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-key"></i> УПРАВЛЕНИЕ КОДАМИ ДОСТУПА
            </h2>
            
            <div style="display: flex; flex-direction: column; gap: 15px; flex: 1; overflow-y: auto; padding-right: 10px;">
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user-graduate"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">КОД ДЛЯ МЛАДШИХ КУРАТОРОВ</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">
                        ИСПОЛЬЗУЕТСЯ МЛАДШИМИ КУРАТОРАМИ ДЛЯ ВХОДА
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <input type="password" id="junior-password" class="form-input" 
                               value="${passwords.junior || ''}" placeholder="НОВЫЙ КОД" style="flex: 1;">
                        <button onclick="updatePassword('junior')" class="btn-primary" style="padding: 10px 15px;">
                            <i class="fas fa-save"></i> ИЗМЕНИТЬ
                        </button>
                    </div>
                </div>
                
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-users"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">КОД ДЛЯ КУРАТОРОВ</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">
                        ИСПОЛЬЗУЕТСЯ КУРАТОРАМИ ДЛЯ ВХОДА В СИСТЕМУ
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <input type="password" id="curator-password" class="form-input" 
                               value="${passwords.curator || ''}" placeholder="НОВЫЙ КОД" style="flex: 1;">
                        <button onclick="updatePassword('curator')" class="btn-primary" style="padding: 10px 15px;">
                            <i class="fas fa-save"></i> ИЗМЕНИТЬ
                        </button>
                    </div>
                </div>
                
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-star"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">КОД ДЛЯ СТАРШИХ КУРАТОРОВ</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">
                        ИСПОЛЬЗУЕТСЯ СТАРШИМИ КУРАТОРЫМИ ДЛЯ ВХОДА
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <input type="password" id="senior-password" class="form-input" 
                               value="${passwords.senior || ''}" placeholder="НОВЫЙ КОД" style="flex: 1;">
                        <button onclick="updatePassword('senior')" class="btn-primary" style="padding: 10px 15px;">
                            <i class="fas fa-save"></i> ИЗМЕНИТЬ
                        </button>
                    </div>
                </div>
                
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">КОД ДЛЯ АДМИНИСТРАТОРОВ</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">
                        ИСПОЛЬЗУЕТСЯ АДМИНИСТРАТОРАМИ ДЛЯ ВХОДА
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <input type="password" id="admin-password" class="form-input" 
                               value="${passwords.admin || ''}" placeholder="НОВЫЙ КОД" style="flex: 1;">
                        <button onclick="updatePassword('admin')" class="btn-primary" style="padding: 10px 15px;">
                            <i class="fas fa-save"></i> ИЗМЕНИТЬ
                        </button>
                    </div>
                </div>
                
                <div class="zone-card" style="border-color: #c0b070;">
                    <div class="card-icon" style="color: #c0b070;"><i class="fas fa-shield-alt"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">СИСТЕМНЫЙ КОД</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">
                        ДЛЯ СИСТЕМНЫХ ОПЕРАЦИЙ И ЗАЩИЩЕННЫХ ПОЛЬЗОВАТЕЛЕЙ
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <input type="password" id="special-password" class="form-input" 
                               value="${passwords.special || ''}" placeholder="НОВЫЙ КОД" style="flex: 1; border-color: #c0b070;">
                        <button onclick="updatePassword('special')" class="btn-primary" 
                                style="border-color: #c0b070; padding: 10px 15px;">
                            <i class="fas fa-save"></i> ИЗМЕНИТЬ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.updatePassword = function(type) {
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

/* ===== УЛУЧШЕННЫЙ ИНТЕРФЕЙС СПИСКА ДОСТУПА ===== */
window.renderWhitelist = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container"
            <h2 style="color: #c0b070; margin-bottom: 20px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-users"></i> СПИСОК ДОСТУПА
            </h2>
            
            <p style="color: #8f9779; margin-bottom: 30px; line-height: 1.6;">
                ТОЛЬКО ПОЛЬЗОВАТЕЛИ ИЗ ЭТОГО СПИСКА МОГУТ ВХОДИТЬ КАК АДМИНИСТРАТОРЫ
            </p>
            
            <div class="zone-card" style="margin-bottom: 30px; padding: 20px;">
                <div class="card-icon"><i class="fas fa-user-plus"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 15px;">ДОБАВИТЬ В СПИСОК ДОСТУПА</h4>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="text" id="new-whitelist-user" class="form-input" 
                           placeholder="ВВЕДИТЕ ПСЕВДОНИМ" style="flex: 1;">
                    <button onclick="addToWhitelist()" class="btn-primary">
                        <i class="fas fa-plus"></i> ДОБАВИТЬ
                    </button>
                </div>
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column;">
                <h4 style="color: #c0b070; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-list"></i> ТЕКУЩИЙ СПИСОК
                    <span style="font-size: 0.9rem; color: #8f9779;">(${whitelist.length})</span>
                </h4>
                
                ${whitelist.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: rgba(140, 180, 60, 0.5); border: 1px dashed rgba(140, 180, 60, 0.3); border-radius: 2px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <i class="fas fa-user-slash" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <h4>СПИСОК ПУСТ</h4>
                        <p>ДОБАВЬТЕ ПЕРВОГО ПОЛЬЗОВАТЕЛЯ</p>
                    </div>
                ` : `
                    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="overflow-x: auto; flex: 1;">
                            <table class="data-table" style="min-width: 100%;">
                                <thead style="position: sticky; top: 0; background: #1e201c;">
                                    <tr>
                                        <th style="min-width: 150px;">ПСЕВДОНИМ</th>
                                        <th style="min-width: 120px;">STATIC ID</th>
                                        <th style="min-width: 120px;">ДОБАВИЛ</th>
                                        <th style="min-width: 150px;">ДАТА ДОБАВЛЕНИЯ</th>
                                        <th style="min-width: 100px;">СТАТУС</th>
                                        <th style="min-width: 100px;">ДЕЙСТВИЯ</th>
                                    </tr>
                                </thead>
                                <tbody id="whitelist-table-body">
                                </tbody>
                            </table>
                        </div>
                    </div>
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
            <td style="font-family: 'Courier New', monospace; font-size: 0.85rem; color: #8f9779;">
                ${user.staticId || "—"}
            </td>
            <td>${user.addedBy || "СИСТЕМА"}</td>
            <td>${user.addedDate || "НЕИЗВЕСТНО"}</td>
            <td>
                <span class="report-status ${isProtected ? 'status-confirmed' : 'status-pending'}" 
                      style="display: inline-flex; padding: 4px 10px; font-size: 0.8rem;">
                    <i class="fas ${isProtected ? 'fa-shield-alt' : 'fa-user'}"></i>
                    ${isProtected ? 'ЗАЩИЩЕННЫЙ' : 'ОБЫЧНЫЙ'}
                </span>
            </td>
            <td>
                ${isProtected ? 
                    `<span style="color: #8f9779; font-size: 0.85rem;">НЕЛЬЗЯ УДАЛИТЬ</span>` : 
                    `<button onclick="removeFromWhitelist('${user.id}')" class="action-btn delete" style="font-size: 0.85rem; padding: 3px 8px;">
                        <i class="fas fa-trash"></i> УДАЛИТЬ
                    </button>`
                }
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

window.addToWhitelist = function() {
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

window.removeFromWhitelist = function(id) {
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

window.renderUsers = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-user-friends"></i> РЕГИСТРИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ
            </h2>
            
            <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-users"></i></div>
                    <div class="card-value">${users.length}</div>
                    <div class="card-label">ВСЕГО</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                    <div class="card-value">${users.filter(u => u.role === RANKS.ADMIN.name).length}</div>
                    <div class="card-label">АДМИНЫ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-star"></i></div>
                    <div class="card-value">${users.filter(u => u.role === RANKS.SENIOR_CURATOR.name).length}</div>
                    <div class="card-label">СТ.КУРАТОРЫ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user"></i></div>
                    <div class="card-value">${users.filter(u => u.role === RANKS.CURATOR.name).length}</div>
                    <div class="card-label">КУРАТОРЫ</div>
                </div>
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <h4 style="color: #c0b070; margin-bottom: 15px;">СПИСОК ПОЛЬЗОВАТЕЛЕЙ (${users.length})</h4>
                <div class="table-container" style="flex: 1;">
                    ${users.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: #8f9779;">
                            <i class="fas fa-user-friends" style="font-size: 2rem; margin-bottom: 10px;"></i>
                            <p>ПОЛЬЗОВАТЕЛИ ПОЯВЯТСЯ ПОСЛЕ РЕГИСТРАЦИИ</p>
                        </div>
                    ` : `
                        <table class="data-table" style="min-width: 100%;">
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
        const isProtected = PROTECTED_USERS.some(protectedUser => 
            protectedUser.toLowerCase() === user.username.toLowerCase()
        );
        const isCurrentUser = user.username === CURRENT_USER;
        const isBanned = bans.some(ban => 
            ban.staticId === user.staticId && 
            !ban.unbanned
        );
        
        // Определяем ранг
        let rankBadge = '';
        let rankClass = '';
        
        if (user.role === RANKS.ADMIN.name) {
            rankBadge = 'АДМИНИСТРАТОР';
            rankClass = 'status-confirmed';
        } else if (user.role === RANKS.SENIOR_CURATOR.name) {
            rankBadge = 'СТАРШИЙ КУРАТОР';
            rankClass = 'status-pending';
        } else if (user.role === RANKS.CURATOR.name) {
            rankBadge = 'КУРАТОР';
            rankClass = '';
        } else {
            rankBadge = 'МЛАДШИЙ КУРАТОР';
            rankClass = '';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 500; color: ${isProtected ? '#c0b070' : isCurrentUser ? '#8cb43c' : isBanned ? '#b43c3c' : '#8f9779'}">
                <i class="fas ${isProtected ? 'fa-shield-alt' : 'fa-user'}"></i>
                ${user.username}
                ${isCurrentUser ? ' <span style="color: #8cb43c; font-size: 0.8rem;">(ВЫ)</span>' : ''}
                ${isBanned ? ' <span style="color: #b43c3c; font-size: 0.8rem;">(ЗАБАНЕН)</span>' : ''}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${user.staticId || "N/A"}
            </td>
            <td>
                <span class="report-status ${rankClass}" style="${!rankClass ? 'background: rgba(100, 100, 100, 0.1); color: #8f9779; border-color: rgba(100, 100, 100, 0.3);' : ''}">
                    ${rankBadge}
                </span>
            </td>
            <td>${user.registrationDate || "НЕИЗВЕСТНО"}</td>
            <td>${user.lastLogin || "НИКОГДА"}</td>
            <td>
                ${isBanned ? 
                    '<span class="report-status status-deleted"><i class="fas fa-ban"></i> ЗАБАНЕН</span>' : 
                    '<span class="report-status status-confirmed"><i class="fas fa-check"></i> АКТИВЕН</span>'
                }
            </td>
            <td>
                <div class="action-buttons">
                    ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.ADMIN.level && user.role !== RANKS.ADMIN.name ? 
                        `<button onclick="promoteToAdminByStaticId('${user.staticId}')" class="action-btn" style="background: #c0b070; border-color: #c0b070; color: #1e201c;">
                            <i class="fas fa-user-shield"></i> АДМ
                        </button>` : 
                        ''
                    }
                    ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.SENIOR_CURATOR.name ? 
                        `<button onclick="promoteToSeniorByStaticId('${user.staticId}')" class="action-btn" style="background: #8cb43c; border-color: #8cb43c; color: #1e201c;">
                            <i class="fas fa-star"></i> СТ.КУР
                        </button>` : 
                        ''
                    }
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

/* ===== УЛУЧШЕННЫЙ ИНТЕРФЕЙС СПИСКА ДОСТУПА ===== */
window.renderWhitelist = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-users"></i> СПИСОК ДОСТУПА
            </h2>
            
            <div class="zone-card" style="margin-bottom: 20px;">
                <div class="card-icon"><i class="fas fa-user-plus"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 10px;">ДОБАВИТЬ В СПИСОК ДОСТУПА</h4>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="new-whitelist-user" class="form-input" placeholder="ВВЕДИТЕ ПСЕВДОНИМ" style="flex: 1;">
                    <button onclick="addToWhitelist()" class="btn-primary" style="padding: 10px 20px;">
                        <i class="fas fa-plus"></i> ДОБАВИТЬ
                    </button>
                </div>
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <h4 style="color: #c0b070; margin-bottom: 15px;">ТЕКУЩИЙ СПИСОК (${whitelist.length})</h4>
                <div class="table-container" style="flex: 1;">
                    ${whitelist.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: #8f9779;">
                            <i class="fas fa-user-slash" style="font-size: 2rem; margin-bottom: 10px;"></i>
                            <p>СПИСОК ПУСТ</p>
                        </div>
                    ` : `
                        <table class="data-table" style="min-width: 100%;">
                            <thead>
                                <tr>
                                    <th>ПСЕВДОНИМ</th>
                                    <th>STATIC ID</th>
                                    <th>ДОБАВИЛ</th>
                                    <th>ДАТА ДОБАВЛЕНИЯ</th>
                                    <th>СТАТУС</th>
                                    <th>ДЕЙСТВИЯ</th>
                                </tr>
                            </thead>
                            <tbody id="whitelist-table-body">
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        </div>
    `;
    
    if (whitelist.length > 0) {
        renderWhitelistTable();
    }
}

window.showBanModal = function(username) {
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

window.closeBanModal = function() {
    const modal = document.getElementById('ban-modal');
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
}

window.processBan = function(username) {
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

/* ===== СТРАНИЦА СИСТЕМЫ ===== */
window.renderSystem = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    const pendingReports = reports.filter(r => !r.confirmed && !r.deleted).length;
    const confirmedReports = reports.filter(r => r.confirmed).length;
    const deletedReports = reports.filter(r => r.deleted).length;
    const adminUsers = users.filter(u => u.role === RANKS.ADMIN.name).length;
    const seniorCurators = users.filter(u => u.role === RANKS.SENIOR_CURATOR.name).length;
    const curators = users.filter(u => u.role === RANKS.CURATOR.name).length;
    const juniorCurators = users.filter(u => u.role === RANKS.JUNIOR_CURATOR.name).length;
    const activeBans = bans.filter(ban => !ban.unbanned).length;
    
    content.innerHTML = `
        <div class="form-container">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-cogs"></i> СИСТЕМА ЗОНЫ
            </h2>
            
            <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-database"></i></div>
                    <div class="card-value">${reports.length}</div>
                    <div class="card-label">ВСЕГО ОТЧЕТОВ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-users"></i></div>
                    <div class="card-value">${users.length}</div>
                    <div class="card-label">ПОЛЬЗОВАТЕЛЕЙ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                    <div class="card-value">${whitelist.length}</div>
                    <div class="card-label">В СПИСКЕ ДОСТУПА</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-ban"></i></div>
                    <div class="card-value">${activeBans}</div>
                    <div class="card-label">АКТИВНЫХ БАНОВ</div>
                </div>
            </div>
            
            <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
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
            
            <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
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
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user-graduate"></i></div>
                    <div class="card-value">${juniorCurators}</div>
                    <div class="card-label">МЛАДШИЕ КУРАТОРЫ</div>
                </div>
            </div>
        </div>
    `;
}

/* ===== ФУНКЦИЯ ДЛЯ ПРОСМОТРА IP СТАТИСТИКИ (ДЛЯ АДМИНИСТРАТОРОВ) ===== */
window.renderIPStats = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) {
        content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>';
        return;
    }
    
    db.ref('mlk_ip_tracking').once('value').then(snapshot => {
        const ipData = snapshot.val() || {};
        const ipList = Object.keys(ipData).map(key => ({ ...ipData[key], id: key }));
        
        content.innerHTML = `
            <div class="form-container">
                <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                    <i class="fas fa-network-wired"></i> МОНИТОРИНГ IP АДРЕСОВ
                </h2>
                
                <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                    <div class="zone-card">
                        <div class="card-icon"><i class="fas fa-desktop"></i></div>
                        <div class="card-value">${ipList.length}</div>
                        <div class="card-label">УНИКАЛЬНЫХ IP</div>
                    </div>
                    <div class="zone-card">
                        <div class="card-icon"><i class="fas fa-users"></i></div>
                        <div class="card-value">${users.length}</div>
                        <div class="card-label">АКТИВНЫХ ПОЛЬЗОВАТЕЛЕЙ</div>
                    </div>
                    <div class="zone-card">
                        <div class="card-icon"><i class="fas fa-shield-alt"></i></div>
                        <div class="card-value">${PROTECTED_USERS.length}</div>
                        <div class="card-label">ЗАЩИЩЕННЫХ ПОЛЬЗОВАТ.</div>
                    </div>
                </div>
                
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 style="color: #c0b070;">ИСТОРИЯ IP АДРЕСОВ (${ipList.length})</h4>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="exportIPData()" class="btn-primary" style="padding: 8px 15px;">
                                <i class="fas fa-download"></i> ЭКСПОРТ
                            </button>
                        </div>
                    </div>
                    
                    <div class="table-container" style="flex: 1;">
                        ${ipList.length === 0 ? `
                            <div style="text-align: center; padding: 40px; color: #8f9779;">
                                <i class="fas fa-database" style="font-size: 2rem; margin-bottom: 10px;"></i>
                                <p>IP АДРЕСА ЕЩЕ НЕ ЗАРЕГИСТРИРОВАНЫ</p>
                            </div>
                        ` : `
                            <table class="data-table" style="min-width: 100%;">
                                <thead>
                                    <tr>
                                        <th>IP АДРЕС</th>
                                        <th>ПОЛЬЗОВАТЕЛЬ</th>
                                        <th>STATIC ID</th>
                                        <th>РЕГИСТРАЦИЯ</th>
                                        <th>ПОСЛЕДНЯЯ АКТИВНОСТЬ</th>
                                    </tr>
                                </thead>
                                <tbody id="ip-table-body">
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
            </div>
        `;
        
        if (ipList.length > 0) {
            renderIPTable(ipList);
        }
    });
}

function renderIPTable(ipList) {
    const tableBody = document.getElementById("ip-table-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    ipList.forEach(record => {
        const row = document.createElement('tr');
        const isCurrentUser = record.username === CURRENT_USER;
        
        row.innerHTML = `
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: ${isCurrentUser ? '#8cb43c' : '#8f9779'}">
                <i class="fas fa-desktop" style="margin-right: 5px;"></i>
                ${record.ip}
            </td>
            <td style="color: ${isCurrentUser ? '#8cb43c' : '#c0b070'}; font-weight: ${isCurrentUser ? 'bold' : 'normal'}">
                ${record.username}
                ${isCurrentUser ? ' <span style="color: #8cb43c; font-size: 0.8rem;">(ВЫ)</span>' : ''}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${record.staticId || "—"}
            </td>
            <td style="font-size: 0.85rem;">${record.registrationDate || "—"}</td>
            <td style="font-size: 0.85rem;">${record.lastActive || "—"}</td>
        `;
        tableBody.appendChild(row);
    });
}

/* ===== ФУНКЦИИ ДЛЯ РАБОТЫ С IP БАНАМИ ===== */
window.banIP = async function(ip) {
    if (!confirm(`Заблокировать IP адрес ${ip}?\nВсе пользователи с этого IP не смогут зайти в систему.`)) {
        return;
    }
    
    const banData = {
        ip: ip,
        bannedBy: CURRENT_USER,
        bannedDate: new Date().toLocaleString(),
        reason: "Блокировка IP по решению администратора",
        unbanned: false
    };
    
    db.ref('mlk_ip_bans').push(banData).then(() => {
        showNotification(`IP адрес ${ip} заблокирован`, "success");
        
        // Блокируем все текущие попытки с этого IP
        loginAttempts[ip] = {
            attempts: MAX_ATTEMPTS,
            lockedUntil: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 дней
            lastAttempt: Date.now()
        };
        
        // Перезагружаем интерфейс
        renderIPStats();
    }).catch(error => {
        showNotification("Ошибка блокировки IP: " + error.message, "error");
    });
}

window.unbanIP = async function(ip) {
    db.ref('mlk_ip_bans').once('value').then(snapshot => {
        const ipBansData = snapshot.val() || {};
        let activeBanKey = null;
        
        for (const key in ipBansData) {
            if (ipBansData[key].ip === ip && !ipBansData[key].unbanned) {
                activeBanKey = key;
                break;
            }
        }
        
        if (!activeBanKey) {
            showNotification("Активный бан для этого IP не найден", "error");
            return;
        }
        
        if (!confirm(`Разблокировать IP адрес ${ip}?`)) return;
        
        db.ref('mlk_ip_bans/' + activeBanKey).update({
            unbanned: true,
            unbannedBy: CURRENT_USER,
            unbannedDate: new Date().toLocaleString(),
            unbannedReason: "Разблокировка администратором"
        }).then(() => {
            showNotification(`IP адрес ${ip} разблокирован`, "success");
            // Удаляем из локального кеша блокировок
            if (loginAttempts[ip]) {
                delete loginAttempts[ip];
            }
            renderIPStats();
        }).catch(error => {
            showNotification("Ошибка разблокировки IP: " + error.message, "error");
        });
    });
}
/* ===== ФУНКЦИЯ ДЛЯ ПРОВЕРКИ IP БАНОВ ПРИ ВХОДЕ ===== */
async function checkIPBan(ip) {
    try {
        const ipBansSnapshot = await db.ref('mlk_ip_bans').once('value');
        const ipBansData = ipBansSnapshot.val() || {};
        
        for (const key in ipBansData) {
            const ban = ipBansData[key];
            if (ban.ip === ip && !ban.unbanned) {
                return {
                    banned: true,
                    reason: ban.reason,
                    bannedBy: ban.bannedBy,
                    bannedDate: ban.bannedDate
                };
            }
        }
        
        return { banned: false };
    } catch (error) {
        console.error("Ошибка проверки IP бана:", error);
        return { banned: false };
    }
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
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-broadcast-tower"></i> DISCORD ВЕБХУКИ
            </h2>
            
            <div style="display: flex; flex-direction: column; gap: 20px; flex: 1; overflow-y: auto; padding-right: 10px;">
                <div class="zone-card" style="border-color: #5865F2;">
                    <div class="card-icon" style="color: #5865F2;"><i class="fab fa-discord"></i></div>
                    <h4 style="color: #5865F2; margin-bottom: 10px;">НАСТРОЙКА ВЕБХУКА</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label class="form-label">URL ВЕБХУКА DISCORD</label>
                            <input type="text" id="webhook-url" class="form-input" 
                                   placeholder="https://discord.com/api/webhooks/..."
                                   value="${DISCORD_WEBHOOK_URL || ''}">
                            <div style="font-size: 0.8rem; color: #8f9779; margin-top: 5px;">
                                Получите URL в Discord: Настройки канала → Интеграции → Вебхуки
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <label class="form-label">ИМЯ ОТПРАВИТЕЛЯ</label>
                                <input type="text" id="webhook-name" class="form-input" 
                                       placeholder="Имя бота"
                                       value="${DISCORD_WEBHOOK_NAME}">
                            </div>
                            <div>
                                <label class="form-label">URL АВАТАРКИ (опционально)</label>
                                <input type="text" id="webhook-avatar" class="form-input" 
                                       placeholder="https://example.com/avatar.png"
                                       value="${DISCORD_WEBHOOK_AVATAR}">
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 15px; padding: 15px; background: rgba(40, 42, 36, 0.5); border: 1px solid #4a4a3a; border-radius: 4px;">
                            <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; border: 2px solid #5865F2;">
                                <img id="avatar-preview" src="${DISCORD_WEBHOOK_AVATAR}" 
                                     style="width: 100%; height: 100%; object-fit: cover;"
                                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                            </div>
                            <div>
                                <div style="color: #c0b070; font-weight: 500;">${DISCORD_WEBHOOK_NAME}</div>
                                <div style="color: #8f9779; font-size: 0.9rem;">Превью отправителя</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px;">
                            <button onclick="saveWebhook()" class="btn-primary" style="border-color: #8cb43c; padding: 10px 15px;">
                                <i class="fas fa-save"></i> СОХРАНИТЬ НАСТРОЙКИ
                            </button>
                            <button onclick="testWebhook()" class="btn-primary" style="border-color: #5865F2; padding: 10px 15px;">
                                <i class="fas fa-broadcast-tower"></i> ТЕСТИРОВАТЬ
                            </button>
                            <button onclick="clearWebhook()" class="btn-secondary" style="padding: 10px 15px;">
                                <i class="fas fa-trash"></i> ОЧИСТИТЬ
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-paper-plane"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">ОТПРАВКА СООБЩЕНИЙ</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label class="form-label">ТЕКСТ СООБЩЕНИЯ</label>
                            <textarea id="message-text" class="form-textarea" rows="4" 
                                      placeholder="Введите текст сообщения для отправки в Discord..."></textarea>
                        </div>
                        
                        <div>
                            <label class="form-label">ЦВЕТ ВСТАВКИ (HEX)</label>
                            <input type="text" id="embed-color" class="form-input" 
                                   placeholder="#5865F2 (синий Discord)"
                                   value="#5865F2">
                        </div>
                        
                        <div style="display: flex; gap: 10px;">
                            <button onclick="sendSimpleMessage()" class="btn-primary" style="border-color: #5865F2; padding: 10px 20px;">
                                <i class="fas fa-paper-plane"></i> ОТПРАВИТЬ ПРОСТОЕ СООБЩЕНИЕ
                            </button>
                            <button onclick="sendEmbedMessage()" class="btn-primary" style="border-color: #c0b070; padding: 10px 20px;">
                                <i class="fas fa-code"></i> ОТПРАВИТЬ ВСТАВКУ (EMBED)
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-history"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">ИСТОРИЯ ОТПРАВКИ</h4>
                    
                    <div id="webhook-history" style="max-height: 200px; overflow-y: auto; background: rgba(20, 18, 15, 0.5); border: 1px solid var(--border-dark); border-radius: 4px; padding: 10px;">
                        <div style="color: #6a6a5a; text-align: center; padding: 20px; font-style: italic;">
                            История отправленных сообщений появится здесь
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Обновляем превью аватарки при изменении URL
    const avatarInput = document.getElementById('webhook-avatar');
    const avatarPreview = document.getElementById('avatar-preview');

    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('input', function() {
            avatarPreview.src = this.value || 'https://cdn.discordapp.com/embed/avatars/0.png';
        });
    }
}

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
}

window.clearWebhookHistory = function() {
    if (!confirm("Очистить историю вебхуков? Это действие нельзя отменить.")) return;
    
    db.ref('mlk_webhooks').remove().then(() => {
        webhooks = [];
        renderWebhookHistory();
        showNotification("История вебхуков очищена", "success");
    }).catch(error => {
        showNotification("Ошибка очистки: " + error.message, "error");
    });
}

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
    const historyDiv = document.getElementById("webhook-history");
    if (!historyDiv) return;
    
    if (webhooks.length === 0) {
        historyDiv.innerHTML = '<div style="color: #6a6a5a; text-align: center; padding: 20px; font-style: italic;">Нет отправленных сообщений</div>';
        return;
    }
    
    historyDiv.innerHTML = '';
    
    // Берем только последние 20 записей
    webhooks.slice(0, 20).forEach(entry => {
        const div = document.createElement('div');
        div.style.cssText = `
            padding: 10px 12px;
            margin-bottom: 8px;
            background: rgba(30, 32, 28, 0.7);
            border: 1px solid rgba(42, 40, 31, 0.3);
            border-radius: 4px;
            font-size: 0.8rem;
            color: #8f9779;
        `;
        
        const time = new Date(entry.timestamp).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        const date = new Date(entry.timestamp).toLocaleDateString('ru-RU');
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: ${entry.type === 'test' ? '#5865F2' : '#8cb43c'}">
                    <i class="fas fa-${entry.type === 'test' ? 'broadcast-tower' : 'paper-plane'}"></i>
                    ${entry.type === 'test' ? 'Тестирование' : 'Сообщение'}
                </span>
                <span style="color: #6a6a5a; font-size: 0.75rem;">${time}</span>
            </div>
            <div style="color: #c0b070; font-size: 0.75rem; margin-bottom: 3px;">
                <i class="fas fa-user"></i> ${entry.user || 'Система'}
            </div>
            <div style="color: #6a6a5a; font-size: 0.7rem;">
                ${date}
            </div>
        `;
        
        historyDiv.appendChild(div);
    });
}
/* ===== ВАЛИДАЦИЯ В РЕАЛЬНОМ ВРЕМЕНИ ===== */
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем валидацию в реальном времени
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (usernameInput) {
        usernameInput.addEventListener('input', function() {
            const validation = validateUsername(this.value);
            updateInputValidation(this, validation);
        });
        
        usernameInput.addEventListener('blur', function() {
            if (this.value.trim()) {
                const validation = validateUsername(this.value);
                updateInputValidation(this, validation);
            }
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const validation = validatePassword(this.value);
            updateInputValidation(this, validation);
        });
    }
});

function updateInputValidation(input, validation) {
    const wrapper = input.closest('.input-wrapper');
    if (!wrapper) return;
    
    // Удаляем старые сообщения
    const oldError = wrapper.querySelector('.validation-error');
    const oldSuccess = wrapper.querySelector('.validation-success');
    if (oldError) oldError.remove();
    if (oldSuccess) oldSuccess.remove();
    
    // Обновляем стиль инпута
    input.classList.remove('input-valid', 'input-invalid');
    
    if (input.value.trim() === '') {
        return;
    }
    
    if (validation.valid) {
        input.classList.add('input-valid');
        const success = document.createElement('div');
        success.className = 'validation-success';
        success.innerHTML = `<i class="fas fa-check-circle"></i> ${validation.message || 'OK'}`;
        wrapper.appendChild(success);
    } else {
        input.classList.add('input-invalid');
        const error = document.createElement('div');
        error.className = 'validation-error';
        error.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${validation.message}`;
        wrapper.appendChild(error);
    }
}

/* ===== ФУНКЦИИ ДЛЯ РАБОТЫ С IP МОНИТОРИНГОМ ===== */
window.investigateIP = function(ip) {
    db.ref('mlk_ip_tracking').once('value').then(snapshot => {
        const ipData = snapshot.val() || {};
        const usersOnIP = [];
        
        for (const key in ipData) {
            if (ipData[key].ip === ip) {
                usersOnIP.push(ipData[key]);
            }
        }
        
        alert(`IP ${ip} используется ${usersOnIP.length} пользователями:\n\n` +
              usersOnIP.map(u => `• ${u.username} (${u.staticId})`).join('\n'));
    });
}

window.banIP = function(ip) {
    if (!confirm(`Заблокировать IP адрес ${ip}?\nВсе пользователи с этого IP не смогут зайти в систему.`)) {
        return;
    }
    
    const banData = {
        ip: ip,
        bannedBy: CURRENT_USER,
        bannedDate: new Date().toLocaleString(),
        reason: "Блокировка IP по решению администратора"
    };
    
    db.ref('mlk_ip_bans').push(banData).then(() => {
        showNotification(`IP адрес ${ip} заблокирован`, "success");
        
        // Блокируем все текущие попытки с этого IP
        loginAttempts[ip] = {
            attempts: MAX_ATTEMPTS,
            lockedUntil: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 дней
            lastAttempt: Date.now()
        };
    });
}

window.clearOldIPRecords = function() {
    if (!confirm("Удалить записи IP старше 30 дней?")) return;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    db.ref('mlk_ip_tracking').once('value').then(snapshot => {
        const ipData = snapshot.val() || {};
        const updates = {};
        
        for (const key in ipData) {
            const recordDate = new Date(ipData[key].registrationDate);
            if (recordDate < thirtyDaysAgo) {
                updates[key] = null;
            }
        }
        
        db.ref('mlk_ip_tracking').update(updates).then(() => {
            showNotification(`Удалено ${Object.keys(updates).length} старых записей IP`, "success");
            renderIPStats();
        });
    });
}

window.exportIPData = function() {
    db.ref('mlk_ip_tracking').once('value').then(snapshot => {
        const ipData = snapshot.val() || {};
        const csvContent = "data:text/csv;charset=utf-8," 
            + "IP Address,Username,Static ID,Registration Date,Last Active,Last IP\n"
            + Object.values(ipData).map(r => 
                `"${r.ip}","${r.username}","${r.staticId}","${r.registrationDate}","${r.lastActive}","${r.lastIP || r.ip}"`
            ).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ip_data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification("Данные IP экспортированы в CSV", "success");
    });

}


/* ===== АВТОМАТИЧЕСКАЯ РЕГУЛИРОВКА ВЫСОТЫ ===== */
function adjustContentHeight() {
    const contentBody = document.getElementById('content-body');
    if (!contentBody) return;
    
    const header = document.querySelector('.content-header');
    const footer = document.querySelector('.content-footer');
    
    if (header && footer) {
        const headerHeight = header.offsetHeight;
        const footerHeight = footer.offsetHeight;
        const windowHeight = window.innerHeight;
        const sidebar = document.querySelector('.zone-sidebar');
        const sidebarHeight = sidebar ? sidebar.offsetHeight : 0;
        
        // Рассчитываем доступную высоту
        const availableHeight = windowHeight - headerHeight - footerHeight - 40; // 40px для отступов
        
        // Устанавливаем минимальную высоту
        contentBody.style.minHeight = Math.max(availableHeight, 400) + 'px';
    }
}

// Вызываем при загрузке и изменении размера окна
window.addEventListener('load', adjustContentHeight);
window.addEventListener('resize', adjustContentHeight);

// Также вызываем при переключении модулей
const originalAddNavButton = addNavButton;
window.addNavButton = function(container, icon, text, onClick) {
    const button = originalAddNavButton(container, icon, text, function() {
        if (onClick) onClick();
        setTimeout(adjustContentHeight, 100); // Ждем отрисовки контента
    });
    return button;
    /* ===== УПРОЩЕННЫЕ ФУНКЦИИ ОТПРАВКИ СООБЩЕНИЙ ===== */
window.sendSimpleMessage = function() {
    if (!DISCORD_WEBHOOK_URL) {
        showNotification('Сначала настройте вебхук', 'error');
        return;
    }
    
    const messageInput = document.getElementById('message-text');
    const message = messageInput ? messageInput.value.trim() : '';
    
    if (!message) {
        showNotification('Введите текст сообщения', 'error');
        return;
    }
    
    const payload = {
        username: DISCORD_WEBHOOK_NAME,
        avatar_url: DISCORD_WEBHOOK_AVATAR,
        content: message
    };
    
    sendDiscordWebhook(DISCORD_WEBHOOK_URL, payload, false);
    
    // Очищаем поле после отправки
    if (messageInput) {
        messageInput.value = '';
    }
}

window.sendEmbedMessage = function() {
    if (!DISCORD_WEBHOOK_URL) {
        showNotification('Сначала настройте вебхук', 'error');
        return;
    }
    
    const messageInput = document.getElementById('message-text');
    const colorInput = document.getElementById('embed-color');
    
    const message = messageInput ? messageInput.value.trim() : '';
    const color = colorInput ? colorInput.value.trim() : '#5865F2';
    
    if (!message) {
        showNotification('Введите текст сообщения', 'error');
        return;
    }
    
    const payload = {
        username: DISCORD_WEBHOOK_NAME,
        avatar_url: DISCORD_WEBHOOK_AVATAR,
        embeds: [{
            title: "📢 СООБЩЕНИЕ ИЗ СИСТЕМЫ",
            description: message,
            color: hexToDecimal(color) || 5793266,
            timestamp: new Date().toISOString(),
            footer: {
                text: `Отправлено через систему отчетов Зоны | Пользователь: ${CURRENT_USER}`
            }
        }]
    };
    
    sendDiscordWebhook(DISCORD_WEBHOOK_URL, payload, false);
    
    // Очищаем поле после отправки
    if (messageInput) {
        messageInput.value = '';
    }
}

/* ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===== */
function hexToDecimal(hex) {
    if (!hex) return null;
    hex = hex.replace('#', '');
    return parseInt(hex, 16);
}

function sendDiscordWebhook(url, payload, isTest = false) {
    if (!url) {
        showNotification('URL вебхука не настроен', 'error');
        return;
    }
    
    showNotification(isTest ? 'Отправка тестового сообщения...' : 'Отправка сообщения в Discord...', 'info');
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (response.ok) {
            const message = isTest ? '✅ Тест вебхука выполнен успешно!' : '✅ Сообщение отправлено в Discord!';
            showNotification(message, 'success');
            addWebhookHistory(isTest ? 'Тест вебхука' : 'Отправлено сообщение', 'success');
            
            // Сохраняем в историю
            const historyEntry = {
                type: isTest ? 'test' : 'message',
                timestamp: new Date().toLocaleString(),
                user: CURRENT_USER,
                payload: payload
            };
            
            webhooks.unshift(historyEntry);
            if (webhooks.length > 50) webhooks = webhooks.slice(0, 50);
            
            // Обновляем историю в интерфейсе
            updateWebhookHistory();
            
            // Сохраняем в базу данных
            db.ref('mlk_webhooks').push(historyEntry);
        } else {
            return response.text().then(text => {
                throw new Error(`HTTP ${response.status}: ${text}`);
            });
        }
    })
    .catch(error => {
        const errorMessage = `❌ Ошибка отправки: ${error.message}`;
        showNotification(errorMessage, 'error');
        addWebhookHistory('Ошибка отправки', 'error');
        console.error('Discord webhook error:', error);
    });
}

function updateWebhookHistory() {
    const historyDiv = document.getElementById('webhook-history');
    if (!historyDiv) return;
    
    if (webhooks.length === 0) {
        historyDiv.innerHTML = '<div style="color: #6a6a5a; text-align: center; padding: 20px; font-style: italic;">Нет отправленных сообщений</div>';
        return;
    }
    
    historyDiv.innerHTML = '';
    
    // Берем только последние 10 записей
    webhooks.slice(0, 10).forEach(entry => {
        const div = document.createElement('div');
        div.style.cssText = `
            padding: 10px 12px;
            margin-bottom: 8px;
            background: rgba(30, 32, 28, 0.7);
            border: 1px solid rgba(42, 40, 31, 0.3);
            border-radius: 4px;
            font-size: 0.8rem;
            color: #8f9779;
        `;
        
        const time = new Date(entry.timestamp).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        const date = new Date(entry.timestamp).toLocaleDateString('ru-RU');
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: ${entry.type === 'test' ? '#5865F2' : '#8cb43c'}">
                    <i class="fas fa-${entry.type === 'test' ? 'broadcast-tower' : 'paper-plane'}"></i>
                    ${entry.type === 'test' ? 'Тестирование' : 'Сообщение'}
                </span>
                <span style="color: #6a6a5a; font-size: 0.75rem;">${time}</span>
            </div>
            <div style="color: #c0b070; font-size: 0.75rem; margin-bottom: 3px;">
                <i class="fas fa-user"></i> ${entry.user || 'Система'}
            </div>
            <div style="color: #6a6a5a; font-size: 0.7rem;">
                ${date}
            </div>
        `;
        
        historyDiv.appendChild(div);
    });
}

/* ===== ФУНКЦИЯ ДЛЯ ТЕСТИРОВАНИЯ ВЕБХУКА ===== */
window.testWebhook = function() {
    const urlInput = document.getElementById('webhook-url');
    const url = urlInput ? urlInput.value.trim() : '';
    
    if (!url) {
        showNotification('Сначала настройте вебхук', 'error');
        return;
    }
    
    const testPayload = {
        username: DISCORD_WEBHOOK_NAME,
        avatar_url: DISCORD_WEBHOOK_AVATAR,
        embeds: [{
            title: "✅ ТЕСТ ВЕБХУКА",
            description: `Вебхук успешно настроен!\n\n**Система:** Отчеты Зоны\n**Пользователь:** ${CURRENT_USER}\n**Ранг:** ${CURRENT_RANK.name}\n**Время:** ${new Date().toLocaleString()}`,
            color: 5793266,
            timestamp: new Date().toISOString(),
            footer: {
                text: "Система вебхуков | Версия 1.5"
            }
        }]
    };
    
    sendDiscordWebhook(url, testPayload, true);
}

/* ===== ФУНКЦИЯ ДЛЯ СОХРАНЕНИЯ НАСТРОЕК ВЕБХУКА ===== */
window.saveWebhook = function() {
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
        
        // Обновляем превью
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) {
            avatarPreview.src = DISCORD_WEBHOOK_AVATAR;
        }
    }).catch(error => {
        showNotification('Ошибка сохранения: ' + error.message, 'error');
    });
}

/* ===== ФУНКЦИЯ ДЛЯ ОЧИСТКИ НАСТРОЕК ВЕБХУКА ===== */
window.clearWebhook = function() {
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
        });
    }
};







