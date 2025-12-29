/* ===== СИСТЕМА РАНГОВ ===== */
const RANKS = {
    JUNIOR_CURATOR: { name: "МЛАДШИЙ КУРАТОР", level: 1, access: ["mlk_reports"] },
    CURATOR: { name: "КУРАТОР", level: 2, access: ["mlk_reports"] },
    SENIOR_CURATOR: { name: "СТАРШИЙ КУРАТОР", level: 3, access: ["mlk_reports", "all_reports", "users"] },
    ADMIN: { name: "АДМИНИСТРАТОР", level: 4, access: ["mlk_reports", "all_reports", "whitelist", "users", "system", "bans", "ip_monitoring", "webhooks"] }
};
const CREATOR_RANK = { name: "СОЗДАТЕЛЬ", level: 999, access: ["mlk_reports", "all_reports", "whitelist", "users", "passwords", "system", "everything", "bans", "ip_monitoring", "webhooks"] };

/* ===== СИСТЕМНЫЕ ПЕРЕМЕННЫЕ ===== */
let CURRENT_ROLE = null, CURRENT_USER = null, CURRENT_RANK = null, CURRENT_STATIC_ID = null;
let reports = [], bans = [], users = [], whitelist = [], passwords = {};
let webhooks = [], DISCORD_WEBHOOK_URL = null, DISCORD_WEBHOOK_NAME = "Система отчетов Зоны", DISCORD_WEBHOOK_AVATAR = "https://i.imgur.com/6B7zHqj.png";
const MAX_ATTEMPTS = 3, LOCKOUT_TIME = 15 * 60 * 1000;
let loginAttempts = {};
let USER_SETTINGS = { theme: 'default', avatar: null, notifications: true, compactView: false, language: 'ru' };
const PAGINATION_CONFIG = { itemsPerPage: 15, visiblePages: 5, maxScrollHeight: 600 };
let currentPage = 1, totalPages = 1, currentScrollPosition = {};

/* ===== ФУНКЦИИ ОТЛАДКИ ===== */
window.debugLogin = () => {
    console.log('=== DEBUG LOGIN ===', {CURRENT_USER, CURRENT_RANK});
    const loginScreen = document.getElementById("login-screen");
    const terminal = document.getElementById("terminal");
    if (loginScreen) loginScreen.style.display = loginScreen.style.visibility = loginScreen.style.opacity = "none";
    if (terminal) terminal.style.display = "flex", terminal.style.visibility = terminal.style.opacity = "visible";
    if (CURRENT_USER) setupSidebar(), renderSystem();
};
window.testLogin = async (username, password) => {
    document.getElementById('username').value = username;
    document.getElementById('password').value = password;
    await login();
};

/* ===== АДАПТИВНОСТЬ И СКРОЛЛ ===== */
const adjustInterfaceHeights = () => {
    document.querySelectorAll('.scrollable-container').forEach(container => {
        const parent = container.closest('.form-container, .terminal-screen, .zone-card');
        if (parent) {
            const maxHeight = Math.min(parent.clientHeight - 20, PAGINATION_CONFIG.maxScrollHeight);
            container.style.maxHeight = maxHeight + 'px';
            const containerId = container.id || container.className;
            if (currentScrollPosition[containerId]) container.scrollTop = currentScrollPosition[containerId];
        }
    });
    const contentBody = document.getElementById('content-body'), sidebar = document.querySelector('.zone-sidebar'), terminal = document.getElementById('terminal');
    if (contentBody && terminal) {
        const header = document.querySelector('.content-header'), footer = document.querySelector('.content-footer');
        if (header && footer) {
            const terminalHeight = terminal.clientHeight, headerHeight = header.offsetHeight, footerHeight = footer.offsetHeight;
            const availableHeight = terminalHeight - headerHeight - footerHeight - 40;
            contentBody.style.minHeight = Math.max(availableHeight, 400) + 'px';
        }
    }
    if (sidebar) sidebar.style.maxHeight = (window.innerHeight - 100) + 'px', sidebar.style.overflowY = 'auto';
};

const setupAutoScroll = () => {
    document.querySelectorAll('.scrollable-container').forEach(container => {
        const hasVerticalScroll = container.scrollHeight > container.clientHeight;
        container.style.paddingRight = hasVerticalScroll ? '15px' : '10px';
        if (hasVerticalScroll) container.addEventListener('scroll', function() {
            currentScrollPosition[this.id || this.className] = this.scrollTop;
        });
    });
    addScrollStyles();
};

const addScrollStyles = () => {
    if (!document.querySelector('#scroll-styles')) {
        const style = document.createElement('style');
        style.id = 'scroll-styles';
        style.textContent = `.scrollable-container{overflow:visible;overflow-x:hidden;padding-right:10px}.scrollable-container::-webkit-scrollbar{width:8px}.scrollable-container::-webkit-scrollbar-track{background:#1e201c;border-radius:4px}.scrollable-container::-webkit-scrollbar-thumb{background:#4a4a3a;border-radius:4px}.scrollable-container::-webkit-scrollbar-thumb:hover{background:#5a5a4a}.table-container thead{position:sticky;top:0;background:#1e201c;z-index:10;box-shadow:0 2px 5px rgba(0,0,0,0.3)}.report-form-scrollable{display:flex;flex-direction:column;height:100%}.report-creation-container{flex:1;overflow-y:auto;padding-right:10px}.form-container.with-scroll{display:flex;flex-direction:column;height:auto;overflow:visible}.form-container.with-scroll>.table-container{flex:1;min-height:0}.scroll-btn{width:40px;height:40px;background:rgba(30,32,28,0.9);border:1px solid #4a4a3a;color:#8f9779;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.2rem;transition:all 0.3s;position:fixed;z-index:1000}.scroll-btn:hover{background:rgba(192,176,112,0.2);border-color:#c0b070;color:#c0b070;transform:scale(1.1)}#scroll-to-top{bottom:70px;right:20px}#scroll-to-bottom{bottom:20px;right:20px}.pagination-container{display:flex;justify-content:center;align-items:center;gap:5px;flex-wrap:wrap;padding:8px;width:100%;}.pagination-btn{padding:6px 12px;background:rgba(40,42,36,0.8);border:1px solid #4a4a3a;color:#8f9779;cursor:pointer;font-size:0.85rem;transition:all 0.2s;border-radius:3px;min-width:34px;height:34px;display:flex;align-items:center;justify-content:center;}.pagination-btn:hover{background:rgba(60,62,56,0.8);border-color:#8f9779;color:#c0b070}.pagination-btn.active{background:rgba(192,176,112,0.2);border-color:#c0b070;color:#c0b070;font-weight:bold}.pagination-btn:disabled{opacity:0.5;cursor:not-allowed}.page-info{color:#8f9779;font-size:0.85rem;margin:0 15px;white-space:nowrap;}.items-per-page-selector{display:flex;align-items:center;gap:8px;color:#8f9779;font-size:0.85rem;}.items-per-page-selector select{background:rgba(40,42,36,0.8);border:1px solid #4a4a3a;color:#8f9779;padding:4px 8px;border-radius:3px;font-size:0.85rem;}.reports-container{display:flex;flex-direction:column;gap:12px;padding:5px;}.report-card{background:rgba(40,42,36,0.8);border:1px solid #4a4a3a;border-radius:4px;padding:15px;transition:all 0.2s;}.report-card:hover{border-color:#5a5a4a;background:rgba(40,42,36,0.9;}#login-error{position:relative;z-index:10;margin:15px 0}.login-error-box{background:rgba(30,32,28,0.9);border:1px solid;border-radius:4px;padding:12px 15px;color:#8f9779;font-size:0.9rem;display:flex;align-items:flex-start;gap:10px;animation:fadeIn 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.3);backdrop-filter:blur(5px)}.notification{position:fixed;bottom:20px;right:20px;z-index:9999;padding:12px 20px;border-radius:4px;color:#1e201c;font-weight:500;font-size:0.9rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);transform:translateY(100px);opacity:0;transition:all 0.3s ease;max-width:350px;backdrop-filter:blur(5px)}.notification.show{transform:translateY(0);opacity:1}.notification.info{background:rgba(192,176,112,0.9);border:1px solid #c0b070}.notification.success{background:rgba(140,180,60,0.9);border:1px solid #8cb43c}.notification.warning{background:rgba(192,176,112,0.9);border:1px solid #c0b070}.notification.error{background:rgba(180,60,60,0.9);border:1px solid #b43c3c}@keyframes fadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{transform:translateY(100px);opacity:0}to{transform:translateY(0);opacity:1}}.action-buttons .action-btn.delete,.action-buttons .delete-btn{background:rgba(180,60,60,0.2)!important;border:1px solid #b43c3c!important;color:#b43c3c!important;transition:all 0.2s}.delete-btn:hover{background:rgba(180,60,60,0.4)!important;border-color:#ff4d4d!important;color:#ff4d4d!important;transform:scale(1.05)}.btn-delete-all{background:linear-gradient(145deg,rgba(180,60,60,0.2),rgba(160,50,50,0.1))!important;border:2px solid #b43c3c!important;color:#b43c3c!important;font-weight:600!important;letter-spacing:0.5px;transition:all 0.3s;position:relative;overflow:hidden}.btn-delete-all:hover{background:linear-gradient(145deg,rgba(180,60,60,0.3),rgba(160,50,50,0.2))!important;border-color:#ff4d4d!important;color:#ff4d4d!important;transform:translateY(-2px);box-shadow:0 5px 15px rgba(180,60,60,0.3)}.btn-delete-all::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);transition:left 0.5s}.btn-delete-all:hover::before{left:100%}#delete-all-confirmation:focus{border-color:#b43c3c;box-shadow:0 0 0 2px rgba(180,60,60,0.2)}`;
        document.head.appendChild(style);
    }
};

const addScrollButtons = () => {
    if (!document.getElementById('scroll-buttons')) {
        document.body.insertAdjacentHTML('beforeend', `<div id="scroll-buttons"><button id="scroll-to-top" class="scroll-btn" style="display:none"><i class="fas fa-arrow-up"></i></button><button id="scroll-to-bottom" class="scroll-btn"><i class="fas fa-arrow-down"></i></button></div>`);
        document.getElementById('scroll-to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        document.getElementById('scroll-to-bottom').addEventListener('click', () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
        window.addEventListener('scroll', handleScroll);
    }
};

const handleScroll = () => {
    const scrollTopBtn = document.getElementById('scroll-to-top'), scrollBottomBtn = document.getElementById('scroll-to-bottom');
    if (scrollTopBtn) scrollTopBtn.style.display = window.scrollY > 200 ? 'flex' : 'none';
    if (scrollBottomBtn) scrollBottomBtn.style.display = window.scrollY + window.innerHeight >= document.body.scrollHeight - 100 ? 'none' : 'flex';
};

/* ===== ПАГИНАЦИЯ ===== */
const renderPagination = (containerId, currentPage, totalPages, callback) => {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) {
        if (container) container.innerHTML = '<div style="color: #8f9779; font-size: 0.85rem;">Страница 1 из 1</div>';
        return;
    }
    
    let html = `<div class="pagination-container">`;
    if (currentPage > 1) html += `<button onclick="${callback}(${currentPage - 1})" class="pagination-btn" title="Предыдущая страница"><i class="fas fa-chevron-left"></i></button>`;
    else html += `<button class="pagination-btn" disabled style="opacity: 0.5; cursor: not-allowed;"><i class="fas fa-chevron-left"></i></button>`;
    
    if (currentPage > 3) {
        html += `<button onclick="${callback}(1)" class="pagination-btn">1</button>`;
        if (currentPage > 4) html += `<span style="color: #8f9779; padding: 0 5px;">...</span>`;
    }
    
    const startPage = Math.max(1, currentPage - 2), endPage = Math.min(totalPages, currentPage + 2);
    for (let i = startPage; i <= endPage; i++) html += `<button onclick="${callback}(${i})" class="pagination-btn ${i === currentPage ? 'active' : ''}">${i}</button>`;
    
    if (currentPage < totalPages - 2) {
        if (currentPage < totalPages - 3) html += `<span style="color: #8f9779; padding: 0 5px;">...</span>`;
        html += `<button onclick="${callback}(${totalPages})" class="pagination-btn">${totalPages}</button>`;
    }
    
    if (currentPage < totalPages) html += `<button onclick="${callback}(${currentPage + 1})" class="pagination-btn" title="Следующая страница"><i class="fas fa-chevron-right"></i></button>`;
    else html += `<button class="pagination-btn" disabled style="opacity: 0.5; cursor: not-allowed;"><i class="fas fa-chevron-right"></i></button>`;
    
    html += `<div class="page-info">Страница ${currentPage} из ${totalPages}</div></div>`;
    container.innerHTML = html;
};

window.changeItemsPerPage = (callback, value) => {
    PAGINATION_CONFIG.itemsPerPage = parseInt(value);
    if (callback === 'renderReportsWithPagination') renderReportsWithPagination(1);
    else if (callback === 'renderUsersWithPagination') renderUsersWithPagination(1);
    else if (callback === 'renderMLKListPaginated') renderMLKListPaginated(1);
    else if (callback === 'renderWhitelistWithPagination') renderWhitelistWithPagination(1);
    else if (callback === 'renderBansWithPagination') renderBansWithPagination(1);
    else if (callback === 'renderIPStatsWithPagination') renderIPStatsWithPagination(1);
};

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
    
    if (!loginAttempts[ip]) {
        loginAttempts[ip] = { 
            attempts: 0, 
            firstAttempt: now, 
            lastAttempt: now, 
            lockedUntil: 0 
        };
    }
    
    if (success) {
        // Сбрасываем счетчик при успешном входе
        loginAttempts[ip].attempts = 0;
        loginAttempts[ip].lockedUntil = 0;
        
        // Показываем уведомление об успешном входе (если нужно)
        // showNotification("Вход выполнен успешно", "success");
        
    } else {
        // Увеличиваем счетчик неудачных попыток
        loginAttempts[ip].attempts++;
        loginAttempts[ip].lastAttempt = now;
        
        console.log(`Неудачная попытка входа ${loginAttempts[ip].attempts} с IP ${ip}`);
        
        // Проверяем, достигнут ли лимит попыток
        if (loginAttempts[ip].attempts >= MAX_ATTEMPTS) {
            loginAttempts[ip].lockedUntil = now + LOCKOUT_TIME;
            
            // Показываем специальное сообщение о блокировке IP
            const minutesLeft = Math.ceil(LOCKOUT_TIME / 60000);
            
            // Сообщение сверху (в форме входа)
            const errorMessage = `Слишком много неудачных попыток. IP-адрес временно заблокирован на ${minutesLeft} ${minutesLeft === 1 ? 'минуту' : minutesLeft < 5 ? 'минуты' : 'минут'}.`;
            showLoginError(errorMessage, "error");
            
            // Дополнительное системное уведомление снизу (через 300мс)
            setTimeout(() => {
                showNotification(`🔒 IP заблокирован на ${minutesLeft} ${minutesLeft === 1 ? 'минуту' : minutesLeft < 5 ? 'минуты' : 'минут'}`, "error");
            }, 300);
            
        } else {
            // Для первых неудачных попыток показываем предупреждение
            const attemptsLeft = MAX_ATTEMPTS - loginAttempts[ip].attempts;
            if (attemptsLeft <= 2) {
                showLoginError(`Неверный пароль. Осталось попыток: ${attemptsLeft}`, "warning");
            }
        }
    }
    
    // Очищаем старые записи (старше 24 часов)
    for (const ipKey in loginAttempts) {
        if (now - loginAttempts[ipKey].lastAttempt > 24 * 60 * 60 * 1000) {
            delete loginAttempts[ipKey];
        }
    }
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
// ВАЖНО: Исправьте восстановление сессии
function restoreSession() {
    console.log('=== RESTORE SESSION ===');
    
    const savedSession = localStorage.getItem('mlk_session');
    if (!savedSession) {
        console.log('No saved session');
        return false;
    }
    
    try {
        const session = JSON.parse(savedSession);
        console.log('Session data:', session);
        
        // Проверяем обязательные поля
        if (!session.user || session.rank === undefined) {
            console.log('Invalid session data');
            localStorage.removeItem('mlk_session');
            return false;
        }
        
        // Устанавливаем глобальные переменные
        CURRENT_USER = session.user;
        CURRENT_ROLE = session.role;
        CURRENT_STATIC_ID = session.staticId;
        
        // Определяем ранг
        if (session.rank === CREATOR_RANK.level) {
            CURRENT_RANK = CREATOR_RANK;
        } else {
            // Ищем ранг по уровню
            for (const key in RANKS) {
                if (RANKS[key].level === session.rank) {
                    CURRENT_RANK = RANKS[key];
                    break;
                }
            }
            // Если не нашли - ставим младшего куратора
            if (!CURRENT_RANK) {
                CURRENT_RANK = RANKS.JUNIOR_CURATOR;
            }
        }
        
        console.log('Session restored successfully');
        console.log('User:', CURRENT_USER);
        console.log('Rank:', CURRENT_RANK.name);
        
        return true;
        
    } catch (e) {
        console.error('Error restoring session:', e);
        localStorage.removeItem('mlk_session');
        return false;
    }
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
        db.ref('mlk_users').once('value').then(snapshot => { 
            const data = snapshot.val() || {}; 
            users = Object.keys(data).map(key => ({ 
                ...data[key], 
                id: key, 
                username: data[key].username || '', 
                staticId: data[key].staticId || '', 
                role: data[key].role || '', 
                rank: data[key].rank || RANKS.JUNIOR_CURATOR.level 
            })); 
        }),
        db.ref('mlk_whitelist').once('value').then(snapshot => { 
            const data = snapshot.val() || {}; 
            whitelist = Object.keys(data).map(key => ({ 
                ...data[key], 
                id: key, 
                username: data[key].username || '', 
                staticId: data[key].staticId || '', 
                addedBy: data[key].addedBy || 'СИСТЕМА' 
            })); 
        }),
        db.ref('mlk_passwords').once('value').then(snapshot => { 
            passwords = snapshot.val() || {}; 
            // Только специальный пароль для создателя
            if (!passwords.special) {
                createOrUpdatePasswords().then(() => db.ref('mlk_passwords').once('value')).then(snapshot => passwords = snapshot.val() || {});
            }
        }),
        db.ref('mlk_bans').once('value').then(snapshot => { 
            const data = snapshot.val() || {}; 
            bans = Object.keys(data).map(key => ({ 
                ...data[key], 
                id: key, 
                username: data[key].username || '', 
                staticId: data[key].staticId || '', 
                reason: data[key].reason || 'Причина не указана', 
                bannedBy: data[key].bannedBy || 'Система' 
            })); 
        }),
        db.ref('mlk_settings/webhook_url').once('value').then(snapshot => DISCORD_WEBHOOK_URL = snapshot.val() || null),
        db.ref('mlk_settings/webhook_name').once('value').then(snapshot => DISCORD_WEBHOOK_NAME = snapshot.val() || "Система отчетов Зоны"),
        db.ref('mlk_settings/webhook_avatar').once('value').then(snapshot => DISCORD_WEBHOOK_AVATAR = snapshot.val() || "https://i.imgur.com/6B7zHqj.png"),
        db.ref('mlk_webhooks').once('value').then(snapshot => { 
            const data = snapshot.val() || {}; 
            webhooks = Object.keys(data).map(key => ({...data[key], id: key})); 
            webhooks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); 
        })
    ];
    
    Promise.all(loadPromises).then(() => {
        console.log("Система инициализирована");
        if (whitelist.length === 0) addProtectedUsersToWhitelist().then(() => { if (callback) callback(); });
        else if (callback) callback();
    }).catch(error => { 
        showNotification("Ошибка загрузки данных", "error"); 
        if (callback) callback(); 
    });
}

const PROTECTED_USERS = ["Tihiy"];

function addProtectedUsersToWhitelist() {
    const promises = PROTECTED_USERS.map(username => db.ref('mlk_whitelist').push({ username, staticId: generateStaticId(username), addedBy: "СИСТЕМА", addedDate: new Date().toLocaleString(), isProtected: true }));
    return Promise.all(promises).then(() => loadData());
}

async function changePassword(type, newPassword) {
    // Эта функция теперь не используется для системных паролей
    // Оставляем только для совместимости
    showNotification("Функция устарела. Используйте 'Изменить мой пароль'", "info");
    return false;
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
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { 
        content.innerHTML = '<div class="error-display">ДОСТУП ЗАПРЕЩЕН</div>'; 
        return; 
    }
    
    currentPage = page;
    const itemsPerPage = PAGINATION_CONFIG.itemsPerPage;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    const activeBans = bans.filter(ban => !ban.unbanned);
    const paginatedActiveBans = activeBans.slice(startIndex, endIndex);
    const activeBansTotalPages = Math.max(1, Math.ceil(activeBans.length / itemsPerPage));
    
    content.innerHTML = `
        <div class="form-container" style="display: flex; flex-direction: column; height: 100%; gap: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                <div>
                    <h2 style="color: #b43c3c; margin: 0 0 5px 0; font-family: 'Orbitron', sans-serif;">
                        <i class="fas fa-ban"></i> СИСТЕМА БЛОКИРОВКИ
                    </h2>
                    <p style="color: #8f9779; font-size: 0.9rem; margin: 0;">УПРАВЛЕНИЕ БАНАМИ ПОЛЬЗОВАТЕЛЕЙ</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div class="items-per-page-selector" style="margin: 0;">
                        <span style="color: #8f9779; font-size: 0.9rem;">На странице:</span>
                        <select onchange="changeItemsPerPage('renderBansWithPagination', this.value)" style="background: rgba(30, 32, 28, 0.8); border: 1px solid #4a4a3a; color: #8f9779; padding: 4px 8px; border-radius: 3px;">
                            <option value="5" ${PAGINATION_CONFIG.itemsPerPage === 5 ? 'selected' : ''}>5</option>
                            <option value="10" ${PAGINATION_CONFIG.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                            <option value="15" ${PAGINATION_CONFIG.itemsPerPage === 15 ? 'selected' : ''}>15</option>
                            <option value="20" ${PAGINATION_CONFIG.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                            <option value="30" ${PAGINATION_CONFIG.itemsPerPage === 30 ? 'selected' : ''}>30</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px; padding: 15px; background: rgba(40, 42, 36, 0.5); border-radius: 4px; border: 1px solid #4a4a3a;">
                <div style="flex: 1; min-width: 300px;">
                    <label class="form-label">БАН ПО ИМЕНИ ПОЛЬЗОВАТЕЛЯ</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="ban-username" class="form-input" placeholder="Введите имя пользователя" style="flex: 1;">
                        <input type="text" id="ban-reason" class="form-input" placeholder="Причина бана" style="flex: 1;">
                        <button onclick="addBan()" class="btn-primary" style="border-color: #b43c3c; padding: 10px 15px; min-width: 120px;">
                            <i class="fas fa-ban"></i> ЗАБАНИТЬ
                        </button>
                    </div>
                </div>
                
                <div style="flex: 1; min-width: 300px;">
                    <label class="form-label">БАН ПО STATIC ID</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="ban-staticid" class="form-input" placeholder="Введите STATIC ID" style="font-family: 'Courier New', monospace; flex: 1;">
                        <input type="text" id="ban-reason-static" class="form-input" placeholder="Причина бана" style="flex: 1;">
                        <button onclick="addBanByStaticId()" class="btn-primary" style="border-color: #b43c3c; padding: 10px 15px; min-width: 120px;">
                            <i class="fas fa-id-card"></i> БАН ПО ID
                        </button>
                    </div>
                </div>
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; gap: 15px; overflow: hidden;">
                <!-- АКТИВНЫЕ БАНЫ -->
                <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="color: #b43c3c; margin: 0;">
                            <i class="fas fa-user-slash"></i> АКТИВНЫЕ БАНЫ (${activeBans.length})
                        </h4>
                        ${activeBansTotalPages > 1 ? `
                        <div id="bans-pagination-top" style="display: flex; align-items: center; gap: 5px;">
                            <!-- Пагинация будет здесь -->
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="scrollable-container" style="flex: 1; background: rgba(30, 32, 28, 0.3); border: 1px solid #4a4a3a; border-radius: 4px; padding: 15px;">
                        ${activeBans.length === 0 ? 
                            `<div style="text-align: center; padding: 30px; color: #8f9779;">
                                <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                                <p>АКТИВНЫХ БАНОВ НЕТ</p>
                            </div>` : 
                            `<table class="data-table" style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="min-width: 120px;">ПОЛЬЗОВАТЕЛЬ</th>
                                        <th style="min-width: 120px;">STATIC ID</th>
                                        <th style="min-width: 150px;">ПРИЧИНА</th>
                                        <th style="min-width: 100px;">ЗАБАНИЛ</th>
                                        <th style="min-width: 120px;">ДАТА</th>
                                        <th style="min-width: 100px;">ДЕЙСТВИЯ</th>
                                    </tr>
                                </thead>
                                <tbody id="bans-table-body"></tbody>
                            </table>`
                        }
                    </div>
                </div>
                
                <!-- ИСТОРИЯ БАНОВ -->
                <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="color: #c0b070; margin: 0;">
                            <i class="fas fa-history"></i> ИСТОРИЯ БАНОВ (${bans.length})
                        </h4>
                    </div>
                    
                    <div class="scrollable-container" style="flex: 1; background: rgba(30, 32, 28, 0.3); border: 1px solid #4a4a3a; border-radius: 4px; padding: 15px;">
                        ${bans.length === 0 ? 
                            `<div style="text-align: center; padding: 30px; color: #8f9779;">
                                <i class="fas fa-history" style="font-size: 2rem; margin-bottom: 10px;"></i>
                                <p>ИСТОРИЯ ПУСТА</p>
                            </div>` : 
                            `<table class="data-table" style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="min-width: 120px;">ПОЛЬЗОВАТЕЛЬ</th>
                                        <th style="min-width: 120px;">STATIC ID</th>
                                        <th style="min-width: 150px;">ПРИЧИНА</th>
                                        <th style="min-width: 80px;">СТАТУС</th>
                                        <th style="min-width: 150px;">ДАТА</th>
                                    </tr>
                                </thead>
                                <tbody id="bans-history-body"></tbody>
                            </table>`
                        }
                    </div>
                </div>
            </div>
            
            <div id="bans-pagination-bottom" style="min-height: 50px; display: flex; align-items: center; justify-content: center; padding: 10px; background: rgba(40, 42, 36, 0.5); border-radius: 4px; border: 1px solid #4a4a3a;">
                <!-- Пагинация будет здесь -->
            </div>
        </div>
    `;
    
    if (activeBans.length > 0) { 
        renderBansTablePaginated(paginatedActiveBans);
        if (activeBansTotalPages > 1) {
            renderPagination('bans-pagination-top', currentPage, activeBansTotalPages, 'renderBansWithPagination');
            renderPagination('bans-pagination-bottom', currentPage, activeBansTotalPages, 'renderBansWithPagination');
        }
    }
    
    if (bans.length > 0) {
        const historyStartIndex = (page - 1) * itemsPerPage;
        const historyEndIndex = historyStartIndex + itemsPerPage;
        const paginatedBansHistory = bans.slice(historyStartIndex, historyEndIndex);
        renderBansHistoryPaginated(paginatedBansHistory);
    }
    
    setTimeout(adjustInterfaceHeights, 100);
}

function renderBansTablePaginated(activeBans) {
    const tableBody = document.getElementById("bans-table-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = activeBans.map(ban => `
        <tr>
            <td style="font-weight: 500; color: #b43c3c;">
                <i class="fas fa-user-slash"></i> ${ban.username || 'Неизвестно'}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${ban.staticId || "N/A"}
            </td>
            <td>${ban.reason || "Причина не указана"}</td>
            <td>${ban.bannedBy || "Неизвестно"}</td>
            <td>${ban.bannedDate || "Неизвестно"}</td>
            <td>
                ${CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level ? 
                    `<button onclick="unbanByStaticId('${ban.staticId}')" class="action-btn confirm" style="padding: 5px 10px; font-size: 0.85rem;">
                        <i class="fas fa-unlock"></i> РАЗБАН
                    </button>` : 
                    '<span style="color: #8f9779; font-size: 0.85rem;">НЕТ ДОСТУПА</span>'
                }
            </td>
        </tr>
    `).join('');
}

function renderBansHistoryPaginated(bansHistory) {
    const tableBody = document.getElementById("bans-history-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = bansHistory.map(ban => {
        const isActive = !ban.unbanned;
        const bannedDate = ban.bannedDate || "Неизвестно";
        const unbannedDate = ban.unbannedDate || "";
        
        return `<tr>
            <td style="color: ${isActive ? '#b43c3c' : '#8f9779'};">
                <i class="fas ${isActive ? 'fa-user-slash' : 'fa-user-check'}"></i> ${ban.username || 'Неизвестно'}
            </td>
            <td style="font-family: 'Courier New', monospace; font-size: 0.9rem; color: #8f9779;">
                ${ban.staticId || "N/A"}
            </td>
            <td>${ban.reason || "Причина не указана"}</td>
            <td>
                <span class="report-status ${isActive ? 'status-deleted' : 'status-confirmed'}" 
                      style="display: inline-flex; padding: 4px 10px; font-size: 0.8rem;">
                    <i class="fas ${isActive ? 'fa-ban' : 'fa-check'}"></i>
                    ${isActive ? 'АКТИВЕН' : 'СНЯТ'}
                </span>
            </td>
            <td>
                ${bannedDate}
                ${unbannedDate ? `<br><small style="color: #6a6a5a; font-size: 0.8rem;">Снят: ${unbannedDate}</small>` : ''}
            </td>
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

window.promoteToAdminByStaticId = async function(staticId) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { 
        showNotification("Только администратор может повышать до администратора", "error"); 
        return; 
    }
    if (!confirm("Повысить пользователя до администратора?")) return;
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    
    try {
        await db.ref('mlk_users/' + user.id).update({ 
            role: RANKS.ADMIN.name, 
            rank: RANKS.ADMIN.level 
        });
        
        // ОБНОВЛЯЕМ ВКЛАДКУ ЭТОГО ПОЛЬЗОВАТЕЛЯ
        updateTabAccessForUser(user.username, RANKS.ADMIN.level, RANKS.ADMIN.access);
        
        await new Promise(resolve => loadData(resolve));
        renderUsersWithPagination(1); 
        showNotification("Пользователь повышен до администратора", "success");
        
    } catch (error) { 
        showNotification("Ошибка: " + error.message, "error"); 
    }
}

window.promoteToSeniorByStaticId = async function(staticId) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { 
        showNotification("Только администратор может повышать до старшего куратора", "error"); 
        return; 
    }
    if (!confirm("Повысить пользователя до старшего куратора?")) return;
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    
    try {
        await db.ref('mlk_users/' + user.id).update({ 
            role: RANKS.SENIOR_CURATOR.name, 
            rank: RANKS.SENIOR_CURATOR.level 
        });
        
        // ОБНОВЛЯЕМ ВКЛАДКУ ЭТОГО ПОЛЬЗОВАТЕЛЯ
        updateTabAccessForUser(user.username, RANKS.SENIOR_CURATOR.level, RANKS.SENIOR_CURATOR.access);
        
        await new Promise(resolve => loadData(resolve));
        renderUsersWithPagination(1); 
        showNotification("Пользователь повышен до старшего куратора", "success");
        
    } catch (error) { 
        showNotification("Ошибка: " + error.message, "error"); 
    }
}

window.setToCuratorByStaticId = async function(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { 
        showNotification("Только старший куратор или выше может назначать кураторов", "error"); 
        return; 
    }
    const user = users.find(u => u.staticId === staticId);
    if (!user) { showNotification("Пользователь не найден", "error"); return; }
    if (user.rank === RANKS.CURATOR.level) { 
        showNotification("Пользователь уже является куратором", "info"); 
        return; 
    }
    let message = `Назначить пользователя ${user.username} куратором?`;
    if (user.rank > RANKS.CURATOR.level) message = `Понизить пользователя ${user.username} до куратора?`;
    else if (user.rank < RANKS.CURATOR.level) message = `Повысить пользователя ${user.username} до куратора?`;
    if (!confirm(message)) return;
    
    try {
        await db.ref('mlk_users/' + user.id).update({ 
            role: RANKS.CURATOR.name, 
            rank: RANKS.CURATOR.level 
        });
        
        // ОБНОВЛЯЕМ ВКЛАДКУ ЭТОГО ПОЛЬЗОВАТЕЛЯ
        updateTabAccessForUser(user.username, RANKS.CURATOR.level, RANKS.CURATOR.access);
        
        await new Promise(resolve => loadData(resolve));
        renderUsersWithPagination(1); 
        showNotification("Пользователь назначен куратором", "success");
        
    } catch (error) { 
        showNotification("Ошибка: " + error.message, "error"); 
    }
}

