/* ===== СИСТЕМА РАНГОВ ЗОНЫ ===== */
const RANKS = {
    JUNIOR_CURATOR: { name: "МЛАДШИЙ КУРАТОР", level: 1, access: ["mlk_reports"] },
    CURATOR: { name: "КУРАТОР", level: 2, access: ["mlk_reports"] },
    SENIOR_CURATOR: { name: "СТАРШИЙ КУРАТОР", level: 3, access: ["mlk_reports", "all_reports", "users"] },
    ADMIN: { name: "АДМИНИСТРАТОР", level: 4, access: ["mlk_reports", "all_reports", "whitelist", "users", "system", "bans", "ip_monitoring", "webhooks"] }
};

/* ===== РАНГ СОЗДАТЕЛЯ ===== */
const CREATOR_RANK = { 
    name: "СОЗДАТЕЛЬ", 
    level: 999, 
    access: ["mlk_reports", "all_reports", "whitelist", "users", "passwords", "system", "everything", "bans", "ip_monitoring", "webhooks"] 
};

/* ===== СИСТЕМНЫЕ ПЕРЕМЕННЫЕ ===== */
let CURRENT_ROLE = null, CURRENT_USER = null, CURRENT_RANK = null, CURRENT_STATIC_ID = null;
let reports = [], bans = [], users = [], whitelist = [], passwords = {};

/* ===== ВЕБХУК ПЕРЕМЕННЫЕ ===== */
let webhooks = [], DISCORD_WEBHOOK_URL = null, DISCORD_WEBHOOK_NAME = "Система отчетов Зоны", DISCORD_WEBHOOK_AVATAR = "https://i.imgur.com/6B7zHqj.png";

/* ===== ДОПОЛНИТЕЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ БЕЗОПАСНОСТИ ===== */
const MAX_ATTEMPTS = 3, LOCKOUT_TIME = 15 * 60 * 1000;
let loginAttempts = {};

/* ===== СИСТЕМА ПАГИНАЦИИ И ПРОКРУТКИ ===== */
const PAGINATION_CONFIG = { itemsPerPage: 15, visiblePages: 5, maxScrollHeight: 600 };
let currentPage = 1, totalPages = 1, currentScrollPosition = {};

/* ===== УЛУЧШЕННАЯ АДАПТИВНОСТЬ И СКРОЛЛ ===== */
function adjustInterfaceHeights() {
    const scrollableContainers = document.querySelectorAll('.scrollable-container');
    const contentBody = document.getElementById('content-body');
    const sidebar = document.querySelector('.zone-sidebar');
    const terminal = document.getElementById('terminal');
    
    scrollableContainers.forEach(container => {
        const parent = container.closest('.form-container, .terminal-screen, .zone-card');
        if (parent) {
            const maxHeight = Math.min(parent.clientHeight - 20, PAGINATION_CONFIG.maxScrollHeight);
            container.style.maxHeight = maxHeight + 'px';
            const containerId = container.id || container.className;
            if (currentScrollPosition[containerId]) container.scrollTop = currentScrollPosition[containerId];
        }
    });
    
    if (contentBody && terminal) {
        const header = document.querySelector('.content-header'), footer = document.querySelector('.content-footer');
        if (header && footer) {
            const terminalHeight = terminal.clientHeight, headerHeight = header.offsetHeight, footerHeight = footer.offsetHeight;
            const availableHeight = terminalHeight - headerHeight - footerHeight - 40;
            contentBody.style.minHeight = Math.max(availableHeight, 400) + 'px';
            contentBody.style.maxHeight = availableHeight + 'px';
            contentBody.style.overflowY = 'auto';
        }
    }
    
    if (sidebar) sidebar.style.maxHeight = (window.innerHeight - 100) + 'px', sidebar.style.overflowY = 'auto';
}

function setupAutoScroll() {
    document.querySelectorAll('.scrollable-container').forEach(container => {
        const hasVerticalScroll = container.scrollHeight > container.clientHeight;
        container.style.paddingRight = hasVerticalScroll ? '15px' : '10px';
        if (hasVerticalScroll) container.addEventListener('scroll', function() {
            currentScrollPosition[this.id || this.className] = this.scrollTop;
        });
    });
    addScrollStyles();
}

function addScrollStyles() {
    if (!document.querySelector('#scroll-styles')) {
        const style = document.createElement('style');
        style.id = 'scroll-styles';
        style.textContent = `.scrollable-container{overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#4a4a3a #1e201c;padding-right:10px}
        .scrollable-container::-webkit-scrollbar{width:8px}.scrollable-container::-webkit-scrollbar-track{background:#1e201c;border-radius:4px}
        .scrollable-container::-webkit-scrollbar-thumb{background:#4a4a3a;border-radius:4px}.scrollable-container::-webkit-scrollbar-thumb:hover{background:#5a5a4a}
        .table-container thead{position:sticky;top:0;background:#1e201c;z-index:10;box-shadow:0 2px 5px rgba(0,0,0,0.3)}
        .report-form-scrollable{display:flex;flex-direction:column;height:100%}.report-creation-container{flex:1;overflow-y:auto;padding-right:10px}
        .form-container.with-scroll{display:flex;flex-direction:column;height:100%;overflow:hidden}
        .form-container.with-scroll>.table-container{flex:1;min-height:0}.scroll-btn{width:40px;height:40px;background:rgba(30,32,28,0.9);border:1px solid #4a4a3a;color:#8f9779;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.2rem;transition:all 0.3s;position:fixed;z-index:1000}
        .scroll-btn:hover{background:rgba(192,176,112,0.2);border-color:#c0b070;color:#c0b070;transform:scale(1.1)}#scroll-to-top{bottom:70px;right:20px}#scroll-to-bottom{bottom:20px;right:20px}
        .pagination-container{display:flex;justify-content:center;align-items:center;margin-top:20px;gap:5px;flex-wrap:wrap;padding:10px;background:rgba(30,32,28,0.5);border-radius:4px}
        .pagination-btn{padding:5px 12px;background:rgba(40,42,36,0.8);border:1px solid #4a4a3a;color:#8f9779;cursor:pointer;font-size:0.9rem;transition:all 0.2s;border-radius:3px;min-width:36px}
        .pagination-btn:hover{background:rgba(60,62,56,0.8);border-color:#8f9779;color:#c0b070}.pagination-btn.active{background:rgba(192,176,112,0.2);border-color:#c0b070;color:#c0b070;font-weight:bold}
        .pagination-btn:disabled{opacity:0.5;cursor:not-allowed}.page-info{color:#8f9779;font-size:0.9rem;margin-left:15px}
        .items-per-page-selector{display:flex;align-items:center;gap:10px;margin-left:auto;color:#8f9779;font-size:0.9rem}
        .items-per-page-selector select{background:rgba(40,42,36,0.8);border:1px solid #4a4a3a;color:#8f9779;padding:3px 8px;border-radius:3px}
        .scroll-indicator{position:absolute;right:5px;top:50%;transform:translateY(-50%);color:#4a4a3a;font-size:0.8rem;pointer-events:none}`;
        document.head.appendChild(style);
    }
}

function addScrollButtons() {
    if (!document.getElementById('scroll-buttons')) {
        document.body.insertAdjacentHTML('beforeend', `<div id="scroll-buttons"><button id="scroll-to-top" class="scroll-btn" style="display:none"><i class="fas fa-arrow-up"></i></button><button id="scroll-to-bottom" class="scroll-btn"><i class="fas fa-arrow-down"></i></button></div>`);
        document.getElementById('scroll-to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        document.getElementById('scroll-to-bottom').addEventListener('click', () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
        window.addEventListener('scroll', handleScroll);
    }
}

function handleScroll() {
    const scrollTopBtn = document.getElementById('scroll-to-top'), scrollBottomBtn = document.getElementById('scroll-to-bottom');
    if (scrollTopBtn) scrollTopBtn.style.display = window.scrollY > 200 ? 'flex' : 'none';
    if (scrollBottomBtn) scrollBottomBtn.style.display = window.scrollY + window.innerHeight >= document.body.scrollHeight - 100 ? 'none' : 'flex';
}

function renderPagination(containerId, currentPage, totalPages, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = `<div class="pagination-container">`;
    if (currentPage > 1) html += `<button onclick="${callback}(${currentPage - 1})" class="pagination-btn" title="Предыдущая страница"><i class="fas fa-chevron-left"></i></button>`;
    
    const startPage = Math.max(1, currentPage - Math.floor(PAGINATION_CONFIG.visiblePages / 2));
    const endPage = Math.min(totalPages, startPage + PAGINATION_CONFIG.visiblePages - 1);
    
    if (startPage > 1) html += `<button onclick="${callback}(1)" class="pagination-btn">1</button>${startPage > 2 ? '<span style="color: #8f9779;">...</span>' : ''}`;
    for (let i = startPage; i <= endPage; i++) html += `<button onclick="${callback}(${i})" class="pagination-btn ${i === currentPage ? 'active' : ''}">${i}</button>`;
    if (endPage < totalPages) html += `${endPage < totalPages - 1 ? '<span style="color: #8f9779;">...</span>' : ''}<button onclick="${callback}(${totalPages})" class="pagination-btn">${totalPages}</button>`;
    if (currentPage < totalPages) html += `<button onclick="${callback}(${currentPage + 1})" class="pagination-btn" title="Следующая страница"><i class="fas fa-chevron-right"></i></button>`;
    
    html += `<div class="page-info">Страница ${currentPage} из ${totalPages}</div><div class="items-per-page-selector"><span>На странице:</span><select onchange="changeItemsPerPage('${callback}', this.value)"><option value="5">5</option><option value="10">10</option><option value="15" selected>15</option><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></div></div>`;
    container.innerHTML = html;
    const select = container.querySelector('select');
    if (select) select.value = PAGINATION_CONFIG.itemsPerPage;
}

/* ===== ФУНКЦИЯ ДЛЯ ИЗМЕНЕНИЯ КОЛИЧЕСТВА ЭЛЕМЕНТОВ НА СТРАНИЦЕ ===== */
function changeItemsPerPage(callback, value) {
    PAGINATION_CONFIG.itemsPerPage = parseInt(value);
    
    if (callback === 'renderReportsWithPagination') {
        renderReportsWithPagination(1);
    } else if (callback === 'renderUsersWithPagination') {
        renderUsersWithPagination(1);
    } else if (callback === 'renderMLKListPaginated') {
        renderMLKListPaginated(1); // ДОБАВЬТЕ ЭТУ СТРОКУ
    } else if (callback === 'renderWhitelistWithPagination') {
        renderWhitelistWithPagination(1);
    } else if (callback === 'renderBansWithPagination') {
        renderBansWithPagination(1);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { setupAutoScroll(); adjustInterfaceHeights(); addScrollButtons(); }, 500);
    window.addEventListener('resize', () => setTimeout(() => { setupAutoScroll(); adjustInterfaceHeights(); }, 100));
});

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
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateStrongPassword() {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    return Array.from({length: 12}, () => charset[Math.floor(Math.random() * charset.length)]).join('');
}

/* ===== ПРОВЕРКА И ПОЛУЧЕНИЕ IP АДРЕСА ===== */
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        return (await response.json()).ip;
    } catch (error) {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({iceServers: [{urls: "stun:stun.l.google.com:19302"}]});
            pc.createDataChannel(""); pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => resolve("unknown"));
            pc.onicecandidate = (ice) => { if (ice.candidate) { const match = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate); if (match) { resolve(match[1]); pc.close(); } } };
            setTimeout(() => resolve("unknown"), 1000);
        });
    }
}

async function checkIPLimit(username) {
    try {
        const userIP = await getUserIP();
        if (userIP === "unknown") return { allowed: true, ip: userIP };
        const ipSnapshot = await db.ref('mlk_ip_tracking').once('value'), ipData = ipSnapshot.val() || {};
        for (const key in ipData) if (ipData[key].ip === userIP && ipData[key].username !== username) return { allowed: false, ip: userIP, message: `С IP-адреса ${userIP} уже зарегистрирован пользователь ${ipData[key].username}` };
        return { allowed: true, ip: userIP };
    } catch (error) { return { allowed: true, ip: "error" }; }
}

async function registerIP(username, staticId) {
    try {
        const userIP = await getUserIP();
        if (userIP === "unknown" || userIP === "error") return;
        await db.ref('mlk_ip_tracking').push({ ip: userIP, username, staticId, registrationDate: new Date().toLocaleString(), lastActive: new Date().toLocaleString() });
        const usersSnapshot = await db.ref('mlk_users').once('value'), usersData = usersSnapshot.val() || {};
        for (const userId in usersData) if (usersData[userId].username === username) {
            await db.ref(`mlk_users/${userId}`).update({ registrationIP: userIP, lastIP: userIP });
            break;
        }
    } catch (error) {}
}

async function updateIPActivity(username) {
    try {
        const userIP = await getUserIP();
        if (userIP === "unknown" || userIP === "error") return;
        const ipSnapshot = await db.ref('mlk_ip_tracking').once('value'), ipData = ipSnapshot.val() || {};
        for (const key in ipData) if (ipData[key].username === username) {
            await db.ref(`mlk_ip_tracking/${key}`).update({ lastIP: userIP, lastActive: new Date().toLocaleString(), lastLogin: new Date().toLocaleString() });
            break;
        }
    } catch (error) {}
}

/* ===== МОНИТОРИНГ ПОПЫТОК ВХОДА ===== */
function trackLoginAttempt(ip, success = false) {
    const now = Date.now();
    if (!loginAttempts[ip]) loginAttempts[ip] = { attempts: 0, firstAttempt: now, lastAttempt: now, lockedUntil: 0 };
    if (success) loginAttempts[ip].attempts = 0, loginAttempts[ip].lockedUntil = 0;
    else {
        loginAttempts[ip].attempts++, loginAttempts[ip].lastAttempt = now;
        if (loginAttempts[ip].attempts >= MAX_ATTEMPTS) {
            loginAttempts[ip].lockedUntil = now + LOCKOUT_TIME;
            showNotification(`Слишком много попыток входа. IP заблокирован на 15 минут`, "error");
        }
    }
    for (const ipKey in loginAttempts) if (now - loginAttempts[ipKey].lastAttempt > 24 * 60 * 60 * 1000) delete loginAttempts[ipKey];
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
    if (!username) return { valid: false, message: "Имя пользователя не указано" };
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) return { valid: false, message: "Имя пользователя должно быть от 3 до 20 символов" };
    if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(trimmedUsername)) return { valid: false, message: "Имя пользователя может содержать только буквы, цифры и подчеркивание" };
    if (['admin', 'root', 'system', 'administrator', 'модератор', 'куратор'].includes(trimmedUsername.toLowerCase())) return { valid: false, message: "Это имя пользователя запрещено" };
    return { valid: true, message: "" };
}

function validatePassword(password) {
    if (!password) return { valid: false, message: "Пароль не указан" };
    if (password.length < 3) return { valid: false, message: "Пароль должен содержать минимум 3 символа" };
    return { valid: true, message: "" };
}

