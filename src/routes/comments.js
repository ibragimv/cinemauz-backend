const express = require('express');
const router = express.Router();
const commentService = require('../services/commentService');

router.get('/:movieId', async (req, res) => {
    try {
        const comments = await commentService.getComments(req.params.movieId);
        res.json({ success: true, data: comments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { movieId, userId, userName, photoUrl, text, replyTo } = req.body;
        const comment = await commentService.addComment({ movieId, userId, userName, photoUrl, text, replyTo });
        res.json({ success: true, data: comment });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/:commentId', async (req, res) => {
    try {
        const success = await commentService.deleteComment(req.params.commentId, req.query.userId);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/:commentId/react', async (req, res) => {
    try {
        const { userId, type } = req.body;
        const result = await commentService.toggleReaction(req.params.commentId, userId, type);
        res.json({ success: !!result, data: result });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