window.demoteToCuratorByStaticId = async function(staticId) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { 
        showNotification("Только администратор может понижать до куратора", "error"); 
        return; 
    }
    
    const user = users.find(u => u.staticId === staticId);
    if (!user) { 
        showNotification("Пользователь не найден", "error"); 
        return; 
    }
    
    if (user.rank <= RANKS.CURATOR.level) { 
        showNotification("Пользователь уже имеет ранг куратора или ниже", "warning"); 
        return; 
    }
    
    if (!confirm(`Понизить пользователя ${user.username} до куратора?`)) return;
    
    try {
        await db.ref('mlk_users/' + user.id).update({ 
            role: RANKS.CURATOR.name, 
            rank: RANKS.CURATOR.level 
        });
        
        // ОБНОВЛЯЕМ ВКЛАДКУ ЭТОГО ПОЛЬЗОВАТЕЛЯ - КЛЮЧЕВАЯ ЧАСТЬ!
        updateTabAccessForUser(user.username, RANKS.CURATOR.level, RANKS.CURATOR.access);
        
        await new Promise(resolve => loadData(resolve));
        renderUsersWithPagination(1); 
        showNotification(`Пользователь ${user.username} понижен до куратора`, "success");
        
    } catch (error) { 
        showNotification("Ошибка: " + error.message, "error"); 
    }
}

window.demoteToJuniorByStaticId = async function(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { 
        showNotification("Только старший куратор или выше может понижать", "error"); 
        return; 
    }
    
    const user = users.find(u => u.staticId === staticId);
    if (!user) { 
        showNotification("Пользователь не найден", "error"); 
        return; 
    }
    
    // Проверяем, не пытаемся ли понизить уже младшего куратора
    if (user.rank <= RANKS.JUNIOR_CURATOR.level) { 
        showNotification("Пользователь уже имеет ранг младшего куратора или ниже", "warning"); 
        return; 
    }
    
    // Определяем какие права будут удалены
    let removedRights = "";
    if (user.rank === RANKS.ADMIN.level) {
        removedRights = "администратора (whitelist, webhooks, system, bans, ip_monitoring, all_reports, users)";
    } else if (user.rank === RANKS.SENIOR_CURATOR.level) {
        removedRights = "старшего куратора (system, bans, ip_monitoring, all_reports, users)";
    } else if (user.rank === RANKS.CURATOR.level) {
        removedRights = "куратора (all_reports, users)";
    }
    
    if (!confirm(`Понизить пользователя ${user.username} до младшего куратора?\n\nЭто действие:\n• Удалит все права ${removedRights}\n• Оставит только доступ к отчетам МЛК\n• Вкладки пользователя будут перезагружены с новыми правами`)) return;
    
    try {
        await db.ref('mlk_users/' + user.id).update({ 
            role: RANKS.JUNIOR_CURATOR.name, 
            rank: RANKS.JUNIOR_CURATOR.level 
        });
        
        // ОБНОВЛЯЕМ ВКЛАДКУ ЭТОГО ПОЛЬЗОВАТЕЛЯ - КЛЮЧЕВОЕ ИЗМЕНЕНИЕ!
        // Используем ТОЛЬКО права младшего куратора
        const juniorAccess = RANKS.JUNIOR_CURATOR.access;
        updateTabAccessForUser(user.username, RANKS.JUNIOR_CURATOR.level, juniorAccess);
        
        await new Promise(resolve => loadData(resolve));
        renderUsersWithPagination(1); 
        
        showNotification(
            `Пользователь ${user.username} понижен до младшего куратора. ` +
            `Доступ только к отчетам МЛК.`, 
            "success"
        );
        
    } catch (error) { 
        showNotification("Ошибка: " + error.message, "error"); 
    }
};

window.setToCuratorByStaticId = async function(staticId) {
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK !== CREATOR_RANK) { 
        showNotification("Только старший куратор или выше может назначать кураторов", "error"); 
        return; 
    }
    
    const user = users.find(u => u.staticId === staticId);
    if (!user) { 
        showNotification("Пользователь не найден", "error"); 
        return; 
    }
    
    if (user.rank === RANKS.CURATOR.level) { 
        showNotification("Пользователь уже является куратором", "info"); 
        return; 
    }
    
    let message = `Назначить пользователя ${user.username} куратором?`;
    let isDemotion = false;
    
    if (user.rank > RANKS.CURATOR.level) {
        message = `Понизить пользователя ${user.username} до куратора?`;
        isDemotion = true;
    } else if (user.rank < RANKS.CURATOR.level) {
        message = `Повысить пользователя ${user.username} до куратора?`;
    }
    
    if (!confirm(message)) return;
    
    try {
        await db.ref('mlk_users/' + user.id).update({ 
            role: RANKS.CURATOR.name, 
            rank: RANKS.CURATOR.level 
        });
        
        // ОБНОВЛЯЕМ ВКЛАДКУ ЭТОГО ПОЛЬЗОВАТЕЛЯ
        updateTabAccessForUser(user.username, RANKS.CURATOR.level, RANKS.CURATOR.access);
        
        await new Promise(resolve => loadData(resolve));
        renderUsersWithPagination(1); 
        
        showNotification(
            isDemotion ? `Пользователь ${user.username} понижен до куратора` : 
                        `Пользователь ${user.username} назначен куратором`, 
            "success"
        );
        
    } catch (error) { 
        showNotification("Ошибка: " + error.message, "error"); 
    }
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

function getAccessByRankLevel(rankLevel) {
    // ВАЖНО: Эта функция должна всегда возвращать правильные права
    switch(rankLevel) {
        case CREATOR_RANK.level:
            return [...CREATOR_RANK.access];
        case RANKS.ADMIN.level:
            return [...RANKS.ADMIN.access];
        case RANKS.SENIOR_CURATOR.level:
            return [...RANKS.SENIOR_CURATOR.access];
        case RANKS.CURATOR.level:
            return [...RANKS.CURATOR.access];
        case RANKS.JUNIOR_CURATOR.level:
            return ["mlk_reports"]; // ТОЧНО ТАК
        default:
            return ["mlk_reports"];
    }
}

function updateTabAccessForUser(username, rankLevel, access) {
    console.log(`Обновление прав вкладки для ${username} до ранга ${rankLevel}`);
    
    // Находим все вкладки этого пользователя
    const tabsToUpdate = accountTabs.filter(tab => 
        tab.login && tab.login.toLowerCase() === username.toLowerCase()
    );
    
    if (tabsToUpdate.length === 0) {
        console.log(`Вкладок для пользователя ${username} не найдено`);
        return;
    }
    
    const rankName = getRankDisplayName(rankLevel);
    
    tabsToUpdate.forEach(tab => {
        // Сохраняем старые данные
        const oldRank = tab.rankName;
        const oldAccess = tab.access || [];
        
        // Обновляем данные вкладки
        tab.rankLevel = rankLevel;
        tab.rankName = rankName;
        
        // Устанавливаем правильные права
        if (Array.isArray(access)) {
            tab.access = [...access];
        } else {
            tab.access = getAccessByRankLevel(rankLevel);
        }
        
        // Обновляем сохраненные данные пользователя
        if (tab.savedUserData) {
            tab.savedUserData.rankLevel = rankLevel;
            tab.savedUserData.rankName = rankName;
        }
        
        console.log(`Вкладка "${tab.name}" обновлена: ${oldRank} (${oldAccess.length} прав) → ${rankName} (${tab.access.length} прав)`);
        
        // Логируем изменения прав
        const removedAccess = oldAccess.filter(x => !tab.access.includes(x));
        const addedAccess = tab.access.filter(x => !oldAccess.includes(x));
        
        if (removedAccess.length > 0) {
            console.log(`Удалены права: ${removedAccess.map(a => getAccessDisplayName(a)).join(', ')}`);
        }
        if (addedAccess.length > 0) {
            console.log(`Добавлены права: ${addedAccess.map(a => getAccessDisplayName(a)).join(', ')}`);
        }
        
        // Если эта вкладка активна - обновляем сайдбар
        if (accountTabs[activeAccountTab]?.id === tab.id) {
            setTimeout(() => {
                updateSidebarForTab(tab);
                
                let message = `Права вкладки обновлены: ${oldRank} → ${rankName}`;
                if (removedAccess.length > 0) {
                    message += `\nУдалены: ${removedAccess.map(a => getAccessDisplayName(a)).join(', ')}`;
                }
                
                showNotification(message, "info");
            }, 100);
        }
    });
    
    // Сохраняем изменения
    saveAccountTabsToStorage();
    
    // Обновляем отображение вкладок
    setTimeout(renderAccountTabs, 50);
}

function getAccessByRankLevel(rankLevel) {
    if (rankLevel === CREATOR_RANK.level) {
        return [...CREATOR_RANK.access];
    } else if (rankLevel === RANKS.ADMIN.level) {
        return [...RANKS.ADMIN.access];
    } else if (rankLevel === RANKS.SENIOR_CURATOR.level) {
        return [...RANKS.SENIOR_CURATOR.access];
    } else if (rankLevel === RANKS.CURATOR.level) {
        return [...RANKS.CURATOR.access];
    } else {
        return [...RANKS.JUNIOR_CURATOR.access];
    }
}

window.login = async function() {
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    
    if (!usernameInput || !passwordInput) {
        console.error("Login form elements not found");
        return;
    }
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const errorElement = document.getElementById("login-error");
    const loginButton = document.getElementById("login-btn");
    const originalButtonText = loginButton ? loginButton.innerHTML : "<i class=\"fas fa-sign-in-alt\"></i><span>ПОДКЛЮЧИТЬСЯ</span>";
    
    // Очищаем предыдущие ошибки
    if (errorElement) {
        errorElement.innerHTML = "";
        errorElement.style.display = "none";
    }
    
    // Валидация имени пользователя
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) { 
        showLoginError(usernameValidation.message, "error"); 
        return; 
    }
    
    // Валидация пароля
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) { 
        showLoginError(passwordValidation.message, "error"); 
        return; 
    }
    
    // Показываем индикатор загрузки
    if (loginButton) {
        loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ПОДКЛЮЧЕНИЕ...';
        loginButton.disabled = true;
    }
    
    try {
        // Получаем IP пользователя
        const userIP = await getUserIP();
        
        // Проверяем блокировку IP
        if (userIP !== "unknown") {
            const ipLockStatus = isIPLocked(userIP);
            if (ipLockStatus) { 
                showLoginError(ipLockStatus, "error");
                resetLoginButton(loginButton, originalButtonText);
                return; 
            }
            
            // Проверяем бан IP
            const ipBanCheck = await checkIPBan(userIP);
            if (ipBanCheck.banned) { 
                showLoginError(`IP адрес ${userIP} заблокирован. Причина: ${ipBanCheck.reason}`, "error");
                resetLoginButton(loginButton, originalButtonText);
                return; 
            }
        }
        
        // Проверяем бан пользователя
        const banCheck = checkIfBanned(username);
        if (banCheck.banned) { 
            showBannedScreen(banCheck); 
            resetLoginButton(loginButton, originalButtonText);
            return; 
        }
        
        // Ищем пользователя в базе
        const existingUser = users.find(user => user.username.toLowerCase() === username.toLowerCase());
        const isCreator = username.toLowerCase() === "tihiy";
        
        // === ОБРАБОТКА СОЗДАТЕЛЯ ===
        if (isCreator) {
            // Загружаем пароль создателя
            const passwordsSnapshot = await db.ref('mlk_passwords').once('value');
            const passwords = passwordsSnapshot.val() || {};
            const creatorPassword = passwords.special;
            
            if (creatorPassword && await verifyPassword(password, creatorPassword)) {
                // Успешная проверка пароля создателя
                if (!existingUser) {
                    // РЕГИСТРАЦИЯ НОВОГО СОЗДАТЕЛЯ
                    const ipCheck = await checkIPLimit(username);
                    
                    if (!ipCheck.allowed) { 
                        showLoginError(ipCheck.message, "error");
                        resetLoginButton(loginButton, originalButtonText);
                        return; 
                    }
                    
                    // Генерируем данные для создателя
                    const staticId = generateStaticId(username);
                    const salt = generateSalt();
                    const passwordHash = await hashPassword(password, salt);
                    
                    const newUser = { 
                        username: username, 
                        staticId, 
                        role: CREATOR_RANK.name, 
                        rank: CREATOR_RANK.level, 
                        registrationDate: new Date().toLocaleString(), 
                        lastLogin: new Date().toLocaleString(), 
                        registrationIP: ipCheck.ip,
                        passwordHash: passwordHash,
                        passwordSalt: salt
                    };
                    
                    // Сохраняем в базу
                    await db.ref('mlk_users').push(newUser);
                    await registerIP(username, staticId);
                    
                    // Обновляем данные
                    await new Promise(resolve => loadData(resolve));
                    
                    // Устанавливаем сессию
                    CURRENT_ROLE = CREATOR_RANK.name;
                    CURRENT_USER = username;
                    CURRENT_RANK = CREATOR_RANK;
                    CURRENT_STATIC_ID = staticId;
                    
                    // Логируем успешный вход
                    trackLoginAttempt(userIP, true);
                    
                    // Завершаем вход
                    completeLogin();
                    resetLoginButton(loginButton, originalButtonText);
                    
                } else {
                    // ВХОД СУЩЕСТВУЮЩЕГО СОЗДАТЕЛЯ
                    // Обновляем время последнего входа
                    await db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
                    await updateIPActivity(username);
                    
                    // Устанавливаем сессию
                    CURRENT_ROLE = existingUser.role || CREATOR_RANK.name;
                    CURRENT_USER = username;
                    CURRENT_RANK = CREATOR_RANK;
                    CURRENT_STATIC_ID = existingUser.staticId;
                    
                    // Логируем успешный вход
                    trackLoginAttempt(userIP, true);
                    
                    // Завершаем вход
                    completeLogin();
                    resetLoginButton(loginButton, originalButtonText);
                }
                
                return;
                
            } else {
                // Неверный пароль для создателя
                trackLoginAttempt(userIP, false);
                showLoginError("НЕВЕРНЫЙ ПАРОЛЬ", "error");
                resetLoginButton(loginButton, originalButtonText);
                return;
            }
        }
        
        // === ОБЫЧНЫЕ ПОЛЬЗОВАТЕЛИ ===
        if (!existingUser) {
            // РЕГИСТРАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ (ВСЕГДА МЛАДШИЙ КУРАТОР)
            // Проверяем ограничение по IP
            const ipCheck = await checkIPLimit(username);
            if (!ipCheck.allowed) { 
                showLoginError(ipCheck.message, "error");
                resetLoginButton(loginButton, originalButtonText);
                return; 
            }
            
            // Генерируем соль и хеш пароля
            const salt = generateSalt();
            const passwordHash = await hashPassword(password, salt);
            
            // Создаем данные пользователя
            const staticId = generateStaticId(username);
            const newUser = { 
                username: username, 
                staticId, 
                role: RANKS.JUNIOR_CURATOR.name, 
                rank: RANKS.JUNIOR_CURATOR.level, 
                registrationDate: new Date().toLocaleString(), 
                lastLogin: new Date().toLocaleString(), 
                registrationIP: ipCheck.ip,
                passwordHash: passwordHash,
                passwordSalt: salt
            };
            
            // Сохраняем в базу
            await db.ref('mlk_users').push(newUser);
            await registerIP(username, staticId);
            
            // Обновляем данные
            await new Promise(resolve => loadData(resolve));
            
            // Устанавливаем сессию
            CURRENT_ROLE = RANKS.JUNIOR_CURATOR.name;
            CURRENT_USER = username;
            CURRENT_RANK = RANKS.JUNIOR_CURATOR;
            CURRENT_STATIC_ID = staticId;
            
            // Логируем успешный вход
            trackLoginAttempt(userIP, true);
            
            // Завершаем вход
            completeLogin();
            resetLoginButton(loginButton, originalButtonText);
            
        } else {
            // ВХОД СУЩЕСТВУЮЩЕГО ПОЛЬЗОВАТЕЛЯ
            const validPassword = await verifyPassword(password, { 
                hash: existingUser.passwordHash, 
                salt: existingUser.passwordSalt 
            });
            
            if (!validPassword) {
                trackLoginAttempt(userIP, false);
                showLoginError("НЕВЕРНЫЙ ПАРОЛЬ", "error");
                resetLoginButton(loginButton, originalButtonText);
                return;
            }
            
            // Определяем ранг пользователя
            let userRank;
            if (existingUser.rank === CREATOR_RANK.level) {
                userRank = CREATOR_RANK;
            } else if (existingUser.rank === RANKS.ADMIN.level) {
                userRank = RANKS.ADMIN;
            } else if (existingUser.rank === RANKS.SENIOR_CURATOR.level) {
                userRank = RANKS.SENIOR_CURATOR;
            } else if (existingUser.rank === RANKS.CURATOR.level) {
                userRank = RANKS.CURATOR;
            } else {
                userRank = RANKS.JUNIOR_CURATOR;
            }
            
            // Обновляем время последнего входа
            await db.ref('mlk_users/' + existingUser.id + '/lastLogin').set(new Date().toLocaleString());
            await updateIPActivity(username);
            
            // Устанавливаем сессию
            CURRENT_ROLE = userRank.name;
            CURRENT_USER = username;
            CURRENT_RANK = userRank;
            CURRENT_STATIC_ID = existingUser.staticId;
            
            // Логируем успешный вход
            trackLoginAttempt(userIP, true);
            
            // Завершаем вход
            completeLogin();
            resetLoginButton(loginButton, originalButtonText);
        }
        
    } catch (error) { 
        console.error('Login error:', error);
        
        // Определяем тип ошибки для пользователя
        let errorMessage = "ОШИБКА СИСТЕМЫ";
        let detailedMessage = error.message;
        
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("Network request failed")) {
            errorMessage = "ОШИБКА ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ";
            detailedMessage = "Проверьте интернет-соединение и повторите попытку.";
        } else if (error.message.includes("permission denied")) {
            errorMessage = "ОШИБКА ДОСТУПА К БАЗЕ ДАННЫХ";
            detailedMessage = "Обратитесь к администратору системы.";
        } else if (error.message.includes("quota exceeded")) {
            errorMessage = "ПРЕВЫШЕН ЛИМИТ БАЗЫ ДАННЫХ";
            detailedMessage = "Обратитесь к администратору для увеличения квоты.";
        }
        
        // Показываем понятное сообщение об ошибке
        showLoginError(`${errorMessage}: ${detailedMessage}`, "error");
        resetLoginButton(loginButton, originalButtonText);
    }
};

// Функция для сброса кнопки входа
function resetLoginButton(loginButton, originalText) {
    if (loginButton) {
        setTimeout(() => {
            loginButton.innerHTML = originalText;
            loginButton.disabled = false;
        }, 500);
    }
}

