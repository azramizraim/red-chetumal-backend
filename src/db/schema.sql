-- Red Social Local Database Schema
-- PostgreSQL with PostGIS for geolocation

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    location GEOGRAPHY(POINT, 4326),
    neighborhood VARCHAR(100),
    city VARCHAR(100) DEFAULT 'Chetumal',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Business categories
CREATE TABLE IF NOT EXISTS business_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL
);

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES business_categories(id),
    address VARCHAR(255) NOT NULL,
    neighborhood VARCHAR(100),
    city VARCHAR(100) DEFAULT 'Chetumal',
    location GEOGRAPHY(POINT, 4326),
    phone VARCHAR(20),
    email VARCHAR(100),
    website VARCHAR(255),
    cover_image_url TEXT,
    logo_url TEXT,
    gallery_images TEXT[],
    opening_hours JSONB,
    is_verified BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_pulses INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    title VARCHAR(200),
    images TEXT[],
    post_type VARCHAR(20) DEFAULT 'general', -- general, recommendation, alert, event
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    neighborhood VARCHAR(100),
    total_pulses INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    is_sponsored BOOLEAN DEFAULT FALSE,
    sponsor_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pulses (likes/upvotes)
CREATE TABLE IF NOT EXISTS pulses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id),
    UNIQUE(user_id, business_id)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    total_pulses INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages/Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) DEFAULT 'direct', -- direct, group
    name VARCHAR(100),
    created_by INTEGER REFERENCES users(id),
    business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, business_card
    media_url TEXT,
    metadata JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Advertisements (for monetization)
CREATE TABLE IF NOT EXISTS advertisements (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,
    cta_text VARCHAR(50) DEFAULT 'Learn More',
    cta_url TEXT,
    ad_type VARCHAR(20) DEFAULT 'feed', -- feed, sidebar, banner
    target_neighborhoods TEXT[],
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    budget DECIMAL(10,2),
    spent DECIMAL(10,2) DEFAULT 0.00,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ad impressions tracking
CREATE TABLE IF NOT EXISTS ad_impressions (
    id SERIAL PRIMARY KEY,
    advertisement_id INTEGER REFERENCES advertisements(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    impression_type VARCHAR(20) DEFAULT 'view', -- view, click
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- pulse, comment, message, mention, business_update
    actor_id INTEGER REFERENCES users(id),
    post_id INTEGER REFERENCES posts(id),
    business_id INTEGER REFERENCES businesses(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_location ON users USING GIST (location);
CREATE INDEX idx_businesses_location ON businesses USING GIST (location);
CREATE INDEX idx_posts_location ON posts (latitude, longitude);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_business_id ON posts(business_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_pulses_user_id ON pulses(user_id);
CREATE INDEX idx_pulses_post_id ON pulses(post_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_advertisements_active ON advertisements(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Insert default business categories
INSERT INTO business_categories (name, icon, color) VALUES
    ('Restaurant', 'restaurant', '#FF6B6B'),
    ('Café', 'local_cafe', '#4ECDC4'),
    ('Shop', 'shopping_bag', '#45B7D1'),
    ('Services', 'home_repair_service', '#96CEB4'),
    ('Entertainment', 'theater_comedy', '#FFEAA7'),
    ('Health', 'local_hospital', '#DDA0DD'),
    ('Education', 'school', '#98D8C8'),
    ('Sports', 'fitness_center', '#F7DC6F'),
    ('Beauty', 'spa', '#F8B739'),
    ('Other', 'store', '#B39CD0')
ON CONFLICT (name) DO NOTHING;