function generateStaticId(username) {
    const timestamp = Date.now().toString(36), usernamePart = username.slice(0, 3).toUpperCase(), randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${usernamePart}-${timestamp.slice(-4)}-${randomPart}`;
}

/* ===== ВОССТАНОВЛЕНИЕ СЕССИИ ===== */
function restoreSession() {
    const savedSession = localStorage.getItem('mlk_session');
    if (!savedSession) return false;
    try {
        const session = JSON.parse(savedSession), currentTime = new Date().getTime(), maxAge = 8 * 60 * 60 * 1000;
        if (currentTime - session.timestamp > maxAge) { localStorage.removeItem('mlk_session'); return false; }
        CURRENT_USER = session.user, CURRENT_ROLE = session.role, CURRENT_RANK = null, CURRENT_STATIC_ID = session.staticId;
        if (session.rank === CREATOR_RANK.level) CURRENT_RANK = CREATOR_RANK;
        else for (const rankKey in RANKS) if (RANKS[rankKey].level === session.rank) { CURRENT_RANK = RANKS[rankKey]; break; }
        return CURRENT_USER && CURRENT_RANK && CURRENT_STATIC_ID;
    } catch (e) { localStorage.removeItem('mlk_session'); return false; }
}

/* ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ТАБЛИЦ ===== */
window.deleteReport = function(id) {
    if(CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK.level !== CREATOR_RANK.level) { showNotification("Недостаточно прав", "error"); return; }
    if(confirm("Удалить отчет?")) db.ref('mlk_reports/' + id + '/deleted').set(true).then(() => loadReports(renderReportsWithPagination));
}

window.confirmReport = function(id) {
    if(CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK.level !== CREATOR_RANK.level) { showNotification("Недостаточно прав", "error"); return; }
    if(confirm("Подтвердить отчет?")) db.ref('mlk_reports/' + id + '/confirmed').set(true).then(() => { loadReports(renderReportsWithPagination); showNotification("Отчет подтвержден", "success"); });
}

function simpleHash(str){
    let h = 0;
    for(let i = 0; i < str.length; i++){ h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return h.toString(16);
}

async function verifyPassword(inputPassword, storedPassword) {
    if (typeof storedPassword === 'string') return inputPassword === storedPassword;
    if (storedPassword && storedPassword.hash && storedPassword.salt) return await hashPassword(inputPassword, storedPassword.salt) === storedPassword.hash;
    if (storedPassword && storedPassword.plain) return inputPassword === storedPassword.plain;
    return false;
}

/* ===== ЗАГРУЗКА ДАННЫХ ИЗ БАЗЫ ===== */
function loadData(callback) {
    const loadPromises = [
        db.ref('mlk_users').once('value').then(snapshot => { const data = snapshot.val() || {}; users = Object.keys(data).map(key => ({ ...data[key], id: key, username: data[key].username || '', staticId: data[key].staticId || '', role: data[key].role || '', rank: data[key].rank || 1 })); }),
        db.ref('mlk_whitelist').once('value').then(snapshot => { const data = snapshot.val() || {}; whitelist = Object.keys(data).map(key => ({ ...data[key], id: key, username: data[key].username || '', staticId: data[key].staticId || '', addedBy: data[key].addedBy || 'СИСТЕМА' })); }),
        db.ref('mlk_passwords').once('value').then(snapshot => { passwords = snapshot.val() || {}; if (!passwords.junior || !passwords.curator || !passwords.senior || !passwords.admin || !passwords.special) return createOrUpdatePasswords().then(() => db.ref('mlk_passwords').once('value')).then(snapshot => passwords = snapshot.val() || {}); }),
        db.ref('mlk_bans').once('value').then(snapshot => { const data = snapshot.val() || {}; bans = Object.keys(data).map(key => ({ ...data[key], id: key, username: data[key].username || '', staticId: data[key].staticId || '', reason: data[key].reason || 'Причина не указана', bannedBy: data[key].bannedBy || 'Система' })); }),
        db.ref('mlk_settings/webhook_url').once('value').then(snapshot => DISCORD_WEBHOOK_URL = snapshot.val() || null),
        db.ref('mlk_settings/webhook_name').once('value').then(snapshot => DISCORD_WEBHOOK_NAME = snapshot.val() || "Система отчетов Зоны"),
        db.ref('mlk_settings/webhook_avatar').once('value').then(snapshot => DISCORD_WEBHOOK_AVATAR = snapshot.val() || "https://i.imgur.com/6B7zHqj.png"),
        db.ref('mlk_webhooks').once('value').then(snapshot => { const data = snapshot.val() || {}; webhooks = Object.keys(data).map(key => ({...data[key], id: key})); webhooks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); })
    ];
    
    Promise.all(loadPromises).then(() => {
        console.log("Система безопасности инициализирована");
        if (whitelist.length === 0) addProtectedUsersToWhitelist().then(() => { if (callback) callback(); });
        else if (callback) callback();
    }).catch(error => { showNotification("Ошибка загрузки данных", "error"); if (callback) callback(); });
}

async function createOrUpdatePasswords() {
    const newPasswords = { admin: "admin", curator: "curator", junior: "junior", senior: "senior", special: "special" };
    const hashedPasswords = {};
    for (const [key, plainPassword] of Object.entries(newPasswords)) {
        const salt = generateSalt(), hash = await hashPassword(plainPassword, salt);
        hashedPasswords[key] = { hash, salt, plain: plainPassword };
    }
    return db.ref('mlk_passwords').set(hashedPasswords);
}

const PROTECTED_USERS = ["Tihiy"];

function addProtectedUsersToWhitelist() {
    const promises = PROTECTED_USERS.map(username => db.ref('mlk_whitelist').push({ username, staticId: generateStaticId(username), addedBy: "СИСТЕМА", addedDate: new Date().toLocaleString(), isProtected: true }));
    return Promise.all(promises).then(() => loadData());
}

async function changePassword(type, newPassword) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { showNotification("Только администратор может изменять коды доступа", "error"); return Promise.reject("Недостаточно прав"); }
    if (!newPassword || newPassword.trim() === "") { showNotification("Введите новый код", "error"); return Promise.reject("Пустой пароль"); }
    const salt = generateSalt(), hash = await hashPassword(newPassword, salt);
    return db.ref('mlk_passwords').update({ [type]: { hash, salt, plain: newPassword } }).then(() => {
        passwords[type] = { hash, salt, plain: newPassword };
        showNotification(`Код доступа изменен`, "success");
        db.ref('mlk_password_logs').push({ type, changedBy: CURRENT_USER, changedAt: new Date().toLocaleString() });
        return true;
    }).catch(error => { showNotification("Ошибка изменения кода: " + error.message, "error"); return false; });
}

function checkIfBanned(username) {
    if (!username || typeof username !== 'string' || username.trim() === '') return { banned: false };
    const usernameLower = username.toLowerCase().trim();
    const user = users.find(u => u && u.username && typeof u.username === 'string' && u.username.toLowerCase().trim() === usernameLower);
    if (!user) return { banned: false };
    const activeBan = bans.find(ban => ban && ((ban.username && typeof ban.username === 'string' && ban.username.toLowerCase().trim() === usernameLower) || (ban.staticId && user.staticId && ban.staticId === user.staticId)) && !ban.unbanned);
    return activeBan ? { banned: true, ...activeBan } : { banned: false };
}

window.banByStaticId = async function(staticId, reason = "Причина не указана") {
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return false; }
    return banUser(user.username, reason);
}

window.unbanByStaticId = async function(staticId) {
    const activeBan = bans.find(ban => ban.staticId === staticId && !ban.unbanned);
    if (!activeBan) { showNotification("Активный бан не найден", "error"); return false; }
    if (!confirm(`Разбанить пользователя ${activeBan.username}?`)) return false;
    return db.ref('mlk_bans/' + activeBan.id).update({ unbanned: true, unbannedBy: CURRENT_USER, unbannedDate: new Date().toLocaleString() }).then(() => {
        loadData(() => { renderBansWithPagination(1); showNotification("Пользователь разбанен", "success"); });
        return true;
    }).catch(error => { showNotification("Ошибка разбана: " + error.message, "error"); return false; });
}

async function banUser(username, reason) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { showNotification("Недостаточно прав для выдачи бана", "error"); return false; }
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) { showNotification("Пользователь не найден", "error"); return false; }
    const isProtected = PROTECTED_USERS.some(protectedUser => protectedUser.toLowerCase() === username.toLowerCase());
    if (isProtected) { showNotification("Нельзя забанить защищенного пользователя", "error"); return false; }
    const existingBan = bans.find(ban => (ban.username.toLowerCase() === username.toLowerCase() || ban.staticId === user.staticId) && !ban.unbanned);
    if (existingBan) { showNotification("Пользователь уже забанен", "warning"); return false; }
    const banData = { username, staticId: user.staticId, reason, bannedBy: CURRENT_USER, bannedDate: new Date().toLocaleString(), unbanned: false };
    return db.ref('mlk_bans').push(banData).then(() => {
        loadData(() => { renderBansWithPagination(1); renderUsersWithPagination(1); showNotification(`Пользователь ${username} забанен`, "success"); });
        return true;
    }).catch(error => { showNotification("Ошибка бана: " + error.message, "error"); return false; });
}

function checkSpecialAccess(username, password) {
    return new Promise((resolve) => {
        if (!username || !password) { resolve({ access: false }); return; }
        const usernameLower = username.toLowerCase().trim();
        db.ref('mlk_passwords').once('value').then(snapshot => {
            const passwords = snapshot.val() || {}, specialPassword = passwords.special;
            if (!specialPassword) { resolve({ access: false }); return; }
            const isProtected = PROTECTED_USERS.some(protectedUser => protectedUser && protectedUser.toLowerCase().trim() === usernameLower);
            resolve({ access: isProtected && password === specialPassword, rank: isProtected && password === specialPassword ? CREATOR_RANK : null });
        }).catch(() => resolve({ access: false }));
    });
}

window.renderBansWithPagination = function(page = 1) {
    const content = document.getElementById("content-body");
    if (!content) return;
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>'; return; }
    
    currentPage = page;
    const itemsPerPage = PAGINATION_CONFIG.itemsPerPage, startIndex = (page - 1) * itemsPerPage, endIndex = startIndex + itemsPerPage;
    const activeBans = bans.filter(ban => !ban.unbanned), paginatedActiveBans = activeBans.slice(startIndex, endIndex), activeBansTotalPages = Math.ceil(activeBans.length / itemsPerPage);
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #b43c3c; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-ban"></i> СИСТЕМА БЛОКИРОВКИ</h2>
            <div class="zone-card" style="margin-bottom: 20px; border-color: #b43c3c;">
                <div class="card-icon" style="color: #b43c3c;"><i class="fas fa-user-slash"></i></div>
                <h4 style="color: #b43c3c; margin-bottom: 10px;">НОВЫЙ БАН</h4>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div><label class="form-label">БАН ПО ИМЕНИ ПОЛЬЗОВАТЕЛЯ</label><div style="display: flex; gap: 10px; flex-wrap: wrap;"><input type="text" id="ban-username" class="form-input" placeholder="Введите имя пользователя" style="flex: 2; min-width: 200px;"><input type="text" id="ban-reason" class="form-input" placeholder="Причина бана" style="flex: 3; min-width: 200px;"><button onclick="addBan()" class="btn-primary" style="border-color: #b43c3c; padding: 10px 15px; min-width: 120px;"><i class="fas fa-ban"></i> ЗАБАНИТЬ</button></div></div>
                    <div><label class="form-label">БАН ПО STATIC ID</label><div style="display: flex; gap: 10px; flex-wrap: wrap;"><input type="text" id="ban-staticid" class="form-input" placeholder="Введите STATIC ID" style="font-family: 'Courier New', monospace; flex: 2; min-width: 200px;"><input type="text" id="ban-reason-static" class="form-input" placeholder="Причина бана" style="flex: 3; min-width: 200px;"><button onclick="addBanByStaticId()" class="btn-primary" style="border-color: #b43c3c; padding: 10px 15px; min-width: 120px;"><i class="fas fa-id-card"></i> БАН ПО ID</button></div></div>
                </div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 20px; overflow: hidden;">
                <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;"><h4 style="color: #b43c3c; margin-bottom: 10px;">АКТИВНЫЕ БАНЫ (${activeBans.length})</h4><div class="table-container scrollable-container" style="flex: 1;">${activeBans.length === 0 ? `<div style="text-align: center; padding: 30px; color: #8f9779;"><i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 10px;"></i><p>АКТИВНЫХ БАНОВ НЕТ</p></div>` : `<table class="data-table"><thead><tr><th>ПОЛЬЗОВАТЕЛЬ</th><th>STATIC ID</th><th>ПРИЧИНА</th><th>ЗАБАНИЛ</th><th>ДАТА</th><th>ДЕЙСТВИЯ</th></tr></thead><tbody id="bans-table-body"></tbody></table>`}</div></div>
                <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;"><h4 style="color: #c0b070; margin-bottom: 10px;">ИСТОРИЯ БАНОВ (${bans.length})</h4><div class="table-container scrollable-container" style="flex: 1;">${bans.length === 0 ? `<div style="text-align: center; padding: 30px; color: #8f9779;"><i class="fas fa-history" style="font-size: 2rem; margin-bottom: 10px;"></i><p>ИСТОРИЯ ПУСТА</p></div>` : `<table class="data-table"><thead><tr><th>ПОЛЬЗОВАТЕЛЬ</th><th>STATIC ID</th><th>ПРИЧИНА</th><th>СТАТУС</th><th>ДАТА</th></tr></thead><tbody id="bans-history-body"></tbody></table>`}</div></div>
            </div><div id="bans-pagination-container"></div>
        </div>`;
    
    if (activeBans.length > 0) { renderBansTablePaginated(paginatedActiveBans); renderPagination('bans-pagination-container', currentPage, activeBansTotalPages, 'renderBansWithPagination'); }
    if (bans.length > 0) renderBansHistoryPaginated(bans.slice(startIndex, endIndex));
    setTimeout(adjustInterfaceHeights, 100);
}

function renderBansTablePaginated(activeBans) {
    const tableBody = document.getElementById("bans-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = activeBans.map(ban => `
        <tr>
            <td style="font-weight: 500; color: #b43c3c;"><i class="fas fa-user-slash"></i> ${ban.username}</td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">${ban.staticId || "N/A"}</td>
            <td>${ban.reason || "Причина не указана"}</td>
            <td>${ban.bannedBy || "Неизвестно"}</td>
            <td>${ban.bannedDate || "Неизвестно"}</td>
            <td>${CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level ? `<button onclick="unbanByStaticId('${ban.staticId}')" class="action-btn confirm"><i class="fas fa-unlock"></i> РАЗБАН</button>` : '<span style="color: #8f9779;">НЕТ ДОСТУПА</span>'}</td>
        </tr>`).join('');
}

function renderBansHistoryPaginated(bans) {
    const tableBody = document.getElementById("bans-history-body");
    if (!tableBody) return;
    tableBody.innerHTML = bans.map(ban => {
        const isActive = !ban.unbanned, bannedDate = ban.bannedDate || "Неизвестно", unbannedDate = ban.unbannedDate || "";
        return `<tr>
            <td style="color: ${isActive ? '#b43c3c' : '#8f9779'}"><i class="fas ${isActive ? 'fa-user-slash' : 'fa-user-check'}"></i> ${ban.username}</td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">${ban.staticId || "N/A"}</td>
            <td>${ban.reason || "Причина не указана"}</td>
            <td><span class="report-status ${isActive ? 'status-deleted' : 'status-confirmed'}" style="display: inline-flex; padding: 4px 10px;"><i class="fas ${isActive ? 'fa-ban' : 'fa-check'}"></i>${isActive ? 'АКТИВЕН' : 'СНЯТ'}</span></td>
            <td>${bannedDate}${unbannedDate ? `<br><small style="color: #6a6a5a;">Снят: ${unbannedDate}</small>` : ''}</td>
        </tr>`;
    }).join('');
}

window.addBan = function() {
    const usernameInput = document.getElementById("ban-username"), reasonInput = document.getElementById("ban-reason");
    const username = usernameInput ? usernameInput.value.trim() : "", reason = reasonInput ? reasonInput.value.trim() : "";
    if (!username) { showNotification("Введите имя пользователя", "error"); return; }
    if (!reason) { showNotification("Введите причину бана", "error"); return; }
    banUser(username, reason).then(success => { if (success) { if (usernameInput) usernameInput.value = ""; if (reasonInput) reasonInput.value = ""; } });
}

window.addBanByStaticId = function() {
    const staticIdInput = document.getElementById("ban-staticid"), reasonInput = document.getElementById("ban-reason-static");
    const staticId = staticIdInput ? staticIdInput.value.trim() : "", reason = reasonInput ? reasonInput.value.trim() : "";
    if (!staticId) { showNotification("Введите STATIC ID", "error"); return; }
    if (!reason) { showNotification("Введите причину бана", "error"); return; }
    banByStaticId(staticId, reason).then(success => { if (success) { if (staticIdInput) staticIdInput.value = ""; if (reasonInput) reasonInput.value = ""; } });
}

window.promoteToAdminByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { showNotification("Только администратор может повышать до администратора", "error"); return; }
    if (!confirm("Повысить пользователя до администратора?")) return;
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    db.ref('mlk_users/' + user.id).update({ role: RANKS.ADMIN.name, rank: RANKS.ADMIN.level }).then(() => {
        loadData(() => { renderUsersWithPagination(1); showNotification("Пользователь повышен до администратора", "success"); });
    }).catch(error => showNotification("Ошибка: " + error.message, "error"));
}

window.promoteToSeniorByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { showNotification("Только администратор может повышать до старшего куратора", "error"); return; }
    if (!confirm("Повысить пользователя до старшего куратора?")) return;
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    db.ref('mlk_users/' + user.id).update({ role: RANKS.SENIOR_CURATOR.name, rank: RANKS.SENIOR_CURATOR.level }).then(() => {
        loadData(() => { renderUsersWithPagination(1); showNotification("Пользователь повышен до старшего куратора", "success"); });
    }).catch(error => showNotification("Ошибка: " + error.message, "error"));
}

window.promoteToCuratorByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { showNotification("Только старший куратор или выше может повышать до куратора", "error"); return; }
    if (!confirm("Повысить пользователя до куратора?")) return;
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    if (user.rank >= RANKS.CURATOR.level) { showNotification("Пользователь уже имеет ранг куратора или выше", "warning"); return; }
    db.ref('mlk_users/' + user.id).update({ role: RANKS.CURATOR.name, rank: RANKS.CURATOR.level }).then(() => {
        loadData(() => { renderUsersWithPagination(1); showNotification("Пользователь повышен до куратора", "success"); });
    }).catch(error => showNotification("Ошибка: " + error.message, "error"));
}

window.demoteToCuratorByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { showNotification("Только администратор может понижать до куратора", "error"); return; }
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    if (user.rank <= RANKS.CURATOR.level) { showNotification("Пользователь уже имеет ранг куратора или ниже", "warning"); return; }
    if (!confirm(`Понизить пользователя ${user.username} до куратора?`)) return;
    db.ref('mlk_users/' + user.id).update({ role: RANKS.CURATOR.name, rank: RANKS.CURATOR.level }).then(() => {
        loadData(() => { renderUsersWithPagination(1); showNotification("Пользователь понижен до куратора", "success"); });
    }).catch(error => showNotification("Ошибка: " + error.message, "error"));
}

window.setToCuratorByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { showNotification("Только старший куратор или выше может назначать кураторов", "error"); return; }
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    if (user.rank === RANKS.CURATOR.level) { showNotification("Пользователь уже является куратором", "info"); return; }
    let message = `Назначить пользователя ${user.username} куратором?`;
    if (user.rank > RANKS.CURATOR.level) message = `Понизить пользователя ${user.username} до куратора?`;
    else if (user.rank < RANKS.CURATOR.level) message = `Повысить пользователя ${user.username} до куратора?`;
    if (!confirm(message)) return;
    db.ref('mlk_users/' + user.id).update({ role: RANKS.CURATOR.name, rank: RANKS.CURATOR.level }).then(() => {
        loadData(() => { renderUsersWithPagination(1); showNotification("Пользователь назначен куратором", "success"); });
    }).catch(error => showNotification("Ошибка: " + error.message, "error"));
}

window.demoteToJuniorByStaticId = function(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { showNotification("Только старший куратор или выше может понижать", "error"); return; }
    if (!confirm("Понизить пользователя до младшего куратора?")) return;
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    db.ref('mlk_users/' + user.id).update({ role: RANKS.JUNIOR_CURATOR.name, rank: RANKS.JUNIOR_CURATOR.level }).then(() => {
        loadData(() => { renderUsersWithPagination(1); showNotification("Пользователь понижен до младшего куратора", "success"); });
    }).catch(error => showNotification("Ошибка: " + error.message, "error"));
}

window.login = async function() {
    const usernameInput = document.getElementById("username").value.trim(), passwordInput = document.getElementById("password").value.trim();
    const errorElement = document.getElementById("login-error");
    if (errorElement) errorElement.textContent = "";
    
    const usernameValidation = validateUsername(usernameInput);
    if (!usernameValidation.valid) { showLoginError(usernameValidation.message); return; }
    const passwordValidation = validatePassword(passwordInput);
    if (!passwordValidation.valid) { showLoginError(passwordValidation.message); return; }
    
    try {
        const userIP = await getUserIP();
        if (userIP !== "unknown") {
            const ipLockStatus = isIPLocked(userIP);
            if (ipLockStatus) { showLoginError(ipLockStatus); return; }
            const ipBanCheck = await checkIPBan(userIP);
            if (ipBanCheck.banned) { showLoginError(`IP адрес ${userIP} заблокирован. Причина: ${ipBanCheck.reason}`); return; }
        }
        
        const banCheck = checkIfBanned(usernameInput);
        if (banCheck.banned) { showBannedScreen(banCheck); return; }
        
        const existingUser = users.find(user => user.username.toLowerCase() === usernameInput.toLowerCase());
        const passwordsSnapshot = await db.ref('mlk_passwords').once('value');
        const passwords = passwordsSnapshot.val() || {};
        const isProtectedUser = PROTECTED_USERS.some(protectedUser => protectedUser.toLowerCase() === usernameInput.toLowerCase());

        if (isProtectedUser) {
            const isSpecialValid = await verifyPassword(passwordInput, passwords.special);
            if (isSpecialValid) {
                if (!existingUser) {
                    const ipCheck = await checkIPLimit(usernameInput);
                    if (!ipCheck.allowed) { showLoginError(ipCheck.message); return; }
                    const staticId = generateStaticId(usernameInput);
                    const newUser = { username: usernameInput, staticId, role: CREATOR_RANK.name, rank: CREATOR_RANK.level, registrationDate: new Date().toLocaleString(), lastLogin: new Date().toLocaleString(), registrationIP: ipCheck.ip };
                    await db.ref('mlk_users').push(newUser);
                    await registerIP(usernameInput, staticId);
                    await new Promise(resolve => loadData(resolve));
                    CURRENT_ROLE = CREATOR_RANK.name, CURRENT_USER = usernameInput, CURRENT_RANK = CREATOR_RANK, CURRENT_STATIC_ID = staticId;
                    trackLoginAttempt(userIP, true);
                    completeLogin();
                } else {
                    await db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
                    await updateIPActivity(usernameInput);
                    CURRENT_ROLE = CREATOR_RANK.name, CURRENT_USER = usernameInput, CURRENT_RANK = CREATOR_RANK, CURRENT_STATIC_ID = existingUser.staticId || generateStaticId(usernameInput);
                    trackLoginAttempt(userIP, true);
                    completeLogin();
                }
                return;
            } else { trackLoginAttempt(userIP, false); showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА"); return; }
        }
        
        if (!existingUser) {
            let userRank = RANKS.JUNIOR_CURATOR, isValidPassword = false;
            const adminValid = await verifyPassword(passwordInput, passwords.admin);
            const seniorValid = await verifyPassword(passwordInput, passwords.senior);
            const curatorValid = await verifyPassword(passwordInput, passwords.curator);
            const juniorValid = await verifyPassword(passwordInput, passwords.junior);
            
            if (adminValid) {
                const isInWhitelist = whitelist.some(user => user.username.toLowerCase() === usernameInput.toLowerCase());
                if (!isInWhitelist) { trackLoginAttempt(userIP, false); showLoginError("ДОСТУП ЗАПРЕЩЕН"); return; }
                userRank = RANKS.ADMIN, isValidPassword = true;
            } else if (seniorValid) {
                const isInWhitelist = whitelist.some(user => user.username.toLowerCase() === usernameInput.toLowerCase());
                if (!isInWhitelist) { trackLoginAttempt(userIP, false); showLoginError("ДОСТУП ЗАПРЕЩЕН"); return; }
                userRank = RANKS.SENIOR_CURATOR, isValidPassword = true;
            } else if (curatorValid) { userRank = RANKS.CURATOR, isValidPassword = true; }
            else if (juniorValid) { userRank = RANKS.JUNIOR_CURATOR, isValidPassword = true; }
            
            if (!isValidPassword) { trackLoginAttempt(userIP, false); showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА"); return; }
            
            const ipCheck = await checkIPLimit(usernameInput);
            if (!ipCheck.allowed) { showLoginError(ipCheck.message); return; }
            
            const staticId = generateStaticId(usernameInput);
            const newUser = { username: usernameInput, staticId, role: userRank.name, rank: userRank.level, registrationDate: new Date().toLocaleString(), lastLogin: new Date().toLocaleString(), registrationIP: ipCheck.ip };
            await db.ref('mlk_users').push(newUser);
            await registerIP(usernameInput, staticId);
            await new Promise(resolve => loadData(resolve));
            CURRENT_ROLE = userRank.name, CURRENT_USER = usernameInput, CURRENT_RANK = userRank, CURRENT_STATIC_ID = staticId;
            trackLoginAttempt(userIP, true);
            completeLogin();
            return;
        } else {
            let isValidPassword = false, userRank = RANKS.JUNIOR_CURATOR;
            if (existingUser.role === RANKS.ADMIN.name) userRank = RANKS.ADMIN;
            else if (existingUser.role === RANKS.SENIOR_CURATOR.name) userRank = RANKS.SENIOR_CURATOR;
            else if (existingUser.role === RANKS.CURATOR.name) userRank = RANKS.CURATOR;
            else userRank = RANKS.JUNIOR_CURATOR;
            
            if (userRank.level >= RANKS.ADMIN.level) isValidPassword = await verifyPassword(passwordInput, passwords.admin);
            else if (userRank.level >= RANKS.SENIOR_CURATOR.level) isValidPassword = await verifyPassword(passwordInput, passwords.senior);
            else if (userRank.level >= RANKS.CURATOR.level) isValidPassword = await verifyPassword(passwordInput, passwords.curator);
            else isValidPassword = await verifyPassword(passwordInput, passwords.junior);
            
            if (!isValidPassword) { trackLoginAttempt(userIP, false); showLoginError("НЕВЕРНЫЙ КОД ДОСТУПА"); return; }
            
            await db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
            await updateIPActivity(usernameInput);
            CURRENT_ROLE = userRank.name, CURRENT_USER = usernameInput, CURRENT_RANK = userRank, CURRENT_STATIC_ID = existingUser.staticId;
            trackLoginAttempt(userIP, true);
            completeLogin();
        }
    } catch (error) { showLoginError("ОШИБКА СИСТЕМЫ"); }
}
    
function showBannedScreen(banInfo) {
    const loginScreen = document.getElementById("login-screen");
    if (!loginScreen) return;
    
    loginScreen.innerHTML = `
        <div class="zone-header">
            <div class="geiger-counter"><div class="geiger-dots"><span class="dot active" style="background: #b43c3c;"></span><span class="dot active" style="background: #b43c3c;"></span><span class="dot active" style="background: #b43c3c;"></span><span class="dot active" style="background: #b43c3c;"></span><span class="dot active" style="background: #b43c3c;"></span></div>
            <div class="geiger-text" style="color: #b43c3c;">ДОСТУП ЗАБЛОКИРОВАН</div></div>
            <h1 class="zone-title"><span class="title-part" style="color: #b43c3c;">ДОСТУП</span><span class="title-part" style="color: #b43c3c;">ЗАБЛОКИРОВАН</span></h1>
            <div class="login-warning" style="border-color: #b43c3c; color: #b43c3c;"><i class="fas fa-ban"></i><span>ВХОД В СИСТЕМУ НЕВОЗМОЖЕН</span></div>
        </div>
        <div class="login-terminal" style="max-width: 800px;">
            <div class="terminal-screen" style="border-color: #b43c3c;">
                <div class="screen-header" style="background: linear-gradient(to right, #3a1a1a, #4a2a2a); color: #b43c3c;"><span>СИСТЕМА БЛОКИРОВКИ</span><span class="blink" style="color: #b43c3c;">█</span></div>
                <div class="screen-content" style="padding: 40px;">
                    <div style="text-align: center; margin-bottom: 30px;"><i class="fas fa-user-slash" style="font-size: 4rem; color: #b43c3c; margin-bottom: 20px;"></i>
                    <h2 style="color: #b43c3c; font-family: 'Orbitron', sans-serif; margin-bottom: 10px;">ВЫ ЗАБАНЕНЫ</h2>
                    <p style="color: #8f9779; font-size: 1.1rem;">ДОСТУП К СИСТЕМЕ ОТЧЕТОВ ЗОНЫ ЗАПРЕЩЕН</p></div>
                    <div style="background: rgba(180, 60, 60, 0.1); border: 1px solid #b43c3c; padding: 20px; margin-bottom: 30px;">
                        <h4 style="color: #c0b070; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;"><i class="fas fa-exclamation-circle"></i> ПРИЧИНА БЛОКИРОВКИ</h4>
                        <div style="color: #8f9779; font-size: 1.1rem; line-height: 1.6; padding: 10px;">"${banInfo.reason}"</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                        <div style="text-align: center;"><div style="font-size: 0.9rem; color: #6a6a5a; margin-bottom: 5px;">ЗАБАНИЛ</div><div style="color: #c0b070; font-weight: 500;">${banInfo.bannedBy}</div></div>
                        <div style="text-align: center;"><div style="font-size: 0.9rem; color: #6a6a5a; margin-bottom: 5px;">ДАТА БАНА</div><div style="color: #c0b070; font-weight: 500;">${banInfo.bannedDate}</div></div>
                        <div style="text-align: center;"><div style="font-size: 0.9rem; color: #6a6a5a; margin-bottom: 5px;">STATIC ID</div><div style="color: #c0b070; font-weight: 500; font-family: 'Courier New', monospace;">${banInfo.staticId || "N/A"}</div></div>
                    </div>
                    <div style="text-align: center; color: #6a6a5a; font-size: 0.9rem; padding: 15px; border-top: 1px solid #4a4a3a;"><i class="fas fa-info-circle"></i>Для разблокировки обратитесь к старшему куратору</div>
                </div>
                <div class="screen-footer" style="padding: 20px; border-top: 1px solid #4a4a3a; text-align: center;">
                    <button onclick="location.reload()" class="access-button" style="border-color: #6a6a5a; color: #6a6a5a;"><i class="fas fa-redo"></i><span>ОБНОВИТЬ СТРАНИЦУ</span></button>
                </div>
            </div>
        </div>
        <div class="zone-footer">
            <div class="footer-info"><span>СТАТУС: БЛОКИРОВКА АКТИВНА</span><span class="sep">|</span><span>КОД: BAN-${Date.now().toString(16).slice(-6).toUpperCase()}</span></div>
            <div class="footer-warning"><i class="fas fa-skull-crossbones"></i><span>ПОПЫТКА ОБХОДА БЛОКИРОВКИ БУДЕТ ЗАФИКСИРОВАНА</span></div>
        </div>`;
}

function showLoginError(message) {
    const errorElement = document.getElementById("login-error");
    if (errorElement) { errorElement.textContent = message; errorElement.style.display = "block"; }
}

function completeLogin() {
    const loginScreen = document.getElementById("login-screen"), terminal = document.getElementById("terminal");
    if (loginScreen && terminal) { loginScreen.style.display = "none"; terminal.style.display = "flex"; }
    localStorage.setItem('mlk_session', JSON.stringify({ user: CURRENT_USER, role: CURRENT_ROLE, rank: CURRENT_RANK.level, staticId: CURRENT_STATIC_ID, timestamp: new Date().getTime() }));
    setupSidebar();
    updateSystemPrompt(`ПОДКЛЮЧЕНИЕ УСПЕШНО. ДОБРО ПОЖАЛОВАТЬ, ${CURRENT_USER}`);
    if (CURRENT_RANK.level >= RANKS.ADMIN.level) loadReports(renderSystem);
    else if (CURRENT_RANK.level >= RANKS.CURATOR.level) loadReports(renderMLKScreen);
    else loadReports(renderMLKScreen);
    setTimeout(adjustInterfaceHeights, 100);
}

/* ===== UI ИНИЦИАЛИЗАЦИЯ ===== */
document.addEventListener('DOMContentLoaded', function() {
    function updateTime() {
        const now = new Date(), timeElement = document.getElementById('current-time'), dateElement = document.getElementById('current-date');
        if (timeElement) timeElement.textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        if (dateElement) dateElement.textContent = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    setInterval(updateTime, 1000);
    updateTime();
    
    if (restoreSession()) {
        loadData(() => {
            const loginScreen = document.getElementById("login-screen"), terminal = document.getElementById("terminal");
            if (loginScreen && terminal) { loginScreen.style.display = "none"; terminal.style.display = "flex"; }
            setupSidebar();
            updateSystemPrompt(`СЕССИЯ ВОССТАНОВЛЕНА. ДОБРО ПОЖАЛОВАТЬ, ${CURRENT_USER}`);
            if (CURRENT_RANK.level >= RANKS.ADMIN.level) loadReports(renderSystem);
            else if (CURRENT_RANK.level >= RANKS.CURATOR.level) loadReports(renderMLKScreen);
            else loadReports(renderMLKScreen);
        });
    } else {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.onclick = function() { loginBtn.style.transform = 'scale(0.98)'; setTimeout(() => { loginBtn.style.transform = ''; login(); }, 150); };
        }
        document.addEventListener('keypress', function(e) { if (e.key === 'Enter') { const activeElement = document.activeElement; if (activeElement && (activeElement.id === 'password' || activeElement.id === 'username')) login(); } });
        loadData();
    }
});

/* ===== НАВИГАЦИЯ И SIDEBAR С ПРОКРУТКОЙ ===== */
function setupSidebar() {
    const sidebar = document.getElementById("sidebar"), navMenu = document.getElementById("nav-menu");
    if (!sidebar || !navMenu) return;
    navMenu.innerHTML = '';
    
    const usernameElement = document.getElementById('current-username'), rankElement = document.getElementById('current-rank'), staticIdElement = document.getElementById('current-static-id');
    if (usernameElement && CURRENT_USER) usernameElement.textContent = CURRENT_USER.toUpperCase();
    if (rankElement && CURRENT_RANK) rankElement.textContent = CURRENT_RANK.name;
    if (staticIdElement && CURRENT_STATIC_ID) staticIdElement.textContent = CURRENT_STATIC_ID;
    
    addNavButton(navMenu, 'fas fa-file-alt', 'ОТЧЕТЫ МЛК', renderMLKScreen);
    if (CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-list', 'ВСЕ ОТЧЕТЫ', () => renderReportsWithPagination(1));
        addNavButton(navMenu, 'fas fa-user-friends', 'ПОЛЬЗОВАТЕЛИ', () => renderUsersWithPagination(1));
    }
    if (CURRENT_RANK.level >= RANKS.ADMIN.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-users', 'СПИСОК ДОСТУПА', () => renderWhitelistWithPagination(1));
        addNavButton(navMenu, 'fas fa-key', 'КОДЫ ДОСТУПА', renderPasswords);
        addNavButton(navMenu, 'fas fa-cogs', 'СИСТЕМА', renderSystem);
        addNavButton(navMenu, 'fas fa-ban', 'БАНЫ', () => renderBansWithPagination(1));
        addNavButton(navMenu, 'fas fa-network-wired', 'IP МОНИТОРИНГ', renderIPStats);
        addNavButton(navMenu, 'fas fa-broadcast-tower', 'DISCORD ВЕБХУКИ', renderWebhookManager);
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;
    
    setTimeout(() => { if (sidebar) { sidebar.classList.add('scrollable-container'); adjustInterfaceHeights(); } }, 100);
}

function addNavButton(container, icon, text, onClick) {
    const button = document.createElement('button');
    button.className = 'nav-button';
    button.innerHTML = `<i class="${icon}"></i><span>${text}</span>`;
    button.onclick = function() {
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        onClick();
        const titleElement = document.getElementById('content-title');
        if (titleElement) titleElement.textContent = text;
        updateSystemPrompt(`ЗАГРУЖЕН РАЗДЕЛ: ${text}`);
        setTimeout(() => { adjustInterfaceHeights(); setupAutoScroll(); }, 100);
    };
    container.appendChild(button);
}

function logout() {
    CURRENT_ROLE = null, CURRENT_USER = null, CURRENT_RANK = null, CURRENT_STATIC_ID = null;
    localStorage.removeItem('mlk_session');
    const terminal = document.getElementById('terminal'), loginScreen = document.getElementById('login-screen');
    if (terminal && loginScreen) { terminal.style.display = 'none'; loginScreen.style.display = 'flex'; }
    document.getElementById('password').value = '';
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.value = '';
    const errorElement = document.getElementById('login-error');
    if (errorElement) errorElement.textContent = '';
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    showNotification("Сессия завершена", "info");
}

/* ===== УВЕДОМЛЕНИЯ ===== */
function showNotification(message, type = "info") {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => { notification.classList.remove('show'); setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 300); }, 5000);
}

function updateSystemPrompt(message) {
    const promptElement = document.getElementById('system-prompt');
    if (promptElement) promptElement.textContent = message;
}

/* ===== ЗАГРУЗКА ОТЧЕТОВ ===== */
function loadReports(callback) {
    db.ref('mlk_reports').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        reports = Object.keys(data).map(key => ({...data[key], id: key}));
        if (callback) callback();
    }).catch(error => { showNotification("Ошибка загрузки отчетов", "error"); if (callback) callback(); });
}

/* ===== ФУНКЦИИ ДЛЯ ФОРМЫ ОТЧЕТА ===== */
window.addProofField = function() {
    const container = document.getElementById('proof-links-container');
    const newInput = document.createElement('div');
    newInput.className = 'proof-link-input';
    newInput.innerHTML = `<input type="text" class="form-input proof-link" placeholder="https://imgur.com/... или steam://..."><button type="button" class="btn-secondary remove-proof-btn" onclick="removeProofField(this)"><i class="fas fa-minus"></i></button>`;
    container.appendChild(newInput);
}

window.removeProofField = function(button) {
    const container = document.getElementById('proof-links-container');
    if (container.children.length > 1) button.closest('.proof-link-input').remove();
}

function updateCharCount() {
    const textarea = document.getElementById('mlk-action'), counter = document.getElementById('char-count');
    if (textarea && counter) {
        const count = textarea.value.length;
        counter.textContent = count;
        counter.style.color = count > 1800 ? '#b43c3c' : count > 1500 ? '#c0b070' : '#8cb43c';
    }
}

function updatePreview() {
    const tagInput = document.getElementById('mlk-tag'), descriptionInput = document.getElementById('mlk-action');
    const selectedCategory = document.querySelector('.category-card.active'), selectedPriority = document.querySelector('.priority-option.active');
    const previewTag = document.getElementById('preview-tag'), previewDescription = document.getElementById('preview-description');
    const previewCategory = document.querySelector('.preview-category'), previewPriority = document.querySelector('.preview-priority');
    
    if (previewTag) previewTag.textContent = tagInput.value || '[не указано]';
    if (previewDescription) previewDescription.textContent = descriptionInput.value || '[описание появится здесь]';
    if (selectedCategory && previewCategory) {
        const categoryName = selectedCategory.querySelector('.category-name').textContent, categoryColor = selectedCategory.dataset.color;
        previewCategory.textContent = categoryName, previewCategory.style.color = categoryColor;
    }
    if (selectedPriority && previewPriority) {
        const priorityText = selectedPriority.querySelector('span').textContent, priorityColor = selectedPriority.querySelector('.priority-dot').style.background;
        previewPriority.textContent = priorityText, previewPriority.style.color = priorityColor;
    }
}

function setupReportFormHandlers() {
    document.querySelectorAll('.category-card').forEach(card => card.addEventListener('click', function() {
        document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        updatePreview();
    }));

    document.querySelectorAll('.priority-option').forEach(option => option.addEventListener('click', function() {
        document.querySelectorAll('.priority-option').forEach(o => o.classList.remove('active'));
        this.classList.add('active');
        updatePreview();
    }));

    document.querySelectorAll('.tag-option').forEach(option => option.addEventListener('click', function() {
        document.querySelectorAll('.tag-option').forEach(o => o.classList.remove('active'));
        this.classList.add('active');
        updatePreview();
    }));

    const addProofBtn = document.querySelector('.add-proof-btn');
    if (addProofBtn) addProofBtn.addEventListener('click', addProofField);

    const proofContainer = document.getElementById('proof-links-container');
    if (proofContainer) proofContainer.addEventListener('click', function(event) {
        if (event.target.classList.contains('remove-proof-btn') || event.target.closest('.remove-proof-btn')) {
            const btn = event.target.classList.contains('remove-proof-btn') ? event.target : event.target.closest('.remove-proof-btn');
            removeProofField(btn);
        }
    });

    updateCharCount();
    updatePreview();
}

window.renderMLKForm = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container report-form-scrollable" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-file-medical"></i> СОЗДАНИЕ ОТЧЕТА</h2>
            <div class="report-creation-container scrollable-container" style="flex: 1; overflow-y: auto; padding-right: 10px;">
                <div class="zone-card" style="margin-bottom: 15px;"><div class="card-icon"><i class="fas fa-user-tag"></i></div><h4 style="color: #c0b070; margin-bottom: 10px;">ИНФОРМАЦИЯ О НАРУШИТЕЛЕ</h4>
                    <div class="form-group"><label class="form-label">ИДЕНТИФИКАТОР НАРУШИТЕЛЯ</label><div style="position: relative;"><input type="text" id="mlk-tag" class="form-input" placeholder="@никнейм / STEAM_1:0:123456 / ID игрока" style="padding-left: 40px; width: 100%;"><i class="fas fa-user-secret" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #8cb43c;"></i></div></div>
                    <div class="form-group"><label class="form-label">ТИП НАРУШИТЕЛЯ</label><div class="tag-selector" style="display: flex; flex-wrap: wrap; gap: 10px;"><button type="button" class="tag-option active" data-value="player" style="flex: 1; min-width: 120px;">Игрок</button><button type="button" class="tag-option" data-value="admin" style="flex: 1; min-width: 120px;">Админ</button><button type="button" class="tag-option" data-value="curator" style="flex: 1; min-width: 120px;">Куратор</button><button type="button" class="tag-option" data-value="other" style="flex: 1; min-width: 120px;">Другое</button></div></div></div>
                <div class="zone-card" style="margin-bottom: 15px; border-color: #c0b070;"><div class="card-icon" style="color: #c0b070;"><i class="fas fa-exclamation-triangle"></i></div><h4 style="color: #c0b070; margin-bottom: 10px;">КАТЕГОРИЯ НАРУШЕНИЯ</h4>
                    <div class="form-group"><label class="form-label">ВЫБЕРИТЕ КАТЕГОРИЮ</label><div class="category-grid" id="violation-categories" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
                        <div class="category-card" data-category="cheat" data-color="#b43c3c" style="cursor: pointer; padding: 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;"><div class="category-icon" style="font-size: 1.5rem; color: #b43c3c; margin-bottom: 8px;"><i class="fas fa-skull-crossbones"></i></div><span class="category-name" style="color: #b43c3c; font-weight: 500; display: block; margin-bottom: 5px;">ЧИТЫ</span><span class="category-desc" style="color: #8f9779; font-size: 0.8rem;">Использование ПО</span></div>
                        <div class="category-card" data-category="toxic" data-color="#b43c3c" style="cursor: pointer; padding: 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;"><div class="category-icon" style="font-size: 1.5rem; color: #b43c3c; margin-bottom: 8px;"><i class="fas fa-comment-slash"></i></div><span class="category-name" style="color: #b43c3c; font-weight: 500; display: block; margin-bottom: 5px;">ТОКСИЧНОСТЬ</span><span class="category-desc" style="color: #8f9779; font-size: 0.8rem;">Оскорбления</span></div>
                        <div class="category-card" data-category="spam" data-color="#b43c3c" style="cursor: pointer; padding: 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;"><div class="category-icon" style="font-size: 1.5rem; color: #b43c3c; margin-bottom: 8px;"><i class="fas fa-comment-dots"></i></div><span class="category-name" style="color: #b43c3c; font-weight: 500; display: block; margin-bottom: 5px;">СПАМ</span><span class="category-desc" style="color: #8f9779; font-size: 0.8rem;">Флуд в чате</span></div>
                        <div class="category-card" data-category="bug" data-color="#c0b070" style="cursor: pointer; padding: 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;"><div class="category-icon" style="font-size: 1.5rem; color: #c0b070; margin-bottom: 8px;"><i class="fas fa-bug"></i></div><span class="category-name" style="color: #c0b070; font-weight: 500; display: block; margin-bottom: 5px;">БАГИ</span><span class="category-desc" style="color: #8f9779; font-size: 0.8rem;">Использование багов</span></div>
                        <div class="category-card" data-category="grief" data-color="#c0b070" style="cursor: pointer; padding: 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;"><div class="category-icon" style="font-size: 1.5rem; color: #c0b070; margin-bottom: 8px;"><i class="fas fa-user-slash"></i></div><span class="category-name" style="color: #c0b070; font-weight: 500; display: block; margin-bottom: 5px;">ГРИФ</span><span class="category-desc" style="color: #8f9779; font-size: 0.8rem;">Вредительство</span></div>
                        <div class="category-card" data-category="other" data-color="#8f9779" style="cursor: pointer; padding: 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;"><div class="category-icon" style="font-size: 1.5rem; color: #8f9779; margin-bottom: 8px;"><i class="fas fa-question-circle"></i></div><span class="category-name" style="color: #8f9779; font-weight: 500; display: block; margin-bottom: 5px;">ДРУГОЕ</span><span class="category-desc" style="color: #8f9779; font-size: 0.8rem;">Иные нарушения</span></div></div></div>
                    <div class="form-group"><label class="form-label">ПРИОРИТЕТ ОТЧЕТА</label><div class="priority-selector" style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div class="priority-option" data-priority="low" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; transition: all 0.2s;"><div class="priority-dot" style="width: 12px; height: 12px; background: #8cb43c; border-radius: 50%;"></div><span style="color: #8f9779;">НИЗКИЙ</span></div>
                        <div class="priority-option active" data-priority="medium" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #c0b070; border-radius: 4px; transition: all 0.2s;"><div class="priority-dot" style="width: 12px; height: 12px; background: #c0b070; border-radius: 50%;"></div><span style="color: #c0b070;">СРЕДНИЙ</span></div>
                        <div class="priority-option" data-priority="high" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; transition: all 0.2s;"><div class="priority-dot" style="width: 12px; height: 12px; background: #b43c3c; border-radius: 50%;"></div><span style="color: #b43c3c;">ВЫСОКИЙ</span></div></div></div></div>
                <div class="zone-card" style="margin-bottom: 15px; border-color: #8cb43c;"><div class="card-icon"><i class="fas fa-align-left"></i></div><h4 style="color: #8cb43c; margin-bottom: 10px;">ДЕТАЛЬНОЕ ОПИСАНИЕ</h4>
                    <div class="form-group"><label class="form-label">ПОДРОБНОЕ ОПИСАНИЕ НАРУШЕНИЯ</label><div style="position: relative;"><textarea id="mlk-action" class="form-textarea" rows="6" placeholder="Опишите нарушение максимально подробно..." style="width: 100%; resize: vertical;"></textarea><div class="char-counter" style="position: absolute; bottom: 10px; right: 10px; color: #8f9779; font-size: 0.8rem;"><span id="char-count">0</span>/2000 символов</div></div></div>
                    <div class="form-group"><label class="form-label">ССЫЛКИ НА ДОКАЗАТЕЛЬСТВА</label><div id="proof-links-container"><div class="proof-link-input" style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;"><input type="text" class="form-input proof-link" placeholder="https://imgur.com/... или steam://..." style="flex: 1;"><button type="button" class="btn-secondary add-proof-btn" style="padding: 8px 12px;"><i class="fas fa-plus"></i></button></div></div><div style="margin-top: 5px; font-size: 0.8rem; color: #8f9779;">Можно добавить ссылки на скриншоты, видео, демо-записи</div></div></div>
                <div class="zone-card" style="background: rgba(40, 42, 36, 0.8); margin-bottom: 15px;"><div class="card-icon"><i class="fas fa-eye"></i></div><h4 style="color: #c0b070; margin-bottom: 10px;">ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР</h4>
                    <div id="report-preview" class="report-preview" style="background: rgba(20, 18, 15, 0.8); padding: 15px; border: 1px solid #4a4a3a; border-radius: 4px;">
                        <div class="preview-header" style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #4a4a3a;">
                            <div class="preview-badge" style="display: flex; gap: 10px; flex-wrap: wrap;"><span class="preview-category" style="background: rgba(180, 60, 60, 0.1); color: #b43c3c; padding: 4px 10px; border-radius: 3px; font-size: 0.8rem;">ЧИТЫ</span><span class="preview-priority" style="background: rgba(192, 176, 112, 0.1); color: #c0b070; padding: 4px 10px; border-radius: 3px; font-size: 0.8rem;">СРЕДНИЙ</span></div>
                            <div class="preview-time" style="color: #8f9779; font-size: 0.8rem;">${new Date().toLocaleString()}</div></div>
                        <div class="preview-content">
                            <div class="preview-violator" style="margin-bottom: 15px;"><i class="fas fa-user-tag" style="color: #8f9779; margin-right: 8px;"></i> <span id="preview-tag" style="color: #c0b070;">[не указано]</span></div>
                            <div class="preview-description" id="preview-description" style="color: #8f9779; line-height: 1.5; min-height: 60px;">[описание появится здесь]</div></div>
                        <div class="preview-footer" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #4a4a3a; display: flex; justify-content: space-between; flex-wrap: wrap;">
                            <div class="preview-author" style="color: #8f9779; font-size: 0.9rem;"><i class="fas fa-user" style="margin-right: 8px;"></i> ${CURRENT_USER}</div>
                            <div class="preview-status"><span class="status-pending" style="background: rgba(192, 176, 112, 0.1); color: #c0b070; padding: 4px 10px; border-radius: 3px; font-size: 0.8rem;">ОЖИДАЕТ ПРОВЕРКИ</span></div></div></div></div>
                <div class="form-actions" style="display: flex; gap: 15px; padding-top: 15px; border-top: 1px solid #4a4a3a;">
                    <button onclick="renderMLKScreen()" class="btn-secondary" style="flex: 1; padding: 12px;"><i class="fas fa-arrow-left"></i> ОТМЕНА</button>
                    <button id="submit-mlk-btn" class="btn-primary" style="flex: 2; padding: 12px;"><i class="fas fa-paper-plane"></i> ОТПРАВИТЬ ОТЧЕТ</button></div></div>
            <div style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 10px; z-index: 10;">
                <button onclick="scrollFormToTop()" class="scroll-btn" style="width: 30px; height: 30px; font-size: 0.9rem;"><i class="fas fa-arrow-up"></i></button>
                <button onclick="scrollFormToBottom()" class="scroll-btn" style="width: 30px; height: 30px; font-size: 0.9rem;"><i class="fas fa-arrow-down"></i></button></div></div>`;
    
    document.getElementById("submit-mlk-btn").onclick = addMLKReport;
    const actionTextarea = document.getElementById("mlk-action"), tagInput = document.getElementById("mlk-tag");
    if (actionTextarea) actionTextarea.addEventListener('input', function(e) { updatePreview(); updateCharCount(); });
    if (tagInput) tagInput.addEventListener('input', updatePreview);
    setupReportFormHandlers();
    setTimeout(() => { const firstCategory = document.querySelector('.category-card'); if (firstCategory) firstCategory.classList.add('active'); }, 100);
    setTimeout(adjustInterfaceHeights, 100);
}