// Функция для отображения ошибок входа
function showLoginError(message, type = "error") {
    console.log("Login error:", message);
    
    const errorElement = document.getElementById("login-error");
    if (errorElement) {
        // Определяем стили в зависимости от типа
        let borderColor, icon, title, bgColor, textColor, iconClass;
        
        switch(type) {
            case "warning":
                borderColor = "#c0b070";
                icon = "fa-exclamation-triangle";
                title = "ПРЕДУПРЕЖДЕНИЕ";
                bgColor = "rgba(192, 176, 112, 0.1)";
                textColor = "#e0d090";
                iconClass = "warning";
                break;
            case "info":
                borderColor = "#8cb43c";
                icon = "fa-info-circle";
                title = "ИНФОРМАЦИЯ";
                bgColor = "rgba(140, 180, 60, 0.1)";
                textColor = "#a0cc60";
                iconClass = "info";
                break;
            default: // error
                borderColor = "#b43c3c";
                icon = "fa-shield-alt";
                title = "СИСТЕМА БЕЗОПАСНОСТИ";
                bgColor = "rgba(180, 60, 60, 0.1)";
                textColor = "#d45c5c";
                iconClass = "error";
        }
        
        // Для сообщения о блокировке IP используем специальный стиль
        if (message.includes("IP заблокирован") || message.includes("блокирован")) {
            title = "🔒 БЛОКИРОВКА IP";
            icon = "fa-ban";
            borderColor = "#b43c3c";
            bgColor = "rgba(180, 60, 60, 0.15)";
            textColor = "#f08080";
            iconClass = "ip-blocked";
            
            errorElement.innerHTML = `
                <div class="login-error-box ip-blocked" style="
                    background: ${bgColor};
                    border: 2px solid ${borderColor};
                    border-left: 5px solid ${borderColor};
                    border-radius: 6px;
                    padding: 20px;
                    margin: 20px 0;
                    color: ${textColor};
                    font-size: 0.95rem;
                    animation: fadeIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                    box-shadow: 0 8px 25px rgba(180, 60, 60, 0.25);
                    backdrop-filter: blur(10px);
                    position: relative;
                    overflow: hidden;
                    z-index: 100;
                ">
                    <!-- Эффект пульсации -->
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: radial-gradient(circle at center, rgba(255,0,0,0.1) 0%, transparent 70%);
                        animation: pulseGlow 2s infinite alternate;
                        pointer-events: none;
                        z-index: -1;
                    "></div>
                    
                    <!-- Анимированный фон -->
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 10px,
                            rgba(180, 60, 60, 0.05) 10px,
                            rgba(180, 60, 60, 0.05) 20px
                        );
                        z-index: -1;
                        pointer-events: none;
                    "></div>
                    
                    <div style="display: flex; align-items: flex-start; gap: 15px; position: relative; z-index: 2;">
                        <div style="
                            width: 50px;
                            height: 50px;
                            background: linear-gradient(135deg, rgba(180, 60, 60, 0.2), rgba(180, 60, 60, 0.4));
                            border: 2px solid ${borderColor};
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                            animation: rotateIcon 3s linear infinite;
                        ">
                            <i class="fas ${icon}" style="
                                color: ${borderColor};
                                font-size: 1.3rem;
                                text-shadow: 0 0 15px rgba(180, 60, 60, 0.7);
                            "></i>
                        </div>
                        
                        <div style="flex: 1;">
                            <div style="
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                margin-bottom: 12px;
                                flex-wrap: wrap;
                                gap: 10px;
                            ">
                                <h4 style="
                                    color: ${borderColor};
                                    font-family: 'Orbitron', sans-serif;
                                    font-weight: 700;
                                    font-size: 1.1rem;
                                    letter-spacing: 1px;
                                    margin: 0;
                                    text-transform: uppercase;
                                ">
                                    <i class="fas fa-lock" style="margin-right: 10px;"></i>
                                    ${title}
                                </h4>
                                
                                <div style="
                                    background: rgba(180, 60, 60, 0.2);
                                    color: ${borderColor};
                                    padding: 4px 12px;
                                    border-radius: 20px;
                                    font-size: 0.8rem;
                                    font-weight: 500;
                                    letter-spacing: 1px;
                                    border: 1px solid rgba(180, 60, 60, 0.4);
                                ">
                                    <i class="fas fa-clock" style="margin-right: 5px;"></i>
                                    IP БЛОКИРОВКА
                                </div>
                            </div>
                            
                            <div style="
                                color: ${textColor};
                                line-height: 1.6;
                                font-size: 0.9rem;
                                margin-bottom: 15px;
                                padding: 12px;
                                background: rgba(20, 18, 15, 0.4);
                                border-radius: 4px;
                                border: 1px solid rgba(180, 60, 60, 0.2);
                                font-family: 'JetBrains Mono', monospace;
                                backdrop-filter: blur(5px);
                            ">
                                <i class="fas fa-exclamation-circle" style="margin-right: 8px; color: ${borderColor};"></i>
                                ${message}
                            </div>
                            
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 15px;
                                padding-top: 12px;
                                border-top: 1px solid rgba(180, 60, 60, 0.2);
                                color: rgba(192, 184, 168, 0.7);
                                font-size: 0.8rem;
                                flex-wrap: wrap;
                            ">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-shield-alt" style="color: ${borderColor};"></i>
                                    <span>Система безопасности активирована</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-user-secret" style="color: ${borderColor};"></i>
                                    <span>Защита от bruteforce</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-history" style="color: ${borderColor};"></i>
                                    <span>Авторазблокировка через 15 минут</span>
                                </div>
                            </div>
                            
                            <!-- Прогресс-бар блокировки -->
                            <div style="
                                margin-top: 15px;
                                padding: 8px;
                                background: rgba(20, 18, 15, 0.5);
                                border-radius: 4px;
                                border: 1px solid rgba(180, 60, 60, 0.3);
                            ">
                                <div style="
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    margin-bottom: 8px;
                                    font-size: 0.8rem;
                                    color: ${textColor};
                                ">
                                    <span>Время до разблокировки:</span>
                                    <span id="lock-timer" style="font-family: 'Orbitron', sans-serif; font-weight: 600;">15:00</span>
                                </div>
                                <div style="
                                    width: 100%;
                                    height: 8px;
                                    background: rgba(180, 60, 60, 0.2);
                                    border-radius: 4px;
                                    overflow: hidden;
                                ">
                                    <div id="lock-progress" style="
                                        width: 100%;
                                        height: 100%;
                                        background: linear-gradient(90deg, #b43c3c, #ff6b6b);
                                        border-radius: 4px;
                                        animation: progressShrink 900s linear;
                                    "></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Запускаем таймер обратного отсчета
            startLockTimer();
            
        } else {
            // Обычные ошибки (не блокировка IP)
            errorElement.innerHTML = `
                <div class="login-error-box ${type}" style="
                    background: ${bgColor};
                    border: 1px solid ${borderColor};
                    border-left: 4px solid ${borderColor};
                    border-radius: 4px;
                    padding: 15px 20px;
                    margin: 15px 0;
                    color: ${textColor};
                    font-size: 0.9rem;
                    animation: slideIn 0.3s ease-out;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    backdrop-filter: blur(5px);
                ">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="
                            width: 36px;
                            height: 36px;
                            background: ${bgColor};
                            border: 1px solid ${borderColor};
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                        ">
                            <i class="fas ${icon}" style="color: ${borderColor}; font-size: 1rem;"></i>
                        </div>
                        
                        <div style="flex: 1;">
                            <div class="error-title" style="
                                color: ${borderColor};
                                font-weight: 600;
                                margin-bottom: 8px;
                                font-size: 0.95rem;
                                letter-spacing: 0.5px;
                            ">${title}</div>
                            <div class="error-message" style="
                                color: ${textColor};
                                line-height: 1.5;
                                font-size: 0.85rem;
                            ">${message}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        errorElement.style.display = "block";
        
        // Добавляем анимацию появления
        setTimeout(() => {
            const box = errorElement.querySelector('.login-error-box');
            if (box) {
                box.style.animation = "fadeIn 0.5s ease";
            }
        }, 10);
        
        // Время отображения в зависимости от типа
        let hideTime = 7000;
        if (message.includes("IP заблокирован") || message.includes("блокирован")) {
            hideTime = 30000; // 30 секунд для блокировки IP
        } else if (message.includes("НЕВЕРНЫЙ ПАРОЛЬ")) {
            hideTime = 5000; // 5 секунд для неправильного пароля
        } else if (type === "warning") {
            hideTime = 6000; // 6 секунд для предупреждений
        }
        
        // Автоматическое скрытие с плавным исчезновением
        setTimeout(() => {
            if (errorElement && errorElement.style.display !== "none") {
                const box = errorElement.querySelector('.login-error-box');
                if (box) {
                    box.style.opacity = "0";
                    box.style.transform = "translateY(-10px)";
                    box.style.transition = "all 0.5s ease";
                    
                    setTimeout(() => {
                        if (errorElement && errorElement.style.display !== "none") {
                            errorElement.style.display = "none";
                            // Восстанавливаем стили для следующего показа
                            const innerBox = errorElement.querySelector('.login-error-box');
                            if (innerBox) {
                                innerBox.style.opacity = "1";
                                innerBox.style.transform = "translateY(0)";
                            }
                        }
                    }, 500);
                }
            }
        }, hideTime);
    }
    
    // Для блокировки IP также показываем системное уведомление
    if (message.includes("IP заблокирован") || message.includes("блокирован")) {
        setTimeout(() => {
            showSystemNotification(message, "error", true);
        }, 300);
    }
}

// Функция для таймера блокировки
function startLockTimer() {
    const timerElement = document.getElementById('lock-timer');
    const progressElement = document.getElementById('lock-progress');
    
    if (!timerElement || !progressElement) return;
    
    let totalSeconds = 15 * 60; // 15 минут в секундах
    let currentSeconds = totalSeconds;
    
    // Сбрасываем анимацию прогресс-бара
    progressElement.style.animation = 'none';
    progressElement.offsetHeight; // Trigger reflow
    progressElement.style.animation = `progressShrink ${totalSeconds}s linear`;
    
    const timerInterval = setInterval(() => {
        currentSeconds--;
        
        if (currentSeconds <= 0) {
            clearInterval(timerInterval);
            timerElement.textContent = '00:00';
            
            // Обновляем сообщение
            const errorElement = document.getElementById("login-error");
            if (errorElement && errorElement.style.display !== "none") {
                const messageDiv = errorElement.querySelector('.error-message');
                if (messageDiv) {
                    messageDiv.innerHTML = `
                        <div style="color: #8cb43c; font-weight: 600;">
                            <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
                            Блокировка IP снята. Теперь вы можете попробовать войти снова.
                        </div>
                    `;
                }
                
                // Меняем стиль уведомления на успешный
                const box = errorElement.querySelector('.login-error-box');
                if (box) {
                    box.style.borderColor = '#8cb43c';
                    box.style.background = 'rgba(140, 180, 60, 0.1)';
                }
                
                // Скрываем через 5 секунд
                setTimeout(() => {
                    if (errorElement && errorElement.style.display !== "none") {
                        errorElement.style.opacity = "0";
                        errorElement.style.transition = "opacity 0.5s ease";
                        setTimeout(() => {
                            if (errorElement && errorElement.style.display !== "none") {
                                errorElement.style.display = "none";
                                errorElement.style.opacity = "1";
                            }
                        }, 500);
                    }
                }, 5000);
            }
            return;
        }
        
        // Форматируем время
        const minutes = Math.floor(currentSeconds / 60);
        const seconds = currentSeconds % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
    }, 1000);
}

// Функция для системных уведомлений (улучшенная)
function showSystemNotification(message, type = "info", isIPBlock = false) {
    // Удаляем старые уведомления
    const oldNotifications = document.querySelectorAll('.system-notification');
    oldNotifications.forEach(notification => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
    
    // Определяем стили
    let icon, bgColor, borderColor, textColor, title;
    
    if (isIPBlock) {
        icon = 'fa-shield-alt';
        title = 'БЛОКИРОВКА IP';
        bgColor = 'rgba(180, 60, 60, 0.95)';
        borderColor = '#b43c3c';
        textColor = '#ffffff';
    } else {
        switch(type) {
            case 'success':
                icon = 'fa-check-circle';
                title = 'УСПЕХ';
                bgColor = 'rgba(140, 180, 60, 0.95)';
                borderColor = '#8cb43c';
                textColor = '#1e201c';
                break;
            case 'warning':
                icon = 'fa-exclamation-triangle';
                title = 'ПРЕДУПРЕЖДЕНИЕ';
                bgColor = 'rgba(192, 176, 112, 0.95)';
                borderColor = '#c0b070';
                textColor = '#1e201c';
                break;
            case 'error':
                icon = 'fa-times-circle';
                title = 'ОШИБКА';
                bgColor = 'rgba(180, 60, 60, 0.95)';
                borderColor = '#b43c3c';
                textColor = '#ffffff';
                break;
            default: // info
                icon = 'fa-info-circle';
                title = 'ИНФОРМАЦИЯ';
                bgColor = 'rgba(40, 42, 36, 0.95)';
                borderColor = '#4a4a3a';
                textColor = '#c0b070';
        }
    }
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `system-notification ${type} ${isIPBlock ? 'ip-block' : ''}`;
    
    notification.innerHTML = `
        <div style="
            background: ${bgColor};
            border: 2px solid ${borderColor};
            border-radius: 8px;
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(10px);
            max-width: 450px;
            min-width: 350px;
            position: relative;
            overflow: hidden;
            z-index: 1000;
        ">
            <!-- Эффект пульсации для IP блокировки -->
            ${isIPBlock ? `
            <div style="
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: pulseGlow 2s infinite alternate;
                pointer-events: none;
                z-index: -1;
            "></div>
            ` : ''}
            
            <div style="
                width: 44px;
                height: 44px;
                background: ${isIPBlock ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};
                border: 2px solid ${borderColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                ${isIPBlock ? 'animation: rotateIcon 3s linear infinite;' : ''}
            ">
                <i class="fas ${icon}" style="
                    color: ${textColor};
                    font-size: 1.2rem;
                    ${isIPBlock ? 'text-shadow: 0 0 10px rgba(255,255,255,0.5);' : ''}
                "></i>
            </div>
            
            <div style="flex: 1;">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                ">
                    <h4 style="
                        color: ${textColor};
                        font-family: 'Orbitron', sans-serif;
                        font-weight: 600;
                        font-size: 1rem;
                        margin: 0;
                        letter-spacing: 1px;
                    ">
                        ${title}
                    </h4>
                    
                    ${isIPBlock ? `
                    <div style="
                        background: rgba(255,255,255,0.2);
                        color: ${textColor};
                        padding: 3px 10px;
                        border-radius: 20px;
                        font-size: 0.7rem;
                        font-weight: 500;
                        letter-spacing: 1px;
                        border: 1px solid rgba(255,255,255,0.3);
                    ">
                        <i class="fas fa-lock" style="margin-right: 5px;"></i>
                        ЗАЩИТА
                    </div>
                    ` : ''}
                </div>
                
                <div style="
                    color: ${textColor};
                    font-size: 0.9rem;
                    font-weight: ${isIPBlock ? '500' : 'normal'};
                    line-height: 1.4;
                ">
                    ${message}
                </div>
            </div>
        </div>
    `;
    
    // Стили для позиционирования
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 9999;
        transform: translateX(150%);
        opacity: 0;
        transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;
    
    document.body.appendChild(notification);
    
    // Показываем с анимацией
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);
    
    // Время отображения
    const duration = isIPBlock ? 8000 : 
                    type === 'error' ? 6000 : 
                    type === 'warning' ? 5000 : 
                    type === 'success' ? 4000 : 3500;
    
    // Автоматическое скрытие с эффектом
    setTimeout(() => {
        notification.style.transform = 'translateX(150%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, duration);
}

// Функция для трекинга попыток входа
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
        // Сбрасываем счетчик при успешном входе
        loginAttempts[ip].attempts = 0;
        loginAttempts[ip].lockedUntil = 0;
        console.log(`Successful login from IP ${ip}, attempts reset`);
    } else {
        // Увеличиваем счетчик неудачных попыток
        loginAttempts[ip].attempts++;
        loginAttempts[ip].lastAttempt = now;
        
        console.log(`Failed login attempt ${loginAttempts[ip].attempts} from IP ${ip}`);
        
        // Проверяем, достигнут ли лимит попыток
        if (loginAttempts[ip].attempts >= MAX_ATTEMPTS) {
            loginAttempts[ip].lockedUntil = now + LOCKOUT_TIME;
            
            // Показываем сообщение о блокировке IP
            const minutesLeft = Math.ceil(LOCKOUT_TIME / 60000);
            showLoginError(`Слишком много неудачных попыток входа. IP-адрес заблокирован на ${minutesLeft} минут.`, "error");
            
            // Записываем в лог блокировку
            console.log(`IP ${ip} blocked for ${minutesLeft} minutes due to ${MAX_ATTEMPTS} failed attempts`);
            
        } else {
            // Для первых неудачных попыток показываем только ошибку сверху
            const attemptsLeft = MAX_ATTEMPTS - loginAttempts[ip].attempts;
            console.log(`IP ${ip} has ${attemptsLeft} attempts left before blocking`);
        }
    }
    
    // Очищаем старые записи (старше 24 часов)
    for (const ipKey in loginAttempts) {
        if (now - loginAttempts[ipKey].lastAttempt > 24 * 60 * 60 * 1000) {
            console.log(`Clearing old login attempts for IP ${ipKey}`);
            delete loginAttempts[ipKey];
        }
    }
}

// Функция проверки блокировки IP
function isIPLocked(ip) {
    if (!loginAttempts[ip]) {
        return false;
    }
    
    const now = Date.now();
    
    if (loginAttempts[ip].lockedUntil > now) {
        const minutesLeft = Math.ceil((loginAttempts[ip].lockedUntil - now) / 60000);
        const secondsLeft = Math.ceil((loginAttempts[ip].lockedUntil - now) / 1000);
        
        if (minutesLeft > 1) {
            return `IP-адрес временно заблокирован. Попробуйте через ${minutesLeft} минут`;
        } else {
            return `IP-адрес временно заблокирован. Попробуйте через ${secondsLeft} секунд`;
        }
    }
    
    return false;
}

// Функция для завершения входа
function completeLogin() {
    const loginScreen = document.getElementById("login-screen");
    const terminal = document.getElementById("terminal");
    const tabsBar = document.getElementById('account-tabs-bar');
    
    console.log('=== COMPLETE LOGIN START ===');
    
    if (loginScreen && terminal) {
        // Скрываем экран входа
        loginScreen.style.display = 'none';
        loginScreen.style.visibility = 'hidden';
        
        // Показываем терминал
        terminal.style.display = 'flex';
        terminal.style.visibility = 'visible';
        
        console.log('Screens switched');
        
        // Сохраняем сессию
        const sessionData = {
            user: CURRENT_USER,
            role: CURRENT_ROLE,
            rank: CURRENT_RANK ? CURRENT_RANK.level : null,
            staticId: CURRENT_STATIC_ID,
            timestamp: new Date().getTime()
        };
        
        localStorage.setItem('mlk_session', JSON.stringify(sessionData));
        
        // Загружаем данные
        loadData(() => {
            console.log('Data loaded after login');
            
            // Загружаем сохраненные вкладки
            loadAccountTabsFromStorage();
            
            // Создаем/обновляем основную вкладку
            addMainAccountTab();
            
            // ПОКАЗЫВАЕМ ПАНЕЛЬ ВКЛАДОК (она должна быть видна с основной вкладкой)
            if (tabsBar && accountTabs.length > 0) {
                tabsBar.style.display = 'flex';
            }
            
            // Настраиваем интерфейс
            setupSidebar();
            updateSystemPrompt(`ПОДКЛЮЧЕНИЕ УСПЕШНО. ДОБРО ПОЖАЛОВАТЬ, ${CURRENT_USER}`);
            
            // Показываем начальный экран
            if (CURRENT_RANK.level >= RANKS.ADMIN.level) {
                renderSystem();
            } else {
                renderMLKScreen();
            }
            
            // Обновляем интерфейс
            setTimeout(() => {
                adjustInterfaceHeights();
                setupAutoScroll();
            }, 100);
        });
        
    } else {
        console.error('ERROR: Login screen or terminal not found');
    }
}

/* ===== ФУНКЦИИ УПРАВЛЕНИЯ ВКЛАДКАМИ ===== */

window.manageAccountTabs = function() {
    const modal = document.createElement('div');
    modal.id = 'tabs-management-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 8, 5, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        backdrop-filter: blur(10px);
    `;
    
    const mainTabs = accountTabs.filter(tab => tab.isMain);
    const additionalTabs = accountTabs.filter(tab => !tab.isMain);
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(145deg, rgba(28, 26, 23, 0.98), rgba(20, 18, 15, 0.98));
            border: 2px solid #c0b070;
            border-radius: 12px;
            padding: 30px;
            max-width: 800px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="color: #c0b070; font-family: 'Orbitron', sans-serif; margin: 0;">
                    <i class="fas fa-layer-group"></i> УПРАВЛЕНИЕ ВКЛАДКАМИ
                </h3>
                <button onclick="document.getElementById('tabs-management-modal').remove()" style="
                    background: none;
                    border: none;
                    color: #8f9779;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 5px;
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h4 style="color: #8cb43c; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-info-circle"></i> СТАТИСТИКА
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: rgba(40, 42, 36, 0.5); border-radius: 6px; padding: 15px; text-align: center;">
                        <div style="color: #c0b070; font-size: 2rem; font-weight: bold;">${accountTabs.length}</div>
                        <div style="color: #8f9779; font-size: 0.9rem;">Всего вкладок</div>
                    </div>
                    <div style="background: rgba(40, 42, 36, 0.5); border-radius: 6px; padding: 15px; text-align: center;">
                        <div style="color: #8cb43c; font-size: 2rem; font-weight: bold;">${mainTabs.length}</div>
                        <div style="color: #8f9779; font-size: 0.9rem;">Основных</div>
                    </div>
                    <div style="background: rgba(40, 42, 36, 0.5); border-radius: 6px; padding: 15px; text-align: center;">
                        <div style="color: #c0b070; font-size: 2rem; font-weight: bold;">${additionalTabs.length}</div>
                        <div style="color: #8f9779; font-size: 0.9rem;">Дополнительных</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h4 style="color: #8cb43c; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fas fa-list"></i> СОХРАНЕННЫЕ ВКЛАДКИ</span>
                    <span style="color: #8f9779; font-size: 0.9rem;">${accountTabs.length} шт.</span>
                </h4>
                
                <div class="scrollable-container" style="max-height: 300px; background: rgba(30, 32, 28, 0.3); border-radius: 6px; padding: 15px;">
                    ${accountTabs.length === 0 ? 
                        `<div style="text-align: center; padding: 40px; color: #6a6a5a;">
                            <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 10px;"></i>
                            <p>Нет сохраненных вкладок</p>
                        </div>` :
                        accountTabs.map((tab, index) => `
                            <div style="
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                padding: 12px 15px;
                                margin-bottom: 10px;
                                background: ${index === activeAccountTab ? 'rgba(192, 176, 112, 0.1)' : 'rgba(40, 42, 36, 0.5)'};
                                border: 1px solid ${index === activeAccountTab ? '#c0b070' : '#4a4a3a'};
                                border-radius: 4px;
                                cursor: pointer;
                            " onclick="switchAccount(${index}); document.getElementById('tabs-management-modal').remove()">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="
                                        width: 36px;
                                        height: 36px;
                                        background: ${tab.isMain ? 'rgba(192, 176, 112, 0.2)' : 'rgba(140, 180, 60, 0.2)'};
                                        border-radius: 50%;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        color: ${tab.isMain ? '#c0b070' : '#8cb43c'};
                                    ">
                                        <i class="fas ${tab.isMain ? 'fa-home' : 'fa-user'}"></i>
                                    </div>
                                    <div>
                                        <div style="color: ${tab.isMain ? '#c0b070' : '#8cb43c'}; font-weight: 500;">
                                            ${tab.name}
                                            ${tab.isMain ? ' <span style="color: #8f9779; font-size: 0.8rem;">(Основной)</span>' : ''}
                                        </div>
                                        <div style="color: #8f9779; font-size: 0.8rem;">
                                            <i class="fas fa-crown"></i> ${tab.rankName || 'Без ранга'}
                                            • <i class="far fa-calendar"></i> ${tab.createdAt ? new Date(tab.createdAt).toLocaleDateString() : 'Неизвестно'}
                                        </div>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    ${!tab.isMain ? `
                                    <button onclick="event.stopPropagation(); closeAccountTab('${tab.id}')" 
                                            style="background: rgba(180, 60, 60, 0.2); border: 1px solid #b43c3c; color: #b43c3c; padding: 4px 8px; border-radius: 3px; font-size: 0.8rem; cursor: pointer;">
                                        <i class="fas fa-times"></i>
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
            
            <div style="display: flex; gap: 15px; justify-content: flex-end;">
                <button onclick="exportAccountTabs()" class="btn-secondary" style="padding: 10px 20px;">
                    <i class="fas fa-download"></i> ЭКСПОРТ
                </button>
                <button onclick="clearAllAccountTabs()" class="btn-primary" style="padding: 10px 20px; border-color: #b43c3c; color: #b43c3c;">
                    <i class="fas fa-trash"></i> ОЧИСТИТЬ ВСЕ
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Функции для управления вкладками
function exportAccountTabs() {
    const tabsData = {
        exportedAt: new Date().toLocaleString(),
        exportedBy: CURRENT_USER,
        tabs: accountTabs
    };
    
    const dataStr = JSON.stringify(tabsData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `account-tabs-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Вкладки экспортированы в JSON файл', 'success');
}

function clearAllAccountTabs() {
    if (!confirm('Очистить ВСЕ сохраненные вкладки?\n\nЭто удалит все дополнительные вкладки и сбросит основную.\n\nДействие нельзя отменить!')) {
        return;
    }
    
    // Оставляем только основную вкладку
    const mainTab = accountTabs.find(tab => tab.isMain);
    accountTabs = mainTab ? [mainTab] : [];
    activeAccountTab = 0;
    
    // Сохраняем изменения
    saveAccountTabsToStorage();
    
    // Обновляем интерфейс
    renderAccountTabs();
    
    // Закрываем модальное окно
    const modal = document.getElementById('tabs-management-modal');
    if (modal) modal.remove();
    
    showNotification('Все вкладки очищены, оставлена только основная', 'success');
}

/* ===== ФУНКЦИИ УДАЛЕНИЯ АККАУНТОВ ===== */

window.deleteUserByStaticId = async function(staticId) {
    console.log('Удаление пользователя с staticId:', staticId);
    
    // Проверяем права доступа
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK.level !== CREATOR_RANK.level) { 
        showNotification("Только старший куратор или выше может удалять пользователей", "error"); 
        return false; 
    }
    
    // Находим пользователя
    const user = users.find(u => u.staticId === staticId);
    if (!user) { 
        showNotification("Пользователь не найден", "error"); 
        return false; 
    }
    
    // Проверяем, не пытаемся ли удалить себя
    if (user.username === CURRENT_USER) {
        showNotification("Нельзя удалить свой собственный аккаунт", "error");
        return false;
    }
    
    // Проверяем, не является ли пользователь защищенным
    const isProtected = PROTECTED_USERS.some(protectedUser => 
        protectedUser.toLowerCase() === user.username.toLowerCase()
    );
    if (isProtected) {
        showNotification("Нельзя удалить защищенного пользователя", "error");
        return false;
    }
    
    if (!confirm(`❌ ВНИМАНИЕ!\n\nВы собираетесь удалить пользователя:\n\nИмя: ${user.username}\nStatic ID: ${staticId}\nРанг: ${user.role}\n\nЭто действие:\n• Удалит пользователя из базы данных\n• Удалит все связанные данные\n• Закроет все вкладки пользователя\n• Нельзя отменить!\n\nПродолжить?`)) {
        return false;
    }
    
    try {
        showNotification("Удаление пользователя...", "info");
        
        // Удаляем пользователя из базы
        await db.ref('mlk_users/' + user.id).remove();
        
        // Удаляем связанные записи
        await deleteUserRelatedData(user.username, staticId);
        
        // Закрываем вкладки этого пользователя
        closeUserTabs(staticId);
        
        // Обновляем локальные данные
        await new Promise(resolve => loadData(resolve));
        
        // Обновляем отображение
        renderUsersWithPagination(1);
        
        showNotification(`✅ Пользователь "${user.username}" полностью удален из системы`, "success");
        
        // Логируем удаление
        await db.ref('mlk_audit_log').push({
            action: 'USER_DELETED',
            targetUser: user.username,
            targetStaticId: staticId,
            performedBy: CURRENT_USER,
            timestamp: new Date().toLocaleString(),
            details: `Пользователь удален полностью из системы`
        });
        
        return true;
        
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        showNotification(`Ошибка удаления: ${error.message}`, "error");
        return false;
    }
}

/* ===== БЫСТРОЕ УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЕЙ ОДНОГО РАНГА ===== */

window.deleteUsersByRank = async function(rankLevel) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK.level !== CREATOR_RANK.level) {
        showNotification("Только администратор может массово удалять пользователей", "error");
        return;
    }
    
    const rankName = getRankDisplayName(rankLevel);
    const usersToDelete = users.filter(user => {
        const isProtected = PROTECTED_USERS.some(protectedUser => 
            protectedUser.toLowerCase() === user.username.toLowerCase()
        );
        const isCurrentUser = user.username === CURRENT_USER;
        return user.rank === rankLevel && !isProtected && !isCurrentUser;
    });
    
    if (usersToDelete.length === 0) {
        showNotification(`Нет пользователей ранга "${rankName}" для удаления`, "info");
        return;
    }
    
    if (!confirm(`Удалить всех пользователей ранга "${rankName}"?\n\nКоличество: ${usersToDelete.length}\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    try {
        showNotification(`Удаление ${usersToDelete.length} пользователей ранга "${rankName}"...`, "warning");
        
        const deletePromises = usersToDelete.map(user => 
            db.ref('mlk_users/' + user.id).remove()
        );
        
        await Promise.all(deletePromises);
        
        // Закрываем вкладки
        usersToDelete.forEach(user => closeUserTabs(user.staticId));
        
        // Обновляем данные
        await new Promise(resolve => loadData(resolve));
        renderUsersWithPagination(1);
        
        showNotification(`✅ Удалено ${usersToDelete.length} пользователей ранга "${rankName}"`, "success");
        
    } catch (error) {
        console.error('Ошибка удаления пользователей по рангу:', error);
        showNotification(`Ошибка удаления: ${error.message}`, "error");
    }
};

/* ===== ФУНКЦИЯ УДАЛЕНИЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ ===== */

window.deleteAllUsersConfirm = function() {
    // Проверяем права - только АДМИНИСТРАТОР
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK.level !== CREATOR_RANK.level) {
        showNotification("Только администратор может удалять всех пользователей", "error");
        return;
    }
    
    // Фильтруем пользователей, которых можно удалить
    const usersToDelete = users.filter(user => {
        const isProtected = PROTECTED_USERS.some(protectedUser => 
            protectedUser.toLowerCase() === user.username.toLowerCase()
        );
        const isCurrentUser = user.username === CURRENT_USER;
        return !isProtected && !isCurrentUser;
    });
    
    if (usersToDelete.length === 0) {
        showNotification("Нет пользователей для удаления", "info");
        return;
    }
    
    // Создаем подробное сообщение с подсчетом
    let userCountByRank = {};
    usersToDelete.forEach(user => {
        const rank = user.role || 'БЕЗ РАНГА';
        userCountByRank[rank] = (userCountByRank[rank] || 0) + 1;
    });
    
    let rankSummary = Object.entries(userCountByRank)
        .map(([rank, count]) => `• ${rank}: ${count}`)
        .join('\n');
    
    const confirmationMessage = `🚨 ВНИМАНИЕ! КРИТИЧЕСКАЯ ОПЕРАЦИЯ!\n\nВы собираетесь удалить ВСЕХ пользователей:\n\n${rankSummary}\n\nИтого: ${usersToDelete.length} пользователей\n\nЭта операция:\n❌ Удалит всех пользователей из базы данных\n❌ Удалит все связанные данные\n❌ Закроет все вкладки\n❌ НЕЛЬЗЯ ОТМЕНИТЬ!\n\nДля подтверждения введите: УДАЛИТЬ ВСЕХ`;
    
    // Создаем модальное окно подтверждения
    const modal = document.createElement('div');
    modal.id = 'delete-all-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 8, 5, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(145deg, rgba(28, 26, 23, 0.98), rgba(20, 18, 15, 0.98));
            border: 3px solid #b43c3c;
            border-radius: 12px;
            padding: 30px;
            max-width: 600px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(180, 60, 60, 0.3);
        ">
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: rgba(180, 60, 60, 0.2);
                    border: 3px solid #b43c3c;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                ">
                    <i class="fas fa-skull-crossbones" style="font-size: 2.5rem; color: #b43c3c;"></i>
                </div>
                <h3 style="color: #b43c3c; font-family: 'Orbitron', sans-serif; margin: 0 0 10px;">
                    УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
                </h3>
                <p style="color: #8f9779; font-size: 0.9rem; margin: 0;">
                    Критическая операция администратора
                </p>
            </div>
            
            <div style="
                background: rgba(180, 60, 60, 0.1);
                border: 1px solid #b43c3c;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 25px;
            ">
                <div style="color: #c0b070; font-weight: 600; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    БУДУТ УДАЛЕНЫ:
                </div>
                
                <div style="color: #8f9779; font-size: 0.9rem; line-height: 1.6; margin-bottom: 20px;">
                    ${rankSummary.split('\n').map(line => `<div style="margin-bottom: 5px;">${line}</div>`).join('')}
                </div>
                
                <div style="
                    background: rgba(20, 18, 15, 0.8);
                    border: 1px solid #4a4a3a;
                    border-radius: 4px;
                    padding: 15px;
                    text-align: center;
                    color: #c0b070;
                    font-weight: 600;
                    font-size: 1.1rem;
                    margin-bottom: 15px;
                ">
                    <i class="fas fa-users"></i> Итого: ${usersToDelete.length} пользователей
                </div>
                
                <div style="color: #b43c3c; font-size: 0.85rem; display: flex; align-items: flex-start; gap: 10px;">
                    <i class="fas fa-shield-alt"></i>
                    <div>
                        <strong>Будут защищены:</strong>
                        <div style="margin-top: 5px;">
                            • Текущий пользователь (${CURRENT_USER})<br>
                            • Защищенные пользователи (${PROTECTED_USERS.join(', ')})
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <div style="color: #c0b070; margin-bottom: 10px; font-weight: 600;">
                    <i class="fas fa-keyboard"></i> ПОДТВЕРЖДЕНИЕ
                </div>
                <div style="color: #8f9779; font-size: 0.9rem; margin-bottom: 15px;">
                    Для подтверждения введите фразу <strong style="color: #b43c3c;">УДАЛИТЬ ВСЕХ</strong> ниже:
                </div>
                <input type="text" id="delete-all-confirmation" class="form-input" 
                       placeholder="Введите 'УДАЛИТЬ ВСЕХ'" 
                       style="width: 100%; text-align: center; font-size: 1rem; padding: 12px;">
            </div>
            
            <div style="display: flex; gap: 15px; justify-content: space-between;">
                <button onclick="closeDeleteAllModal()" 
                        style="
                            background: rgba(40, 42, 36, 0.8);
                            border: 1px solid #4a4a3a;
                            color: #8f9779;
                            padding: 12px 24px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: 500;
                            flex: 1;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.background='rgba(60, 62, 56, 0.8)'; this.style.borderColor='#5a5a4a'"
                        onmouseout="this.style.background='rgba(40, 42, 36, 0.8)'; this.style.borderColor='#4a4a3a'">
                    <i class="fas fa-times"></i> ОТМЕНА
                </button>
                
                <button onclick="deleteAllUsers()" 
                        id="delete-all-button"
                        disabled
                        style="
                            background: rgba(180, 60, 60, 0.2);
                            border: 1px solid #b43c3c;
                            color: #6a6a5a;
                            padding: 12px 24px;
                            border-radius: 4px;
                            cursor: not-allowed;
                            font-weight: 500;
                            flex: 1;
                            transition: all 0.2s;
                        ">
                    <i class="fas fa-skull-crossbones"></i> УДАЛИТЬ ВСЕХ
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Активация кнопки при правильном вводе
    const input = document.getElementById('delete-all-confirmation');
    const button = document.getElementById('delete-all-button');
    
    input.addEventListener('input', function() {
        const isConfirmed = this.value.trim() === 'УДАЛИТЬ ВСЕХ';
        
        if (isConfirmed) {
            button.disabled = false;
            button.style.background = 'rgba(180, 60, 60, 0.4)';
            button.style.color = '#b43c3c';
            button.style.cursor = 'pointer';
            button.style.borderColor = '#ff4d4d';
            button.onmouseover = function() {
                this.style.background = 'rgba(180, 60, 60, 0.6)';
                this.style.borderColor = '#ff6b6b';
            };
            button.onmouseout = function() {
                this.style.background = 'rgba(180, 60, 60, 0.4)';
                this.style.borderColor = '#ff4d4d';
            };
        } else {
            button.disabled = true;
            button.style.background = 'rgba(180, 60, 60, 0.2)';
            button.style.color = '#6a6a5a';
            button.style.cursor = 'not-allowed';
            button.style.borderColor = '#b43c3c';
            button.onmouseover = null;
            button.onmouseout = null;
        }
    });
    
    // Фокус на поле ввода
    setTimeout(() => {
        if (input) input.focus();
    }, 100);
}

window.deleteAllUsers = async function() {
    try {
        // Проверяем права
        if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK.level !== CREATOR_RANK.level) {
            showNotification("Только администратор может удалять всех пользователей", "error");
            closeDeleteAllModal();
            return;
        }
        
        // Получаем список пользователей для удаления
        const usersToDelete = users.filter(user => {
            const isProtected = PROTECTED_USERS.some(protectedUser => 
                protectedUser.toLowerCase() === user.username.toLowerCase()
            );
            const isCurrentUser = user.username === CURRENT_USER;
            return !isProtected && !isCurrentUser;
        });
        
        if (usersToDelete.length === 0) {
            showNotification("Нет пользователей для удаления", "info");
            closeDeleteAllModal();
            return;
        }
        
        showNotification(`Начинаю удаление ${usersToDelete.length} пользователей...`, "warning");
        
        // Удаляем каждого пользователя
        let deletedCount = 0;
        let errorCount = 0;
        
        for (const user of usersToDelete) {
            try {
                // Удаляем пользователя из базы
                await db.ref('mlk_users/' + user.id).remove();
                
                // Удаляем связанные данные
                await deleteUserRelatedData(user.username, user.staticId);
                
                // Закрываем вкладки
                closeUserTabs(user.staticId);
                
                deletedCount++;
                
                // Обновляем прогресс
                const progress = Math.round((deletedCount / usersToDelete.length) * 100);
                const progressElement = document.createElement('div');
                progressElement.id = 'delete-progress';
                progressElement.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(30, 32, 28, 0.95);
                    border: 1px solid #4a4a3a;
                    border-radius: 8px;
                    padding: 15px 25px;
                    z-index: 10001;
                    min-width: 300px;
                    text-align: center;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.5);
                `;
                progressElement.innerHTML = `
                    <div style="color: #c0b070; font-weight: 600; margin-bottom: 10px;">
                        <i class="fas fa-trash"></i> Удаление пользователей...
                    </div>
                    <div style="color: #8f9779; margin-bottom: 10px;">
                        ${deletedCount} / ${usersToDelete.length} (${progress}%)
                    </div>
                    <div style="background: #4a4a3a; height: 6px; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${progress}%; height: 100%; background: #b43c3c; transition: width 0.3s;"></div>
                    </div>
                `;
                
                // Обновляем или создаем элемент прогресса
                const existingProgress = document.getElementById('delete-progress');
                if (existingProgress) {
                    existingProgress.innerHTML = progressElement.innerHTML;
                } else {
                    document.body.appendChild(progressElement);
                }
                
            } catch (error) {
                console.error(`Ошибка удаления пользователя ${user.username}:`, error);
                errorCount++;
            }
        }
        
        // Удаляем элемент прогресса
        const progressElement = document.getElementById('delete-progress');
        if (progressElement) {
            setTimeout(() => progressElement.remove(), 1000);
        }
        
        // Закрываем модальное окно
        closeDeleteAllModal();
        
        // Обновляем данные
        await new Promise(resolve => loadData(resolve));
        
        // Обновляем отображение
        renderUsersWithPagination(1);
        
        // Показываем результат
        if (errorCount === 0) {
            showNotification(`✅ Успешно удалено ${deletedCount} пользователей`, "success");
            
            // Логируем операцию
            await db.ref('mlk_audit_log').push({
                action: 'MASS_USER_DELETION',
                deletedCount: deletedCount,
                performedBy: CURRENT_USER,
                timestamp: new Date().toLocaleString(),
                details: `Массовое удаление ${deletedCount} пользователей`
            });
        } else {
            showNotification(`⚠️ Удалено ${deletedCount} пользователей, ошибок: ${errorCount}`, "warning");
        }
        
        // Автоматически закрываем все дополнительные вкладки
        const additionalTabs = accountTabs.filter(tab => !tab.isMain);
        if (additionalTabs.length > 0) {
            setTimeout(() => {
                showNotification(`Закрыто ${additionalTabs.length} вкладок удаленных пользователей`, "info");
            }, 1000);
        }
        
    } catch (error) {
        console.error('Ошибка массового удаления пользователей:', error);
        showNotification(`❌ Ошибка удаления: ${error.message}`, "error");
        closeDeleteAllModal();
    }
};

function closeDeleteAllModal() {
    const modal = document.getElementById('delete-all-modal');
    if (modal) {
        modal.remove();
    }
}

async function deleteUserRelatedData(username, staticId) {
    try {
        console.log('Удаление связанных данных для:', username, staticId);
        
        // Удаляем из whitelist
        const whitelistSnapshot = await db.ref('mlk_whitelist').once('value');
        const whitelistData = whitelistSnapshot.val() || {};
        const whitelistPromises = [];
        
        for (const key in whitelistData) {
            if (whitelistData[key].username === username || whitelistData[key].staticId === staticId) {
                whitelistPromises.push(db.ref('mlk_whitelist/' + key).remove());
            }
        }
        
        // Удаляем IP записи
        const ipSnapshot = await db.ref('mlk_ip_tracking').once('value');
        const ipData = ipSnapshot.val() || {};
        const ipPromises = [];
        
        for (const key in ipData) {
            if (ipData[key].username === username || ipData[key].staticId === staticId) {
                ipPromises.push(db.ref('mlk_ip_tracking/' + key).remove());
            }
        }
        
        // Обновляем отчеты (помечаем как удаленные)
        const reportsSnapshot = await db.ref('mlk_reports').once('value');
        const reportsData = reportsSnapshot.val() || {};
        const reportPromises = [];
        
        for (const key in reportsData) {
            if (reportsData[key].author === username || reportsData[key].authorStaticId === staticId) {
                reportPromises.push(
                    db.ref('mlk_reports/' + key).update({
                        authorDeleted: true,
                        originalAuthor: username,
                        deletedBy: CURRENT_USER,
                        deletionDate: new Date().toLocaleString()
                    })
                );
            }
        }
        
        // Ждем выполнения всех обещаний
        await Promise.all([...whitelistPromises, ...ipPromises, ...reportPromises]);
        
        console.log('Связанные данные пользователя удалены');
        return true;
        
    } catch (error) {
        console.error('Ошибка удаления связанных данных:', error);
        throw error;
    }
}

function closeUserTabs(staticId) {
    // Находим пользователя по staticId
    const user = users.find(u => u.staticId === staticId);
    if (!user) return;
    
    console.log('Закрытие вкладок для пользователя:', user.username);
    
    // Находим и закрываем все вкладки этого пользователя
    const tabsToClose = accountTabs.filter(tab => 
        tab.login && tab.login.toLowerCase() === user.username.toLowerCase()
    );
    
    tabsToClose.forEach(tab => {
        console.log('Закрытие вкладки:', tab.name);
        // Удаляем из массива вкладок
        const index = accountTabs.findIndex(t => t.id === tab.id);
        if (index !== -1) {
            accountTabs.splice(index, 1);
        }
    });
    
    // Обновляем активную вкладку, если текущая была удалена
    if (tabsToClose.some(tab => tab.id === accountTabs[activeAccountTab]?.id)) {
        if (accountTabs.length > 0) {
            activeAccountTab = 0;
            switchAccount(0);
        } else {
            activeAccountTab = 0;
            // Показываем экран без вкладок
            const content = document.getElementById("content-body");
            if (content) {
                content.innerHTML = `
                    <div class="empty-screen" style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                        color: #8f9779;
                        text-align: center;
                        padding: 40px;
                    ">
                        <i class="fas fa-users" style="font-size: 4rem; margin-bottom: 20px; color: #4a4a3a;"></i>
                        <h3 style="color: #c0b070; margin-bottom: 10px;">НЕТ АКТИВНЫХ АККАУНТОВ</h3>
                        <p style="max-width: 400px; margin-bottom: 20px;">
                            Вкладка была закрыта, так как пользователь был удален.
                        </p>
                        <button onclick="addMainAccountTab(); renderSystem();" class="btn-primary" style="margin-top: 20px;">
                            <i class="fas fa-user"></i> ВЕРНУТЬСЯ К ОСНОВНОМУ АККАУНТУ
                        </button>
                    </div>
                `;
            }
        }
    }
    
    // Сохраняем изменения
    saveAccountTabsToStorage();
    
    console.log('Закрыто вкладок:', tabsToClose.length);
    return tabsToClose.length;
}

