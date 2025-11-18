const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = 'your-super-secret-key-here';

// Симуляция аутентификации
async function makeAuthRequest(userData) {
    // В реальном приложении здесь был бы запрос к базе данных
    return null;
}

// Генерация JWT токена
function generateToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// Проверка JWT токена
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Хеширование пароля
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

// Проверка пароля
async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

module.exports = {
    makeAuthRequest,
    generateToken,
    verifyToken,
    hashPassword,
    comparePassword,
    JWT_SECRET
};