function scrollFormToTop() {
    const formContainer = document.querySelector('.report-creation-container');
    if (formContainer) formContainer.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollFormToBottom() {
    const formContainer = document.querySelector('.report-creation-container');
    if (formContainer) formContainer.scrollTo({ top: formContainer.scrollHeight, behavior: 'smooth' });
}

window.renderMLKScreen = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    loadReports(function() {
        content.innerHTML = `
            <div class="form-container with-scroll">
                <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                    <i class="fas fa-file-alt"></i> ОТЧЕТЫ МЛК
                </h2>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h3 style="color: #c0b070; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-bottom: 5px;">АРХИВ ОТЧЕТОВ</h3>
                        <p style="color: #8f9779; font-size: 0.9rem;">СИСТЕМА ФИКСАЦИИ НАРУШЕНИЙ</p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <div class="items-per-page-selector" style="margin: 0;">
                            <span style="color: #8f9779; font-size: 0.9rem;">На странице:</span>
                            <select onchange="changeItemsPerPage('renderMLKListPaginated', this.value)">
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="15" selected>15</option>
                                <option value="20">20</option>
                                <option value="30">30</option>
                            </select>
                        </div>
                        <button onclick="renderMLKForm()" class="btn-primary" style="padding: 10px 20px; font-size: 0.9rem;">
                            <i class="fas fa-plus"></i> НОВЫЙ ОТЧЕТ
                        </button>
                    </div>
                </div>
                
                <div id="mlk-list" class="table-container scrollable-container" style="flex: 1;">
                    <!-- Здесь будет список отчетов -->
                </div>
                
                <div id="mlk-pagination-container"></div>
            </div>
        `;
        
        renderMLKListPaginated(1);
    });
}