/* ===== НОВЫЕ ФУНКЦИИ ДЛЯ СИСТЕМЫ ВКЛАДОК ===== */

/* ===== УЛУЧШЕННОЕ СОХРАНЕНИЕ И ЗАГРУЗКА ВКЛАДОК ===== */

function saveAccountTabsToStorage() {
    try {
        // Сохраняем ВСЕ вкладки, включая основной аккаунт
        const tabsToSave = accountTabs.map(tab => ({
            id: tab.id,
            name: tab.name,
            login: tab.login,
            rankLevel: tab.rankLevel,
            rankName: tab.rankName,
            access: tab.access,
            createdAt: tab.createdAt,
            isMinimized: tab.isMinimized,
            isMain: tab.isMain,
            savedUserData: tab.savedUserData,
            data: tab.data
        }));
        
        localStorage.setItem('accountTabs', JSON.stringify(tabsToSave));
        localStorage.setItem('activeAccountTab', activeAccountTab.toString());
        console.log('Вкладки сохранены в localStorage:', tabsToSave.length, 'вкладок');
    } catch (error) {
        console.error('Ошибка сохранения вкладок:', error);
    }
}

function loadAccountTabsFromStorage() {
    try {
        const savedTabs = localStorage.getItem('accountTabs');
        if (savedTabs) {
            const parsedTabs = JSON.parse(savedTabs);
            console.log('Загружаем вкладки из localStorage:', parsedTabs.length, 'вкладок');
            
            // Восстанавливаем ВСЕ вкладки
            accountTabs = parsedTabs;
            
            // Восстанавливаем активную вкладку
            const savedActiveTab = localStorage.getItem('activeAccountTab');
            activeAccountTab = savedActiveTab ? parseInt(savedActiveTab) : 0;
            
            // Корректируем индекс, если он выходит за пределы
            if (activeAccountTab >= accountTabs.length) {
                activeAccountTab = accountTabs.length > 0 ? accountTabs.length - 1 : 0;
            }
            
            console.log('Вкладки загружены:', {
                totalTabs: accountTabs.length,
                activeTab: activeAccountTab,
                tabs: accountTabs.map(t => ({ name: t.name, isMain: t.isMain }))
            });
            
            return true;
        }
    } catch (error) {
        console.error('Ошибка загрузки вкладок:', error);
    }
    return false;
}

function clearAccountTabsStorage() {
    localStorage.removeItem('accountTabs');
    localStorage.removeItem('activeAccountTab');
    console.log('Хранилище вкладок очищено');
}

function updateMainAccountDisplay() {
    const usernameEl = document.getElementById('current-username');
    const rankEl = document.getElementById('current-rank');
    
    if (usernameEl && CURRENT_USER) {
        usernameEl.textContent = CURRENT_USER.toUpperCase();
    }
    
    if (rankEl && CURRENT_RANK) {
        rankEl.textContent = CURRENT_RANK.name || '';
    }
}

function getRankDisplayName(level) {
    if (!level) return 'БЕЗ РАНГА';
    if (CREATOR_RANK && CREATOR_RANK.level === level) return CREATOR_RANK.name;
    
    for (const key in RANKS) {
        if (RANKS[key].level === level) return RANKS[key].name;
    }
    return 'МЛАДШИЙ КУРАТОР';
}

function updateAccountDisplay(tab) {
    const usernameEl = document.getElementById('current-username');
    const rankEl = document.getElementById('current-rank');
    
    if (usernameEl) {
        if (tab.isMain) {
            usernameEl.textContent = CURRENT_USER.toUpperCase();
        } else {
            usernameEl.textContent = `${tab.login} [${tab.rankName || 'ДОП. АККАУНТ'}]`;
        }
    }
    
    if (rankEl) {
        if (tab.isMain) {
            rankEl.textContent = CURRENT_RANK?.name || '';
        } else {
            rankEl.textContent = tab.rankName || 'ДОП. АККАУНТ';
        }
    }
}

function updateMainAccountDisplay() {
    const usernameEl = document.getElementById('current-username');
    const rankEl = document.getElementById('current-rank');
    
    if (usernameEl && CURRENT_USER) {
        usernameEl.textContent = CURRENT_USER.toUpperCase();
    }
    
    if (rankEl && CURRENT_RANK) {
        rankEl.textContent = CURRENT_RANK.name || '';
    }
}

function updateSidebarForTab(tab) {
    // Сначала скрываем все элементы навигации
    document.querySelectorAll('.nav-button').forEach(btn => {
        // Не скрываем всегда видимые кнопки (профиль)
        if (!btn.classList.contains('always-visible')) {
            btn.style.display = 'none';
        }
    });
    
    // Показываем все элементы навигации для основного аккаунта
    if (tab.isMain) {
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.style.display = 'flex';
        });
        return;
    }
    
    // Показываем только те элементы, к которым есть доступ у этой вкладки
    if (tab.access && Array.isArray(tab.access)) {
        tab.access.forEach(access => {
            const navElement = document.querySelector(`.nav-button[data-access="${access}"]`);
            if (navElement) {
                navElement.style.display = 'flex';
            }
        });
    }
    
    // Всегда показываем профиль (если есть кнопка профиля)
    const profileBtn = document.querySelector('.nav-button[data-access="profile"]');
    if (profileBtn) profileBtn.style.display = 'flex';
    
    // Для создателя показываем пароль создателя
    if (tab.rankLevel === CREATOR_RANK.level) {
        const creatorPassBtn = document.querySelector('.nav-button[data-access="creator_password"]');
        if (creatorPassBtn) creatorPassBtn.style.display = 'flex';
    }
}
function addMainAccountTab() {
    if (!CURRENT_USER) return;
    
    // Получаем доступы основного аккаунта
    const mainAccess = CURRENT_RANK?.access || RANKS.JUNIOR_CURATOR.access;
    
    // Ищем, есть ли уже вкладка основного аккаунта
    const existingMainIndex = accountTabs.findIndex(t => t.isMain);
    
    const mainTabData = {
        id: 'main-' + CURRENT_STATIC_ID,
        name: CURRENT_USER,
        login: CURRENT_USER,
        rankLevel: CURRENT_RANK?.level || null,
        rankName: CURRENT_RANK?.name || null,
        access: mainAccess,
        createdAt: new Date().toLocaleString(),
        isMinimized: false,
        isMain: true,
        isClosable: true, // ДОБАВЛЯЕМ ВОЗМОЖНОСТЬ ЗАКРЫТИЯ
        data: {},
        savedUserData: {
            username: CURRENT_USER,
            role: CURRENT_ROLE,
            rankName: CURRENT_RANK?.name,
            rankLevel: CURRENT_RANK?.level,
            staticId: CURRENT_STATIC_ID
        }
    };
    
    if (existingMainIndex !== -1) {
        // Обновляем существующую основную вкладку
        accountTabs[existingMainIndex] = mainTabData;
        console.log('Обновлена основная вкладка:', mainTabData.name);
    } else {
        // Создаем новую основную вкладку и добавляем в начало
        accountTabs.unshift(mainTabData);
        console.log('Создана новая основная вкладка:', mainTabData.name);
    }
    
    // Устанавливаем активной первую вкладку
    activeAccountTab = 0;
    
    // Сохраняем изменения
    saveAccountTabsToStorage();
    
    console.log('Основная вкладка добавлена/обновлена:', {
        totalTabs: accountTabs.length,
        mainTab: mainTabData
    });
}

function createAccountTab(accountName, accountLogin, rankLevel, access = null) {
    // Определяем доступ на основе ранга
    let tabAccess = access;
    
    if (!tabAccess) {
        if (rankLevel === CREATOR_RANK.level) {
            tabAccess = CREATOR_RANK.access;
        } else if (rankLevel === RANKS.ADMIN.level) {
            tabAccess = RANKS.ADMIN.access;
        } else if (rankLevel === RANKS.SENIOR_CURATOR.level) {
            tabAccess = RANKS.SENIOR_CURATOR.access;
        } else if (rankLevel === RANKS.CURATOR.level) {
            tabAccess = RANKS.CURATOR.access;
        } else {
            tabAccess = RANKS.JUNIOR_CURATOR.access;
        }
    }
    
    const tabObj = {
        id: 'tab-' + Date.now(),
        name: accountName,
        login: accountLogin,
        rankLevel: rankLevel || null,
        rankName: getRankDisplayName(rankLevel),
        access: tabAccess,
        createdAt: new Date().toLocaleString(),
        isMinimized: false,
        isMain: false,
        data: {},
        savedUserData: {
            username: accountLogin,
            rankName: getRankDisplayName(rankLevel),
            rankLevel: rankLevel,
            staticId: accountLogin + "-tab-" + Date.now()
        }
    };
    
    accountTabs.push(tabObj);
    activeAccountTab = accountTabs.length - 1;
    
    // НЕМЕДЛЕННО СОХРАНЯЕМ В LOCALSTORAGE
    saveAccountTabsToStorage();
    
    renderAccountTabs();
    switchAccount(activeAccountTab);
    
    showNotification(`✅ Аккаунт "${accountName}" создан`, "success");
}

function closeAccountTab(tabId) {
    const index = accountTabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    
    const tab = accountTabs[index];
    const isMainTab = tab.isMain;
    
    // Подтверждение для закрытия основной вкладки
    if (isMainTab) {
        if (!confirm(`Закрыть основной аккаунт "${tab.name}"?\n\nЭто приведет к выходу из системы и показу экрана входа.`)) {
            return;
        }
    } else {
        if (!confirm(`Закрыть вкладку "${tab.name}"?`)) {
            return;
        }
    }
    
    accountTabs.splice(index, 1);
    
    // Если был активный таб, переключаемся на другой
    if (index === activeAccountTab) {
        if (accountTabs.length > 0) {
            activeAccountTab = Math.min(index, accountTabs.length - 1);
            switchAccount(activeAccountTab);
        } else {
            // Если закрыли ВСЕ вкладки (включая основную)
            if (isMainTab) {
                // Выходим из системы
                logout();
                return;
            } else {
                // Переключаемся на основную вкладку
                const mainIndex = accountTabs.findIndex(t => t.isMain);
                if (mainIndex !== -1) {
                    activeAccountTab = mainIndex;
                    switchAccount(mainIndex);
                } else {
                    // Если нет других вкладок - показываем экран входа
                    logout();
                    return;
                }
            }
        }
    }
    
    // Сохраняем изменения
    saveAccountTabsToStorage();
    renderAccountTabs();
    
    showNotification(isMainTab ? 
        `Основной аккаунт "${tab.name}" закрыт. Выход из системы...` : 
        `Аккаунт "${tab.name}" закрыт`, 
        isMainTab ? 'warning' : 'info'
    );
    
    // Если закрыли основной таб - сразу выходим
    if (isMainTab) {
        setTimeout(() => {
            logout();
        }, 1500);
    }
}
/* ===== ОЧИСТКА УСТАРЕВШИХ ВКЛАДОК ===== */

function cleanupOldTabs() {
    try {
        const savedTabs = localStorage.getItem('accountTabs');
        if (!savedTabs) return;
        
        const parsedTabs = JSON.parse(savedTabs);
        const now = new Date().getTime();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // 1 неделя
        
        const filteredTabs = parsedTabs.filter(tab => {
            // Основные вкладки не удаляем
            if (tab.isMain) return true;
            
            // Проверяем дату создания
            if (tab.createdAt) {
                try {
                    const tabDate = new Date(tab.createdAt).getTime();
                    return tabDate > oneWeekAgo;
                } catch (e) {
                    return true; // Если ошибка парсинга даты, оставляем
                }
            }
            
            return true; // Если нет даты, оставляем
        });
        
        if (filteredTabs.length < parsedTabs.length) {
            localStorage.setItem('accountTabs', JSON.stringify(filteredTabs));
            console.log('Очищены устаревшие вкладки:', {
                было: parsedTabs.length,
                стало: filteredTabs.length,
                удалено: parsedTabs.length - filteredTabs.length
            });
        }
        
    } catch (error) {
        console.error('Ошибка очистки устаревших вкладок:', error);
    }
}

// Вызывайте эту функцию при необходимости, например:
// cleanupOldTabs();

function switchAccount(tabIndex) {
    if (tabIndex < 0 || tabIndex >= accountTabs.length) return;
    
    activeAccountTab = tabIndex;
    const tab = accountTabs[tabIndex];
    
    // Для основного аккаунта используем глобальные переменные
    if (tab.isMain) {
        console.log(`Переключились на ОСНОВНОЙ аккаунт: ${CURRENT_USER}`);
    } else {
        console.log(`Переключились на ДОПОЛНИТЕЛЬНЫЙ аккаунт: ${tab.login}`);
    }
    
    // Обновляем отображение в шапке
    updateAccountDisplay(tab);
    
    // Если это основной аккаунт, показываем все кнопки
    if (tab.isMain) {
        setupSidebar();
    } else {
        updateSidebarForTab(tab);
    }
    
    // Показываем начальный экран в зависимости от доступа
    if (tab.isMain) {
        if (CURRENT_RANK && CURRENT_RANK.level >= RANKS.ADMIN.level) {
            renderSystem();
        } else {
            renderMLKScreen();
        }
    } else {
        if (tab.access && tab.access.includes('system')) {
            renderSystem();
        } else if (tab.access && tab.access.includes('mlk_reports')) {
            renderMLKScreen();
        }
    }
    
    renderAccountTabs();
    saveAccountTabsToStorage(); // Сохраняем в localStorage
}

function minimizeAccountTab(tabId) {
    const tab = accountTabs.find(t => t.id === tabId);
    if (tab) {
        tab.isMinimized = !tab.isMinimized;
        renderAccountTabs();
        saveAccountTabsToStorage(); // Сохраняем в localStorage
    }
}

function addMainAccountTab() {
    if (!CURRENT_USER) return;
    
    // Проверяем, есть ли уже вкладка основного аккаунта в сохраненных данных
    const savedTabs = localStorage.getItem('accountTabs');
    let existingMainTab = null;
    
    if (savedTabs) {
        try {
            const parsedTabs = JSON.parse(savedTabs);
            existingMainTab = parsedTabs.find(tab => tab.isMain);
        } catch (error) {
            console.error('Ошибка парсинга сохраненных вкладок:', error);
        }
    }
    
    // Получаем доступы основного аккаунта
    const mainAccess = CURRENT_RANK?.access || RANKS.JUNIOR_CURATOR.access;
    
    // Создаем/обновляем данные основного таба
    const mainTabData = {
        id: existingMainTab?.id || 'main-' + Date.now(),
        name: CURRENT_USER,
        login: CURRENT_USER,
        rankLevel: CURRENT_RANK?.level || null,
        rankName: CURRENT_RANK?.name || null,
        access: mainAccess,
        createdAt: existingMainTab?.createdAt || new Date().toLocaleString(),
        isMinimized: existingMainTab?.isMinimized || false,
        isMain: true,
        data: existingMainTab?.data || {}
    };
    
    // Проверяем, есть ли уже основная вкладка в текущих вкладках
    const existingMainIndex = accountTabs.findIndex(t => t.isMain);
    
    if (existingMainIndex !== -1) {
        // Обновляем существующую основную вкладку
        accountTabs[existingMainIndex] = mainTabData;
        console.log('Обновлена основная вкладка:', mainTabData.name);
    } else {
        // Ищем основную вкладку в загруженных данных
        const loadedMainIndex = accountTabs.findIndex(t => t.isMain);
        if (loadedMainIndex !== -1) {
            // Обновляем загруженную основную вкладку
            accountTabs[loadedMainIndex] = mainTabData;
            console.log('Обновлена загруженная основная вкладка:', mainTabData.name);
        } else {
            // Создаем новую основную вкладку и добавляем в начало
            accountTabs.unshift(mainTabData);
            console.log('Создана новая основная вкладка:', mainTabData.name);
        }
    }
    
    // Устанавливаем активной первую вкладку
    activeAccountTab = 0;
    
    // Сохраняем изменения
    saveAccountTabsToStorage();
    
    console.log('Основная вкладка добавлена/обновлена:', {
        totalTabs: accountTabs.length,
        mainTab: mainTabData
    });
}

function renderAccountTabs() {
    const tabsList = document.getElementById('tabs-list');
    const tabsBar = document.getElementById('account-tabs-bar');
    
    if (!tabsList) return;
    
    tabsList.innerHTML = '';
    
    accountTabs.forEach((tab, index) => {
        const tabEl = document.createElement('div');
        tabEl.className = 'account-tab' + (index === activeAccountTab ? ' active' : '');
        
        // Определяем иконку для вкладки
        let icon = 'fa-user';
        if (tab.isMain) icon = 'fa-home';
        if (tab.isMinimized) icon = 'fa-window-minimize';
        
        tabEl.innerHTML = `
            <span class="tab-icon">
                <i class="fas ${icon}"></i>
            </span>
            <span class="tab-name">${tab.name}${tab.isMain ? ' (ОСНОВНОЙ)' : ''}</span>
            ${tab.rankName ? `<span class="tab-rank" style="font-size: 0.7rem; color: #8cb43c;">${tab.rankName}</span>` : ''}
            <button class="tab-minimize" onclick="event.stopPropagation(); minimizeAccountTab('${tab.id}')" title="Свернуть/развернуть">
                ${tab.isMinimized ? '▢' : '▁'}
            </button>
            ${tab.isClosable !== false ? `
                <button class="tab-close" onclick="event.stopPropagation(); closeAccountTab('${tab.id}')" title="Закрыть">
                    ×
                </button>
            ` : ''}
        `;
        
        tabEl.addEventListener('click', () => switchAccount(index));
        tabsList.appendChild(tabEl);
    });
    
    // ПОКАЗЫВАЕМ панель вкладок всегда, если есть хотя бы один таб
    if (tabsBar) {
        tabsBar.style.display = accountTabs.length > 0 ? 'flex' : 'none';
        
        // Автоматически прокручиваем к активной вкладке
        setTimeout(() => {
            const activeTab = tabsList.querySelector('.account-tab.active');
            if (activeTab) {
                activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 100);
    }
}
// Инициализация обработчиков событий при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM LOADED ===');
    
    // Функция обновления времени
    function updateTime() {
        const timeElement = document.getElementById('current-time');
        const dateElement = document.getElementById('current-date');
        
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString('ru-RU');
        }
        if (dateElement) {
            dateElement.textContent = new Date().toLocaleDateString('ru-RU');
        }
    }
    
    setInterval(updateTime, 1000);
    updateTime();
    
    // Инициализируем отображение по умолчанию
    const loginScreen = document.getElementById("login-screen");
    const terminal = document.getElementById("terminal");
    
    // Сначала показываем экран входа
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        loginScreen.style.visibility = 'visible';
    }
    
    if (terminal) {
        terminal.style.display = 'none';
        terminal.style.visibility = 'hidden';
    }
    
    // ОДИН раз пытаемся восстановить сессию
    if (restoreSession()) {
        console.log('Session restored for:', CURRENT_USER);
        
        // Сразу переключаем экраны
        if (loginScreen) {
            loginScreen.style.display = 'none';
            loginScreen.style.visibility = 'hidden';
        }
        
        if (terminal) {
            terminal.style.display = 'flex';
            terminal.style.visibility = 'visible';
        }
        
        // Загружаем данные ОДИН раз
        loadData(() => {
            console.log('Data loaded after session restore');
            
            // Загружаем сохраненные вкладки
            loadAccountTabsFromStorage();
            
            // Создаем основную вкладку
            addMainAccountTab();
            
            // ПОКАЗЫВАЕМ ПАНЕЛЬ ВКЛАДОК СРАЗУ
            const tabsBar = document.getElementById('account-tabs-bar');
            if (tabsBar && accountTabs.length > 0) {
                tabsBar.style.display = 'flex';
            }
            
            // Настраиваем интерфейс
            setupSidebar();
            updateSystemPrompt(`СЕССИЯ ВОССТАНОВЛЕНА. ДОБРО ПОЖАЛОВАТЬ, ${CURRENT_USER}`);
            
            // Рендерим начальный экран
            if (CURRENT_RANK && CURRENT_RANK.level >= RANKS.ADMIN.level) {
                renderSystem();
            } else {
                renderMLKScreen();
            }
            
            // Обновляем интерфейс
            setTimeout(() => {
                adjustInterfaceHeights();
                setupAutoScroll();
            }, 100);
        });
        
    } else {
        console.log('No valid session, showing login form');
        
        // Настраиваем обработчики входа
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.onclick = window.login;
        }
        
        document.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.id === 'password' || activeElement.id === 'username')) {
                    window.login();
                }
            }
        });
        
        // Загружаем данные для формы входа
        loadData(() => {
            console.log('Login form initialized');
        });
    }
});
// Исправленная версия обработчика blur
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById("login-btn");

if (passwordInput) {
    passwordInput.addEventListener('blur', function() {
        const validation = validatePassword(this.value);
        if (!validation.valid) {
            this.style.borderColor = "#b43c3c";
            this.style.boxShadow = "0 0 0 2px rgba(180, 60, 60, 0.2)";
        }
    });
}   
    // Обработка нажатия Enter
    function handleEnterKey(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.id === 'password' || activeElement.id === 'username')) {
                login();
            }
        }
    }
    
    if (usernameInput) usernameInput.addEventListener('keypress', handleEnterKey);
    if (passwordInput) passwordInput.addEventListener('keypress', handleEnterKey);
    
    // Анимация нажатия кнопки
    if (loginButton) {
        loginButton.addEventListener('mousedown', function() {
            this.style.transform = 'scale(0.98)';
        });
        
        loginButton.addEventListener('mouseup', function() {
            this.style.transform = '';
        });
        
        loginButton.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    }
    
window.changeUserPassword = async function() {
    if (!CURRENT_USER) {
        showNotification("Сначала войдите в систему", "error");
        return;
    }
    
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container" style="display: flex; flex-direction: column; height: 100%; gap: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: rgba(40, 42, 36, 0.7); border: 1px solid #4a4a3a; border-radius: 4px;">
                <div>
                    <h2 style="color: #c0b070; margin: 0 0 5px 0; font-family: 'Orbitron', sans-serif; font-size: 1.2rem;">
                        <i class="fas fa-key"></i> СМЕНА ПАРОЛЯ
                    </h2>
                    <p style="color: #8f9779; font-size: 0.85rem; margin: 0;">ИЗМЕНИТЕ ВАШ ПАРОЛЬ</p>
                </div>
                <button onclick="renderSystem()" class="btn-secondary" style="padding: 8px 16px; font-size: 0.9rem;">
                    <i class="fas fa-arrow-left"></i> НАЗАД
                </button>
            </div>
            
            <div style="flex: 1; background: rgba(30, 32, 28, 0.3); border: 1px solid #4a4a3a; border-radius: 4px; padding: 20px;">
                <div style="max-width: 500px; margin: 0 auto;">
                    <div class="zone-card" style="margin-bottom: 20px;">
                        <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                        <h4 style="color: #c0b070; margin-bottom: 15px;">СМЕНА ПАРОЛЯ</h4>
                        
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            <div>
                                <label class="form-label">ТЕКУЩИЙ ПАРОЛЬ</label>
                                <input type="password" id="current-password" class="form-input" placeholder="Введите текущий пароль">
                            </div>
                            
                            <div>
                                <label class="form-label">НОВЫЙ ПАРОЛЬ</label>
                                <input type="password" id="new-password" class="form-input" placeholder="Введите новый пароль">
                            </div>
                            
                            <div>
                                <label class="form-label">ПОВТОРИТЕ НОВЫЙ ПАРОЛЬ</label>
                                <input type="password" id="confirm-password" class="form-input" placeholder="Повторите новый пароль">
                            </div>
                            
                            <div style="margin-top: 20px;">
                                <button onclick="processPasswordChange()" class="btn-primary" style="width: 100%; padding: 12px;">
                                    <i class="fas fa-save"></i> СОХРАНИТЬ НОВЫЙ ПАРОЛЬ
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="color: #8f9779; font-size: 0.85rem; padding: 15px; background: rgba(40, 42, 36, 0.5); border-radius: 4px; border: 1px solid #4a4a3a;">
                        <h5 style="color: #c0b070; margin-bottom: 10px;"><i class="fas fa-info-circle"></i> ТРЕБОВАНИЯ К ПАРОЛЮ:</h5>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Минимум 6 символов</li>
                            <li>Рекомендуется использовать буквы, цифры и специальные символы</li>
                            <li>Не используйте простые пароли (123456, qwerty, password)</li>
                            <li>Пароль должен отличаться от старого</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.processPasswordChange = async function() {
    const currentPassword = document.getElementById("current-password")?.value.trim();
    const newPassword = document.getElementById("new-password")?.value.trim();
    const confirmPassword = document.getElementById("confirm-password")?.value.trim();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification("Заполните все поля", "error");
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification("Новые пароли не совпадают", "error");
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification("Пароль должен содержать минимум 6 символов", "error");
        return;
    }
    
    if (newPassword === currentPassword) {
        showNotification("Новый пароль должен отличаться от старого", "error");
        return;
    }
    
    try {
        // Находим текущего пользователя
        const currentUser = users.find(u => u.username === CURRENT_USER);
        if (!currentUser) {
            showNotification("Пользователь не найден", "error");
            return;
        }
        
        // Проверяем текущий пароль
        const validCurrentPassword = await verifyPassword(currentPassword, {
            hash: currentUser.passwordHash,
            salt: currentUser.passwordSalt
        });
        
        if (!validCurrentPassword) {
            showNotification("Неверный текущий пароль", "error");
            return;
        }
        
        // Генерируем новый хеш пароля
        const newSalt = generateSalt();
        const newHash = await hashPassword(newPassword, newSalt);
        
        // Обновляем пароль в базе данных
        await db.ref('mlk_users/' + currentUser.id).update({
            passwordHash: newHash,
            passwordSalt: newSalt,
            passwordChangedAt: new Date().toLocaleString()
        });
        
        showNotification("✅ Пароль успешно изменен", "success");
        
        // Возвращаемся в систему
        setTimeout(() => {
            renderSystem();
        }, 1500);
        
    } catch (error) {
        console.error('Password change error:', error);
        showNotification("Ошибка при смене пароля", "error");
    }
};

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

