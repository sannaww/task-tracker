const express = require('express');
const cors = require('cors');
const db = require('./database');
const { generateToken, verifyToken, hashPassword, comparePassword } = require('./auth');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Middleware для проверки аутентификации
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader;

    if (!token) {
        return res.status(401).json({ error: 'Токен доступа не предоставлен' });
    }

    const user = verifyToken(token);
    if (!user) {
        return res.status(403).json({ error: 'Неверный токен' });
    }

    req.user = user;
    next();
}

// Регистрация
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Проверка существующего пользователя
        const existingUser = await db.getAsync(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
        }

        // Хеширование пароля
        const hashedPassword = await hashPassword(password);

        // Создание пользователя
        const result = await db.runAsync(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        const user = {
            id: result.id,
            username,
            email
        };

        const token = generateToken(user);

        res.json({
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Вход
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Поиск пользователя
        const user = await db.getAsync(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (!user) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        // Проверка пароля
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        const token = generateToken(user);

        res.json({
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение задач
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { sort = 'created' } = req.query;
        const userId = req.user.userId;

        let orderBy = 'created_at DESC';
        if (sort === 'due') {
            orderBy = 'due_date ASC';
        }

        const tasks = await db.allAsync(`
            SELECT t.*, u.username as author_username 
            FROM tasks t 
            LEFT JOIN users u ON t.user_id = u.id 
            WHERE t.user_id = ? OR t.shared_with LIKE ? 
            ORDER BY ${orderBy}
        `, [userId, `%${userId}%`]);

        res.json(tasks.map(task => ({
            ...task,
            completed: Boolean(task.completed)
        })));
    } catch (error) {
        console.error('Ошибка получения задач:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Создание задачи
app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { title, description, due_date, shared_with = '' } = req.body;
        const userId = req.user.userId;

        if (!title || !due_date) {
            return res.status(400).json({ error: 'Название и срок выполнения обязательны' });
        }

        const result = await db.runAsync(
            'INSERT INTO tasks (title, description, due_date, user_id, shared_with) VALUES (?, ?, ?, ?, ?)',
            [title, description, due_date, userId, shared_with]
        );

        res.json({ id: result.id, message: 'Задача создана' });
    } catch (error) {
        console.error('Ошибка создания задачи:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Обновление задачи
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.userId;
        const { title, description, due_date, completed, shared_with } = req.body;

        // Проверка прав доступа
        const task = await db.getAsync(
            'SELECT * FROM tasks WHERE id = ?',
            [taskId]
        );

        if (!task) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }

        if (task.user_id !== userId && !task.shared_with.includes(userId.toString())) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        // Обновление полей
        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (due_date !== undefined) {
            updates.push('due_date = ?');
            params.push(due_date);
        }
        if (completed !== undefined) {
            updates.push('completed = ?');
            params.push(completed ? 1 : 0);
        }
        if (shared_with !== undefined) {
            updates.push('shared_with = ?');
            params.push(shared_with);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Нет данных для обновления' });
        }

        params.push(taskId);

        await db.runAsync(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        res.json({ message: 'Задача обновлена' });
    } catch (error) {
        console.error('Ошибка обновления задачи:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Удаление задачи
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.userId;

        // Проверка прав доступа (только владелец может удалять)
        const task = await db.getAsync(
            'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
            [taskId, userId]
        );

        if (!task) {
            return res.status(404).json({ error: 'Задача не найдена или доступ запрещен' });
        }

        await db.runAsync('DELETE FROM tasks WHERE id = ?', [taskId]);

        res.json({ message: 'Задача удалена' });
    } catch (error) {
        console.error('Ошибка удаления задачи:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение списка пользователей
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const currentUserId = req.user.userId;

        const users = await db.allAsync(
            'SELECT id, username FROM users WHERE id != ?',
            [currentUserId]
        );

        res.json(users);
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Проверка приближающихся задач (для уведомлений)
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        const upcomingTasks = await db.allAsync(`
            SELECT title, due_date 
            FROM tasks 
            WHERE user_id = ? 
            AND completed = 0 
            AND due_date BETWEEN ? AND ?
        `, [userId, now.toISOString(), oneHourLater.toISOString()]);

        res.json(upcomingTasks);
    } catch (error) {
        console.error('Ошибка получения уведомлений:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});