function renderMLKListPaginated(page = 1) {
    const listDiv = document.getElementById("mlk-list");
    const paginationContainer = document.getElementById("mlk-pagination-container");
    
    if (!listDiv) return;
    
    const filteredReports = (CURRENT_RANK.level <= RANKS.CURATOR.level)
        ? reports.filter(r => r.author === CURRENT_USER)
        : reports;
    
    currentPage = page;
    const itemsPerPage = PAGINATION_CONFIG.itemsPerPage;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedReports = filteredReports.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    
    if (filteredReports.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-reports" style="text-align: center; padding: 40px; color: #8f9779;">
                <div class="empty-icon" style="font-size: 2rem; margin-bottom: 10px;">
                    <i class="fas fa-inbox"></i>
                </div>
                <h3>ОТЧЕТЫ ОТСУТСТВУЮТ</h3>
                <p>СОЗДАЙТЕ ПЕРВЫЙ ОТЧЕТ, НАЖАВ НА КНОПКУ "НОВЫЙ ОТЧЕТ"</p>
            </div>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    
    listDiv.innerHTML = '';
    
    const sortedReports = [...paginatedReports].sort((a, b) => {
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
        
        const categoryColors = {
            'cheat': '#b43c3c',
            'toxic': '#b43c3c',
            'spam': '#b43c3c',
            'bug': '#c0b070',
            'grief': '#c0b070',
            'other': '#8f9779'
        };
        
        const categoryColor = categoryColors[r.category] || '#8f9779';
        
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
    
    // Добавляем пагинацию если есть больше одной страницы
    if (paginationContainer) {
        if (totalPages > 1) {
            renderPagination('mlk-pagination-container', currentPage, totalPages, 'renderMLKListPaginated');
        } else {
            paginationContainer.innerHTML = '';
        }
    }
}

function renderReportsWithPagination(page = 1) {
    const content = document.getElementById("content-body");
    if (!content) return;
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>'; return; }
    
    currentPage = page;
    const itemsPerPage = PAGINATION_CONFIG.itemsPerPage, startIndex = (page - 1) * itemsPerPage, endIndex = startIndex + itemsPerPage;
    const paginatedReports = reports.slice(startIndex, endIndex);
    totalPages = Math.ceil(reports.length / itemsPerPage);
    const pendingReports = reports.filter(r => !r.confirmed && !r.deleted).length, confirmedReports = reports.filter(r => r.confirmed).length, deletedReports = reports.filter(r => r.deleted).length;
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-list-alt"></i> АРХИВ ОТЧЕТОВ</h2>
            <p style="color: #8f9779; margin-bottom: 15px; font-size: 0.9rem;">ОБЩЕЕ КОЛИЧЕСТВО: ${reports.length}</p>
            <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div class="zone-card"><div class="card-icon"><i class="fas fa-clock"></i></div><div class="card-value">${pendingReports}</div><div class="card-label">НА РАССМОТРЕНИИ</div></div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-check"></i></div><div class="card-value">${confirmedReports}</div><div class="card-label">ПОДТВЕРЖДЕНО</div></div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-trash"></i></div><div class="card-value">${deletedReports}</div><div class="card-label">УДАЛЕНО</div></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h4 style="color: #c0b070; margin: 0;">ВСЕ ОТЧЕТЫ (${reports.length})</h4>
                <div class="items-per-page-selector"><span>На странице:</span><select onchange="changeItemsPerPage('renderReportsWithPagination', this.value)"><option value="5">5</option><option value="10">10</option><option value="15" selected>15</option><option value="20">20</option><option value="30">30</option></select></div>
            </div>
            <div class="table-container scrollable-container" style="flex: 1;">
                ${reports.length === 0 ? `<div style="text-align: center; padding: 40px; color: #8f9779;"><i class="fas fa-database" style="font-size: 2rem; margin-bottom: 10px;"></i><p>ОТЧЕТЫ ЕЩЕ НЕ СОЗДАНЫ</p></div>` : `<table class="data-table"><thead><tr><th>ИДЕНТИФИКАТОР</th><th>НАРУШЕНИЕ</th><th>АВТОР</th><th>ВРЕМЯ</th><th>СТАТУС</th><th class="actions">ДЕЙСТВИЯ</th></tr></thead><tbody id="all-reports-body"></tbody></table>`}
            </div>
            <div id="reports-pagination-container"></div>
        </div>`;
    
    if (reports.length > 0) {
        renderAllReportsTablePaginated(paginatedReports);
        if (totalPages > 1) renderPagination('reports-pagination-container', currentPage, totalPages, 'renderReportsWithPagination');
    }
    setTimeout(adjustInterfaceHeights, 100);
}

function renderAllReportsTablePaginated(paginatedReports) {
    const tableBody = document.getElementById("all-reports-body");
    if (!tableBody) return;
    tableBody.innerHTML = paginatedReports.map(r => {
        let status = r.deleted ? "удален" : (r.confirmed ? "подтвержден" : "рассматривается");
        let statusClass = r.deleted ? "status-deleted" : (r.confirmed ? "status-confirmed" : "status-pending");
        const actionsHtml = (!r.deleted && !r.confirmed && CURRENT_RANK.level >= RANKS.ADMIN.level) ? `<div class="action-buttons"><button onclick="confirmReport('${r.id}')" class="action-btn confirm"><i class="fas fa-check"></i> Подтвердить</button><button onclick="deleteReport('${r.id}')" class="action-btn delete"><i class="fas fa-trash"></i> Удалить</button></div>` : '';
        return `<tr>
            <td style="max-width: 150px;"><i class="fas fa-user-tag fa-icon"></i>${r.tag || '—'}</td>
            <td style="max-width: 200px;" class="truncate" title="${r.action || ''}">${(r.action || '').substring(0, 50)}${r.action && r.action.length > 50 ? '...' : ''}</td>
            <td>${r.author || 'неизвестно'}</td>
            <td style="font-size: 0.85rem;">${r.time || '—'}</td>
            <td class="status-cell"><span class="report-status ${statusClass}">${status}</span></td>
            <td class="actions">${actionsHtml}</td>
        </tr>`;
    }).join('');
}

function addMLKReport() {
    const tag = document.getElementById("mlk-tag")?.value.trim() || "", action = document.getElementById("mlk-action")?.value.trim() || "";
    const selectedCategory = document.querySelector('.category-card.active'), selectedPriority = document.querySelector('.priority-option.active'), selectedViolatorType = document.querySelector('.tag-option.active');
    const proofLinks = Array.from(document.querySelectorAll('.proof-link')).map(input => input.value.trim()).filter(link => link.length > 0);
    
    if (!tag) { showNotification("Введите идентификатор нарушителя", "error"); return; }
    if (!action) { showNotification("Опишите нарушение", "error"); return; }
    if (action.length < 20) { showNotification("Описание должно содержать минимум 20 символов", "error"); return; }
    
    const report = {
        tag, action, category: selectedCategory ? selectedCategory.dataset.category : "other", categoryName: selectedCategory ? selectedCategory.querySelector('.category-name').textContent : "Другое",
        priority: selectedPriority ? selectedPriority.dataset.priority : "medium", priorityName: selectedPriority ? selectedPriority.querySelector('span').textContent : "СРЕДНИЙ",
        violatorType: selectedViolatorType ? selectedViolatorType.dataset.value : "player", proofLinks, author: CURRENT_USER, authorStaticId: CURRENT_STATIC_ID, role: CURRENT_ROLE,
        time: new Date().toLocaleString(), timestamp: Date.now(), confirmed: false, deleted: false
    };
    
    db.ref('mlk_reports').push(report).then(() => {
        showNotification("✅ Отчет успешно сохранен", "success");
        if (DISCORD_WEBHOOK_URL) sendReportToDiscord(report);
        loadReports(renderMLKScreen);
    }).catch(error => showNotification("Ошибка при сохранении: " + error.message, "error"));
}

function sendReportToDiscord(report) {
    if (!DISCORD_WEBHOOK_URL) return;
    const colorMap = { 'cheat': 0xb43c3c, 'toxic': 0xb43c3c, 'spam': 0xb43c3c, 'bug': 0xc0b070, 'grief': 0xc0b070, 'other': 0x8f9779 };
    const priorityColorMap = { 'low': 0x8cb43c, 'medium': 0xc0b070, 'high': 0xb43c3c };
    const payload = {
        username: DISCORD_WEBHOOK_NAME, avatar_url: DISCORD_WEBHOOK_AVATAR,
        embeds: [{
            title: "📄 НОВЫЙ ОТЧЕТ МЛК", description: `**Нарушитель:** \`${report.tag}\`\n**Категория:** ${report.categoryName}\n**Приоритет:** ${report.priorityName}`,
            color: colorMap[report.category] || 0x8f9779, fields: [
                { name: "📝 Описание", value: report.action.length > 1024 ? report.action.substring(0, 1021) + "..." : report.action },
                { name: "👤 Автор отчета", value: `${report.author} (${report.role})`, inline: true },
                { name: "🕐 Время", value: report.time, inline: true }
            ],
            footer: { text: `Static ID: ${report.authorStaticId} | Система отчетов Зоны` }, timestamp: new Date().toISOString()
        }]
    };
    if (report.proofLinks && report.proofLinks.length > 0) payload.embeds[0].fields.push({ name: "🔗 Доказательства", value: report.proofLinks.map((link, i) => `${i+1}. ${link}`).join('\n') });
    fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(error => console.error('Discord webhook error:', error));
}

