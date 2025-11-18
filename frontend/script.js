class TaskTracker {
    constructor() {
        this.API_BASE = 'http://localhost:5000/api';
        this.currentUser = null;
        this.authToken = null;
        this.init();
    }

    init() {
        this.checkAuthState();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Enter key for auth forms
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
    }

    checkAuthState() {
        const savedToken = localStorage.getItem('authToken');
        const savedUser = localStorage.getItem('currentUser');
        
        if (savedToken && savedUser) {
            this.authToken = savedToken;
            this.currentUser = JSON.parse(savedUser);
            this.showMainApp();
        } else {
            this.showAuth();
        }
    }

    // Аутентификация
    async register() {
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !email || !password) {
            this.showMessage('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.authToken = data.token;
                this.currentUser = data.user;
                this.saveAuthState();
                this.showMainApp();
                this.showMessage('Регистрация успешна!', 'success');
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка регистрации', 'error');
            console.error('Registration error:', error);
        }
    }

    async login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showMessage('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.authToken = data.token;
                this.currentUser = data.user;
                this.saveAuthState();
                this.showMainApp();
                this.showMessage('Вход выполнен!', 'success');
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка входа', 'error');
            console.error('Login error:', error);
        }
    }

    logout() {
        this.currentUser = null;
        this.authToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        this.showAuth();
        this.showMessage('Вы вышли из системы', 'info');
    }

    saveAuthState() {
        localStorage.setItem('authToken', this.authToken);
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }

    // Работа с задачами
    async createTask() {
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const dueDate = document.getElementById('task-due-date').value;
        const shareSelect = document.getElementById('share-users');
        
        const sharedUsers = Array.from(shareSelect.selectedOptions)
            .map(opt => opt.value)
            .join(',');

        if (!title || !dueDate) {
            this.showMessage('Заполните обязательные поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken
                },
                body: JSON.stringify({
                    title,
                    description,
                    due_date: dueDate,
                    shared_with: sharedUsers
                })
            });

            if (response.ok) {
                // Очистка формы
                document.getElementById('task-title').value = '';
                document.getElementById('task-description').value = '';
                document.getElementById('task-due-date').value = '';
                shareSelect.selectedIndex = -1;
                
                this.loadTasks();
                this.showMessage('Задача создана!', 'success');
            } else {
                const data = await response.json();
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка создания задачи', 'error');
            console.error('Create task error:', error);
        }
    }

    async loadTasks() {
        try {
            const sortBy = document.getElementById('sort-select').value;
            const response = await fetch(`${this.API_BASE}/tasks?sort=${sortBy}`, {
                headers: { 'Authorization': this.authToken }
            });

            if (response.ok) {
                const tasks = await response.json();
                this.displayTasks(tasks);
            } else {
                throw new Error('Failed to load tasks');
            }
        } catch (error) {
            this.showMessage('Ошибка загрузки задач', 'error');
            console.error('Load tasks error:', error);
        }
    }

    displayTasks(tasks) {
        const tasksList = document.getElementById('tasks-list');
        
        if (tasks.length === 0) {
            tasksList.innerHTML = '<div class="no-tasks">Задачи не найдены</div>';
            return;
        }

        tasksList.innerHTML = tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <div class="task-info">
                    <div class="task-title">
                        ${this.escapeHtml(task.title)}
                        ${task.user_id !== this.currentUser.id ? 
                            `<span class="shared-badge">от ${this.escapeHtml(task.author_username)}</span>` : ''}
                    </div>
                    ${task.description ? `
                        <div class="task-description">${this.escapeHtml(task.description)}</div>
                    ` : ''}
                    <div class="task-meta">
                        <span>Срок: ${new Date(task.due_date).toLocaleString()}</span>
                        <span>Создана: ${new Date(task.created_at).toLocaleString()}</span>
                        ${task.shared_with ? '<span>Общая</span>' : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-complete" onclick="app.toggleTask(${task.id}, ${!task.completed})">
                        ${task.completed ? 'Вернуть' : 'Выполнить'}
                    </button>
                    <button class="btn-edit" onclick="app.editTask(${task.id})">Изменить</button>
                    ${task.user_id === this.currentUser.id ? `
                        <button class="btn-delete" onclick="app.deleteTask(${task.id})">Удалить</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async toggleTask(taskId, completed) {
        try {
            const response = await fetch(`${this.API_BASE}/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken
                },
                body: JSON.stringify({ completed })
            });

            if (response.ok) {
                this.loadTasks();
                this.showMessage(`Задача ${completed ? 'выполнена' : 'возвращена'}`, 'success');
            } else {
                throw new Error('Failed to update task');
            }
        } catch (error) {
            this.showMessage('Ошибка обновления задачи', 'error');
            console.error('Toggle task error:', error);
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return;

        try {
            const response = await fetch(`${this.API_BASE}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': this.authToken }
            });

            if (response.ok) {
                this.loadTasks();
                this.showMessage('Задача удалена', 'success');
            } else {
                throw new Error('Failed to delete task');
            }
        } catch (error) {
            this.showMessage('Ошибка удаления задачи', 'error');
            console.error('Delete task error:', error);
        }
    }

    async editTask(taskId) {
        const newTitle = prompt('Введите новое название задачи:');
        if (newTitle && newTitle.trim()) {
            try {
                const response = await fetch(`${this.API_BASE}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': this.authToken
                    },
                    body: JSON.stringify({ title: newTitle.trim() })
                });

                if (response.ok) {
                    this.loadTasks();
                    this.showMessage('Задача обновлена', 'success');
                } else {
                    throw new Error('Failed to update task');
                }
            } catch (error) {
                this.showMessage('Ошибка изменения задачи', 'error');
                console.error('Edit task error:', error);
            }
        }
    }

    // Пользователи
    async loadUsers() {
        try {
            const response = await fetch(`${this.API_BASE}/users`, {
                headers: { 'Authorization': this.authToken }
            });

            if (response.ok) {
                const users = await response.json();
                this.displayUsers(users);
            }
        } catch (error) {
            console.error('Load users error:', error);
        }
    }

    displayUsers(users) {
        const shareSelect = document.getElementById('share-users');
        shareSelect.innerHTML = users.map(user => 
            `<option value="${user.id}">${this.escapeHtml(user.username)}</option>`
        ).join('');
    }

    // Уведомления
    async checkNotifications() {
        try {
            const response = await fetch(`${this.API_BASE}/notifications`, {
                headers: { 'Authorization': this.authToken }
            });

            if (response.ok) {
                const notifications = await response.json();
                this.showNotifications(notifications);
            }
        } catch (error) {
            console.error('Check notifications error:', error);
        }
    }

    showNotifications(notifications) {
        if (notifications.length > 0) {
            notifications.forEach(notification => {
                const dueTime = new Date(notification.due_date).toLocaleString();
                this.showMessage(
                    `Напоминание: "${notification.title}" - срок: ${dueTime}`,
                    'warning'
                );
            });
        }
    }

    // UI методы
    showAuth() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('main-section').classList.add('hidden');
        this.clearAuthForm();
    }

    showMainApp() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        document.getElementById('user-name').textContent = this.currentUser.username;
        this.loadTasks();
        this.loadUsers();
        this.checkNotifications();
    }

    clearAuthForm() {
        document.getElementById('username').value = '';
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
    }

    showMessage(message, type = 'info') {
        // Создаем временное уведомление
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        const backgroundColor = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        }[type];

        messageDiv.style.background = backgroundColor;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 4000);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Глобальные функции для HTML onclick
const app = new TaskTracker();

function register() { app.register(); }
function login() { app.login(); }
function logout() { app.logout(); }
function createTask() { app.createTask(); }

// Добавляем CSS для анимации сообщений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .no-tasks {
        text-align: center;
        padding: 40px;
        color: #666;
        font-style: italic;
    }
`;
document.head.appendChild(style);

// Периодическая проверка уведомлений
setInterval(() => app.checkNotifications(), 300000); // Каждые 5 минут