/* ===== СОВРЕМЕННЫЕ УВЕДОМЛЕНИЯ ===== */
function showNotification(message, type = "info") {
    // Создаем контейнер для уведомлений если его нет
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    // Определяем иконку и заголовок в зависимости от типа
    let icon, title;
    switch(type) {
        case 'success':
            icon = 'fa-check-circle';
            title = 'УСПЕХ';
            break;
        case 'error':
            icon = 'fa-times-circle';
            title = 'ОШИБКА';
            break;
        case 'warning':
            icon = 'fa-exclamation-triangle';
            title = 'ПРЕДУПРЕЖДЕНИЕ';
            break;
        default: // info
            icon = 'fa-info-circle';
            title = 'ИНФОРМАЦИЯ';
    }
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notification-title">${title}</div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="notification-content">${message}</div>
        <div class="notification-progress">
            <div class="notification-progress-bar" style="width: 100%;"></div>
        </div>
    `;
    
    // Добавляем в контейнер
    container.appendChild(notification);
    
    // Показываем с анимацией
    setTimeout(() => {
        notification.classList.add('show');
        
        // Запускаем прогресс-бар
        const progressBar = notification.querySelector('.notification-progress-bar');
        if (progressBar) {
            progressBar.style.transition = 'width 5s linear';
            progressBar.style.width = '0%';
        }
    }, 10);
    
    // Время отображения в зависимости от типа
    const duration = {
        'success': 4000,
        'error': 6000,
        'warning': 5000,
        'info': 3500
    }[type] || 4000;
    
    // Автоматическое скрытие
    const hideNotification = () => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 400);
    };
    
    const timeoutId = setTimeout(hideNotification, duration);
    
    // Обработчики для закрытия
    notification.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
        const progressBar = notification.querySelector('.notification-progress-bar');
        if (progressBar) {
            progressBar.style.transition = 'none';
            progressBar.style.width = '100%';
        }
    });
    
    notification.addEventListener('mouseleave', () => {
        const newTimeoutId = setTimeout(hideNotification, 1000);
        notification.dataset.timeoutId = newTimeoutId;
        const progressBar = notification.querySelector('.notification-progress-bar');
        if (progressBar) {
            progressBar.style.transition = 'width 1s linear';
            progressBar.style.width = '0%';
        }
    });
    
    // Ограничиваем количество уведомлений (максимум 5)
    const notifications = container.querySelectorAll('.notification');
    if (notifications.length > 5) {
        const oldestNotification = notifications[0];
        oldestNotification.classList.remove('show');
        oldestNotification.classList.add('hide');
        setTimeout(() => {
            if (oldestNotification.parentNode) {
                oldestNotification.parentNode.removeChild(oldestNotification);
            }
        }, 400);
    }
    
    return notification;
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
    
    // ОПРЕДЕЛЯЕМ ПЕРЕМЕННЫЕ В ВЕРХНЕМ УРОВНЕ ОБЛАСТИ ВИДИМОСТИ
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-btn');
    
    // Функция для обработки Enter
    function handleEnterKey(event) { 
        if (event.key === 'Enter') { 
            const activeElement = document.activeElement; 
            if (activeElement && (activeElement.id === 'password' || activeElement.id === 'username')) 
                login(); 
        } 
    }
    
    // Назначаем обработчики событий для полей ввода
    if (usernameInput) usernameInput.addEventListener('keypress', handleEnterKey);
    if (passwordInput) passwordInput.addEventListener('keypress', handleEnterKey);
    
    // Назначаем обработчик для кнопки
    if (loginButton) {
        loginButton.onclick = function() { 
            loginButton.style.transform = 'scale(0.98)'; 
            setTimeout(() => { 
                loginButton.style.transform = ''; 
                login(); 
            }, 150); 
        };
        
        // Анимация нажатия кнопки (опционально)
        loginButton.addEventListener('mousedown', function() {
            this.style.transform = 'scale(0.98)';
        });
        
        loginButton.addEventListener('mouseup', function() {
            this.style.transform = '';
        });
        
        loginButton.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    }
    
    if (restoreSession()) {
        loadData(() => {
            const loginScreen = document.getElementById("login-screen"), terminal = document.getElementById("terminal");
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
    
    // Загружаем настройки пользователя
    loadUserSettings();
    
    // Добавляем аватар в сайдбар
    const userInfo = document.querySelector('.user-terminal .display-line:nth-child(2)');
    const avatarLine = document.querySelector('.user-terminal .display-line[data-avatar="true"]');
    if (userInfo && !avatarLine) {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'display-line';
        avatarDiv.setAttribute('data-avatar', 'true');
        avatarDiv.innerHTML = `
            <span class="output">> АВАТАР: <span class="user-info-avatar" style="display: inline-flex; align-items: center; gap: 5px;">
                ${USER_SETTINGS.avatar ? 
                    `<img src="${USER_SETTINGS.avatar}" alt="${CURRENT_USER}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">` : 
                    `<i class="fas fa-user-circle"></i>`
                }
            </span></span>
        `;
        userInfo.parentNode.insertBefore(avatarDiv, userInfo);
    }
    
    // === КАТЕГОРИЯ: ПОЛЬЗОВАТЕЛЬСКИЙ УГОЛОК ===
    addCategoryHeader(navMenu, 'ПОЛЬЗОВАТЕЛЬСКИЙ УГОЛОК', 'fa-user-circle');
    
    // Мой профиль (для всех пользователей) - ВСЕГДА ВИДИМ
    addNavButton(navMenu, 'fas fa-user-circle', 'МОЙ ПРОФИЛЬ', () => {
        renderProfile();
        updateTitleAndPrompt('МОЙ ПРОФИЛЬ', 'НАСТРОЙКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ');
    }, 'profile', true);
    
    // Пароль создателя (только для создателя)
    if (CURRENT_USER.toLowerCase() === "tihiy") {
        addNavButton(navMenu, 'fas fa-crown', 'ПАРОЛЬ СОЗДАТЕЛЯ', () => {
            renderPasswords();
            updateTitleAndPrompt('ПАРОЛЬ СОЗДАТЕЛЯ', 'УПРАВЛЕНИЕ ПАРОЛЕМ СОЗДАТЕЛЯ');
        }, 'creator_password', false);
    }
    
    // === КАТЕГОРИЯ: НАСТРОЙКИ СИСТЕМЫ ===
    addCategoryHeader(navMenu, 'НАСТРОЙКИ СИСТЕМЫ', 'fa-cogs');
    
    // Список доступа (только для администраторов и создателя)
    if (CURRENT_RANK.level >= RANKS.ADMIN.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-users', 'СПИСОК ДОСТУПА', () => {
            renderWhitelistWithPagination(1);
            updateTitleAndPrompt('СПИСОК ДОСТУПА', 'УПРАВЛЕНИЕ СПИСКОМ ДОСТУПА');
        }, 'whitelist', false);
    }
    
    // Система (только для администраторов и создателя)
    if (CURRENT_RANK.level >= RANKS.ADMIN.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-cogs', 'СИСТЕМА', () => {
            renderSystem();
            updateTitleAndPrompt('СИСТЕМА', 'ОБЩАЯ СТАТИСТИКА И ИНФОРМАЦИЯ');
        }, 'system', false);
    }
    
    // Баны (только для администраторов и создателя)
    if (CURRENT_RANK.level >= RANKS.ADMIN.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-ban', 'БАНЫ', () => {
            renderBansWithPagination(1);
            updateTitleAndPrompt('БАНЫ', 'УПРАВЛЕНИЕ СИСТЕМОЙ БЛОКИРОВКИ');
        }, 'bans', false);
    }
    
    // IP Мониторинг (только для администраторов и создателя)
    if (CURRENT_RANK.level >= RANKS.ADMIN.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-network-wired', 'IP МОНИТОРИНГ', () => {
            renderIPStats();
            updateTitleAndPrompt('IP МОНИТОРИНГ', 'МОНИТОРИНГ IP АДРЕСОВ И БЕЗОПАСНОСТЬ');
        }, 'ip_monitoring', false);
    }
    
    // Пользователи (только для старших кураторов и выше)
    if (CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-user-friends', 'ПОЛЬЗОВАТЕЛИ', () => {
            renderUsersWithPagination(1);
            updateTitleAndPrompt('ПОЛЬЗОВАТЕЛИ', 'УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ И РАНГАМИ');
        }, 'users', false);
    }
    
    // Discord вебхуки (только для администраторов и создателя)
    if (CURRENT_RANK.level >= RANKS.ADMIN.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-broadcast-tower', 'DISCORD ВЕБХУКИ', () => {
            renderWebhookManager();
            updateTitleAndPrompt('DISCORD ВЕБХУКИ', 'НАСТРОЙКА ИНТЕГРАЦИИ С DISCORD');
        }, 'webhooks', false);
    }
    
    // === КАТЕГОРИЯ: РАБОТА ===
    addCategoryHeader(navMenu, 'РАБОТА', 'fa-briefcase');
    
    // Отчеты МЛК (для всех пользователей)
    addNavButton(navMenu, 'fas fa-file-alt', 'ОТЧЕТЫ МЛК', () => {
        renderMLKScreen();
        updateTitleAndPrompt('ОТЧЕТЫ МЛК', 'СИСТЕМА ФИКСАЦИИ НАРУШЕНИЙ');
    }, 'mlk_reports', false);
    
    // Все отчеты (только для старших кураторов и выше)
    if (CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level || CURRENT_RANK.level === CREATOR_RANK.level) {
        addNavButton(navMenu, 'fas fa-list', 'ВСЕ ОТЧЕТЫ', () => {
            renderReportsWithPagination(1);
            updateTitleAndPrompt('ВСЕ ОТЧЕТЫ', 'ПОЛНЫЙ АРХИВ ОТЧЕТОВ');
        }, 'all_reports', false);
    }
    
    // УПРАВЛЕНИЕ ВКЛАДКАМИ - УБИРАЕМ ЭТОТ ПУНКТ
    // Добавляем кнопку управления вкладками только если есть дополнительные вкладки
    if (accountTabs.length > 1) {
        addNavButton(navMenu, 'fas fa-layer-group', 'УПРАВЛЕНИЕ ВКЛАДКАМИ', () => {
            manageAccountTabs();
        }, null, false);
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;
    
    // Обновляем навигацию для активной вкладки
    if (accountTabs.length > 0 && activeAccountTab < accountTabs.length) {
        updateSidebarForTab(accountTabs[activeAccountTab]);
    }
    
    setTimeout(() => { 
        if (sidebar) { 
            sidebar.classList.add('scrollable-container'); 
            adjustInterfaceHeights(); 
        } 
    }, 100);
}
/* ===== ФУНКЦИЯ ДЛЯ СОЗДАНИЯ ЗАГОЛОВКОВ КАТЕГОРИЙ ===== */
function addCategoryHeader(container, title, icon = 'fa-folder') {
    const header = document.createElement('div');
    header.className = 'nav-category-header';
    header.innerHTML = `
        <div class="category-icon">
            <i class="fas ${icon}"></i>
        </div>
        <span>${title}</span>
    `;
    container.appendChild(header);
}

/* ===== ФУНКЦИЯ ДЛЯ ДОБАВЛЕНИЯ КНОПОК НАВИГАЦИИ ===== */

/* ===== ФУНКЦИЯ ОБНОВЛЕНИЯ ЗАГОЛОВКА И ПОДСКАЗКИ ===== */
function updateTitleAndPrompt(title, prompt) {
    const titleElement = document.getElementById('content-title');
    const promptElement = document.getElementById('system-prompt');
    
    if (titleElement) {
        titleElement.textContent = title;
    }
    
    if (promptElement) {
        promptElement.textContent = prompt;
    }
    
    // Также обновляем title страницы
    document.title = `${title} | Система отчетов Зоны`;
}
function addNavButton(container, icon, text, onClick, dataAccess = null, alwaysVisible = false) {
    const button = document.createElement('button');
    button.className = 'nav-button';
    if (alwaysVisible) {
        button.classList.add('always-visible');
    }
    if (dataAccess) {
        button.setAttribute('data-access', dataAccess);
    }
    button.innerHTML = `<i class="${icon}"></i><span>${text}</span>`;
    button.onclick = function() {
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Вызываем функцию навигации
        onClick();
        
        // Обновляем заголовок и подсказку
        updateTitleAndPrompt(text, `ЗАГРУЖЕН РАЗДЕЛ: ${text}`);
        
        // Настраиваем интерфейс
        setTimeout(() => { 
            adjustInterfaceHeights(); 
            setupAutoScroll(); 
        }, 100);
    };
    container.appendChild(button);
}
window.logout = function logout() {
    console.log('Logout called');
    
    // Очищаем все данные сессии
    CURRENT_ROLE = null;
    CURRENT_USER = null;
    CURRENT_RANK = null;
    CURRENT_STATIC_ID = null;
    localStorage.removeItem('mlk_session');
    
    // Очищаем ВСЕ вкладки
    accountTabs = [];
    activeAccountTab = 0;
    saveAccountTabsToStorage();
    
    const terminal = document.getElementById('terminal');
    const loginScreen = document.getElementById('login-screen');
    const tabsBar = document.getElementById('account-tabs-bar');
    
    // Прячем терминал и панель вкладок, показываем экран входа
    if (terminal && loginScreen) { 
        terminal.style.display = 'none'; 
        loginScreen.style.display = 'flex'; 
    }
    
    // Скрываем панель вкладок
    if (tabsBar) {
        tabsBar.style.display = 'none';
    }
    
    // Очищаем поля формы
    const passwordInput = document.getElementById('password');
    if (passwordInput) passwordInput.value = '';
    
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.value = '';
    
    const errorElement = document.getElementById('login-error');
    if (errorElement) errorElement.textContent = '';
    
    // Сбрасываем активные кнопки навигации
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    
    // Обновляем заголовок экрана входа
    const loginTitle = document.querySelector('.zone-title');
    if (loginTitle) {
        loginTitle.innerHTML = `<span class="title-part">СИСТЕМА</span><span class="title-part">ОТЧЕТОВ</span>`;
    }
    
    // Обновляем предупреждение
    const loginWarning = document.querySelector('.login-warning');
    if (loginWarning) {
        loginWarning.innerHTML = `<i class="fas fa-terminal"></i><span>ВХОД В СИСТЕМУ ОТЧЕТОВ ЗОНЫ</span>`;
    }
    
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

/* ===== ФУНКЦИЯ ОБНОВЛЕНИЯ СИСТЕМНОЙ ПОДСКАЗКИ ===== */
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

// Обновленная функция setupReportFormHandlers
function setupReportFormHandlers() {
    console.log('Setting up report form handlers...');
    
    // Обработчики для кнопок типа нарушителя
    document.querySelectorAll('.violator-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('Violator type clicked:', this.dataset.value);
            document.querySelectorAll('.violator-type-btn').forEach(b => {
                b.style.background = 'rgba(40, 42, 36, 0.8)';
                b.style.border = '1px solid #4a4a3a';
                b.style.color = '#8f9779';
            });
            this.style.background = 'rgba(140, 180, 60, 0.15)';
            this.style.border = '2px solid #8cb43c';
            this.style.color = '#8cb43c';
            updatePreview();
        });
    });

    // Обработчики для карточек категорий
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', function() {
            console.log('Category clicked:', this.dataset.category);
            document.querySelectorAll('.category-card').forEach(c => {
                c.style.background = 'rgba(40, 42, 36, 0.8)';
                c.style.border = '1px solid #4a4a3a';
            });
            const color = this.dataset.color;
            this.style.background = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.1)`;
            this.style.border = `2px solid ${color}`;
            updatePreview();
        });
    });

    // Обработчики для опций приоритета
    document.querySelectorAll('.priority-option').forEach(option => {
        option.addEventListener('click', function() {
            console.log('Priority clicked:', this.dataset.priority);
            document.querySelectorAll('.priority-option').forEach(o => {
                o.style.background = 'rgba(40, 42, 36, 0.8)';
                o.style.border = '1px solid #4a4a3a';
            });
            const priority = this.dataset.priority;
            const color = priority === 'low' ? '#8cb43c' : priority === 'medium' ? '#c0b070' : '#b43c3c';
            this.style.background = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.15)`;
            this.style.border = `2px solid ${color}`;
            updatePreview();
        });
    });

    // Кнопка добавления доказательств - встроенный onclick
    const addProofBtn = document.querySelector('.add-proof-btn');
    if (addProofBtn) {
        // Уже имеет onclick="addProofField()"
    }

    updateCharCount();
    updatePreview();
}

window.renderMLKForm = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    content.innerHTML = `
        <div class="form-container" style="display: flex; flex-direction: column; height: 100%; gap: 10px; position: relative;">
            <!-- ШАПКА -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: rgba(40, 42, 36, 0.7); border: 1px solid #4a4a3a; border-radius: 4px;">
                <div>
                    <h2 style="color: #c0b070; margin: 0 0 5px 0; font-family: 'Orbitron', sans-serif; font-size: 1.2rem;">
                        <i class="fas fa-file-medical"></i> СОЗДАНИЕ ОТЧЕТА
                    </h2>
                    <p style="color: #8f9779; font-size: 0.85rem; margin: 0;">ЗАПОЛНИТЕ ВСЕ ПОЛЯ ДЛЯ СОЗДАНИЯ ОТЧЕТА</p>
                </div>
                <button onclick="renderMLKScreen()" class="btn-secondary" style="padding: 8px 16px; font-size: 0.9rem; min-width: 120px;">
                    <i class="fas fa-arrow-left"></i> НАЗАД
                </button>
            </div>
            
            <!-- ПРОКРУЧИВАЕМАЯ ОБЛАСТЬ С ФОРМОЙ -->
            <div id="mlk-form-scrollable" class="scrollable-container" style="flex: 1; overflow-y: auto; background: rgba(30, 32, 28, 0.3); border: 1px solid #4a4a3a; border-radius: 4px; padding: 15px;">
                <!-- Форма будет загружена сюда -->
                <div style="color: #8f9779; text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 15px;"></i>
                    <p>Загрузка формы...</p>
                </div>
            </div>
            
            <!-- ФУТЕР С КНОПКОЙ ОТПРАВКИ -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: rgba(40, 42, 36, 0.7); border: 1px solid #4a4a3a; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 8px; color: #8f9779; font-size: 0.9rem;">
                    <i class="fas fa-info-circle"></i>
                    <span>Проверьте все поля перед отправкой</span>
                </div>
                <button id="submit-mlk-btn" class="btn-primary" style="padding: 10px 20px; font-size: 0.95rem; min-width: 180px; font-weight: 500;">
                    <i class="fas fa-paper-plane"></i> ОТПРАВИТЬ ОТЧЕТ
                </button>
            </div>
            
            <!-- КНОПКИ ПРОКРУТКИ (добавить этот блок) -->
            <div style="position: absolute; right: 20px; top: 60%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 10px; z-index: 100;">
                <button onclick="scrollToTop('mlk-form-scrollable')" class="scroll-btn" style="width: 36px; height: 36px; font-size: 1rem; background: rgba(30, 32, 28, 0.9); border: 1px solid #4a4a3a; color: #8f9779; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s;">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button onclick="scrollToBottom('mlk-form-scrollable')" class="scroll-btn" style="width: 36px; height: 36px; font-size: 1rem; background: rgba(30, 32, 28, 0.9); border: 1px solid #4a4a3a; color: #8f9779; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s;">
                    <i class="fas fa-arrow-down"></i>
                </button>
            </div>
        </div>
    `;
    
    // Загружаем форму
    setTimeout(() => {
        const formContainer = document.getElementById("mlk-form-scrollable");
        if (!formContainer) return;
        
        formContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 20px; padding: 5px;">
                <!-- КАРТОЧКА 1: ИНФОРМАЦИЯ О НАРУШИТЕЛЕ -->
                <div class="form-section" style="background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; padding: 20px; border-left: 4px solid #c0b070;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; background: rgba(192, 176, 112, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #c0b070;">
                            <i class="fas fa-user-tag fa-lg"></i>
                        </div>
                        <div>
                            <h3 style="color: #c0b070; margin: 0; font-size: 1.1rem;">ИНФОРМАЦИЯ О НАРУШИТЕЛЕ</h3>
                            <p style="color: #8f9779; margin: 5px 0 0 0; font-size: 0.85rem;">Укажите данные нарушителя</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        <!-- Поле для идентификатора -->
                        <div>
                            <label class="form-label">ИДЕНТИФИКАТОР НАРУШИТЕЛЯ</label>
                            <div style="position: relative;">
                                <input type="text" id="mlk-tag" class="form-input" placeholder="@никнейм / STEAM_1:0:123456 / ID игрока" style="width: 100%; padding: 12px 15px 12px 45px; font-size: 0.95rem;">
                                <div style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #8cb43c;">
                                    <i class="fas fa-user-secret fa-lg"></i>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Выбор типа нарушителя -->
                        <div>
                            <label class="form-label">ТИП НАРУШИТЕЛЯ</label>
                            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                                <button type="button" class="violator-type-btn active" data-value="player" style="flex: 1; min-width: 130px; padding: 12px; background: rgba(140, 180, 60, 0.15); border: 2px solid #8cb43c; color: #8cb43c; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                    <i class="fas fa-user fa-lg"></i>
                                    <span>Игрок</span>
                                </button>
                                <button type="button" class="violator-type-btn" data-value="admin" style="flex: 1; min-width: 130px; padding: 12px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; color: #8f9779; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                    <i class="fas fa-user-shield fa-lg"></i>
                                    <span>Админ</span>
                                </button>
                                <button type="button" class="violator-type-btn" data-value="curator" style="flex: 1; min-width: 130px; padding: 12px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; color: #8f9779; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                    <i class="fas fa-user-tie fa-lg"></i>
                                    <span>Куратор</span>
                                </button>
                                <button type="button" class="violator-type-btn" data-value="other" style="flex: 1; min-width: 130px; padding: 12px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; color: #8f9779; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                    <i class="fas fa-question fa-lg"></i>
                                    <span>Другое</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- КАРТОЧКА 2: КАТЕГОРИЯ НАРУШЕНИЯ -->
                <div class="form-section" style="background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; padding: 20px; border-left: 4px solid #c0b070;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; background: rgba(192, 176, 112, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #c0b070;">
                            <i class="fas fa-exclamation-triangle fa-lg"></i>
                        </div>
                        <div>
                            <h3 style="color: #c0b070; margin: 0; font-size: 1.1rem;">КАТЕГОРИЯ НАРУШЕНИЯ</h3>
                            <p style="color: #8f9779; margin: 5px 0 0 0; font-size: 0.85rem;">Выберите категорию и приоритет</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        <!-- Выбор категории -->
                        <div>
                            <label class="form-label">ВЫБЕРИТЕ КАТЕГОРИЮ</label>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-top: 10px;">
                                <div class="category-card active" data-category="cheat" data-color="#b43c3c" style="cursor: pointer; padding: 18px 12px; background: rgba(180, 60, 60, 0.1); border: 2px solid #b43c3c; border-radius: 4px; text-align: center; transition: all 0.2s;">
                                    <div style="font-size: 1.8rem; color: #b43c3c; margin-bottom: 10px;"><i class="fas fa-skull-crossbones"></i></div>
                                    <div style="color: #b43c3c; font-weight: 500; margin-bottom: 6px; font-size: 0.95rem;">ЧИТЫ</div>
                                    <div style="color: #8f9779; font-size: 0.8rem;">Использование ПО</div>
                                </div>
                                <div class="category-card" data-category="toxic" data-color="#b43c3c" style="cursor: pointer; padding: 18px 12px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;">
                                    <div style="font-size: 1.8rem; color: #b43c3c; margin-bottom: 10px;"><i class="fas fa-comment-slash"></i></div>
                                    <div style="color: #b43c3c; font-weight: 500; margin-bottom: 6px; font-size: 0.95rem;">ТОКСИЧНОСТЬ</div>
                                    <div style="color: #8f9779; font-size: 0.8rem;">Оскорбления</div>
                                </div>
                                <div class="category-card" data-category="spam" data-color="#b43c3c" style="cursor: pointer; padding: 18px 12px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;">
                                    <div style="font-size: 1.8rem; color: #b43c3c; margin-bottom: 10px;"><i class="fas fa-comment-dots"></i></div>
                                    <div style="color: #b43c3c; font-weight: 500; margin-bottom: 6px; font-size: 0.95rem;">СПАМ</div>
                                    <div style="color: #8f9779; font-size: 0.8rem;">Флуд в чате</div>
                                </div>
                                <div class="category-card" data-category="bug" data-color="#c0b070" style="cursor: pointer; padding: 18px 12px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;">
                                    <div style="font-size: 1.8rem; color: #c0b070; margin-bottom: 10px;"><i class="fas fa-bug"></i></div>
                                    <div style="color: #c0b070; font-weight: 500; margin-bottom: 6px; font-size: 0.95rem;">БАГИ</div>
                                    <div style="color: #8f9779; font-size: 0.8rem;">Использование багов</div>
                                </div>
                                <div class="category-card" data-category="grief" data-color="#c0b070" style="cursor: pointer; padding: 18px 12px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;">
                                    <div style="font-size: 1.8rem; color: #c0b070; margin-bottom: 10px;"><i class="fas fa-user-slash"></i></div>
                                    <div style="color: #c0b070; font-weight: 500; margin-bottom: 6px; font-size: 0.95rem;">ГРИФ</div>
                                    <div style="color: #8f9779; font-size: 0.8rem;">Вредительство</div>
                                </div>
                                <div class="category-card" data-category="other" data-color="#8f9779" style="cursor: pointer; padding: 18px 12px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; text-align: center; transition: all 0.2s;">
                                    <div style="font-size: 1.8rem; color: #8f9779; margin-bottom: 10px;"><i class="fas fa-question-circle"></i></div>
                                    <div style="color: #8f9779; font-weight: 500; margin-bottom: 6px; font-size: 0.95rem;">ДРУГОЕ</div>
                                    <div style="color: #8f9779; font-size: 0.8rem;">Иные нарушения</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Выбор приоритета -->
                        <div>
                            <label class="form-label">ПРИОРИТЕТ ОТЧЕТА</label>
                            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 10px;">
                                <div class="priority-option" data-priority="low" style="flex: 1; min-width: 140px; cursor: pointer; padding: 14px 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; transition: all 0.2s; display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 14px; height: 14px; background: #8cb43c; border-radius: 50%;"></div>
                                    <div style="display: flex; flex-direction: column;">
                                        <span style="color: #8f9779; font-weight: 500;">НИЗКИЙ</span>
                                        <span style="color: #6a6a5a; font-size: 0.8rem;">Не срочно</span>
                                    </div>
                                </div>
                                <div class="priority-option active" data-priority="medium" style="flex: 1; min-width: 140px; cursor: pointer; padding: 14px 15px; background: rgba(192, 176, 112, 0.15); border: 2px solid #c0b070; border-radius: 4px; transition: all 0.2s; display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 14px; height: 14px; background: #c0b070; border-radius: 50%;"></div>
                                    <div style="display: flex; flex-direction: column;">
                                        <span style="color: #c0b070; font-weight: 500;">СРЕДНИЙ</span>
                                        <span style="color: #8f9779; font-size: 0.8rem;">Обычный приоритет</span>
                                    </div>
                                </div>
                                <div class="priority-option" data-priority="high" style="flex: 1; min-width: 140px; cursor: pointer; padding: 14px 15px; background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; transition: all 0.2s; display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 14px; height: 14px; background: #b43c3c; border-radius: 50%;"></div>
                                    <div style="display: flex; flex-direction: column;">
                                        <span style="color: #b43c3c; font-weight: 500;">ВЫСОКИЙ</span>
                                        <span style="color: #6a6a5a; font-size: 0.8rem;">Требует срочного внимания</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- КАРТОЧКА 3: ДЕТАЛЬНОЕ ОПИСАНИЕ -->
                <div class="form-section" style="background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; padding: 20px; border-left: 4px solid #8cb43c;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; background: rgba(140, 180, 60, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #8cb43c;">
                            <i class="fas fa-align-left fa-lg"></i>
                        </div>
                        <div>
                            <h3 style="color: #8cb43c; margin: 0; font-size: 1.1rem;">ДЕТАЛЬНОЕ ОПИСАНИЕ</h3>
                            <p style="color: #8f9779; margin: 5px 0 0 0; font-size: 0.85rem;">Опишите нарушение подробно</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        <!-- Описание нарушения -->
                        <div>
                            <label class="form-label">ПОДРОБНОЕ ОПИСАНИЕ НАРУШЕНИЯ</label>
                            <div style="position: relative;">
                                <textarea id="mlk-action" class="form-textarea" rows="6" placeholder="Опишите нарушение максимально подробно... Время, место, действия нарушителя, последствия и т.д." style="width: 100%; resize: vertical; min-height: 180px; padding: 15px; font-size: 0.95rem;"></textarea>
                                <div id="char-counter" style="position: absolute; bottom: 12px; right: 12px; color: #8f9779; font-size: 0.85rem; background: rgba(30, 32, 28, 0.9); padding: 4px 10px; border-radius: 3px; border: 1px solid #4a4a3a;">
                                    <i class="fas fa-text-height"></i> <span id="char-count">0</span>/2000 символов
                                </div>
                            </div>
                        </div>
                        
                        <!-- Доказательства - ИСПРАВЛЕННАЯ ВЕРСИЯ -->
                        <div>
                            <label class="form-label">ССЫЛКИ НА ДОКАЗАТЕЛЬСТВА</label>
                            <div id="proof-links-container" style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                                <div class="proof-link-input" style="display: flex; gap: 10px;">
                                    <input type="text" class="form-input proof-link" placeholder="https://imgur.com/... или steam://..." style="flex: 1; padding: 12px 15px;">
                                    <button type="button" class="btn-secondary add-proof-btn" style="padding: 0 20px; min-width: 100px; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;" onclick="addProofField()">
                                        <i class="fas fa-plus"></i> Добавить
                                    </button>
                                </div>
                            </div>
                            <div style="margin-top: 8px; font-size: 0.85rem; color: #8f9779; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-info-circle"></i>
                                <span>Можно добавить ссылки на скриншоты, видео, демо-записи. Нажмите "+" чтобы добавить еще поле.</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- КАРТОЧКА 4: ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР -->
                <div class="form-section" style="background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; padding: 20px; border-left: 4px solid #c0b070; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; background: rgba(192, 176, 112, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #c0b070;">
                            <i class="fas fa-eye fa-lg"></i>
                        </div>
                        <div>
                            <h3 style="color: #c0b070; margin: 0; font-size: 1.1rem;">ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР</h3>
                            <p style="color: #8f9779; margin: 5px 0 0 0; font-size: 0.85rem;">Как будет выглядеть ваш отчет</p>
                        </div>
                    </div>
                    
                    <div id="report-preview" style="background: rgba(20, 18, 15, 0.9); border: 1px solid #4a4a3a; border-radius: 4px; padding: 20px;">
                        <!-- Заголовок предпросмотра -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #4a4a3a; flex-wrap: wrap; gap: 10px;">
                            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                <span id="preview-category" style="background: rgba(180, 60, 60, 0.15); color: #b43c3c; padding: 8px 14px; border-radius: 4px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-tag"></i> ЧИТЫ
                                </span>
                                <span id="preview-priority" style="background: rgba(192, 176, 112, 0.15); color: #c0b070; padding: 8px 14px; border-radius: 4px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-flag"></i> СРЕДНИЙ
                                </span>
                            </div>
                            <div style="color: #8f9779; font-size: 0.85rem; background: rgba(30, 32, 28, 0.5); padding: 6px 12px; border-radius: 4px;">
                                <i class="far fa-clock"></i> ${new Date().toLocaleString()}
                            </div>
                        </div>
                        
                        <!-- Содержимое предпросмотра -->
                        <div style="margin-bottom: 20px;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px; padding: 12px; background: rgba(30, 32, 28, 0.5); border-radius: 4px;">
                                <div style="color: #8cb43c; font-size: 1.2rem;">
                                    <i class="fas fa-user-tag"></i>
                                </div>
                                <div>
                                    <div id="preview-tag" style="color: #c0b070; font-weight: 500; font-size: 1rem;">[не указано]</div>
                                    <div style="color: #8f9779; font-size: 0.85rem; margin-top: 3px;">Нарушитель: Игрок</div>
                                </div>
                            </div>
                            
                            <div style="background: rgba(30, 32, 28, 0.7); border-radius: 4px; padding: 15px; min-height: 80px;">
                                <div style="color: #8f9779; font-size: 0.9rem; line-height: 1.6;" id="preview-description">
                                    [описание появится здесь]
                                </div>
                            </div>
                        </div>
                        
                        <!-- Футер предпросмотра -->
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid #4a4a3a; flex-wrap: wrap; gap: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px; color: #8f9779; font-size: 0.9rem;">
                                <div style="width: 32px; height: 32px; background: rgba(192, 176, 112, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div>
                                    <div style="color: #c0b070; font-weight: 500;">${CURRENT_USER}</div>
                                    <div style="color: #6a6a5a; font-size: 0.8rem;">Автор отчета</div>
                                </div>
                            </div>
                            <div>
                                <span style="background: rgba(192, 176, 112, 0.15); color: #c0b070; padding: 8px 16px; border-radius: 4px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-clock"></i> ОЖИДАЕТ ПРОВЕРКИ
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Назначаем обработчик кнопки отправки
        const submitBtn = document.getElementById('submit-mlk-btn');
        if (submitBtn) {
            submitBtn.onclick = addMLKReport;
        }
        
        // ОБНОВЛЕННЫЙ ВЫЗОВ ОБРАБОТЧИКОВ - нужно дождаться рендера DOM
        setTimeout(() => {
            setupReportFormHandlers();
        }, 50);
        
        // Инициализируем счетчик символов и предпросмотр
        const actionTextarea = document.getElementById("mlk-action");
        const tagInput = document.getElementById("mlk-tag");
        
        if (actionTextarea) {
            actionTextarea.addEventListener('input', function() { 
                updatePreview(); 
                updateCharCount(); 
            });
        }
        
        if (tagInput) {
            tagInput.addEventListener('input', updatePreview);
        }
        
        // Инициализируем предпросмотр
        updatePreview();
        updateCharCount();
        
        // Настраиваем высоту интерфейса
        setTimeout(() => {
            adjustInterfaceHeights();
        }, 100);
        
    }, 100);
};

// Функции для прокрутки
function scrollToTop(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function scrollToBottom(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
}

window.renderMLKScreen = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    loadReports(function() {
        content.innerHTML = `
            <div class="form-container" style="display: flex; flex-direction: column; height: 100%;">
                <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                    <i class="fas fa-file-alt"></i> ОТЧЕТЫ МЛК
                </h2>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; padding: 10px; background: rgba(40, 42, 36, 0.5); border-radius: 4px;">
                    <div>
                        <h3 style="color: #c0b070; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-bottom: 5px;">АРХИВ ОТЧЕТОВ</h3>
                        <p style="color: #8f9779; font-size: 0.9rem; margin: 0;">СИСТЕМА ФИКСАЦИИ НАРУШЕНИЙ</p>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div class="items-per-page-selector" style="margin: 0;">
                            <span style="color: #8f9779; font-size: 0.9rem;">На странице:</span>
                            <select onchange="changeItemsPerPage('renderMLKListPaginated', this.value)" style="background: rgba(30, 32, 28, 0.8); border: 1px solid #4a4a3a; color: #8f9779; padding: 4px 8px; border-radius: 3px;">
                                <option value="5" ${PAGINATION_CONFIG.itemsPerPage === 5 ? 'selected' : ''}>5</option>
                                <option value="10" ${PAGINATION_CONFIG.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                                <option value="15" ${PAGINATION_CONFIG.itemsPerPage === 15 ? 'selected' : ''}>15</option>
                                <option value="20" ${PAGINATION_CONFIG.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                                <option value="30" ${PAGINATION_CONFIG.itemsPerPage === 30 ? 'selected' : ''}>30</option>
                            </select>
                        </div>
                        <button onclick="renderMLKForm()" class="btn-primary" style="padding: 8px 16px; font-size: 0.9rem; white-space: nowrap;">
                            <i class="fas fa-plus"></i> НОВЫЙ ОТЧЕТ
                        </button>
                    </div>
                </div>
                
                <div id="mlk-list" class="scrollable-container" style="flex: 1; overflow-y: auto; margin-bottom: 10px; background: rgba(30, 32, 28, 0.3); border: 1px solid #4a4a3a; border-radius: 4px; padding: 15px;">
                    <!-- Здесь будет список отчетов -->
                </div>
                
                <div id="mlk-pagination-container" style="min-height: 60px; display: flex; align-items: center; justify-content: center; background: rgba(40, 42, 36, 0.5); border-radius: 4px; padding: 10px;">
                    <!-- Здесь будет пагинация -->
                </div>
            </div>
        `;
        
        renderMLKListPaginated(1);
    });
}

function renderMLKListPaginated(page = 1) {
    const listDiv = document.getElementById("mlk-list");
    const paginationContainer = document.getElementById("mlk-pagination-container");
    
    if (!listDiv) return;
    
    console.log('Rendering MLK list page:', page, 'Total reports:', reports.length);
    
    const filteredReports = (CURRENT_RANK.level <= RANKS.CURATOR.level)
        ? reports.filter(r => r.author === CURRENT_USER)
        : reports;
    
    currentPage = page;
    const itemsPerPage = PAGINATION_CONFIG.itemsPerPage;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedReports = filteredReports.slice(startIndex, endIndex);
    const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
    
    console.log('Filtered reports:', filteredReports.length, 'Paginated:', paginatedReports.length, 'Total pages:', totalPages);
    
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
    
    // Сортируем отчеты по времени (новые сверху)
    const sortedReports = [...paginatedReports].sort((a, b) => {
        const timeA = a.timestamp || (a.time ? new Date(a.time).getTime() : 0);
        const timeB = b.timestamp || (b.time ? new Date(b.time).getTime() : 0);
        return timeB - timeA;
    });
    
    // Очищаем контейнер
    listDiv.innerHTML = '';
    
    // Создаем контейнер для карточек
    const cardsContainer = document.createElement('div');
    cardsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';
    
    sortedReports.forEach(r => {
        const card = document.createElement("div");
        card.className = "report-card-enhanced";
        card.style.cssText = 'background: rgba(40, 42, 36, 0.8); border: 1px solid #4a4a3a; border-radius: 4px; padding: 15px; margin-bottom: 10px;';
        
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
        const categoryName = r.categoryName || 'Другое';
        
        const priorityColors = {
            'low': '#8cb43c',
            'medium': '#c0b070',
            'high': '#b43c3c'
        };
        
        const priorityColor = priorityColors[r.priority] || '#c0b070';
        const priorityName = r.priorityName || 'СРЕДНИЙ';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; border-bottom: 1px solid rgba(74, 74, 58, 0.3); padding-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="background: ${categoryColor}20; border-left: 3px solid ${categoryColor}; padding: 5px 10px; border-radius: 2px;">
                        <span style="color: ${categoryColor}; font-weight: 500; font-size: 0.9rem;">${categoryName}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px; color: ${priorityColor};">
                        <div style="width: 8px; height: 8px; background: ${priorityColor}; border-radius: 50%;"></div>
                        <span style="font-size: 0.85rem;">${priorityName}</span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                    <span style="color: #8f9779; font-size: 0.8rem;"><i class="far fa-clock"></i> ${r.time || '—'}</span>
                    <span style="color: #8f9779; font-size: 0.8rem;"><i class="fas fa-user"></i> ${r.author || 'неизвестно'}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <div style="color: #8f9779; font-size: 1rem;"><i class="fas fa-user-tag"></i></div>
                    <div>
                        <h4 style="color: #c0b070; margin: 0 0 5px 0; font-size: 1rem;">${r.tag || '—'}</h4>
                        <span style="color: #8f9779; font-size: 0.85rem;">Тип: ${r.violatorType === 'admin' ? 'Администратор' : r.violatorType === 'curator' ? 'Куратор' : 'Игрок'}</span>
                    </div>
                </div>
                
                <div style="color: #8f9779; line-height: 1.5; font-size: 0.9rem; margin-bottom: 15px; max-height: 100px; overflow: hidden; text-overflow: ellipsis;">
                    ${(r.action || '').replace(/\n/g, '<br>')}
                </div>
                
                ${r.proofLinks && r.proofLinks.length > 0 ? `
                <div style="margin-bottom: 15px;">
                    <h5 style="color: #c0b070; font-size: 0.9rem; margin-bottom: 5px;"><i class="fas fa-link"></i> ДОКАЗАТЕЛЬСТВА</h5>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${r.proofLinks.slice(0, 3).map(link => `
                            <a href="${link}" target="_blank" style="color: #8cb43c; font-size: 0.8rem; text-decoration: none; background: rgba(140, 180, 60, 0.1); padding: 2px 8px; border-radius: 3px; display: flex; align-items: center; gap: 3px;">
                                <i class="fas fa-external-link-alt"></i> ${link.length > 30 ? link.substring(0, 30) + '...' : link}
                            </a>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(74, 74, 58, 0.3); padding-top: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="background: ${statusClass === 'status-deleted' ? 'rgba(180, 60, 60, 0.1)' : statusClass === 'status-confirmed' ? 'rgba(140, 180, 60, 0.1)' : 'rgba(192, 176, 112, 0.1)'}; color: ${statusClass === 'status-deleted' ? '#b43c3c' : statusClass === 'status-confirmed' ? '#8cb43c' : '#c0b070'}; padding: 4px 10px; border-radius: 3px; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                        <i class="fas ${statusIcon}"></i>
                        <span>${status.toUpperCase()}</span>
                    </div>
                    ${r.authorStaticId ? `
                    <div style="color: #8f9779; font-size: 0.8rem; display: flex; align-items: center; gap: 3px;">
                        <i class="fas fa-id-card"></i>
                        <span>${r.authorStaticId}</span>
                    </div>
                    ` : ''}
                </div>
                
                ${CURRENT_RANK.level >= RANKS.ADMIN.level && !r.confirmed && !r.deleted ? `
                <div style="display: flex; gap: 5px;">
                    <button onclick="confirmReport('${r.id}')" style="background: rgba(140, 180, 60, 0.2); border: 1px solid #8cb43c; color: #8cb43c; padding: 4px 8px; border-radius: 3px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-check"></i> Подтвердить
                    </button>
                    <button onclick="deleteReport('${r.id}')" style="background: rgba(180, 60, 60, 0.2); border: 1px solid #b43c3c; color: #b43c3c; padding: 4px 8px; border-radius: 3px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        cardsContainer.appendChild(card);
    });
    
    listDiv.appendChild(cardsContainer);
    
    // Добавляем пагинацию если есть больше одной страницы
    if (paginationContainer) {
        if (totalPages > 1) {
            renderPagination('mlk-pagination-container', currentPage, totalPages, 'renderMLKListPaginated');
        } else {
            paginationContainer.innerHTML = '<div style="text-align: center; color: #8f9779; padding: 10px;">Страница 1 из 1</div>';
        }
    }
    
    setTimeout(adjustInterfaceHeights, 100);
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
    
    // Только создатель может менять пароль
    if (CURRENT_USER.toLowerCase() !== "tihiy") { 
        content.innerHTML = `
            <div class="error-display" style="text-align: center; padding: 40px;">
                <i class="fas fa-lock" style="font-size: 3rem; color: #b43c3c; margin-bottom: 20px;"></i>
                <h3 style="color: #b43c3c;">ДОСТУП ЗАПРЕЩЕН</h3>
                <p style="color: #8f9779;">Только создатель системы может изменять пароль</p>
            </div>
        `; 
        return; 
    }
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-key"></i> ПАРОЛЬ СОЗДАТЕЛЯ
            </h2>
            
            <div class="scrollable-container" style="flex: 1; padding-right: 10px;">
                <div class="zone-card" style="margin-bottom: 20px; border-color: #c0b070;">
                    <div class="card-icon" style="color: #c0b070;"><i class="fas fa-crown"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">ИНФОРМАЦИЯ</h4>
                    <p style="color: #8f9779; line-height: 1.6;">
                        Этот пароль используется только для входа под именем <strong>Tihiy</strong>.<br>
                        Все остальные пользователи регистрируются со своими паролями и становятся младшими кураторами.
                    </p>
                </div>
                
                <div class="zone-card" style="border-color: #c0b070;">
                    <div class="card-icon" style="color: #c0b070;"><i class="fas fa-shield-alt"></i></div>
                    <h4 style="color: #c0b070; margin-bottom: 10px;">ИЗМЕНЕНИЕ ПАРОЛЯ СОЗДАТЕЛЯ</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label class="form-label">ТЕКУЩИЙ ПАРОЛЬ</label>
                            <input type="password" id="current-password" class="form-input" placeholder="Введите текущий пароль">
                        </div>
                        
                        <div>
                            <label class="form-label">НОВЫЙ ПАРОЛЬ</label>
                            <input type="password" id="new-password" class="form-input" placeholder="Введите новый пароль">
                        </div>
                        
                        <div>
                            <label class="form-label">ПОВТОРИТЕ НОВЫЙ ПАРОЛЬ</label>
                            <input type="password" id="confirm-password" class="form-input" placeholder="Повторите новый пароль">
                        </div>
                        
                        <div style="margin-top: 10px;">
                            <button onclick="updateCreatorPassword()" class="btn-primary" style="width: 100%; padding: 12px; border-color: #c0b070;">
                                <i class="fas fa-save"></i> СОХРАНИТЬ НОВЫЙ ПАРОЛЬ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setTimeout(adjustInterfaceHeights, 100);
};

window.updateCreatorPassword = async function() {
    const currentPassword = document.getElementById("current-password")?.value.trim();
    const newPassword = document.getElementById("new-password")?.value.trim();
    const confirmPassword = document.getElementById("confirm-password")?.value.trim();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification("Заполните все поля", "error");
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification("Новые пароли не совпадают", "error");
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification("Пароль должен содержать минимум 6 символов", "error");
        return;
    }
    
    try {
        // Проверяем текущий пароль создателя
        const passwordsSnapshot = await db.ref('mlk_passwords').once('value');
        const passwords = passwordsSnapshot.val() || {};
        const creatorPassword = passwords.special;
        
        if (!creatorPassword) {
            showNotification("Ошибка системы: пароль создателя не найден", "error");
            return;
        }
        
        const validCurrentPassword = await verifyPassword(currentPassword, creatorPassword);
        if (!validCurrentPassword) {
            showNotification("Неверный текущий пароль", "error");
            return;
        }
        
        // Обновляем пароль создателя
        const salt = generateSalt();
        const hash = await hashPassword(newPassword, salt);
        
        await db.ref('mlk_passwords').update({ 
            special: { hash, salt, plain: newPassword } 
        });
        
        showNotification("✅ Пароль создателя успешно изменен", "success");
        
        // Обновляем отображение
        renderPasswords();
        
    } catch (error) {
        console.error('Password change error:', error);
        showNotification("Ошибка при смене пароля", "error");
    }
};

window.updateSystemPassword = async function(type) {
    if (CURRENT_RANK.level < RANKS.ADMIN.level && CURRENT_RANK !== CREATOR_RANK) { 
        showNotification("Только администратор может изменять системные пароли", "error"); 
        return; 
    }
    
    const inputId = type + "-password";
    const input = document.getElementById(inputId);
    const newPassword = input ? input.value.trim() : "";
    
    if (!newPassword) { 
        showNotification("Введите новый пароль", "error"); 
        return; 
    }
    
    if (newPassword.length < 6) {
        showNotification("Пароль должен содержать минимум 6 символов", "error");
        return;
    }
    
    const confirmMessage = `Изменить системный пароль "${type}"?\nНовый пароль будет установлен.`;
    if (!confirm(confirmMessage)) return;
    
    try {
        const salt = generateSalt();
        const hash = await hashPassword(newPassword, salt);
        
        await db.ref('mlk_passwords').update({ 
            [type]: { hash, salt, plain: newPassword } 
        });
        
        passwords[type] = { hash, salt, plain: newPassword };
        showNotification(`✅ Системный пароль "${type}" изменен`, "success");
        
        // Логируем изменение
        await db.ref('mlk_password_logs').push({ 
            type, 
            changedBy: CURRENT_USER, 
            changedAt: new Date().toLocaleString(),
            userStaticId: CURRENT_STATIC_ID
        });
        
        // Обновляем отображение
        renderPasswords();
        
    } catch (error) { 
        showNotification("Ошибка изменения пароля: " + error.message, "error"); 
    }
};

async function createOrUpdatePasswords() {
    const defaultPassword = "creator123"; // Пароль по умолчанию для создателя
    
    const salt = generateSalt();
    const hash = await hashPassword(defaultPassword, salt);
    
    const passwordsData = {
        special: { hash, salt, plain: defaultPassword }
    };
    
    return db.ref('mlk_passwords').set(passwordsData);
}

window.resetAllPasswords = async function() {
    if (CURRENT_USER.toLowerCase() !== "tihiy") { 
        showNotification("Только создатель может сбрасывать пароли", "error"); 
        return; 
    }
    
    if (!confirm("ВНИМАНИЕ! Это сбросит пароль создателя на значение по умолчанию. Продолжить?")) return;
    
    try {
        await createOrUpdatePasswords();
        showNotification("Пароль создателя сброшен на значение по умолчанию", "success");
        await new Promise(resolve => loadData(resolve));
        renderPasswords();
    } catch (error) { 
        showNotification("Ошибка сброса пароля: " + error.message, "error"); 
    }
};

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
    
    // Проверяем права доступа
    if (CURRENT_RANK.level < RANKS.SENIOR_CURATOR.level && CURRENT_RANK.level !== CREATOR_RANK.level) {
        content.innerHTML = `
            <div class="error-display" style="text-align: center; padding: 40px;">
                <i class="fas fa-lock" style="font-size: 3rem; color: #b43c3c; margin-bottom: 20px;"></i>
                <h3 style="color: #b43c3c;">ДОСТУП ЗАПРЕЩЕН</h3>
                <p style="color: #8f9779;">Только старший куратор или выше может просматривать список пользователей</p>
            </div>
        `;
        return;
    }
    
    currentPage = page;
    const itemsPerPage = PAGINATION_CONFIG.itemsPerPage;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = users.slice(startIndex, endIndex);
    totalPages = Math.ceil(users.length / itemsPerPage);
    
    const adminUsers = users.filter(u => u.role === RANKS.ADMIN.name).length;
    const seniorCurators = users.filter(u => u.role === RANKS.SENIOR_CURATOR.name).length;
    const curators = users.filter(u => u.role === RANKS.CURATOR.name).length;
    const juniorCurators = users.filter(u => u.role === RANKS.JUNIOR_CURATOR.name).length;
    
    // Рассчитываем пользователей, которых можно удалить
    const deletableUsers = users.filter(user => {
        const isProtected = PROTECTED_USERS.some(protectedUser => 
            protectedUser.toLowerCase() === user.username.toLowerCase()
        );
        const isCurrentUser = user.username === CURRENT_USER;
        return !isProtected && !isCurrentUser;
    }).length;
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <div>
                    <h2 style="color: #c0b070; margin-bottom: 5px; font-family: 'Orbitron', sans-serif;">
                        <i class="fas fa-user-friends"></i> РЕГИСТРИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ
                    </h2>
                    <p style="color: #8f9779; margin: 0; font-size: 0.9rem;">
                        Всего пользователей: ${users.length} | Можно удалить: ${deletableUsers}
                    </p>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <div class="items-per-page-selector">
                        <span>На странице:</span>
                        <select onchange="changeItemsPerPage('renderUsersWithPagination', this.value)">
                            <option value="5" ${PAGINATION_CONFIG.itemsPerPage === 5 ? 'selected' : ''}>5</option>
                            <option value="10" ${PAGINATION_CONFIG.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                            <option value="15" ${PAGINATION_CONFIG.itemsPerPage === 15 ? 'selected' : ''}>15</option>
                            <option value="20" ${PAGINATION_CONFIG.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                            <option value="30" ${PAGINATION_CONFIG.itemsPerPage === 30 ? 'selected' : ''}>30</option>
                        </select>
                    </div>
                    
                    ${CURRENT_RANK.level >= RANKS.ADMIN.level ? `
                    <button onclick="deleteAllUsersConfirm()" class="btn-primary" 
                            style="background: rgba(180, 60, 60, 0.2); border-color: #b43c3c; color: #b43c3c; padding: 8px 16px;"
                            title="Удалить всех пользователей (кроме себя и защищенных)">
                        <i class="fas fa-skull-crossbones"></i> УДАЛИТЬ ВСЕХ
                    </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="dashboard-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-users"></i></div>
                    <div class="card-value">${users.length}</div>
                    <div class="card-label">ВСЕГО</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user-shield"></i></div>
                    <div class="card-value">${adminUsers}</div>
                    <div class="card-label">АДМИНЫ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-star"></i></div>
                    <div class="card-value">${seniorCurators}</div>
                    <div class="card-label">СТ.КУРАТОРЫ</div>
                </div>
                <div class="zone-card">
                    <div class="card-icon"><i class="fas fa-user"></i></div>
                    <div class="card-value">${curators}</div>
                    <div class="card-label">КУРАТОРЫ</div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h4 style="color: #c0b070; margin: 0;">СПИСОК ПОЛЬЗОВАТЕЛЕЙ (${users.length})</h4>
                ${deletableUsers > 0 ? `
                <div style="color: #8f9779; font-size: 0.9rem;">
                    <i class="fas fa-exclamation-triangle" style="color: #c0b070;"></i>
                    Можно удалить: ${deletableUsers} пользователей
                </div>
                ` : ''}
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div class="table-container scrollable-container" style="flex: 1;">
                    ${users.length === 0 ? 
                        `<div style="text-align: center; padding: 40px; color: #8f9779;">
                            <i class="fas fa-user-friends" style="font-size: 2rem; margin-bottom: 10px;"></i>
                            <p>ПОЛЬЗОВАТЕЛИ ПОЯВЯТСЯ ПОСЛЕ РЕГИСТРАЦИИ</p>
                        </div>` : 
                        `<table class="data-table" style="min-width: 100%;">
                            <thead>
                                <tr>
                                    <th>ПСЕВДОНИМ</th>
                                    <th>STATIC ID</th>
                                    <th>РАНГ</th>
                                    <th>РЕГИСТРАЦИЯ</th>
                                    <th>ПОСЛЕДНИЙ ВХОД</th>
                                    <th>СТАТУС</th>
                                    <th style="min-width: 200px;">ДЕЙСТВИЯ</th>
                                </tr>
                            </thead>
                            <tbody id="users-table-body"></tbody>
                        </table>`
                    }
                </div>
                <div id="users-pagination-container"></div>
            </div>
        </div>
    `;
    
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
        const isProtected = PROTECTED_USERS.some(protectedUser => 
            protectedUser.toLowerCase() === user.username.toLowerCase()
        );
        const isCurrentUser = user.username === CURRENT_USER;
        const isBanned = bans.some(ban => ban.staticId === user.staticId && !ban.unbanned);
        
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
        
        // Проверяем права для удаления
        const canDelete = (
            !isProtected && 
            !isCurrentUser && 
            (CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level || CURRENT_RANK.level === CREATOR_RANK.level)
        );
        
        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas ${isProtected ? 'fa-shield-alt' : 'fa-user'}" 
                       style="color: ${isProtected ? '#c0b070' : isCurrentUser ? '#8cb43c' : isBanned ? '#b43c3c' : '#8f9779'}">
                    </i>
                    <a href="javascript:void(0)" 
                       onclick="openUserInNewTab('${user.username.replace(/'/g, "\\'")}', '${user.role.replace(/'/g, "\\'")}', '${user.staticId}', ${user.rank})"
                       class="username-link"
                       style="
                           color: ${isProtected ? '#c0b070' : isCurrentUser ? '#8cb43c' : isBanned ? '#b43c3c' : '#8f9779'};
                           text-decoration: none;
                           font-weight: 500;
                           cursor: pointer;
                           transition: all 0.2s;
                           padding: 3px 8px;
                           border-radius: 3px;
                       "
                       onmouseover="this.style.background='rgba(192, 176, 112, 0.1)'; this.style.textDecoration='underline'"
                       onmouseout="this.style.background='transparent'; this.style.textDecoration='none'"
                       title="Открыть в новой вкладке">
                        ${user.username}
                        ${isCurrentUser ? '<span style="color: #8cb43c; font-size: 0.8rem; margin-left: 5px;">(ВЫ)</span>' : ''}
                        ${isBanned ? '<span style="color: #b43c3c; font-size: 0.8rem; margin-left: 5px;">(ЗАБАНЕН)</span>' : ''}
                    </a>
                </div>
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
                <div class="action-buttons" style="display: flex; gap: 5px; flex-wrap: wrap;">
    ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.ADMIN.level && user.role !== RANKS.ADMIN.name ? 
        `<button onclick="promoteToAdminByStaticId('${user.staticId}')" class="action-btn" style="background: #c0b070; border-color: #c0b070; color: #1e201c; padding: 3px 8px; font-size: 0.8rem;">
            <i class="fas fa-user-shield"></i> АДМ
        </button>` : ''
    }
    ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.SENIOR_CURATOR.name ? 
        `<button onclick="promoteToSeniorByStaticId('${user.staticId}')" class="action-btn" style="background: #8cb43c; border-color: #8cb43c; color: #1e201c; padding: 3px 8px; font-size: 0.8rem;">
            <i class="fas fa-star"></i> СТ.КУР
        </button>` : ''
    }
    ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.role !== RANKS.CURATOR.name ? 
        `<button onclick="setToCuratorByStaticId('${user.staticId}')" class="action-btn" style="background: #5865F2; border-color: #5865F2; color: #1e201c; padding: 3px 8px; font-size: 0.8rem;">
            <i class="fas fa-user"></i> КУР
        </button>` : ''
    }
    ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.rank > RANKS.CURATOR.level ? 
        `<button onclick="demoteToCuratorByStaticId('${user.staticId}')" class="action-btn" style="background: #5865F2; border-color: #5865F2; color: #1e201c; padding: 3px 8px; font-size: 0.8rem;"
             title="Понизить до куратора">
            <i class="fas fa-arrow-down"></i> КУР
        </button>` : ''
    }
    ${!isProtected && !isCurrentUser && CURRENT_RANK.level >= RANKS.SENIOR_CURATOR.level && user.rank > RANKS.JUNIOR_CURATOR.level ? 
    `<button onclick="demoteToJuniorByStaticId('${user.staticId}')" 
        class="action-btn" 
        style="
            background: rgba(143, 151, 121, 0.2); 
            border: 1px solid #8f9779; 
            color: #8f9779; 
            padding: 3px 8px; 
            font-size: 0.8rem;
            transition: all 0.2s;
        "
        onmouseover="this.style.background='rgba(143, 151, 121, 0.4)'; this.style.borderColor='#c0b070'; this.style.color='#c0b070'"
        onmouseout="this.style.background='rgba(143, 151, 121, 0.2)'; this.style.borderColor='#8f9779'; this.style.color='#8f9779'"
        title="Понизить до младшего куратора (оставит только доступ к отчетам)">
        <i class="fas fa-arrow-down"></i> МЛ.КУР
    </button>` : ''
}
    }
    ${canDelete ? 
        `<button onclick="deleteUserByStaticId('${user.staticId}')" class="action-btn delete-btn" 
           style="background: #b43c3c; border-color: #b43c3c; color: white; padding: 3px 8px; font-size: 0.8rem;"
           title="Удалить пользователя полностью из системы">
            <i class="fas fa-trash"></i> УДАЛИТЬ
        </button>` : ''
    }