/* ===== СТРАНИЦА КОДОВ ДОСТУПА С ПРОКРУТКОЙ ===== */
window.renderPasswords = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>'; return; }
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-key"></i> УПРАВЛЕНИЕ КОДАМИ ДОСТУПА</h2>
            <div class="scrollable-container" style="flex: 1; padding-right: 10px;">
                <div class="zone-card"><div class="card-icon"><i class="fas fa-user-graduate"></i></div><h4 style="color: #c0b070; margin-bottom: 10px;">КОД ДЛЯ МЛАДШИХ КУРАТОРОВ</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">ИСПОЛЬЗУЕТСЯ МЛАДШИМИ КУРАТОРАМИ ДЛЯ ВХОДА</p>
                    <div style="display: flex; gap: 10px;"><input type="password" id="junior-password" class="form-input" value="${passwords.junior || ''}" placeholder="НОВЫЙ КОД" style="flex: 1;">
                    <button onclick="updatePassword('junior')" class="btn-primary" style="padding: 10px 15px;"><i class="fas fa-save"></i> ИЗМЕНИТЬ</button></div></div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-users"></i></div><h4 style="color: #c0b070; margin-bottom: 10px;">КОД ДЛЯ КУРАТОРОВ</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">ИСПОЛЬЗУЕТСЯ КУРАТОРАМИ ДЛЯ ВХОДА В СИСТЕМУ</p>
                    <div style="display: flex; gap: 10px;"><input type="password" id="curator-password" class="form-input" value="${passwords.curator || ''}" placeholder="НОВЫЙ КОД" style="flex: 1;">
                    <button onclick="updatePassword('curator')" class="btn-primary" style="padding: 10px 15px;"><i class="fas fa-save"></i> ИЗМЕНИТЬ</button></div></div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-star"></i></div><h4 style="color: #c0b070; margin-bottom: 10px;">КОД ДЛЯ СТАРШИХ КУРАТОРОВ</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">ИСПОЛЬЗУЕТСЯ СТАРШИМИ КУРАТОРЫМИ ДЛЯ ВХОДА</p>
                    <div style="display: flex; gap: 10px;"><input type="password" id="senior-password" class="form-input" value="${passwords.senior || ''}" placeholder="НОВЫЙ КОД" style="flex: 1;">
                    <button onclick="updatePassword('senior')" class="btn-primary" style="padding: 10px 15px;"><i class="fas fa-save"></i> ИЗМЕНИТЬ</button></div></div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-user-shield"></i></div><h4 style="color: #c0b070; margin-bottom: 10px;">КОД ДЛЯ АДМИНИСТРАТОРОВ</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">ИСПОЛЬЗУЕТСЯ АДМИНИСТРАТОРАМИ ДЛЯ ВХОДА</p>
                    <div style="display: flex; gap: 10px;"><input type="password" id="admin-password" class="form-input" value="${passwords.admin || ''}" placeholder="НОВЫЙ КОД" style="flex: 1;">
                    <button onclick="updatePassword('admin')" class="btn-primary" style="padding: 10px 15px;"><i class="fas fa-save"></i> ИЗМЕНИТЬ</button></div></div>
                <div class="zone-card" style="border-color: #c0b070;"><div class="card-icon" style="color: #c0b070;"><i class="fas fa-shield-alt"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">СИСТЕМНЫЙ КОД</h4>
                    <p style="color: #8f9779; margin-bottom: 10px; font-size: 0.9rem;">ДЛЯ СИСТЕМНЫХ ОПЕРАЦИЙ И ЗАЩИЩЕННЫХ ПОЛЬЗОВАТЕЛЕЙ</p>
                    <div style="display: flex; gap: 10px;"><input type="password" id="special-password" class="form-input" value="${passwords.special || ''}" placeholder="НОВЫЙ КОД" style="flex: 1; border-color: #c0b070;">
                    <button onclick="updatePassword('special')" class="btn-primary" style="border-color: #c0b070; padding: 10px 15px;"><i class="fas fa-save"></i> ИЗМЕНИТЬ</button></div></div>
            </div>
        </div>`;
    setTimeout(adjustInterfaceHeights, 100);
}

window.resetAllPasswords = async function() {
    if (CURRENT_RANK !== CREATOR_RANK) { showNotification("Только создатель может сбрасывать все пароли", "error"); return; }
    if (!confirm("ВНИМАНИЕ! Это сбросит ВСЕ пароли в системе. Продолжить?")) return;
    try {
        await createOrUpdatePasswords();
        showNotification("Все пароли сброшены на значения по умолчанию", "success");
        await new Promise(resolve => loadData(resolve));
        if (window.renderPasswords) renderPasswords();
    } catch (error) { showNotification("Ошибка сброса паролей: " + error.message, "error"); }
}

window.updatePassword = function(type) {
    const inputId = type + "-password", input = document.getElementById(inputId), newPassword = input ? input.value.trim() : "";
    if (!newPassword) { showNotification("Введите новый код", "error"); return; }
    let confirmMessage = `Изменить код доступа?\nНовый код: ${'*'.repeat(newPassword.length)}`;
    if (!confirm(confirmMessage)) return;
    changePassword(type, newPassword).then(success => { if (success) renderPasswords(); });
}

/* ===== СПИСОК ДОСТУПА С ПАГИНАЦИЕЙ ===== */
window.renderWhitelistWithPagination = function(page = 1) {
    const content = document.getElementById("content-body");
    if (!content) return;
    currentPage = page;
    const itemsPerPage = PAGINATION_CONFIG.itemsPerPage, startIndex = (page - 1) * itemsPerPage, endIndex = startIndex + itemsPerPage;
    const paginatedWhitelist = whitelist.slice(startIndex, endIndex);
    totalPages = Math.ceil(whitelist.length / itemsPerPage);
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #c0b070; margin-bottom: 20px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-users"></i> СПИСОК ДОСТУПА</h2>
            <p style="color: #8f9779; margin-bottom: 20px; line-height: 1.6;">ТОЛЬКО ПОЛЬЗОВАТЕЛИ ИЗ ЭТОГО СПИСКА МОГУТ ВХОДИТЬ КАК АДМИНИСТРАТОРЫ И СТАРШИЕ КУРАТОРЫ</p>
            <div class="zone-card" style="margin-bottom: 20px; padding: 20px;"><div class="card-icon"><i class="fas fa-user-plus"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 15px;">ДОБАВИТЬ В СПИСОК ДОСТУПА</h4>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="new-whitelist-user" class="form-input" placeholder="ВВЕДИТЕ ПСЕВДОНИМ" style="flex: 1; min-width: 200px;">
                    <button onclick="addToWhitelist()" class="btn-primary" style="min-width: 120px;"><i class="fas fa-plus"></i> ДОБАВИТЬ</button></div></div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h4 style="color: #c0b070; margin: 0;">ТЕКУЩИЙ СПИСОК (${whitelist.length})</h4>
                <div class="items-per-page-selector"><span>На странице:</span><select onchange="changeItemsPerPage('renderWhitelistWithPagination', this.value)"><option value="5">5</option><option value="10">10</option><option value="15" selected>15</option><option value="20">20</option></select></div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div class="table-container scrollable-container" style="flex: 1;">
                    ${whitelist.length === 0 ? `<div style="text-align: center; padding: 40px; color: rgba(140, 180, 60, 0.5); flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;"><i class="fas fa-user-slash" style="font-size: 3rem; margin-bottom: 15px;"></i><h4 style="color: #8f9779;">СПИСОК ПУСТ</h4><p style="color: #8f9779;">ДОБАВЬТЕ ПЕРВОГО ПОЛЬЗОВАТЕЛЯ</p></div>` : 
                    `<table class="data-table" style="min-width: 100%;"><thead style="position: sticky; top: 0; background: #1e201c;">
                        <tr><th style="min-width: 150px;">ПСЕВДОНИМ</th><th style="min-width: 120px;">STATIC ID</th><th style="min-width: 120px;">ДОБАВИЛ</th><th style="min-width: 150px;">ДАТА ДОБАВЛЕНИЯ</th><th style="min-width: 100px;">СТАТУС</th><th style="min-width: 100px;">ДЕЙСТВИЯ</th></tr></thead><tbody id="whitelist-table-body"></tbody></table>`}
                </div><div id="whitelist-pagination-container"></div></div></div>`;
    
    if (whitelist.length > 0) {
        renderWhitelistTablePaginated(paginatedWhitelist);
        if (totalPages > 1) renderPagination('whitelist-pagination-container', currentPage, totalPages, 'renderWhitelistWithPagination');
    }
    setTimeout(adjustInterfaceHeights, 100);
}

