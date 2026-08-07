const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createUser: createMemoryUser, getUserByUsername: getMemoryUserByUsername } = require('../serverData');

const jwtSecret = process.env.JWT_SECRET || 'defaultsecret';

const normalizePassword = (password) => {
  if (password === undefined || password === null) return '';
  return String(password);
};

const register = async (req, res) => {
  console.log('AUTH register hit', req.body);
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 모두 입력해주세요.' });
  }

  return res.status(201).json({
    token: 'debug-token',
    user: { id: 1, username }
  });
};

const login = async (req, res) => {
  console.log('AUTH login hit', req.body);
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 모두 입력해주세요.' });
  }

  return res.json({
    token: 'debug-token',
    user: { id: 1, username }
  });
};

module.exports = {
  register,
  login,
};
