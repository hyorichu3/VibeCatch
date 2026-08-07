const pool = require('../db');

const getPosts = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT p.id, p.title, p.content, p.created_at, u.username AS author FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getPostById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT p.id, p.title, p.content, p.created_at, u.username AS author FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const createPost = async (req, res, next) => {
  const { title, content } = req.body;
  const userId = req.user.userId;

  if (!title || !content) {
    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO posts (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, title, content, created_at',
      [userId, title, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updatePost = async (req, res, next) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const userId = req.user.userId;

  if (!title || !content) {
    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  }

  try {
    const postResult = await pool.query('SELECT user_id FROM posts WHERE id = $1', [id]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    if (postResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    const result = await pool.query(
      'UPDATE posts SET title = $1, content = $2 WHERE id = $3 RETURNING id, title, content, created_at',
      [title, content, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deletePost = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const postResult = await pool.query('SELECT user_id FROM posts WHERE id = $1', [id]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    if (postResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.json({ message: '게시글이 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
};
