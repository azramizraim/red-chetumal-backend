import express from 'express';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get list of conversations for user
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      `SELECT c.*, 
              p.username as other_user, p.avatar_url as other_avatar,
              m.content as last_message, m.created_at as last_message_date,
              cp.unread_count
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       LEFT JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != $1
       LEFT JOIN users p ON cp2.user_id = p.id
       LEFT JOIN LATERAL (
         SELECT content, created_at 
         FROM messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at DESC LIMIT 1
       ) m ON true
       WHERE cp.user_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get messages for a conversation
router.get('/conversation/:id', authenticate, async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.userId;

    // Verify user is participant
    const participant = await query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (participant.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized to access this conversation' },
      });
    }

    const messages = await query(
      `SELECT m.*, u.username, u.full_name, u.avatar_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    // Mark messages as read
    await query(
      `UPDATE conversation_participants 
       SET unread_count = 0, last_read_at = CURRENT_TIMESTAMP
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    res.json({
      success: true,
      data: messages.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Start new conversation
router.post('/start', authenticate, async (req, res, next) => {
  try {
    const { recipientId, businessId } = req.body;
    const userId = req.user.userId;

    if (!recipientId && !businessId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Recipient or business is required' },
      });
    }

    // Check for existing direct conversation
    if (recipientId) {
      const existing = await query(
        `SELECT c.id FROM conversations c
         JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
         JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
         WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.type = 'direct'`,
        [userId, recipientId]
      );

      if (existing.rows.length > 0) {
        return res.json({ success: true, data: { conversationId: existing.rows[0].id } });
      }
    }

    // Create conversation
    const convResult = await query(
      `INSERT INTO conversations (created_by, type, business_id)
       VALUES ($1, 'direct', $2)
       RETURNING id`,
      [userId, businessId || null]
    );

    const conversationId = convResult.rows[0].id;

    // Add participants
    const participants = [userId];
    if (recipientId) participants.push(recipientId);

    for (const pId of participants) {
      await query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
        [conversationId, pId]
      );
    }

    res.status(201).json({
      success: true,
      data: { conversationId },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