</div>
            </td>
        </tr>`;
    }).join('');
}
/* ===== СТРАНИЦА СИСТЕМЫ С ПРОКРУТКОЙ ===== */
window.renderSystem = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    const pendingReports = reports.filter(r => !r.confirmed && !r.deleted).length;
    const confirmedReports = reports.filter(r => r.confirmed).length;
    const deletedReports = reports.filter(r => r.deleted).length;
    
    const adminUsers = users.filter(u => u.role === RANKS.ADMIN.name).length;
    const adminItemsHtml = users.filter(u => u.role === RANKS.ADMIN.name).map(u => `<div class="admin-name">${(u.username || u.user) ?? '—'}</div>`).join('');
    const seniorCurators = users.filter(u => u.role === RANKS.SENIOR_CURATOR.name).length;
    const curators = users.filter(u => u.role === RANKS.CURATOR.name).length;
    const juniorCurators = users.filter(u => u.role === RANKS.JUNIOR_CURATOR.name).length;
    const activeBans = bans.filter(ban => !ban.unbanned).length;
    
    content.innerHTML = `
        <div class="form-container with-scroll">
            <h2 style="color: #c0b070; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                <i class="fas fa-cogs"></i> СИСТЕМА ЗОНЫ
            </h2>
            
            <div class="scrollable-container" style="flex: 1; padding-right: 10px;">
                <!-- Main metrics moved into the left 'СИСТЕМА' card; old small grids removed -->
                
                <!-- ИНФОРМАЦИЯ О СИСТЕМЕ (РАЗДЕЛЕНИЕ НА КАТЕГОРИИ) -->
                <div class="dashboard-grid info-split" style="margin-top: 20px; grid-template-columns: 1fr 1fr; gap:16px;">
                    <div class="zone-card info-card metrics-card" style="border-color: #c0b070;">
                        <div class="card-icon" style="color: #c0b070;"><i class="fas fa-info-circle"></i></div>
                        <h4 style="color: #c0b070; margin-bottom: 10px;">СИСТЕМА</h4>
                        <div class="info-content">
                            <div class="metric-grid">
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-database"></i></div><div class="card-value">${reports.length}</div><div class="card-label">ВСЕГО ОТЧЁТОВ</div></div>
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-users"></i></div><div class="card-value">${users.length}</div><div class="card-label">ПОЛЬЗОВАТЕЛЕЙ</div></div>
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-user-shield"></i></div><div class="card-value">${whitelist.length}</div><div class="card-label">В СПИСКЕ ДОСТУПА</div></div>
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-ban"></i></div><div class="card-value">${activeBans}</div><div class="card-label">АКТИВНЫХ БАНОВ</div></div>

                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-clock"></i></div><div class="card-value">${pendingReports}</div><div class="card-label">НА РАССМОТРЕНИИ</div></div>
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-check"></i></div><div class="card-value">${confirmedReports}</div><div class="card-label">ПОДТВЕРЖДЕНО</div></div>
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-trash"></i></div><div class="card-value">${deletedReports}</div><div class="card-label">УДАЛЕНО</div></div>

                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-user-shield"></i></div><div class="card-value">${adminUsers}</div><div class="card-label">АДМИНИСТРАТОРЫ</div></div>
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-star"></i></div><div class="card-value">${seniorCurators}</div><div class="card-label">СТАРШИЕ КУРАТОРЫ</div></div>
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-user"></i></div><div class="card-value">${curators}</div><div class="card-label">КУРАТОРЫ</div></div>
                                <div class="metric-tile"><div class="card-icon"><i class="fas fa-user-graduate"></i></div><div class="card-value">${juniorCurators}</div><div class="card-label">МЛАДШИЕ КУРАТОРЫ</div></div>
                            </div>
                        </div>
                    </div>

                    <div class="zone-card info-card admin-card" style="border-color: #8cb43c;">
                        <div class="card-icon" style="color: #8cb43c;"><i class="fas fa-user-shield"></i></div>
                        <h4 style="color: #8cb43c; margin-bottom: 10px;">АДМИНЫ</h4>
                        <div class="info-content">
                            <div class="admin-count" style="font-weight:600; color:var(--text-primary); margin-bottom:8px;">Всего: ${adminUsers}</div>
                            <div class="admin-list">${adminItemsHtml || '<div class="admin-name">—</div>'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setTimeout(adjustInterfaceHeights, 100);
};

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
/* ===== СИСТЕМА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ===== */

// Загрузка настроек из LocalStorage
function loadUserSettings() {
    const savedSettings = localStorage.getItem('user_settings_' + CURRENT_STATIC_ID);
    if (savedSettings) {
        USER_SETTINGS = { ...USER_SETTINGS, ...JSON.parse(savedSettings) };
    }
    applyUserSettings();
}

// Сохранение настроек
function saveUserSettings() {
    localStorage.setItem('user_settings_' + CURRENT_STATIC_ID, JSON.stringify(USER_SETTINGS));
    applyUserSettings();
}

// Применение настроек к интерфейсу
function applyUserSettings() {
    // Применение темы
    document.body.setAttribute('data-theme', USER_SETTINGS.theme);
    
    // Применение компактного вида
    if (USER_SETTINGS.compactView) {
        document.body.classList.add('compact-view');
    } else {
        document.body.classList.remove('compact-view');
    }
    
    // Применение размера шрифта
    if (USER_SETTINGS.fontSize) {
        document.body.style.fontSize = USER_SETTINGS.fontSize + 'px';
    }
    
    // Обновление аватарки в сайдбаре если есть
    updateUserAvatarInSidebar();
}

// Обновление аватарки в сайдбаре
function updateUserAvatarInSidebar() {
    const sidebarUser = document.querySelector('.user-info-avatar');
    if (sidebarUser) {
        if (USER_SETTINGS.avatar) {
            sidebarUser.innerHTML = `<img src="${USER_SETTINGS.avatar}" alt="${CURRENT_USER}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">`;
        } else {
            sidebarUser.innerHTML = `<i class="fas fa-user-circle"></i>`;
        }
    }
}