function renderWhitelistTablePaginated(paginatedWhitelist) {
    const tableBody = document.getElementById("whitelist-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = paginatedWhitelist.map(user => {
        const isProtected = PROTECTED_USERS.some(protectedUser => protectedUser.toLowerCase() === user.username.toLowerCase());
        return `<tr>
            <td style="font-weight: 500; color: ${isProtected ? '#c0b070' : '#8cb43c'}"><i class="fas ${isProtected ? 'fa-shield-alt' : 'fa-user'}"></i>${user.username}</td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.85rem; color: #8f9779;">${user.staticId || "—"}</td>
            <td>${user.addedBy || "СИСТЕМА"}</td>
            <td>${user.addedDate || "НЕИЗВЕСТНО"}</td>
            <td><span class="report-status ${isProtected ? 'status-confirmed' : 'status-pending'}" style="display: inline-flex; padding: 4px 10px; font-size: 0.8rem;"><i class="fas ${isProtected ? 'fa-shield-alt' : 'fa-user'}"></i>${isProtected ? 'ЗАЩИЩЕННЫЙ' : 'ОБЫЧНЫЙ'}</span></td>
            <td>${isProtected ? `<span style="color: #8f9779; font-size: 0.85rem;">НЕЛЬЗЯ УДАЛИТЬ</span>` : `<button onclick="removeFromWhitelist('${user.id}')" class="action-btn delete" style="font-size: 0.85rem; padding: 3px 8px;"><i class="fas fa-trash"></i> УДАЛИТЬ</button>`}</td>
        </tr>`;
    }).join('');
}

window.addToWhitelist = function() {
    const input = document.getElementById("new-whitelist-user"), username = input ? input.value.trim() : "";
    if (!username) { showNotification("Введите псевдоним", "error"); return; }
    if (PROTECTED_USERS.some(protectedUser => protectedUser.toLowerCase() === username.toLowerCase())) { showNotification("Этот пользователь уже в системе", "warning"); return; }
    if (whitelist.some(user => user.username.toLowerCase() === username.toLowerCase())) { showNotification("Пользователь уже в списке доступа", "warning"); return; }
    const staticId = generateStaticId(username);
    db.ref('mlk_whitelist').push({ username, staticId, addedBy: CURRENT_USER, addedDate: new Date().toLocaleString(), isProtected: false }).then(() => {
        loadData(() => { renderWhitelistWithPagination(1); showNotification(`Пользователь "${username}" добавлен в список доступа`, "success"); if (input) input.value = ""; });
    }).catch(error => showNotification("Ошибка: " + error.message, "error"));
}

window.removeFromWhitelist = function(id) {
    const userToRemove = whitelist.find(user => user.id === id);
    if (!userToRemove) return;
    if (userToRemove.isProtected) { showNotification("Нельзя удалить защищенного пользователя", "error"); return; }
    if (!confirm(`Удалить пользователя "${userToRemove.username}" из списка доступа?`)) return;
    db.ref('mlk_whitelist/' + id).remove().then(() => {
        loadData(() => { renderWhitelistWithPagination(1); showNotification("Пользователь удален из списка доступа", "success"); });
    }).catch(error => showNotification("Ошибка: " + error.message, "error"));
}

