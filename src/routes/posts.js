import express from 'express';
import { query } from '../db/index.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get feed posts
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { neighborhood, limit = 20, offset = 0 } = req.query;
    const userId = req.user?.userId;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (neighborhood) {
      whereClause += ` AND p.neighborhood = $${paramIndex}`;
      params.push(neighborhood);
      paramIndex++;
    }

    // Get posts with user data and pulse count
    const postsQuery = `
      SELECT p.*, 
             u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified as user_verified,
             b.id as business_id, b.name as business_name, b.logo_url,
              CASE WHEN $${paramIndex}::INT IS NOT NULL THEN 
                EXISTS(SELECT 1 FROM pulses WHERE user_id = $${paramIndex}::INT AND post_id = p.id)
              ELSE false END as has_pulsed
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN businesses b ON p.business_id = b.id
      ${whereClause}
      ORDER BY 
        CASE WHEN p.is_sponsored THEN 1 ELSE 0 END DESC,
        p.created_at DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    params.push(userId, parseInt(limit), parseInt(offset));

    const result = await query(postsQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create post
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { content, title, images, post_type, business_id, latitude, longitude, neighborhood } = req.body;
    const userId = req.user.userId;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: { message: 'Content is required' },
      });
    }

    const result = await query(
      `INSERT INTO posts (user_id, business_id, content, title, images, post_type, latitude, longitude, neighborhood)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, business_id || null, content, title || null, images || [], post_type || 'general', latitude, longitude, neighborhood]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Pulse (like) a post
router.post('/:id/pulse', authenticate, async (req, res, next) => {
  try {
    const postId = req.params.id;
    const userId = req.user.userId;

    // Toggle pulse
    const existing = await query('SELECT id FROM pulses WHERE user_id = $1 AND post_id = $2', [userId, postId]);

    if (existing.rows.length > 0) {
      // Remove pulse
      await query('DELETE FROM pulses WHERE user_id = $1 AND post_id = $2', [userId, postId]);
      await query('UPDATE posts SET total_pulses = total_pulses - 1 WHERE id = $1', [postId]);
    } else {
      // Add pulse
      await query('INSERT INTO pulses (user_id, post_id) VALUES ($1, $2)', [userId, postId]);
      await query('UPDATE posts SET total_pulses = total_pulses + 1 WHERE id = $1', [postId]);
    }

    const updated = await query('SELECT total_pulses FROM posts WHERE id = $1', [postId]);

    res.json({
      success: true,
      data: { pulsed: existing.rows.length === 0, totalPulses: updated.rows[0].total_pulses },
    });
  } catch (error) {
    next(error);
  }
});

// Get post by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.*, 
              u.username, u.full_name, u.avatar_url, u.is_verified as user_verified
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found' },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
