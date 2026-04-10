import express from 'express';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get nearby users
router.get('/nearby', authenticate, async (req, res, next) => {
  try {
    const { lat, lng, radius = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: { message: 'Latitude and longitude required' },
      });
    }

    const result = await query(
      `SELECT id, username, full_name, avatar_url, neighborhood, bio,
              ST_Distance(location, ST_MakePoint($2, $1)::geography) as distance
       FROM users
       WHERE location IS NOT NULL
         AND ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3 * 1000)
         AND id != $4
       ORDER BY distance
       LIMIT 20`,
      [lat, lng, radius, req.user.userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, username, full_name, avatar_url, bio, neighborhood, city, is_verified, created_at
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
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
