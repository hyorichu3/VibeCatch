const express = require('express');
const { recommendVideos, addToHistory, getHistory, incrementHit, deleteHistory } = require('../controllers/musicController');

const router = express.Router();

router.post('/recommendations', recommendVideos);
router.post('/history', addToHistory);
router.get('/history', getHistory);
router.post('/history/:videoId/hit', incrementHit);
router.delete('/history/:videoId', deleteHistory);

module.exports = router;