/* ===== ПОЛЬЗОВАТЕЛИ С ПАГИНАЦИЕЙ ===== */
window.renderUsersWithPagination = function(page = 1) {
    const content = document.getElementById("content-body");
    if (!content) return;
    currentPage = page;
    const itemsPerPage = PAGINATION_CONFIG.itemsPerPage, startIndex = (page - 1) * itemsPerPage, endIndex = startIndex + itemsPerPage;
    const paginatedUsers = users.slice(startIndex, endIndex);
    totalPages = Math.ceil(users.length / itemsPerPage);
    const adminUsers = users.filter(u => u.role === RANKS.ADMIN.name).length, seniorCurators = users.filter(u => u.role === RANKS.SENIOR_CURATOR.name).length, curators = users.filter(u => u.role === RANKS.CURATOR.name).length, juniorCurators = users.filter(u => u.role === RANKS.JUNIOR_CURATOR.name).length;
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-user-friends"></i> РЕГИСТРИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ</h2>
            <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="zone-card"><div class="card-icon"><i class="fas fa-users"></i></div><div class="card-value">${users.length}</div><div class="card-label">ВСЕГО</div></div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-user-shield"></i></div><div class="card-value">${adminUsers}</div><div class="card-label">АДМИНЫ</div></div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-star"></i></div><div class="card-value">${seniorCurators}</div><div class="card-label">СТ.КУРАТОРЫ</div></div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-user"></i></div><div class="card-value">${curators}</div><div class="card-label">КУРАТОРЫ</div></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h4 style="color: #c0b070; margin: 0;">СПИСОК ПОЛЬЗОВАТЕЛЕЙ (${users.length})</h4>
                <div class="items-per-page-selector"><span>На странице:</span><select onchange="changeItemsPerPage('renderUsersWithPagination', this.value)"><option value="5">5</option><option value="10">10</option><option value="15" selected>15</option><option value="20">20</option><option value="30">30</option></select></div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div class="table-container scrollable-container" style="flex: 1;">
                    ${users.length === 0 ? `<div style="text-align: center; padding: 40px; color: #8f9779;"><i class="fas fa-user-friends" style="font-size: 2rem; margin-bottom: 10px;"></i><p>ПОЛЬЗОВАТЕЛИ ПОЯВЯТСЯ ПОСЛЕ РЕГИСТРАЦИИ</p></div>` : 
                    `<table class="data-table" style="min-width: 100%;"><thead><tr><th>ПСЕВДОНИМ</th><th>STATIC ID</th><th>РАНГ</th><th>РЕГИСТРАЦИЯ</th><th>ПОСЛЕДНИЙ ВХОД</th><th>СТАТУС</th><th>ДЕЙСТВИЯ</th></tr></thead><tbody id="users-table-body"></tbody></table>`}
                </div><div id="users-pagination-container"></div></div></div>`;
    
    if (users.length > 0) {
        renderUsersTablePaginated(paginatedUsers);
        if (totalPages > 1) renderPagination('users-pagination-container', currentPage, totalPages, 'renderUsersWithPagination');
    }
    setTimeout(adjustInterfaceHeights, 100);
}

function renderUsersTablePaginated(paginatedUsers) {
    const tableBody = document.getElementById("users-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = paginatedUsers.map(user => {
        const isProtected = PROTECTED_USERS.some(protectedUser => protectedUser.toLowerCase() === user.username.toLowerCase());
        const isCurrentUser = user.username === CURRENT_USER;
        const isBanned = bans.some(ban => ban.staticId === user.staticId && !ban.unbanned);
        let rankBadge = '', rankClass = '';
        if (user.role === RANKS.ADMIN.name) { rankBadge = 'АДМИНИСТРАТОР'; rankClass = 'status-confirmed'; }
        else if (user.role === RANKS.SENIOR_CURATOR.name) { rankBadge = 'СТАРШИЙ КУРАТОР'; rankClass = 'status-pending'; }
        else if (user.role === RANKS.CURATOR.name) { rankBadge = 'КУРАТОР'; rankClass = ''; }
        else { rankBadge = 'МЛАДШИЙ КУРАТОР'; rankClass = ''; }
        return `<tr>
            <td style="font-weight: 500; color: ${isProtected ? '#c0b070' : isCurrentUser ? '#8cb43c' : isBanned ? '#b43c3c' : '#8f9779'}">
                <i class="fas ${isProtected ? 'fa-shield-alt' : 'fa-user'}"></i>${user.username}${isCurrentUser ? ' <span style="color: #8cb43c; font-size: 0.8rem;">(ВЫ)</span>' : ''}${isBanned ? ' <span style="color: #b43c3c; font-size: 0.8rem;">(ЗАБАНЕН)</span>' : ''}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">${user.staticId || "N/A"}</td>
            <td><span class="report-status ${rankClass}" style="${!rankClass ? 'background: rgba(100, 100, 100, 0.1); color: #8f9779; border-color: rgba(100, 100, 100, 0.3);' : ''}">${rankBadge}</span></td>
            <td>${user.registrationDate || "НЕИЗВЕСТНО"}</td>
            <td>${user.lastLogin || "НИКОГДА"}</td>
            <td>${isBanned ? '<span class="report-status status-deleted"><i class="fas fa-ban"></i> ЗАБАНЕН</span>' : '<span class="report-status status-confirmed"><i class="fas fa-check"></i> АКТИВЕН</span>'}</td>
            <td><div class="action-buttons" style="display: flex; gap: 5px; flex-wrap: wrap;">
                ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.ADMIN.level && user.role !== RANKS.ADMIN.name ? `<button onclick="promoteToAdminByStaticId('${user.staticId}')" class="action-btn" style="background: #c0b070; border-color: #c0b070; color: #1e201c; padding: 3px 8px; font-size: 0.8rem;"><i class="fas fa-user-shield"></i> АДМ</button>` : ''}
                ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.SENIOR_CURATOR.name ? `<button onclick="promoteToSeniorByStaticId('${user.staticId}')" class="action-btn" style="background: #8cb43c; border-color: #8cb43c; color: #1e201c; padding: 3px 8px; font-size: 0.8rem;"><i class="fas fa-star"></i> СТ.КУР</button>` : ''}
                ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.CURATOR.name ? `<button onclick="setToCuratorByStaticId('${user.staticId}')" class="action-btn" style="background: #5865F2; border-color: #5865F2; color: #1e201c; padding: 3px 8px; font-size: 0.8rem;"><i class="fas fa-user"></i> КУР</button>` : ''}
            </div></td>
        </tr>`;
    }).join('');
}

/* ===== СТРАНИЦА СИСТЕМЫ С ПРОКРУТКОЙ ===== */
window.renderSystem = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    const pendingReports = reports.filter(r => !r.confirmed && !r.deleted).length, confirmedReports = reports.filter(r => r.confirmed).length, deletedReports = reports.filter(r => r.deleted).length;
    const adminUsers = users.filter(u => u.role === RANKS.ADMIN.name).length, seniorCurators = users.filter(u => u.role === RANKS.SENIOR_CURATOR.name).length, curators = users.filter(u => u.role === RANKS.CURATOR.name).length, juniorCurators = users.filter(u => u.role === RANKS.JUNIOR_CURATOR.name).length;
    const activeBans = bans.filter(ban => !ban.unbanned).length;
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-cogs"></i> СИСТЕМА ЗОНЫ</h2>
            <div class="scrollable-container" style="flex: 1; padding-right: 10px;">
                <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-database"></i></div><div class="card-value">${reports.length}</div><div class="card-label">ВСЕГО ОТЧЕТОВ</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-users"></i></div><div class="card-value">${users.length}</div><div class="card-label">ПОЛЬЗОВАТЕЛЕЙ</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-user-shield"></i></div><div class="card-value">${whitelist.length}</div><div class="card-label">В СПИСКЕ ДОСТУПА</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-ban"></i></div><div class="card-value">${activeBans}</div><div class="card-label">АКТИВНЫХ БАНОВ</div></div>
                </div>
                <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-clock"></i></div><div class="card-value">${pendingReports}</div><div class="card-label">НА РАССМОТРЕНИИ</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-check"></i></div><div class="card-value">${confirmedReports}</div><div class="card-label">ПОДТВЕРЖДЕНО</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-trash"></i></div><div class="card-value">${deletedReports}</div><div class="card-label">УДАЛЕНО</div></div>
                </div>
                <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-user-shield"></i></div><div class="card-value">${adminUsers}</div><div class="card-label">АДМИНИСТРАТОРЫ</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-star"></i></div><div class="card-value">${seniorCurators}</div><div class="card-label">СТАРШИЕ КУРАТОРЫ</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-user"></i></div><div class="card-value">${curators}</div><div class="card-label">КУРАТОРЫ</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-user-graduate"></i></div><div class="card-value">${juniorCurators}</div><div class="card-label">МЛАДШИЕ КУРАТОРЫ</div></div>
                </div>
            </div>
        </div>`;
    setTimeout(adjustInterfaceHeights, 100);
}

/* ===== IP МОНИТОРИНГ С ПАГИНАЦИЕЙ ===== */
window.renderIPStats = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>'; return; }
    db.ref('mlk_ip_tracking').once('value').then(snapshot => {
        const ipData = snapshot.val() || {}, ipList = Object.keys(ipData).map(key => ({ ...ipData[key], id: key }));
        const currentPage = 1, itemsPerPage = PAGINATION_CONFIG.itemsPerPage, startIndex = (currentPage - 1) * itemsPerPage, endIndex = startIndex + itemsPerPage;
        const paginatedIPList = ipList.slice(startIndex, endIndex), totalPages = Math.ceil(ipList.length / itemsPerPage);
        
        content.innerHTML = `
            <div class="form-container with-scroll">
                <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-network-wired"></i> МОНИТОРИНГ IP АДРЕСОВ</h2>
                <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-desktop"></i></div><div class="card-value">${ipList.length}</div><div class="card-label">УНИКАЛЬНЫХ IP</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-users"></i></div><div class="card-value">${users.length}</div><div class="card-label">АКТИВНЫХ ПОЛЬЗОВАТЕЛЕЙ</div></div>
                    <div class="zone-card"><div class="card-icon"><i class="fas fa-shield-alt"></i></div><div class="card-value">${PROTECTED_USERS.length}</div><div class="card-label">ЗАЩИЩЕННЫХ ПОЛЬЗОВАТ.</div></div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                    <h4 style="color: #c0b070; margin: 0;">ИСТОРИЯ IP АДРЕСОВ (${ipList.length})</h4>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;"><button onclick="exportIPData()" class="btn-primary" style="padding: 8px 15px;"><i class="fas fa-download"></i> ЭКСПОРТ</button>
                    <div class="items-per-page-selector"><span>На странице:</span><select onchange="changeIPItemsPerPage(this.value)"><option value="10">10</option><option value="15" selected>15</option><option value="20">20</option><option value="30">30</option></select></div></div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div class="table-container scrollable-container" style="flex: 1;">
                        ${ipList.length === 0 ? `<div style="text-align: center; padding: 40px; color: #8f9779;"><i class="fas fa-database" style="font-size: 2rem; margin-bottom: 10px;"></i><p>IP АДРЕСА ЕЩЕ НЕ ЗАРЕГИСТРИРОВАНЫ</p></div>` : 
                        `<table class="data-table" style="min-width: 100%;"><thead><tr><th>IP АДРЕС</th><th>ПОЛЬЗОВАТЕЛЬ</th><th>STATIC ID</th><th>РЕГИСТРАЦИЯ</th><th>ПОСЛЕДНЯЯ АКТИВНОСТЬ</th></tr></thead><tbody id="ip-table-body"></tbody></table>`}
                    </div><div id="ip-pagination-container"></div></div></div>`;
        
        if (ipList.length > 0) { renderIPTablePaginated(paginatedIPList); if (totalPages > 1) renderPagination('ip-pagination-container', currentPage, totalPages, 'renderIPStatsWithPagination'); }
        setTimeout(adjustInterfaceHeights, 100);
    });
}

function renderIPStatsWithPagination(page = 1) {
    db.ref('mlk_ip_tracking').once('value').then(snapshot => {
        const ipData = snapshot.val() || {}, ipList = Object.keys(ipData).map(key => ({ ...ipData[key], id: key }));
        const itemsPerPage = PAGINATION_CONFIG.itemsPerPage, startIndex = (page - 1) * itemsPerPage, endIndex = startIndex + itemsPerPage;
        const paginatedIPList = ipList.slice(startIndex, endIndex), totalPages = Math.ceil(ipList.length / itemsPerPage);
        renderIPTablePaginated(paginatedIPList);
        const paginationContainer = document.getElementById('ip-pagination-container');
        if (paginationContainer && totalPages > 1) renderPagination('ip-pagination-container', page, totalPages, 'renderIPStatsWithPagination');
    });
}

function changeIPItemsPerPage(value) { PAGINATION_CONFIG.itemsPerPage = parseInt(value); renderIPStatsWithPagination(1); }

function renderIPTablePaginated(ipList) {
    const tableBody = document.getElementById("ip-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = ipList.map(record => {
        const isCurrentUser = record.username === CURRENT_USER;
        return `<tr>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: ${isCurrentUser ? '#8cb43c' : '#8f9779'}"><i class="fas fa-desktop" style="margin-right: 5px;"></i>${record.ip}</td>
            <td style="color: ${isCurrentUser ? '#8cb43c' : '#c0b070'}; font-weight: ${isCurrentUser ? 'bold' : 'normal'}">${record.username}${isCurrentUser ? ' <span style="color: #8cb43c; font-size: 0.8rem;">(ВЫ)</span>' : ''}</td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">${record.staticId || "—"}</td>
            <td style="font-size: 0.85rem;">${record.registrationDate || "—"}</td>
            <td style="font-size: 0.85rem;">${record.lastActive || "—"}</td>
        </tr>`;
    }).join('');
}

window.banIP = async function(ip) {
    if (!confirm(`Заблокировать IP адрес ${ip}?\nВсе пользователи с этого IP не смогут зайти в систему.`)) return;
    const banData = { ip, bannedBy: CURRENT_USER, bannedDate: new Date().toLocaleString(), reason: "Блокировка IP по решению администратора", unbanned: false };
    db.ref('mlk_ip_bans').push(banData).then(() => {
        showNotification(`IP адрес ${ip} заблокирован`, "success");
        loginAttempts[ip] = { attempts: MAX_ATTEMPTS, lockedUntil: Date.now() + (30 * 24 * 60 * 60 * 1000), lastAttempt: Date.now() };
        renderIPStats();
    }).catch(error => showNotification("Ошибка блокировки IP: " + error.message, "error"));
}

window.unbanIP = async function(ip) {
    db.ref('mlk_ip_bans').once('value').then(snapshot => {
        const ipBansData = snapshot.val() || {};
        let activeBanKey = null;
        for (const key in ipBansData) if (ipBansData[key].ip === ip && !ipBansData[key].unbanned) { activeBanKey = key; break; }
        if (!activeBanKey) { showNotification("Активный бан для этого IP не найден", "error"); return; }
        if (!confirm(`Разблокировать IP адрес ${ip}?`)) return;
        db.ref('mlk_ip_bans/' + activeBanKey).update({ unbanned: true, unbannedBy: CURRENT_USER, unbannedDate: new Date().toLocaleString(), unbannedReason: "Разблокировка администратором" }).then(() => {
            showNotification(`IP адрес ${ip} разблокирован`, "success");
            if (loginAttempts[ip]) delete loginAttempts[ip];
            renderIPStats();
        }).catch(error => showNotification("Ошибка разблокировки IP: " + error.message, "error"));
    });
}

async function checkIPBan(ip) {
    try {
        const ipBansSnapshot = await db.ref('mlk_ip_bans').once('value'), ipBansData = ipBansSnapshot.val() || {};
        for (const key in ipBansData) {
            const ban = ipBansData[key];
            if (ban.ip === ip && !ban.unbanned) return { banned: true, reason: ban.reason, bannedBy: ban.bannedBy, bannedDate: ban.bannedDate };
        }
        return { banned: false };
    } catch (error) { return { banned: false }; }
}

