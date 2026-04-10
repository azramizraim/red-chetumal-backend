import { query } from '../db/index.js';

export const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('👤 New client connected:', socket.id);

    // Auth middleware for sockets
    socket.on('authenticate', async ({ token }) => {
      try {
        // we would verify JWT here
        // For MVP, we trust the token or use a simple auth check
        socket.emit('auth_success', { status: 'authenticated' });
      } catch (error) {
        socket.emit('auth_failure', { message: 'Invalid token' });
      }
    });

    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
      console.log(`Socket ${socket.id} joined room conv_${conversationId}`);
    });

    // Send message
    socket.on('send_message', async (data) => {
      const { conversationId, senderId, content, messageType = 'text' } = data;

      try {
        const result = await query(
          `INSERT INTO messages (conversation_id, sender_id, content, message_type)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [conversationId, senderId, content, messageType]
        );

        const message = result.rows[0];

        // Broadcast to room
        io.to(`conv_${conversationId}`).emit('new_message', message);

        // Update conversation updated_at
        await query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [conversationId]);
        
        // Update unread counts for other participants
        await query(
          `UPDATE conversation_participants 
           SET unread_count = unread_count + 1 
           WHERE conversation_id = $1 AND user_id != $2`,
          [conversationId, senderId]
        );

      } catch (error) {
        console.error('Socket message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('👤 Client disconnected:', socket.id);
    });
  });
};