/* ===== РЕНДЕР ПРОФИЛЯ ===== */
window.renderProfile = function() {
    const content = document.getElementById("content-body");
    if (!content) return;
    
    // Получаем данные активного аккаунта
    let currentTab = accountTabs[activeAccountTab];
    let displayUsername, displayRank, displayStaticId;
    
    if (currentTab && currentTab.isMain) {
        // Основной аккаунт - используем глобальные переменные
        displayUsername = CURRENT_USER;
        displayRank = CURRENT_RANK?.name;
        displayStaticId = CURRENT_STATIC_ID;
    } else if (currentTab && currentTab.savedUserData) {
        // Дополнительный аккаунт - используем данные из таба
        displayUsername = currentTab.savedUserData.username;
        displayRank = currentTab.savedUserData.rankName;
        displayStaticId = currentTab.savedUserData.staticId;
    } else {
        // Если что-то пошло не так, показываем данные основного аккаунта
        displayUsername = CURRENT_USER;
        displayRank = CURRENT_RANK?.name;
        displayStaticId = CURRENT_STATIC_ID;
    }
    
    loadUserSettings(); // Загружаем текущие настройки
    
    content.innerHTML = `
        <div class="form-container" style="display: flex; flex-direction: column; height: 100%; gap: 20px;">
            <!-- ШАПКА ПРОФИЛЯ -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: rgba(40, 42, 36, 0.7); border: 1px solid #4a4a3a; border-radius: 8px; border-left: 5px solid #c0b070;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="position: relative;">
                        <div id="avatar-preview-large" style="
                            width: 96px; 
                            height: 96px; 
                            background: rgba(60, 62, 56, 0.8); 
                            border-radius: 50%; 
                            border: 3px solid #c0b070; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            overflow: hidden;
                        ">
                            ${USER_SETTINGS.avatar ? 
                                `<img src="${USER_SETTINGS.avatar}" alt="${displayUsername}" 
                                      style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                                      onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'96\\' height=\\'96\\' viewBox=\\'0 0 96 96\\'><rect width=\\'96\\' height=\\'96\\' fill=\\'%231e201c\\' rx=\\'48\\'/><text x=\\'48\\' y=\\'52\\' font-family=\\'Arial\\' font-size=\\'32\\' font-weight=\\'bold\\' text-anchor=\\'middle\\' fill=\\'%23c0b070\\'>${displayUsername.substring(0, 2).toUpperCase()}</text></svg>'">` : 
                                `<i class="fas fa-user-shield" style="font-size: 2.5rem; color: #c0b070;"></i>`
                            }
                        </div>
                        <div id="avatar-change-btn" style="
                            position: absolute; 
                            bottom: 5px; 
                            right: 5px; 
                            width: 32px; 
                            height: 32px; 
                            background: #c0b070; 
                            border-radius: 50%; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            cursor: pointer; 
                            border: 2px solid #1e201c;
                        ">
                            <i class="fas fa-camera" style="color: #1e201c; font-size: 1rem;"></i>
                        </div>
                    </div>
                    <div>
                        <h2 style="color: #c0b070; margin: 0 0 8px 0; font-family: 'Orbitron', sans-serif; font-size: 1.5rem;">
                            ${displayUsername}
                            ${currentTab && !currentTab.isMain ? '<span style="color: #8cb43c; font-size: 0.8rem; margin-left: 10px;">[ДОП. АККАУНТ]</span>' : ''}
                        </h2>
                        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                            <span style="color: #8cb43c; background: rgba(140, 180, 60, 0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500;">
                                <i class="fas fa-crown" style="margin-right: 5px;"></i>
                                ${displayRank || 'БЕЗ РАНГА'}
                            </span>
                            <span style="color: #8f9779; font-family: 'Courier New', monospace; font-size: 0.85rem;">
                                <i class="fas fa-id-card" style="margin-right: 5px;"></i>
                                ${displayStaticId || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
                <button onclick="goBackToPreviousScreen()" class="btn-secondary" style="padding: 10px 20px; font-size: 0.9rem; min-width: 120px;">
    <i class="fas fa-arrow-left"></i> НАЗАД
</button>
            </div>
            
            <!-- ОСНОВНОЕ СОДЕРЖИМОЕ С ВКЛАДКАМИ -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 20px; overflow: hidden;">
                <!-- ТАБЫ -->
                <div style="display: flex; gap: 5px; border-bottom: 1px solid #4a4a3a; padding: 0 10px; overflow-x: auto;">
                    <button class="profile-tab active" onclick="switchProfileTab('info')" style="padding: 12px 20px; min-width: 120px;">
                        <i class="fas fa-user"></i> ПРОФИЛЬ
                    </button>
                    ${currentTab && currentTab.isMain ? `
                    <button class="profile-tab" onclick="switchProfileTab('security')" style="padding: 12px 20px; min-width: 120px;">
                        <i class="fas fa-shield-alt"></i> БЕЗОПАСНОСТЬ
                    </button>
                    <button class="profile-tab" onclick="switchProfileTab('appearance')" style="padding: 12px 20px; min-width: 120px;">
                        <i class="fas fa-palette"></i> ВНЕШНИЙ ВИД
                    </button>
                    <button class="profile-tab" onclick="switchProfileTab('notifications')" style="padding: 12px 20px; min-width: 120px;">
                        <i class="fas fa-bell"></i> УВЕДОМЛЕНИЯ
                    </button>
                    ` : `
                    <div style="padding: 12px 20px; min-width: 120px; color: #6a6a5a; font-size: 0.9rem; text-align: center;">
                        <i class="fas fa-info-circle"></i> ЛИШЬ ПРОСМОТР
                    </div>
                    `}
                </div>
                
                <!-- КОНТЕНТ ВКЛАДОК -->
                <div id="profile-tab-content" class="scrollable-container" style="flex: 1; padding: 20px; background: rgba(30, 32, 28, 0.3); border-radius: 8px;">
                    <!-- Контент будет загружен здесь -->
                </div>
            </div>
        </div>
    `;
    
    // Для дополнительных аккаунтов показываем только просмотр
    if (currentTab && !currentTab.isMain) {
        loadProfileTabForAdditionalAccount(currentTab);
    } else {
        // Для основного аккаунта загружаем полный профиль
        loadProfileTab('info');
    }
    function loadProfileTabForAdditionalAccount(tab) {
    const tabContent = document.getElementById('profile-tab-content');
    if (!tabContent) return;
    
    const userData = tab.savedUserData || {
        username: tab.login,
        rankName: tab.rankName,
        rankLevel: tab.rankLevel,
        staticId: tab.login + "-tab-" + tab.id
    };
    
    tabContent.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 25px; max-width: 800px; margin: 0 auto;">
            <!-- ИНФОРМАЦИЯ О ДОПОЛНИТЕЛЬНОМ АККАУНТЕ -->
            <div class="zone-card" style="border-color: #8cb43c;">
                <div class="card-icon" style="color: #8cb43c;"><i class="fas fa-info-circle"></i></div>
                <h4 style="color: #8cb43c; margin-bottom: 20px;">ПРОСМОТР АККАУНТА</h4>
                
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- КАРТОЧКИ С ИНФОРМАЦИЕЙ -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        <div style="background: rgba(40, 42, 36, 0.5); border-radius: 6px; padding: 20px;">
                            <div style="color: #8f9779; font-size: 0.9rem; margin-bottom: 8px;">
                                <i class="fas fa-user"></i> ИМЯ ПОЛЬЗОВАТЕЛЯ
                            </div>
                            <div style="color: #c0b070; font-weight: 600; font-size: 1.2rem;">
                                ${userData.username}
                            </div>
                        </div>
                        
                        <div style="background: rgba(40, 42, 36, 0.5); border-radius: 6px; padding: 20px;">
                            <div style="color: #8f9779; font-size: 0.9rem; margin-bottom: 8px;">
                                <i class="fas fa-crown"></i> РАНГ
                            </div>
                            <div style="color: #8cb43c; font-weight: 600; font-size: 1.2rem;">
                                ${userData.rankName || 'НЕИЗВЕСТНО'}
                            </div>
                        </div>
                        
                        <div style="background: rgba(40, 42, 36, 0.5); border-radius: 6px; padding: 20px;">
                            <div style="color: #8f9779; font-size: 0.9rem; margin-bottom: 8px;">
                                <i class="fas fa-id-card"></i> ID
                            </div>
                            <div style="color: #8f9779; font-family: 'Courier New', monospace; font-size: 0.9rem;">
                                ${userData.staticId}
                            </div>
                        </div>
                    </div>
                    
                    <!-- ПРАВА ДОСТУПА -->
                    <div style="background: rgba(40, 42, 36, 0.5); border-radius: 6px; padding: 20px;">
                        <h5 style="color: #c0b070; margin-bottom: 15px; font-size: 1rem;">
                            <i class="fas fa-key"></i> ПРАВА ДОСТУПА
                        </h5>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                            ${tab.access && tab.access.length > 0 ? 
                                tab.access.map(access => `
                                    <span style="
                                        background: rgba(140, 180, 60, 0.1);
                                        color: #8cb43c;
                                        padding: 6px 12px;
                                        border-radius: 4px;
                                        font-size: 0.85rem;
                                        display: flex;
                                        align-items: center;
                                        gap: 6px;
                                    ">
                                        <i class="fas fa-check-circle"></i>
                                        ${getAccessDisplayName(access)}
                                    </span>
                                `).join('') : 
                                '<span style="color: #6a6a5a; font-style: italic;">Нет прав доступа</span>'
                            }
                        </div>
                    </div>
                    
                    <!-- ПРИМЕЧАНИЕ -->
                    <div style="background: rgba(192, 176, 112, 0.05); border: 1px solid #c0b070; border-radius: 6px; padding: 20px;">
                        <div style="color: #c0b070; display: flex; align-items: flex-start; gap: 10px;">
                            <i class="fas fa-exclamation-circle" style="margin-top: 3px;"></i>
                            <div>
                                <div style="font-weight: 600; margin-bottom: 5px;">ПРИМЕЧАНИЕ</div>
                                <div style="color: #8f9779; font-size: 0.9rem;">
                                    Это дополнительный аккаунт, созданный через систему вкладок. 
                                    Для изменения настроек используйте основной аккаунт.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- КНОПКА ЗАКРЫТИЯ -->
            <div style="text-align: center;">
                <button onclick="closeAccountTab('${tab.id}')" class="btn-primary" style="border-color: #b43c3c; color: #b43c3c;">
                    <i class="fas fa-times"></i> ЗАКРЫТЬ ЭТУ ВКЛАДКУ
                </button>
            </div>
        </div>
    `;
}
/* ===== ФУНКЦИЯ ВОЗВРАТА НА ПРЕДЫДУЩИЙ ЭКРАН ===== */
window.goBackToPreviousScreen = function() {
    // Определяем, на какой экран вернуться в зависимости от активного аккаунта
    const currentTab = accountTabs[activeAccountTab];
    
    if (currentTab) {
        if (currentTab.isMain) {
            // Основной аккаунт - показываем систему или отчеты
            if (CURRENT_RANK && CURRENT_RANK.level >= RANKS.ADMIN.level) {
                renderSystem();
            } else {
                renderMLKScreen();
            }
        } else {
            // Дополнительный аккаунт - показываем в зависимости от доступа
            if (currentTab.access && currentTab.access.includes('system')) {
                renderSystem();
            } else if (currentTab.access && currentTab.access.includes('mlk_reports')) {
                renderMLKScreen();
            }
        }
    }
};
// Функция для отображения названий прав доступа
function getAccessDisplayName(access) {
    const accessNames = {
        'mlk_reports': 'Отчеты МЛК',
        'all_reports': 'Все отчеты',
        'whitelist': 'Список доступа',
        'users': 'Пользователи',
        'system': 'Система',
        'bans': 'Баны',
        'ip_monitoring': 'IP мониторинг',
        'webhooks': 'Discord вебхуки',
        'profile': 'Мой профиль',
        'creator_password': 'Пароль создателя'
    };
    return accessNames[access] || access;
}
    // Добавляем обработчик для смены аватарки (только для основного аккаунта)
    if (currentTab && currentTab.isMain) {
        const changeBtn = document.getElementById('avatar-change-btn');
        if (changeBtn) {
            changeBtn.addEventListener('click', function() {
                showAvatarUploadModal();
            });
        }
    } else {
        // Скрываем кнопку изменения аватарки для дополнительных аккаунтов
        const changeBtn = document.getElementById('avatar-change-btn');
        if (changeBtn) {
            changeBtn.style.display = 'none';
        }
    }
    
    setTimeout(adjustInterfaceHeights, 100);
};

/* ===== ФУНКЦИИ ДЛЯ ВКЛАДОК ПРОФИЛЯ ===== */
function switchProfileTab(tabName) {
    // Обновляем активную вкладку
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    event.currentTarget.classList.add('active');
    
    // Загружаем контент вкладки
    loadProfileTab(tabName);
}

function loadProfileTab(tabName) {
    const tabContent = document.getElementById('profile-tab-content');
    if (!tabContent) return;
    
    switch(tabName) {
        case 'info':
            tabContent.innerHTML = renderProfileInfoTab();
            break;
        case 'security':
            tabContent.innerHTML = renderProfileSecurityTab();
            break;
        case 'appearance':
            tabContent.innerHTML = renderProfileAppearanceTab();
            break;
        case 'notifications':
            tabContent.innerHTML = renderProfileNotificationsTab();
            break;
    }
    
    setTimeout(adjustInterfaceHeights, 50);
}