/* ===== DISCORD ВЕБХУКИ С ПРОКРУТКОЙ ===== */
function renderWebhookManager() {
    const content = document.getElementById("content-body");
    if (!content) return;
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>'; return; }
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;"><i class="fas fa-broadcast-tower"></i> DISCORD ВЕБХУКИ</h2>
            <div class="scrollable-container" style="flex: 1; padding-right: 10px;">
                <div class="zone-card" style="border-color: #5865F2; margin-bottom: 20px;">
                    <div class="card-icon" style="color: #5865F2;"><i class="fab fa-discord"></i></div>
                    <h4 style="color: #5865F2; margin-bottom: 10px;">НАСТРОЙКА ВЕБХУКА</h4>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div><label class="form-label">URL ВЕБХУКА DISCORD</label><input type="text" id="webhook-url" class="form-input" placeholder="https://discord.com/api/webhooks/..." value="${DISCORD_WEBHOOK_URL || ''}"></div>
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px;"><label class="form-label">ИМЯ ОТПРАВИТЕЛЯ</label><input type="text" id="webhook-name" class="form-input" placeholder="Имя бота" value="${DISCORD_WEBHOOK_NAME}"></div>
                            <div style="flex: 1; min-width: 200px;"><label class="form-label">URL АВАТАРКИ</label><input type="text" id="webhook-avatar" class="form-input" placeholder="https://example.com/avatar.png" value="${DISCORD_WEBHOOK_AVATAR}"></div>
                        </div>
                        <div style="display: flex; gap: 15px; align-items: center; padding: 15px; background: rgba(40, 42, 36, 0.5); border-radius: 4px;">
                            <img id="avatar-preview" src="${DISCORD_WEBHOOK_AVATAR}" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid #5865F2;" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                            <div><div style="color: #c0b070; font-weight: 500;">${DISCORD_WEBHOOK_NAME}</div><div style="color: #8f9779; font-size: 0.9rem;">Превью отправителя</div></div>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button onclick="saveWebhook()" class="btn-primary" style="border-color: #8cb43c; padding: 10px 15px;"><i class="fas fa-save"></i> СОХРАНИТЬ</button>
                            <button onclick="testWebhook()" class="btn-primary" style="border-color: #5865F2; padding: 10px 15px;"><i class="fas fa-broadcast-tower"></i> ТЕСТ</button>
                            <button onclick="clearWebhook()" class="btn-secondary" style="padding: 10px 15px;"><i class="fas fa-trash"></i> ОЧИСТИТЬ</button>
                        </div>
                    </div>
                </div>
                <div class="zone-card" style="margin-bottom: 20px;">
                    <div class="card-icon"><i class="fas fa-paper-plane"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">ОТПРАВКА СООБЩЕНИЙ</h4>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div><label class="form-label">ТЕКСТ СООБЩЕНИЯ</label><textarea id="message-text" class="form-textarea" rows="4" placeholder="Введите текст сообщения..."></textarea></div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button onclick="sendSimpleMessage()" class="btn-primary" style="border-color: #5865F2; padding: 10px 20px;"><i class="fas fa-paper-plane"></i> ОТПРАВИТЬ ТЕКСТ</button>
                            <button onclick="sendEmbedMessage()" class="btn-primary" style="border-color: #c0b070; padding: 10px 20px;"><i class="fas fa-code"></i> ОТПРАВИТЬ ВСТАВКУ</button>
                        </div>
                    </div>
                </div>
                <div class="zone-card"><div class="card-icon"><i class="fas fa-history"></i></div><h4 style="color: #c0b070; margin-bottom: 10px;">ИСТОРИЯ ОТПРАВКИ</h4>
                    <div id="webhook-history" class="scrollable-container" style="min-height: 100px; max-height: 200px; background: rgba(20, 18, 15, 0.5); border-radius: 4px; padding: 10px;"></div>
                </div>
            </div>
        </div>`;
    
    const avatarInput = document.getElementById('webhook-avatar'), avatarPreview = document.getElementById('avatar-preview');
    if (avatarInput && avatarPreview) avatarInput.addEventListener('input', function() { avatarPreview.src = this.value || 'https://cdn.discordapp.com/embed/avatars/0.png'; });
    renderWebhookHistory();
    setTimeout(adjustInterfaceHeights, 100);
}

window.sendSimpleMessage = function() {
    if (!DISCORD_WEBHOOK_URL) { showNotification('Сначала настройте вебхук', 'error'); return; }
    const messageInput = document.getElementById('message-text'), message = messageInput ? messageInput.value.trim() : '';
    if (!message) { showNotification('Введите текст сообщения', 'error'); return; }
    const payload = { username: DISCORD_WEBHOOK_NAME, avatar_url: DISCORD_WEBHOOK_AVATAR, content: message };
    sendDiscordWebhook(DISCORD_WEBHOOK_URL, payload, false);
    if (messageInput) messageInput.value = '';
}

window.sendEmbedMessage = function() {
    if (!DISCORD_WEBHOOK_URL) { showNotification('Сначала настройте вебхук', 'error'); return; }
    const messageInput = document.getElementById('message-text'), message = messageInput ? messageInput.value.trim() : '';
    const colorInput = document.createElement('input'); colorInput.value = '#5865F2'; const color = colorInput.value.trim();
    if (!message) { showNotification('Введите текст сообщения', 'error'); return; }
    const payload = {
        username: DISCORD_WEBHOOK_NAME, avatar_url: DISCORD_WEBHOOK_AVATAR,
        embeds: [{
            title: "📢 СООБЩЕНИЕ ИЗ СИСТЕМЫ", description: message, color: hexToDecimal(color) || 5793266, timestamp: new Date().toISOString(),
            footer: { text: `Отправлено через систему отчетов Зоны | Пользователь: ${CURRENT_USER}` }
        }]
    };
    sendDiscordWebhook(DISCORD_WEBHOOK_URL, payload, false);
    if (messageInput) messageInput.value = '';
}

function hexToDecimal(hex) { if (!hex) return null; hex = hex.replace('#', ''); return parseInt(hex, 16); }

function sendDiscordWebhook(url, payload, isTest = false) {
    if (!url) { showNotification('URL вебхука не настроен', 'error'); return; }
    showNotification(isTest ? 'Отправка тестового сообщения...' : 'Отправка сообщения в Discord...', 'info');
    if (!payload.username) payload.username = DISCORD_WEBHOOK_NAME;
    if (!payload.avatar_url) payload.avatar_url = DISCORD_WEBHOOK_AVATAR;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(response => {
        if (response.ok) {
            const message = isTest ? '✅ Тест вебхука выполнен успешно!' : '✅ Сообщение отправлено в Discord!';
            showNotification(message, 'success');
            addWebhookHistory(isTest ? 'Тест вебхука' : 'Отправлено сообщение', 'success');
            const historyEntry = { type: isTest ? 'test' : 'message', timestamp: new Date().toLocaleString(), user: CURRENT_USER, payload: payload };
            webhooks.unshift(historyEntry); if (webhooks.length > 50) webhooks = webhooks.slice(0, 50);
            renderWebhookHistory();
            db.ref('mlk_webhooks').push(historyEntry);
        } else return response.text().then(text => { throw new Error(`HTTP ${response.status}: ${text}`); });
    }).catch(error => { showNotification(`❌ Ошибка отправки: ${error.message}`, 'error'); addWebhookHistory('Ошибка отправки', 'error'); });
}

function addWebhookHistory(message, type) {
    const historyDiv = document.getElementById('webhook-history');
    if (!historyDiv) return;
    const entry = document.createElement('div');
    entry.style.cssText = `padding: 8px 10px; margin-bottom: 5px; border-left: 3px solid ${type === 'success' ? '#8cb43c' : type === 'error' ? '#b43c3c' : '#c0b070'}; background: rgba(40, 42, 36, 0.3); font-size: 0.8rem; color: #8f9779;`;
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    entry.innerHTML = `<div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span style="color: ${type === 'success' ? '#8cb43c' : type === 'error' ? '#b43c3c' : '#c0b070'}"><i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}"></i>${message}</span><span style="color: #6a6a5a;">${time}</span></div>`;
    historyDiv.insertBefore(entry, historyDiv.firstChild);
    if (historyDiv.children.length > 10) historyDiv.removeChild(historyDiv.lastChild);
}

function renderWebhookHistory() {
    const historyDiv = document.getElementById("webhook-history");
    if (!historyDiv) return;
    if (webhooks.length === 0) { historyDiv.innerHTML = '<div style="color: #6a6a5a; text-align: center; padding: 20px; font-style: italic;">Нет отправленных сообщений</div>'; return; }
    historyDiv.innerHTML = '';
    webhooks.slice(0, 10).forEach(entry => {
        const div = document.createElement('div');
        div.style.cssText = `padding: 10px 12px; margin-bottom: 8px; background: rgba(30, 32, 28, 0.7); border: 1px solid rgba(42, 40, 31, 0.3); border-radius: 4px; font-size: 0.8rem; color: #8f9779;`;
        const time = new Date(entry.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = new Date(entry.timestamp).toLocaleDateString('ru-RU');
        div.innerHTML = `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span style="color: ${entry.type === 'test' ? '#5865F2' : '#8cb43c'}"><i class="fas fa-${entry.type === 'test' ? 'broadcast-tower' : 'paper-plane'}"></i>${entry.type === 'test' ? 'Тестирование' : 'Сообщение'}</span><span style="color: #6a6a5a; font-size: 0.75rem;">${time}</span></div>
            <div style="color: #c0b070; font-size: 0.75rem; margin-bottom: 3px;"><i class="fas fa-user"></i> ${entry.user || 'Система'}</div><div style="color: #6a6a5a; font-size: 0.7rem;">${date}</div>`;
        historyDiv.appendChild(div);
    });
}

window.testWebhook = function() {
    const urlInput = document.getElementById('webhook-url'), url = urlInput ? urlInput.value.trim() : '';
    if (!url) { showNotification('Сначала настройте вебхук', 'error'); return; }
    const testPayload = {
        username: DISCORD_WEBHOOK_NAME, avatar_url: DISCORD_WEBHOOK_AVATAR,
        embeds: [{
            title: "✅ ТЕСТ ВЕБХУКА",
            description: `Вебхук успешно настроен!\n\n**Система:** Отчеты Зоны\n**Пользователь:** ${CURRENT_USER}\n**Ранг:** ${CURRENT_RANK.name}\n**Время:** ${new Date().toLocaleString()}`,
            color: 5793266, timestamp: new Date().toISOString(), footer: { text: "Система вебхуков | Версия 1.5" }
        }]
    };
    sendDiscordWebhook(url, testPayload, true);
}

window.saveWebhook = function() {
    const urlInput = document.getElementById('webhook-url'), nameInput = document.getElementById('webhook-name'), avatarInput = document.getElementById('webhook-avatar');
    const url = urlInput ? urlInput.value.trim() : '', name = nameInput ? nameInput.value.trim() : '', avatar = avatarInput ? avatarInput.value.trim() : '';
    if (!url) { showNotification('Введите URL вебхука', 'error'); return; }
    if (!url.startsWith('https://discord.com/api/webhooks/')) { showNotification('Некорректный URL вебхука Discord', 'error'); return; }
    if (!name) { showNotification('Введите имя вебхука', 'error'); return; }
    DISCORD_WEBHOOK_URL = url, DISCORD_WEBHOOK_NAME = name, DISCORD_WEBHOOK_AVATAR = avatar || "https://i.imgur.com/6B7zHqj.png";
    const updates = { 'mlk_settings/webhook_url': url, 'mlk_settings/webhook_name': name, 'mlk_settings/webhook_avatar': avatar || "https://i.imgur.com/6B7zHqj.png" };
    db.ref().update(updates).then(() => {
        showNotification('Настройки вебхука сохранены', 'success');
        addWebhookHistory('Сохранены настройки вебхука', 'success');
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) avatarPreview.src = DISCORD_WEBHOOK_AVATAR;
    }).catch(error => showNotification('Ошибка сохранения: ' + error.message, 'error'));
}

window.clearWebhook = function() {
    if (confirm('Очистить все настройки вебхука?')) {
        DISCORD_WEBHOOK_URL = null, DISCORD_WEBHOOK_NAME = "Система отчетов Зоны", DISCORD_WEBHOOK_AVATAR = "https://i.imgur.com/6B7zHqj.png";
        const urlInput = document.getElementById('webhook-url'), nameInput = document.getElementById('webhook-name'), avatarInput = document.getElementById('webhook-avatar');
        const avatarPreview = document.getElementById('avatar-preview');
        if (urlInput) urlInput.value = ''; if (nameInput) nameInput.value = 'Система отчетов Зоны'; if (avatarInput) avatarInput.value = 'https://i.imgur.com/6B7zHqj.png';
        if (avatarPreview) avatarPreview.src = 'https://i.imgur.com/6B7zHqj.png';
        const updates = { 'mlk_settings/webhook_url': null, 'mlk_settings/webhook_name': null, 'mlk_settings/webhook_avatar': null };
        db.ref().update(updates).then(() => { showNotification('Настройки вебхука очищены', 'success'); addWebhookHistory('Настройки вебхука очищены', 'info'); });
    }
}

window.clearWebhookHistory = function() {
    if (!confirm("Очистить историю вебхуков? Это действие нельзя отменить.")) return;
    db.ref('mlk_webhooks').remove().then(() => { webhooks = []; renderWebhookHistory(); showNotification("История вебхуков очищена", "success"); }).catch(error => showNotification("Ошибка очистки: " + error.message, "error"));
}

/* ===== ВАЛИДАЦИЯ В РЕАЛЬНОМ ВРЕМЕНИ ===== */
document.addEventListener('DOMContentLoaded', function() {
    const usernameInput = document.getElementById('username'), passwordInput = document.getElementById('password');
    if (usernameInput) {
        usernameInput.addEventListener('input', function() { const validation = validateUsername(this.value); updateInputValidation(this, validation); });
        usernameInput.addEventListener('blur', function() { if (this.value.trim()) { const validation = validateUsername(this.value); updateInputValidation(this, validation); } });
    }
    if (passwordInput) passwordInput.addEventListener('input', function() { const validation = validatePassword(this.value); updateInputValidation(this, validation); });
});

function updateInputValidation(input, validation) {
    const wrapper = input.closest('.input-wrapper');
    if (!wrapper) return;
    const oldError = wrapper.querySelector('.validation-error'), oldSuccess = wrapper.querySelector('.validation-success');
    if (oldError) oldError.remove(); if (oldSuccess) oldSuccess.remove();
    input.classList.remove('input-valid', 'input-invalid');
    if (input.value.trim() === '') return;
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
        const ipData = snapshot.val() || {}, usersOnIP = [];
        for (const key in ipData) if (ipData[key].ip === ip) usersOnIP.push(ipData[key]);
        alert(`IP ${ip} используется ${usersOnIP.length} пользователями:\n\n` + usersOnIP.map(u => `• ${u.username} (${u.staticId})`).join('\n'));
    });
}

window.clearOldIPRecords = function() {
    if (!confirm("Удалить записи IP старше 30 дней?")) return;
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    db.ref('mlk_ip_tracking').once('value').then(snapshot => {
        const ipData = snapshot.val() || {}, updates = {};
        for (const key in ipData) { const recordDate = new Date(ipData[key].registrationDate); if (recordDate < thirtyDaysAgo) updates[key] = null; }
        db.ref('mlk_ip_tracking').update(updates).then(() => { showNotification(`Удалено ${Object.keys(updates).length} старых записей IP`, "success"); renderIPStats(); });
    });
}

window.exportIPData = function() {
    db.ref('mlk_ip_tracking').once('value').then(snapshot => {
        const ipData = snapshot.val() || {};
        const csvContent = "data:text/csv;charset=utf-8," + "IP Address,Username,Static ID,Registration Date,Last Active,Last IP\n" + Object.values(ipData).map(r => `"${r.ip}","${r.username}","${r.staticId}","${r.registrationDate}","${r.lastActive}","${r.lastIP || r.ip}"`).join("\n");
        const encodedUri = encodeURI(csvContent), link = document.createElement("a");
        link.setAttribute("href", encodedUri); link.setAttribute("download", `ip_data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showNotification("Данные IP экспортированы в CSV", "success");
    });
}

/* ===== ФУНКЦИИ ДЛЯ ПРОКРУТКИ КОНТЕЙНЕРОВ ===== */
window.scrollContainerToTop = function(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.scrollTop = 0;
};

window.scrollContainerToBottom = function(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.scrollTop = container.scrollHeight;
};

/* ===== ФУНКЦИЯ ДЛЯ ПЕРЕЗАГРУЗКИ НАСТРОЕК ВЫСОТЫ ===== */
window.refreshLayout = function() {
    adjustInterfaceHeights();
    setupAutoScroll();
    showNotification("Настройки высоты обновлены", "info");
};