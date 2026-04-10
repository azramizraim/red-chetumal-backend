import express from 'express';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all businesses with filters
router.get('/', async (req, res, next) => {
  try {
    const { category, neighborhood, search, lat, lng, radius = 5 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND category_id = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (neighborhood) {
      whereClause += ` AND neighborhood = $${paramIndex}`;
      params.push(neighborhood);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (lat && lng) {
      whereClause += ` AND ST_DWithin(location, ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography, $${paramIndex + 2} * 1000)`;
      params.push(lng, lat, radius);
      paramIndex += 3;
    }

    const result = await query(
      `SELECT b.*, c.name as category_name, c.icon as category_icon,
              ST_Distance(location, ST_MakePoint(COALESCE($1, 0), COALESCE($2, 0))::geography) as distance
       FROM businesses b
       JOIN business_categories c ON b.category_id = c.id
       ${whereClause}
       ORDER BY 
         CASE WHEN b.is_featured THEN 1 ELSE 0 END DESC,
         distance ASC
       LIMIT 50`,
      [lng || 0, lat || 0, ...params]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get business by ID (Detailed profile)
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, c.name as category_name, c.icon as category_icon
       FROM businesses b
       JOIN business_categories c ON b.category_id = c.id
       WHERE b.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Business not found' },
      });
    }

    // Get recent recommendations for this business
    const posts = await query(
      `SELECT p.*, u.username, u.avatar_url
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.business_id = $1
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        business: result.rows[0],
        recommendations: posts.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create/Update business (for owners)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, description, category_id, address, neighborhood, latitude, longitude, phone, email, website } = req.body;
    const ownerId = req.user.userId;

    const result = await query(
      `INSERT INTO businesses (owner_id, name, description, category_id, address, neighborhood, 
       location, phone, email, website)
       VALUES ($1, $2, $3, $4, $5, $6, ST_MakePoint($7, $8), $9, $10, $11)
       RETURNING *`,
      [ownerId, name, description, category_id, address, neighborhood, longitude, latitude, phone, email, website]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