function renderProfileInfoTab() {
    const currentUserData = users.find(u => u.username === CURRENT_USER);
    
    return `
        <div style="display: flex; flex-direction: column; gap: 25px; max-width: 800px; margin: 0 auto;">
            <!-- ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ -->
            <div class="zone-card" style="border-color: #c0b070;">
                <div class="card-icon" style="color: #c0b070;"><i class="fas fa-info-circle"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 20px;">ИНФОРМАЦИЯ О ПРОФИЛЕ</h4>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 25px;">
                    <div>
                        <label class="form-label">ИМЯ ПОЛЬЗОВАТЕЛЯ</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="profile-username" class="form-input" value="${CURRENT_USER}" placeholder="Ваше имя пользователя" style="flex: 1;">
                            <button onclick="updateUsername()" class="btn-secondary" style="min-width: 100px;">
                                <i class="fas fa-save"></i>
                            </button>
                        </div>
                        <div style="font-size: 0.8rem; color: #8f9779; margin-top: 5px;">
                            Можно изменить только один раз в месяц
                        </div>
                    </div>
                    
                    <div>
                        <label class="form-label">EMAIL (ОПЦИОНАЛЬНО)</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="email" id="profile-email" class="form-input" placeholder="email@example.com" style="flex: 1;">
                            <button onclick="updateEmail()" class="btn-secondary" style="min-width: 100px;">
                                <i class="fas fa-save"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- СТАТИСТИКА -->
                <div style="background: rgba(40, 42, 36, 0.5); border-radius: 6px; padding: 20px; margin-top: 20px;">
                    <h5 style="color: #8cb43c; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-chart-bar"></i> СТАТИСТИКА АКТИВНОСТИ
                    </h5>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                        <div style="text-align: center; padding: 15px; background: rgba(30, 32, 28, 0.7); border-radius: 4px;">
                            <div style="font-size: 2rem; color: #c0b070; font-weight: bold; margin-bottom: 5px;">
                                ${currentUserData?.reportsCreated || 0}
                            </div>
                            <div style="font-size: 0.85rem; color: #8f9779;">
                                <i class="fas fa-file-alt" style="margin-right: 5px;"></i>
                                Отчетов создано
                            </div>
                        </div>
                        
                        <div style="text-align: center; padding: 15px; background: rgba(30, 32, 28, 0.7); border-radius: 4px;">
                            <div style="font-size: 2rem; color: #8cb43c; font-weight: bold; margin-bottom: 5px;">
                                ${currentUserData?.reportsConfirmed || 0}
                            </div>
                            <div style="font-size: 0.85rem; color: #8f9779;">
                                <i class="fas fa-check-circle" style="margin-right: 5px;"></i>
                                Отчетов подтверждено
                            </div>
                        </div>
                        
                        <div style="text-align: center; padding: 15px; background: rgba(30, 32, 28, 0.7); border-radius: 4px;">
                            <div style="font-size: 2rem; color: #c0b070; font-weight: bold; margin-bottom: 5px;">
                                ${new Date(currentUserData?.registrationDate || new Date()).toLocaleDateString('ru-RU')}
                            </div>
                            <div style="font-size: 0.85rem; color: #8f9779;">
                                <i class="fas fa-calendar-alt" style="margin-right: 5px;"></i>
                                Дата регистрации
                            </div>
                        </div>
                        
                        <div style="text-align: center; padding: 15px; background: rgba(30, 32, 28, 0.7); border-radius: 4px;">
                            <div style="font-size: 2rem; color: #8cb43c; font-weight: bold; margin-bottom: 5px;">
                                ${currentUserData?.lastLogin || 'Недавно'}
                            </div>
                            <div style="font-size: 0.85rem; color: #8f9779;">
                                <i class="fas fa-sign-in-alt" style="margin-right: 5px;"></i>
                                Последний вход
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- АВАТАР -->
            <div class="zone-card" style="border-color: #8cb43c;">
                <div class="card-icon" style="color: #8cb43c;"><i class="fas fa-user-circle"></i></div>
                <h4 style="color: #8cb43c; margin-bottom: 20px;">АВАТАР ПРОФИЛЯ</h4>
                
                <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
                    <div id="current-avatar" style="
                        width: 144px; 
                        height: 144px; 
                        border-radius: 50%; 
                        border: 4px solid #8cb43c; 
                        overflow: hidden; 
                        background: rgba(60, 62, 56, 0.8); 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                    ">
                        ${USER_SETTINGS.avatar ? 
                            `<img src="${USER_SETTINGS.avatar}" alt="${CURRENT_USER}" 
                                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                                  onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'144\\' height=\\'144\\' viewBox=\\'0 0 144 144\\'><rect width=\\'144\\' height=\\'144\\' fill=\\'%231e201c\\' rx=\\'72\\'/><text x=\\'72\\' y=\\'78\\' font-family=\\'Arial\\' font-size=\\'48\\' font-weight=\\'bold\\' text-anchor=\\'middle\\' fill=\\'%238cb43c\\'>${CURRENT_USER.substring(0, 2).toUpperCase()}</text></svg>'">` : 
                            `<i class="fas fa-user-shield" style="font-size: 4rem; color: #8cb43c;"></i>`
                        }
                    </div>
                    
                    <div style="text-align: center; color: #8f9779; max-width: 500px; margin: 0 auto;">
                        <p>Загрузите изображение для вашего профиля. Поддерживаются форматы JPG, PNG, GIF, SVG. Максимальный размер: 2MB.</p>
                    </div>
                    
                    <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
                        <button onclick="showAvatarUploadModal()" class="btn-primary" style="border-color: #8cb43c;">
                            <i class="fas fa-upload"></i> ЗАГРУЗИТЬ
                        </button>
                        <button onclick="generateAvatar()" class="btn-secondary">
                            <i class="fas fa-robot"></i> ГЕНЕРАЦИЯ
                        </button>
                        ${USER_SETTINGS.avatar ? 
                            `<button onclick="removeAvatar()" class="btn-secondary" style="border-color: #b43c3c; color: #b43c3c;">
                                <i class="fas fa-trash"></i> УДАЛИТЬ
                            </button>` : ''
                        }
                    </div>
                    
                    <!-- ПРЕДУСТАНОВЛЕННЫЕ АВАТАРКИ -->
                    <div style="width: 100%;">
                        <h5 style="color: #c0b070; margin-bottom: 15px; font-size: 0.95rem;">
                            <i class="fas fa-th"></i> БЫСТРЫЙ ВЫБОР
                        </h5>
                        <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
                            ${[
                                { icon: 'fa-user-secret', label: 'Шпион' },
                                { icon: 'fa-robot', label: 'Робот' },
                                { icon: 'fa-user-ninja', label: 'Ниндзя' },
                                { icon: 'fa-user-astronaut', label: 'Космонавт' },
                                { icon: 'fa-user-tie', label: 'Бизнесмен' },
                                { icon: 'fa-user-md', label: 'Доктор' }
                            ].map(item => `
                                <div onclick="setAvatarIcon('${item.icon}')" 
                                     class="avatar-option" 
                                     title="${item.label}"
                                     style="
                                        width: 72px;
                                        height: 72px;
                                        border-radius: 50%;
                                        background: rgba(60, 62, 56, 0.8);
                                        border: 2px solid #4a4a3a;
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        justify-content: center;
                                        cursor: pointer;
                                        transition: all 0.3s;
                                        padding: 8px;
                                    ">
                                    <i class="fas ${item.icon}" style="font-size: 1.8rem; color: #8f9779; margin-bottom: 5px;"></i>
                                    <span style="font-size: 0.75rem; color: #6a6a5a; line-height: 1.2;">${item.label}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProfileSecurityTab() {
    return `
        <div style="display: flex; flex-direction: column; gap: 25px; max-width: 800px; margin: 0 auto;">
            <!-- СМЕНА ПАРОЛЯ -->
            <div class="zone-card" style="border-color: #8cb43c;">
                <div class="card-icon" style="color: #8cb43c;"><i class="fas fa-key"></i></div>
                <h4 style="color: #8cb43c; margin-bottom: 20px;">СМЕНА ПАРОЛЯ</h4>
                
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div>
                        <label class="form-label">ТЕКУЩИЙ ПАРОЛЬ</label>
                        <input type="password" id="security-current-password" class="form-input" placeholder="Введите текущий пароль">
                    </div>
                    
                    <div>
                        <label class="form-label">НОВЫЙ ПАРОЛЬ</label>
                        <input type="password" id="security-new-password" class="form-input" placeholder="Введите новый пароль">
                        <div style="font-size: 0.8rem; color: #8f9779; margin-top: 5px;">
                            Минимум 6 символов, рекомендуется использовать буквы, цифры и специальные символы
                        </div>
                    </div>
                    
                    <div>
                        <label class="form-label">ПОВТОРИТЕ НОВЫЙ ПАРОЛЬ</label>
                        <input type="password" id="security-confirm-password" class="form-input" placeholder="Повторите новый пароль">
                    </div>
                    
                    <div style="margin-top: 10px;">
                        <button onclick="updatePassword()" class="btn-primary" style="width: 100%; padding: 12px; border-color: #8cb43c;">
                            <i class="fas fa-save"></i> СОХРАНИТЬ НОВЫЙ ПАРОЛЬ
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- СЕССИИ И БЕЗОПАСНОСТЬ -->
            <div class="zone-card" style="border-color: #c0b070;">
                <div class="card-icon" style="color: #c0b070;"><i class="fas fa-shield-alt"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 20px;">БЕЗОПАСНОСТЬ И СЕССИИ</h4>
                
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(40, 42, 36, 0.5); border-radius: 4px;">
                        <div>
                            <div style="color: #c0b070; font-weight: 500; margin-bottom: 5px;">ТЕКУЩАЯ СЕССИЯ</div>
                            <div style="color: #8f9779; font-size: 0.85rem;">
                                <i class="fas fa-desktop" style="margin-right: 5px;"></i>
                                ${navigator.userAgent.split(')')[0].split('(')[1] || 'Неизвестное устройство'}
                            </div>
                        </div>
                        <div style="color: #8cb43c; font-weight: 500;">АКТИВНА</div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <label class="form-checkbox">
                            <input type="checkbox" id="security-2fa" ${USER_SETTINGS.twoFactor ? 'checked' : ''}>
                            <span>Двухфакторная аутентификация</span>
                        </label>
                        
                        <label class="form-checkbox">
                            <input type="checkbox" id="security-email-notifications" ${USER_SETTINGS.emailNotifications ? 'checked' : ''}>
                            <span>Уведомления на email о входе в аккаунт</span>
                        </label>
                        
                        <label class="form-checkbox">
                            <input type="checkbox" id="security-logout-others" onclick="logoutOtherSessions()">
                            <span>Завершить все другие сессии</span>
                        </label>
                    </div>
                    
                    <div style="margin-top: 10px;">
                        <button onclick="saveSecuritySettings()" class="btn-primary" style="width: 100%; padding: 12px;">
                            <i class="fas fa-save"></i> СОХРАНИТЬ НАСТРОЙКИ БЕЗОПАСНОСТИ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProfileAppearanceTab() {
    const themes = [
        { id: 'default', name: 'СТАНДАРТНАЯ', color: '#c0b070', desc: 'Классическая тема Зоны' },
        { id: 'dark', name: 'ТЕМНАЯ', color: '#2a2520', desc: 'Максимально темная тема' },
        { id: 'green', name: 'ЗЕЛЕНАЯ', color: '#8cb43c', desc: 'Зеленая терминальная тема' },
        { id: 'blue', name: 'СИНЯЯ', color: '#5865F2', desc: 'Стиль Discord' },
        { id: 'red', name: 'КРАСНАЯ', color: '#b43c3c', desc: 'Агрессивный стиль' },
        { id: 'matrix', name: 'МАТРИЦА', color: '#00ff41', desc: 'Стиль матрицы' }
    ];
    
    return `
        <div style="display: flex; flex-direction: column; gap: 25px; max-width: 800px; margin: 0 auto;">
            <!-- ВЫБОР ТЕМЫ -->
            <div class="zone-card" style="border-color: #c0b070;">
                <div class="card-icon" style="color: #c0b070;"><i class="fas fa-palette"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 20px;">НАСТРОЙКА ВНЕШНЕГО ВИДА</h4>
                
                <div style="margin-bottom: 25px;">
                    <h5 style="color: #8cb43c; margin-bottom: 15px; font-size: 1rem;">
                        <i class="fas fa-fill-drip"></i> ВЫБЕРИТЕ ТЕМУ
                    </h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        ${themes.map(theme => `
                            <div class="theme-option ${USER_SETTINGS.theme === theme.id ? 'active' : ''}" 
                                 onclick="selectTheme('${theme.id}')"
                                 style="
                                    background: ${theme.id === 'default' ? 'linear-gradient(145deg, rgba(28, 26, 23, 0.9), rgba(20, 18, 15, 0.9))' : theme.color + '10'};
                                    border: 2px solid ${USER_SETTINGS.theme === theme.id ? theme.color : '#4a4a3a'};
                                    border-radius: 8px;
                                    padding: 20px;
                                    cursor: pointer;
                                    transition: all 0.3s;
                                 ">
                                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                                    <div style="
                                        width: 40px;
                                        height: 40px;
                                        background: ${theme.color};
                                        border-radius: 50%;
                                        border: 2px solid ${theme.color}80;
                                    "></div>
                                    <div>
                                        <div style="color: ${theme.color}; font-weight: 600; font-size: 1.1rem;">${theme.name}</div>
                                        <div style="color: #8f9779; font-size: 0.8rem; margin-top: 3px;">${theme.desc}</div>
                                    </div>
                                </div>
                                ${USER_SETTINGS.theme === theme.id ? 
                                    `<div style="text-align: center; margin-top: 10px;">
                                        <span style="color: ${theme.color}; font-size: 0.8rem;">
                                            <i class="fas fa-check-circle"></i> ВЫБРАНА
                                        </span>
                                    </div>` : ''
                                }
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ -->
                <div>
                    <h5 style="color: #8cb43c; margin-bottom: 15px; font-size: 1rem;">
                        <i class="fas fa-sliders-h"></i> ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ
                    </h5>
                    
                    <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
                        <label class="form-checkbox">
                            <input type="checkbox" id="appearance-compact" ${USER_SETTINGS.compactView ? 'checked' : ''}>
                            <span>Компактный режим (меньше отступов)</span>
                        </label>
                        
                        <label class="form-checkbox">
                            <input type="checkbox" id="appearance-animations" ${USER_SETTINGS.animations !== false ? 'checked' : ''}>
                            <span>Анимации интерфейса</span>
                        </label>
                        
                        <label class="form-checkbox">
                            <input type="checkbox" id="appearance-shadows" ${USER_SETTINGS.shadows !== false ? 'checked' : ''}>
                            <span>Тени элементов</span>
                        </label>
                    </div>
                    
                    <!-- НАСТРОЙКА ШРИФТА -->
                    <div style="margin-bottom: 20px;">
                        <label class="form-label">РАЗМЕР ШРИФТА</label>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <span style="color: #8f9779; font-size: 0.85rem;">Мелкий</span>
                            <input type="range" id="font-size-slider" min="12" max="18" value="${USER_SETTINGS.fontSize || 14}" 
                                   style="flex: 1; height: 6px; background: #4a4a3a; border-radius: 3px; outline: none;">
                            <span style="color: #8f9779; font-size: 0.85rem;">Крупный</span>
                        </div>
                    </div>
                    
                    <!-- КНОПКА СОХРАНЕНИЯ -->
                    <div>
                        <button onclick="saveAppearanceSettings()" class="btn-primary" style="width: 100%; padding: 12px; border-color: #c0b070;">
                            <i class="fas fa-save"></i> ПРИМЕНИТЬ НАСТРОЙКИ ВНЕШНЕГО ВИДА
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- ПРЕВЬЮ ТЕМЫ -->
            <div class="zone-card" style="border-color: #8cb43c;">
                <div class="card-icon" style="color: #8cb43c;"><i class="fas fa-eye"></i></div>
                <h4 style="color: #8cb43c; margin-bottom: 20px;">ПРЕДПРОСМОТР</h4>
                
                <div id="theme-preview" style="
                    background: ${USER_SETTINGS.theme === 'default' ? 'linear-gradient(145deg, rgba(28, 26, 23, 0.9), rgba(20, 18, 15, 0.9))' : 
                                 USER_SETTINGS.theme === 'green' ? 'linear-gradient(145deg, rgba(20, 25, 15, 0.9), rgba(15, 20, 10, 0.9))' :
                                 USER_SETTINGS.theme === 'blue' ? 'linear-gradient(145deg, rgba(20, 20, 40, 0.9), rgba(15, 15, 35, 0.9))' :
                                 USER_SETTINGS.theme === 'red' ? 'linear-gradient(145deg, rgba(40, 20, 20, 0.9), rgba(35, 15, 15, 0.9))' :
                                 USER_SETTINGS.theme === 'matrix' ? 'linear-gradient(145deg, rgba(0, 20, 0, 0.9), rgba(0, 15, 0, 0.9))' :
                                 'linear-gradient(145deg, rgba(15, 15, 15, 0.9), rgba(10, 10, 10, 0.9))'};
                    border: 1px solid ${USER_SETTINGS.theme === 'default' ? '#4a4a3a' :
                                     USER_SETTINGS.theme === 'green' ? '#8cb43c' :
                                     USER_SETTINGS.theme === 'blue' ? '#5865F2' :
                                     USER_SETTINGS.theme === 'red' ? '#b43c3c' :
                                     USER_SETTINGS.theme === 'matrix' ? '#00ff41' : '#4a4a3a'};
                    border-radius: 8px;
                    padding: 20px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid ${USER_SETTINGS.theme === 'default' ? '#4a4a3a40' :
                                                                                           USER_SETTINGS.theme === 'green' ? '#8cb43c40' :
                                                                                           USER_SETTINGS.theme === 'blue' ? '#5865F240' :
                                                                                           USER_SETTINGS.theme === 'red' ? '#b43c3c40' :
                                                                                           USER_SETTINGS.theme === 'matrix' ? '#00ff4140' : '#4a4a3a40'};">
                        <div style="color: ${USER_SETTINGS.theme === 'default' ? '#c0b070' :
                                        USER_SETTINGS.theme === 'green' ? '#8cb43c' :
                                        USER_SETTINGS.theme === 'blue' ? '#5865F2' :
                                        USER_SETTINGS.theme === 'red' ? '#b43c3c' :
                                        USER_SETTINGS.theme === 'matrix' ? '#00ff41' : '#c0b070'}; font-weight: 600;">
                            ПРИМЕР ЭЛЕМЕНТА
                        </div>
                        <div style="color: #8f9779; font-size: 0.85rem;">
                            <i class="fas fa-check-circle"></i> Активно
                        </div>
                    </div>
                    
                    <div style="color: #8f9779; line-height: 1.5; margin-bottom: 20px;">
                        Это пример того, как будет выглядеть интерфейс с выбранной темой.
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button style="
                            background: ${USER_SETTINGS.theme === 'default' ? 'rgba(192, 176, 112, 0.1)' :
                                         USER_SETTINGS.theme === 'green' ? 'rgba(140, 180, 60, 0.1)' :
                                         USER_SETTINGS.theme === 'blue' ? 'rgba(88, 101, 242, 0.1)' :
                                         USER_SETTINGS.theme === 'red' ? 'rgba(180, 60, 60, 0.1)' :
                                         USER_SETTINGS.theme === 'matrix' ? 'rgba(0, 255, 65, 0.1)' : 'rgba(192, 176, 112, 0.1)'};
                            border: 1px solid ${USER_SETTINGS.theme === 'default' ? '#c0b070' :
                                             USER_SETTINGS.theme === 'green' ? '#8cb43c' :
                                             USER_SETTINGS.theme === 'blue' ? '#5865F2' :
                                             USER_SETTINGS.theme === 'red' ? '#b43c3c' :
                                             USER_SETTINGS.theme === 'matrix' ? '#00ff41' : '#c0b070'};
                            color: ${USER_SETTINGS.theme === 'default' ? '#c0b070' :
                                    USER_SETTINGS.theme === 'green' ? '#8cb43c' :
                                    USER_SETTINGS.theme === 'blue' ? '#5865F2' :
                                    USER_SETTINGS.theme === 'red' ? '#b43c3c' :
                                    USER_SETTINGS.theme === 'matrix' ? '#00ff41' : '#c0b070'};
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                        ">
                            КНОПКА
                        </button>
                        
                        <div style="
                            background: rgba(40, 42, 36, 0.5);
                            border: 1px solid #4a4a3a;
                            border-radius: 4px;
                            padding: 8px 12px;
                            color: #8f9779;
                            font-size: 0.9rem;
                            flex: 1;
                        ">
                            Поле ввода
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProfileNotificationsTab() {
    return `
        <div style="display: flex; flex-direction: column; gap: 25px; max-width: 800px; margin: 0 auto;">
            <!-- НАСТРОЙКИ УВЕДОМЛЕНИЙ -->
            <div class="zone-card" style="border-color: #8cb43c;">
                <div class="card-icon" style="color: #8cb43c;"><i class="fas fa-bell"></i></div>
                <h4 style="color: #8cb43c; margin-bottom: 20px;">НАСТРОЙКИ УВЕДОМЛЕНИЙ</h4>
                
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label class="form-label">ОБЩИЕ НАСТРОЙКИ</label>
                        <div style="display: flex; flex-direction: column; gap: 12px; padding: 15px; background: rgba(40, 42, 36, 0.5); border-radius: 6px;">
                            <label class="form-checkbox">
                                <input type="checkbox" id="notifications-enabled" ${USER_SETTINGS.notifications !== false ? 'checked' : ''}>
                                <span>Включить уведомления</span>
                            </label>
                            
                            <label class="form-checkbox">
                                <input type="checkbox" id="notifications-sound" ${USER_SETTINGS.soundNotifications !== false ? 'checked' : ''}>
                                <span>Звуковые уведомления</span>
                            </label>
                            
                            <label class="form-checkbox">
                                <input type="checkbox" id="notifications-desktop" ${USER_SETTINGS.desktopNotifications ? 'checked' : ''}>
                                <span>Desktop-уведомления</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- ТИПЫ УВЕДОМЛЕНИЙ -->
                    <div>
                        <label class="form-label">ТИПЫ УВЕДОМЛЕНИЙ</label>
                        <div style="display: flex; flex-direction: column; gap: 10px; padding: 20px; background: rgba(40, 42, 36, 0.5); border-radius: 6px;">
                            ${[
                                { id: 'notify-reports', label: 'Новые отчеты в системе', checked: true },
                                { id: 'notify-confirmations', label: 'Подтверждение ваших отчетов', checked: true },
                                { id: 'notify-system', label: 'Системные сообщения', checked: true },
                                { id: 'notify-updates', label: 'Обновления системы', checked: true },
                                { id: 'notify-security', label: 'События безопасности', checked: true }
                            ].map(notif => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(74, 74, 58, 0.3);">
                                    <span style="color: #8f9779; font-size: 0.9rem;">${notif.label}</span>
                                    <label class="switch">
                                        <input type="checkbox" id="${notif.id}" ${notif.checked ? 'checked' : ''}>
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- ЧАСТОТА УВЕДОМЛЕНИЙ -->
                    <div>
                        <label class="form-label">ЧАСТОТА УВЕДОМЛЕНИЙ</label>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            ${['Сразу', 'Каждые 30 мин', 'Каждый час', 'Только важные'].map((freq, i) => `
                                <label class="radio-option">
                                    <input type="radio" name="frequency" value="${i}" ${i === 0 ? 'checked' : ''}>
                                    <span>${freq}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- КНОПКА СОХРАНЕНИЯ -->
                    <div style="margin-top: 20px;">
                        <button onclick="saveNotificationSettings()" class="btn-primary" style="width: 100%; padding: 12px; border-color: #8cb43c;">
                            <i class="fas fa-save"></i> СОХРАНИТЬ НАСТРОЙКИ УВЕДОМЛЕНИЙ
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- ИСТОРИЯ УВЕДОМЛЕНИЙ -->
            <div class="zone-card" style="border-color: #c0b070;">
                <div class="card-icon" style="color: #c0b070;"><i class="fas fa-history"></i></div>
                <h4 style="color: #c0b070; margin-bottom: 20px;">ИСТОРИЯ УВЕДОМЛЕНИЙ</h4>
                
                <div id="notifications-history" class="scrollable-container" style="
                    max-height: 200px;
                    background: rgba(20, 18, 15, 0.5);
                    border-radius: 4px;
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                ">
                    <div style="text-align: center; padding: 20px; color: #6a6a5a;">
                        <i class="fas fa-bell-slash" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p>История уведомлений пуста</p>
                    </div>
                </div>
                
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button onclick="clearNotifications()" class="btn-secondary" style="flex: 1;">
                        <i class="fas fa-trash"></i> ОЧИСТИТЬ ИСТОРИЮ
                    </button>
                    <button onclick="testNotification()" class="btn-secondary" style="flex: 1;">
                        <i class="fas fa-bell"></i> ТЕСТ УВЕДОМЛЕНИЯ
                    </button>
                </div>
            </div>
        </div>
    `;
}

/* ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ПРОФИЛЕМ ===== */

// Модальное окно загрузки аватарки
function showAvatarUploadModal() {
    const modal = document.createElement('div');
    modal.id = 'avatar-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 8, 5, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        backdrop-filter: blur(10px);
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(145deg, rgba(28, 26, 23, 0.98), rgba(20, 18, 15, 0.98));
            border: 2px solid #c0b070;
            border-radius: 12px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="color: #c0b070; font-family: 'Orbitron', sans-serif; margin: 0;">
                    <i class="fas fa-user-circle"></i> ЗАГРУЗКА АВАТАРА
                </h3>
                <button onclick="document.getElementById('avatar-modal').remove()" style="
                    background: none;
                    border: none;
                    color: #8f9779;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 5px;
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="margin-bottom: 25px;">
                <label class="form-label">ВЫБЕРИТЕ ИЗОБРАЖЕНИЕ</label>
                <div style="
                    border: 2px dashed #4a4a3a;
                    border-radius: 8px;
                    padding: 40px 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-bottom: 20px;
                " id="avatar-dropzone">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: #4a4a3a; margin-bottom: 15px;"></i>
                    <div style="color: #8f9779; margin-bottom: 10px;">
                        <strong>Перетащите изображение сюда</strong>
                    </div>
                    <div style="color: #6a6a5a; font-size: 0.9rem;">
                        или нажмите для выбора файла
                    </div>
                </div>
                <input type="file" id="avatar-file-input" accept="image/*" style="display: none;">
            </div>
            
            <div style="margin-bottom: 25px;">
                <label class="form-label">ИЛИ ВВЕДИТЕ URL</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="avatar-url" class="form-input" placeholder="https://example.com/avatar.jpg" style="flex: 1;">
                    <button onclick="loadAvatarFromURL()" class="btn-secondary" style="min-width: 100px;">
                        Загрузить
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 30px; padding: 20px; background: rgba(40, 42, 36, 0.5); border-radius: 8px;">
                <div style="color: #8cb43c; font-weight: 500; margin-bottom: 10px;">
                    <i class="fas fa-info-circle"></i> ТРЕБОВАНИЯ
                </div>
                <ul style="color: #8f9779; font-size: 0.9rem; padding-left: 20px; margin: 0;">
                    <li>Форматы: JPG, PNG, GIF, WebP</li>
                    <li>Максимальный размер: 2 MB</li>
                    <li>Рекомендуемый размер: 256×256 пикселей</li>
                    <li>Изображение будет обрезано до квадрата</li>
                </ul>
            </div>
            
            <div style="display: flex; gap: 15px; justify-content: flex-end;">
                <button onclick="document.getElementById('avatar-modal').remove()" class="btn-secondary" style="padding: 12px 24px;">
                    ОТМЕНА
                </button>
                <button onclick="uploadAvatar()" class="btn-primary" style="padding: 12px 24px; border-color: #8cb43c;">
                    <i class="fas fa-upload"></i> ЗАГРУЗИТЬ
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обработчики для drag & drop
    const dropzone = document.getElementById('avatar-dropzone');
    const fileInput = document.getElementById('avatar-file-input');
    
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#8cb43c';
        dropzone.style.background = 'rgba(140, 180, 60, 0.05)';
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '#4a4a3a';
        dropzone.style.background = 'transparent';
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#4a4a3a';
        dropzone.style.background = 'transparent';
        
        if (e.dataTransfer.files.length > 0) {
            handleAvatarFile(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAvatarFile(e.target.files[0]);
        }
    });
}

function handleAvatarFile(file) {
    if (!file.type.startsWith('image/')) {
        showNotification('Выберите файл изображения', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showNotification('Файл слишком большой (макс. 2 MB)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('avatar-url').value = e.target.result;
        showNotification('Изображение загружено', 'success');
    };
    reader.readAsDataURL(file);
}

async function uploadAvatar() {
    const urlInput = document.getElementById('avatar-url');
    const avatarUrl = urlInput ? urlInput.value.trim() : '';
    
    if (!avatarUrl) {
        showNotification('Выберите изображение', 'error');
        return;
    }
    
    // Проверяем URL
    if (avatarUrl.startsWith('http')) {
        try {
            new URL(avatarUrl);
        } catch {
            showNotification('Некорректный URL', 'error');
            return;
        }
        
        // Проверяем, что это изображение
        if (!avatarUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
            showNotification('URL должен вести на изображение (JPG, PNG, GIF, WebP, SVG)', 'error');
            return;
        }
    }
    
    USER_SETTINGS.avatar = avatarUrl;
    saveUserSettings();
    
    // Обновляем все превью
    updateAllAvatarPreviews(avatarUrl);
    
    showNotification('Аватар обновлен', 'success');
    
    // Закрываем модальное окно
    const modal = document.getElementById('avatar-modal');
    if (modal) modal.remove();
}

function removeAvatar() {
    USER_SETTINGS.avatar = null;
    saveUserSettings();
    
    // Обновляем все превью
    const avatarPreviewLarge = document.getElementById('avatar-preview-large');
    const currentAvatar = document.getElementById('current-avatar');
    const sidebarAvatar = document.querySelector('.user-info-avatar');
    
    if (avatarPreviewLarge) {
        avatarPreviewLarge.innerHTML = `<i class="fas fa-user-shield"></i>`;
    }
    
    if (currentAvatar) {
        currentAvatar.innerHTML = `<i class="fas fa-user-shield"></i>`;
    }
    
    if (sidebarAvatar) {
        sidebarAvatar.innerHTML = `<i class="fas fa-user-circle"></i>`;
    }
    
    showNotification('Аватар удален', 'success');
}

function generateAvatar() {
    // Генерируем случайный цвет для аватара
    const colors = ['#c0b070', '#8cb43c', '#5865F2', '#b43c3c', '#8f9779', '#00ff41'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Берем первые две буквы имени
    const initials = CURRENT_USER.substring(0, 2).toUpperCase();
    
    // Создаем SVG аватар
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
            <rect width="256" height="256" fill="${color}" rx="128"/>
            <text x="128" y="140" 
                  font-family="Arial, sans-serif" 
                  font-size="80" 
                  font-weight="bold" 
                  text-anchor="middle" 
                  fill="#1e201c"
                  style="text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">
                ${initials}
            </text>
        </svg>
    `;
    
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    USER_SETTINGS.avatar = url;
    saveUserSettings();
    
    // Обновляем превью
    updateAllAvatarPreviews(url);
    
    showNotification('Сгенерирован новый аватар', 'success');
}

// Новая функция для обновления всех превью аватарок
// Новая улучшенная функция для обновления всех превью аватарок
function updateAllAvatarPreviews(avatarUrl) {
    // Обновляем большую превьюшку в шапке
    const avatarPreviewLarge = document.getElementById('avatar-preview-large');
    if (avatarPreviewLarge) {
        if (avatarUrl) {
            avatarPreviewLarge.innerHTML = `
                <img src="${avatarUrl}" 
                     alt="${CURRENT_USER}" 
                     style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                     onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"96\" height=\"96\" viewBox=\"0 0 96 96\"><rect width=\"96\" height=\"96\" fill=\"%231e201c\" rx=\"48\"/><text x=\"48\" y=\"52\" font-family=\"Arial\" font-size=\"32\" font-weight=\"bold\" text-anchor=\"middle\" fill=\"%23c0b070\">${CURRENT_USER.substring(0, 2).toUpperCase()}</text></svg>'">
            `;
        } else {
            avatarPreviewLarge.innerHTML = `<i class="fas fa-user-shield" style="font-size: 2.5rem; color: #c0b070;"></i>`;
        }
    }
    
    // Обновляем текущий аватар во вкладке
    const currentAvatar = document.getElementById('current-avatar');
    if (currentAvatar) {
        if (avatarUrl) {
            currentAvatar.innerHTML = `
                <img src="${avatarUrl}" 
                     alt="${CURRENT_USER}" 
                     style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                     onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"144\" height=\"144\" viewBox=\"0 0 144 144\"><rect width=\"144\" height=\"144\" fill=\"%231e201c\" rx=\"72\"/><text x=\"72\" y=\"78\" font-family=\"Arial\" font-size=\"48\" font-weight=\"bold\" text-anchor=\"middle\" fill=\"%238cb43c\">${CURRENT_USER.substring(0, 2).toUpperCase()}</text></svg>'">
            `;
        } else {
            currentAvatar.innerHTML = `<i class="fas fa-user-shield" style="font-size: 4rem; color: #8cb43c;"></i>`;
        }
    }
    
    // Обновляем сайдбар
    updateUserAvatarInSidebar(avatarUrl);
}

// Обновленная функция для сайдбара
function updateUserAvatarInSidebar(avatarUrl = null) {
    const urlToUse = avatarUrl || USER_SETTINGS.avatar;
    const sidebarUser = document.querySelector('.user-info-avatar');
    
    if (sidebarUser) {
        if (urlToUse) {
            sidebarUser.innerHTML = `
                <img src="${urlToUse}" 
                     alt="${CURRENT_USER}" 
                     style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid #4a4a3a;"
                     onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" fill=\"%231e201c\" rx=\"12\"/><text x=\"12\" y=\"13\" font-family=\"Arial\" font-size=\"8\" font-weight=\"bold\" text-anchor=\"middle\" fill=\"%23c0b070\">${CURRENT_USER.substring(0, 1).toUpperCase()}</text></svg>'">
            `;
        } else {
            sidebarUser.innerHTML = `<i class="fas fa-user-circle" style="font-size: 1rem; color: #8f9779;"></i>`;
        }
    }
}

function setAvatarIcon(iconClass) {
    // Цвет для иконки
    const color = '#c0b070';
    const bgColor = '#1e201c';
    
    // Создаем SVG с иконкой (упрощенная версия)
    const iconText = getIconCharacter(iconClass);
    
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
            <defs>
                <style>
                    @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
                </style>
            </defs>
            <rect width="256" height="256" fill="${bgColor}" rx="128"/>
            <text x="128" y="140" 
                  font-family="Arial, sans-serif" 
                  font-size="100" 
                  font-weight="bold" 
                  text-anchor="middle" 
                  fill="${color}"
                  style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
                ${iconText}
            </text>
        </svg>
    `;
    
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    USER_SETTINGS.avatar = url;
    saveUserSettings();
    
    // Обновляем все превью
    updateAllAvatarPreviews(url);
    
    // Подсвечиваем выбранную иконку
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('active');
        option.style.borderColor = '#4a4a3a';
        option.style.background = 'rgba(60, 62, 56, 0.8)';
    });
    
    // Находим и подсвечиваем текущую иконку
    const iconElement = event?.currentTarget || document.querySelector(`[onclick*="${iconClass}"]`);
    if (iconElement) {
        iconElement.classList.add('active');
        iconElement.style.borderColor = '#c0b070';
        iconElement.style.background = 'rgba(192, 176, 112, 0.2)';
    }
    
    showNotification('Аватар установлен', 'success');
}

// Функция для получения символа иконки
function getIconCharacter(iconClass) {
    const iconMap = {
        'fa-user-secret': '🕵️',
        'fa-robot': '🤖',
        'fa-user-ninja': '🥷',
        'fa-user-astronaut': '👨‍🚀',
        'fa-user-tie': '👔',
        'fa-user-md': '👨‍⚕️'
    };
    return iconMap[iconClass] || '👤';
}

function getUnicodeForIcon(iconClass) {
    const iconMap = {
        'fa-user-secret': '\\f21b',
        'fa-robot': '\\f544',
        'fa-user-ninja': '\\f504',
        'fa-user-astronaut': '\\f4fb',
        'fa-user-tie': '\\f508',
        'fa-user-md': '\\f0f0'
    };
    return iconMap[iconClass] || '\\f007';
}

// Функции для настроек
function selectTheme(themeId) {
    USER_SETTINGS.theme = themeId;
    
    // Обновляем активную тему в интерфейсе
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
    });
    
    event.currentTarget.classList.add('active');
    
    // Обновляем превью темы
    updateThemePreview();
    
    // Автоматически сохраняем
    saveUserSettings();
}

function updateThemePreview() {
    const preview = document.getElementById('theme-preview');
    if (!preview) return;
    
    const theme = USER_SETTINGS.theme;
    
    let bgColor, borderColor, textColor;
    
    switch(theme) {
        case 'dark':
            bgColor = 'linear-gradient(145deg, rgba(15, 15, 15, 0.9), rgba(10, 10, 10, 0.9))';
            borderColor = '#2a2520';
            textColor = '#c0b070';
            break;
        case 'green':
            bgColor = 'linear-gradient(145deg, rgba(20, 25, 15, 0.9), rgba(15, 20, 10, 0.9))';
            borderColor = '#8cb43c';
            textColor = '#8cb43c';
            break;
        case 'blue':
            bgColor = 'linear-gradient(145deg, rgba(20, 20, 40, 0.9), rgba(15, 15, 35, 0.9))';
            borderColor = '#5865F2';
            textColor = '#5865F2';
            break;
        case 'red':
            bgColor = 'linear-gradient(145deg, rgba(40, 20, 20, 0.9), rgba(35, 15, 15, 0.9))';
            borderColor = '#b43c3c';
            textColor = '#b43c3c';
            break;
        case 'matrix':
            bgColor = 'linear-gradient(145deg, rgba(0, 20, 0, 0.9), rgba(0, 15, 0, 0.9))';
            borderColor = '#00ff41';
            textColor = '#00ff41';
            break;
        default: // default
            bgColor = 'linear-gradient(145deg, rgba(28, 26, 23, 0.9), rgba(20, 18, 15, 0.9))';
            borderColor = '#4a4a3a';
            textColor = '#c0b070';
    }
    
    preview.style.background = bgColor;
    preview.style.borderColor = borderColor;
    
    // Обновляем цвета внутри превью
    const header = preview.querySelector('div:first-child > div:first-child');
    if (header) header.style.color = textColor;
    
    const button = preview.querySelector('button');
    if (button) {
        button.style.background = textColor + '10';
        button.style.borderColor = textColor;
        button.style.color = textColor;
    }
}

function saveAppearanceSettings() {
    USER_SETTINGS.compactView = document.getElementById('appearance-compact').checked;
    USER_SETTINGS.animations = document.getElementById('appearance-animations').checked;
    USER_SETTINGS.shadows = document.getElementById('appearance-shadows').checked;
    USER_SETTINGS.fontSize = document.getElementById('font-size-slider').value;
    
    saveUserSettings();
    showNotification('Настройки внешнего вида сохранены', 'success');
    
    // Применяем настройки шрифта
    document.body.style.fontSize = USER_SETTINGS.fontSize + 'px';
}

function saveSecuritySettings() {
    USER_SETTINGS.twoFactor = document.getElementById('security-2fa').checked;
    USER_SETTINGS.emailNotifications = document.getElementById('security-email-notifications').checked;
    
    saveUserSettings();
    showNotification('Настройки безопасности сохранены', 'success');
}

function saveNotificationSettings() {
    USER_SETTINGS.notifications = document.getElementById('notifications-enabled').checked;
    USER_SETTINGS.soundNotifications = document.getElementById('notifications-sound').checked;
    USER_SETTINGS.desktopNotifications = document.getElementById('notifications-desktop').checked;
    
    saveUserSettings();
    showNotification('Настройки уведомлений сохранены', 'success');
}

async function updateUsername() {
    const newUsername = document.getElementById('profile-username').value.trim();
    
    if (!newUsername) {
        showNotification('Введите имя пользователя', 'error');
        return;
    }
    
    if (newUsername === CURRENT_USER) {
        showNotification('Имя пользователя не изменилось', 'info');
        return;
    }
    
    // Проверяем валидацию
    const validation = validateUsername(newUsername);
    if (!validation.valid) {
        showNotification(validation.message, 'error');
        return;
    }
    
    // Проверяем, занято ли имя
    const usernameExists = users.some(u => u.username.toLowerCase() === newUsername.toLowerCase());
    if (usernameExists) {
        showNotification('Это имя пользователя уже занято', 'error');
        return;
    }
    
    if (!confirm(`Изменить имя пользователя с "${CURRENT_USER}" на "${newUsername}"?`)) {
        return;
    }
    
    try {
        // Находим пользователя в базе
        const currentUser = users.find(u => u.username === CURRENT_USER);
        if (!currentUser) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        // Обновляем в базе
        await db.ref('mlk_users/' + currentUser.id).update({
            username: newUsername,
            usernameChangedAt: new Date().toLocaleString()
        });
        
        // Обновляем текущую сессию
        CURRENT_USER = newUsername;
        localStorage.setItem('mlk_session', JSON.stringify({
            user: CURRENT_USER,
            role: CURRENT_ROLE,
            rank: CURRENT_RANK.level,
            staticId: CURRENT_STATIC_ID,
            timestamp: new Date().getTime()
        }));
        
        // Обновляем сайдбар
        const usernameElement = document.getElementById('current-username');
        if (usernameElement) {
            usernameElement.textContent = CURRENT_USER.toUpperCase();
        }
        
        // Перезагружаем данные
        await new Promise(resolve => loadData(resolve));
        
        showNotification(`Имя пользователя изменено на "${newUsername}"`, 'success');
        
        // Обновляем интерфейс профиля
        renderProfile();
        
    } catch (error) {
        showNotification('Ошибка при изменении имени: ' + error.message, 'error');
    }
}

async function updatePassword() {
    const currentPassword = document.getElementById('security-current-password').value.trim();
    const newPassword = document.getElementById('security-new-password').value.trim();
    const confirmPassword = document.getElementById('security-confirm-password').value.trim();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Новые пароли не совпадают', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Пароль должен содержать минимум 6 символов', 'error');
        return;
    }
    
    if (newPassword === currentPassword) {
        showNotification('Новый пароль должен отличаться от старого', 'error');
        return;
    }
    
    try {
        // Находим текущего пользователя
        const currentUser = users.find(u => u.username === CURRENT_USER);
        if (!currentUser) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        // Проверяем текущий пароль
        const validCurrentPassword = await verifyPassword(currentPassword, {
            hash: currentUser.passwordHash,
            salt: currentUser.passwordSalt
        });
        
        if (!validCurrentPassword) {
            showNotification('Неверный текущий пароль', 'error');
            return;
        }
        
        // Генерируем новый хеш пароля
        const newSalt = generateSalt();
        const newHash = await hashPassword(newPassword, newSalt);
        
        // Обновляем пароль в базе данных
        await db.ref('mlk_users/' + currentUser.id).update({
            passwordHash: newHash,
            passwordSalt: newSalt,
            passwordChangedAt: new Date().toLocaleString()
        });
        
        // Очищаем поля
        document.getElementById('security-current-password').value = '';
        document.getElementById('security-new-password').value = '';
        document.getElementById('security-confirm-password').value = '';
        
        showNotification('✅ Пароль успешно изменен', 'success');
        
    } catch (error) {
        console.error('Password change error:', error);
        showNotification('Ошибка при смене пароля', 'error');
    }
}

/* ===== СИСТЕМА МЕМОВ ===== */
const MEMES = [
    { text: 'ЕБАРЬ КЛУБНИЧКИ? ЗНАЕМ КТО.', icon: 'fa-grin-wink' },
    { text: 'EOD', icon: 'fa-crown' },
    { text: 'ЛАВР ПАПА', icon: 'fa-user-shield' },
    { text: 'ТИХОГО НА СТК', icon: 'fa-user-secret' },
    { text: 'БЕСКОНЕЧНЫЙ ОТПУСК', icon: 'fa-umbrella-beach' },
    { text: 'ИНСПЕКТОР ЧМО', icon: 'fa-face-grin-squint-tears' }
];

function initMemeZone() {
    const memeContainer = document.querySelector('.meme-container');
    if (!memeContainer) return;
    
    function showRandomMeme() {
        const randomMeme = MEMES[Math.floor(Math.random() * MEMES.length)];
        const memeContent = document.getElementById('meme-content');
        const memeIcon = document.querySelector('.meme-icon i');
        
        if (memeContent && memeIcon) {
            memeContent.textContent = randomMeme.text;
            memeIcon.className = `fas ${randomMeme.icon}`;
            memeContainer.style.animation = 'none';
            setTimeout(() => {
                memeContainer.style.animation = 'memePulse 3s ease-in-out infinite';
            }, 10);
        }
    }
    
    memeContainer.addEventListener('click', showRandomMeme);
    showRandomMeme(); // Показываем первый мем при загрузке
}

// Инициализируем мем при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initMemeZone();
    initAccountTabs();
});

/* ===== СИСТЕМА ТАБОВ АККАУНТОВ ===== */
let accountTabs = [];
let activeAccountTab = 0;

function initAccountTabs() {
    const addAccountBtn = document.getElementById('add-account-btn');
    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', showCreateAccountModal);
    }
    const manageBtn = document.getElementById('manage-accounts-btn');
    if (manageBtn) manageBtn.addEventListener('click', toggleAccountsManager);
    const accountsBackBtn = document.getElementById('accounts-back-btn');
    if (accountsBackBtn) accountsBackBtn.addEventListener('click', returnToMainAccount);
    
    // НЕ загружаем старые табы - они создаются при входе
    // accountTabs начинаются пустыми
}

function loadAccountTabsFromStorage() {
    const savedTabs = localStorage.getItem('accountTabs');
    if (savedTabs) {
        accountTabs = JSON.parse(savedTabs);
        // Restore active tab
        if (activeAccountTab >= accountTabs.length) {
            activeAccountTab = accountTabs.length - 1;
        }
    }
}
function toggleAccountsManager() {
    const tabsBar = document.getElementById('account-tabs-bar');
    if (!tabsBar) return;
    if (tabsBar.style.display === 'none' || tabsBar.style.display === '') {
        tabsBar.style.display = 'flex';
        // If no tabs exist yet, show create modal to encourage creating one
        if (accountTabs.length === 0) showCreateAccountModal();
    } else {
        tabsBar.style.display = 'none';
    }
}

function returnToMainAccount() {
    accountTabs = [];
    activeAccountTab = 0;
    renderAccountTabs();
    const usernameEl = document.getElementById('current-username');
    if (usernameEl && CURRENT_USER) usernameEl.textContent = CURRENT_USER;
    const rankEl = document.getElementById('current-rank');
    if (rankEl && CURRENT_RANK) rankEl.textContent = CURRENT_RANK.name || '';
    showNotification('Возвращено к основному аккаунту', 'info');
}

window.showCreateAccountModal = function() {
    let modal = document.getElementById("create-account-modal");
    
    // Если модальное окно не существует, создаем его
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "create-account-modal";
        modal.className = "create-account-modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">Создать новый аккаунт</div>
                <div class="modal-form">
                    <input type="text" id="new-account-login" class="modal-input" placeholder="Логин (ник)" maxlength="30">
                    <input type="password" id="new-account-password" class="modal-input" placeholder="Пароль" maxlength="100">
                    <select id="new-account-rank" class="modal-input">
                        <option value="1">МЛАДШИЙ КУРАТОР</option>
                        <option value="2">КУРАТОР</option>
                        <option value="3">СТАРШИЙ КУРАТОР</option>
                        <option value="4">АДМИНИСТРАТОР</option>
                        <option value="999">СОЗДАТЕЛЬ</option>
                    </select>
                </div>
                <div class="modal-buttons">
                    <button class="modal-btn confirm" onclick="confirmCreateAccount()">Создать</button>
                    <button class="modal-btn cancel" onclick="closeCreateAccountModal()">Отмена</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Всегда сбрасываем поля формы при открытии
    const passwordInput = document.getElementById("new-account-password");
    const rankSelect = document.getElementById("new-account-rank");
    
    if (passwordInput) passwordInput.value = "";
    if (rankSelect) rankSelect.value = "1";
    
    // Показываем модальное окно
    modal.classList.add("show");
    modal.style.display = "flex";
    
    // Фокусируемся на поле ввода логина
    if (loginInput) {
        setTimeout(() => loginInput.focus(), 100);
    }
};

// Добавьте это в ваш существующий код где-нибудь после определения других функций
window.closeCreateAccountModal = function() {
    const modal = document.getElementById('create-account-modal');
    if (modal) {
        modal.classList.remove('show');
        
        // Используем setTimeout чтобы анимация успела отработать
        setTimeout(() => {
            modal.style.display = 'none';
            
            // Очищаем поля формы
            const loginInput = document.getElementById('new-account-login');
            const passwordInput = document.getElementById('new-account-password');
            const rankSelect = document.getElementById('new-account-rank');
            
            if (loginInput) loginInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (rankSelect) rankSelect.value = '1';
        }, 300); // Время должно соответствовать CSS transition
    }
};

// Также добавьте функцию для закрытия модального окна по нажатию на фон
document.addEventListener('click', function(e) {
    const modal = document.getElementById('create-account-modal');
    if (modal && modal.classList.contains('show')) {
        if (e.target === modal) {
            closeCreateAccountModal();
        }
    }
});

// Закрытие по Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('create-account-modal');
        if (modal && modal.classList.contains('show')) {
            closeCreateAccountModal();
        }
    }
});

window.confirmCreateAccount = async function() {
    const loginEl = document.getElementById('new-account-login');
    const passEl = document.getElementById('new-account-password');
    const rankEl = document.getElementById('new-account-rank');
    
    if (!loginEl || !passEl || !rankEl) { 
        showNotification('Ошибка формы', 'error'); 
        return; 
    }

    const login = loginEl.value.trim();
    const password = passEl.value;
    const rankLevel = parseInt(rankEl.value, 10) || RANKS.JUNIOR_CURATOR.level;

    if (!login || !password) { 
        showNotification('Заполните все поля', 'warning'); 
        return; 
    }

    const valid = validateUsername(login);
    if (!valid.valid) { 
        showNotification(valid.message, 'warning'); 
        return; 
    }

    // Проверяем, существует ли уже такой пользователь
    const existingUser = users.find(u => u.username.toLowerCase() === login.toLowerCase());
    if (existingUser) {
        showNotification('Пользователь с таким именем уже существует', 'error');
        return;
    }

    try {
        const salt = generateSalt();
        const hash = await hashPassword(password, salt);
        const staticId = generateStaticId(login);
        
        // Определяем роль на основе ранга
        let role = RANKS.JUNIOR_CURATOR.name;
        let rankObj = RANKS.JUNIOR_CURATOR;
        
        if (rankLevel === CREATOR_RANK.level) {
            role = CREATOR_RANK.name;
            rankObj = CREATOR_RANK;
        } else if (rankLevel === RANKS.ADMIN.level) {
            role = RANKS.ADMIN.name;
            rankObj = RANKS.ADMIN;
        } else if (rankLevel === RANKS.SENIOR_CURATOR.level) {
            role = RANKS.SENIOR_CURATOR.name;
            rankObj = RANKS.SENIOR_CURATOR;
        } else if (rankLevel === RANKS.CURATOR.level) {
            role = RANKS.CURATOR.name;
            rankObj = RANKS.CURATOR;
        }
        
        const userData = {
            username: login,
            passwordHash: hash,
            passwordSalt: salt,
            staticId: staticId,
            role: role,
            rank: rankLevel,
            registrationDate: new Date().toLocaleString(),
            lastLogin: new Date().toLocaleString(),
            createdBy: CURRENT_USER || 'system'
        };

        await db.ref('mlk_users').push(userData);
        
        // Обновляем локальные данные
        await new Promise(resolve => loadData(resolve));
        
        // Создаем вкладку с ПРАВИЛЬНЫМИ правами доступа
        createAccountTab(login, login, rankLevel, rankObj.access);
        
        closeCreateAccountModal();
        loginEl.value = ''; 
        passEl.value = '';
        
        showNotification(`Аккаунт "${login}" создан как ${role}`, 'success');
        
    } catch (err) { 
        showNotification('Ошибка создания аккаунта: ' + (err && err.message ? err.message : err), 'error'); 
    }
}

function createAccountTab(accountName, accountLogin, rankLevel) {
    const tabObj = {
        id: 'tab-' + Date.now(),
        name: accountName,
        login: accountLogin,
        rankLevel: rankLevel || null,
        rankName: rankLevel ? getRankName(rankLevel) : null,
        createdAt: new Date().toLocaleString(),
        isMinimized: false,
        data: {}
    };
    
    // Получаем доступ на основе ранга
    const rankObj = getAccessByRank(rankLevel);
    tabObj.access = rankObj.access || []; // получаем массив access
    
    // Для младших кураторов добавляем доступ к отчетам
    if (rankLevel === RANKS.JUNIOR_CURATOR.level) {
        if (!tabObj.access.includes("mlk_reports")) {
            tabObj.access.push("mlk_reports");
        }
    }
    
    accountTabs.push(tabObj);
    activeAccountTab = accountTabs.length - 1;
    renderAccountTabs();
    switchAccount(activeAccountTab);
    showNotification(`Аккаунт "${accountName}" создан!`, "success");
}

window.openUserInNewTab = function(username, role, staticId, rankLevel) {
    // Проверяем, не пытаемся ли открыть себя
    if (username === CURRENT_USER) {
        showNotification("Это ваш текущий аккаунт", "info");
        return;
    }
    
    // Проверяем, есть ли уже такая вкладка
    const existingTabIndex = accountTabs.findIndex(tab => 
        tab.login && tab.login.toLowerCase() === username.toLowerCase()
    );
    
    if (existingTabIndex !== -1) {
        // Сначала синхронизируем права вкладки с актуальными данными пользователя
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (user && user.rank !== accountTabs[existingTabIndex].rankLevel) {
            let access = [];
            if (user.rank === CREATOR_RANK.level) access = CREATOR_RANK.access;
            else if (user.rank === RANKS.ADMIN.level) access = RANKS.ADMIN.access;
            else if (user.rank === RANKS.SENIOR_CURATOR.level) access = RANKS.SENIOR_CURATOR.access;
            else if (user.rank === RANKS.CURATOR.level) access = RANKS.CURATOR.access;
            else access = RANKS.JUNIOR_CURATOR.access;
            
            updateTabAccessForUser(username, user.rank, access);
        }
        
        // Переключаемся на существующую вкладку
        switchAccount(existingTabIndex);
        showNotification(`Переключено на вкладку ${username}`, "info");
        return;
    }
    
    // Определяем доступы на основе ранга
    let access = [];
    if (rankLevel === CREATOR_RANK.level) {
        access = CREATOR_RANK.access;
    } else if (rankLevel === RANKS.ADMIN.level) {
        access = RANKS.ADMIN.access;
    } else if (rankLevel === RANKS.SENIOR_CURATOR.level) {
        access = RANKS.SENIOR_CURATOR.access;
    } else if (rankLevel === RANKS.CURATOR.level) {
        access = RANKS.CURATOR.access;
    } else {
        access = RANKS.JUNIOR_CURATOR.access;
    }
    
    // Создаем новую вкладку
    createAccountTab(username, username, rankLevel, access);
    
    // Загружаем данные пользователя в сохраненные данные вкладки
    const currentTab = accountTabs[accountTabs.length - 1];
    if (currentTab) {
        currentTab.savedUserData = {
            username: username,
            role: role,
            rankName: getRankDisplayName(rankLevel),
            rankLevel: rankLevel,
            staticId: staticId
        };
        
        // Сохраняем вкладки
        saveAccountTabsToStorage();
        
        showNotification(`✅ Аккаунт "${username}" открыт в новой вкладке`, "success");
    }
};

function getAccessByRank(rankLevel) {
    const rankKey = getRankName(rankLevel);
    if (!rankKey) return { access: [] };
    
    if (rankKey === "CREATOR") {
        return CREATOR_RANK; // возвращаем объект с доступом
    }
    
    return RANKS[rankKey] || { access: [] }; // возвращаем объект ранга
}

function getRankName(level) {
    if (!level) return null;
    if (CREATOR_RANK && CREATOR_RANK.level === level) return "CREATOR"; // возвращаем ключ на английском
    for (const key in RANKS) {
        if (RANKS[key].level === level) return key; // возвращаем ключ (на английском)
    }
    return null;
}

function minimizeAccountTab(tabId) {
    const tab = accountTabs.find(t => t.id === tabId);
    if (tab) {
        tab.isMinimized = !tab.isMinimized;
        renderAccountTabs();
    }
}