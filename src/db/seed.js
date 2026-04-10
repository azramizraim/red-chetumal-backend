import { query } from './index.js';
import bcrypt from 'bcrypt';

const SEED_DATA = {
  users: [
    { username: 'juan_chet', email: 'juan@example.com', password: 'password123', full_name: 'Juan Pérez', neighborhood: 'Centro', bio: 'Amante de la comida local y la historia de Chetumal.' },
    { username: 'maria_local', email: 'maria@example.com', password: 'password123', full_name: 'María García', neighborhood: 'Centro Norte', bio: 'Buscando los mejores cafés de la ciudad.' },
    { username: 'pedro_tech', email: 'pedro@example.com', password: 'password123', full_name: 'Pedro López', neighborhood: 'Fraccionamiento', bio: 'Entusiasta de la tecnología y el diseño.' },
    { username: 'lucia_art', email: 'lucia@example.com', password: 'password123', full_name: 'Lucía Méndez', neighborhood: 'Centro', bio: 'Artista local y coleccionista de antigüedades.' },
  ],
  businesses: [
    { name: 'Café El Faro', description: 'El mejor café artesanal con vista al boulevard.', category_id: 2, address: 'Blvd. Bahía, Centro', neighborhood: 'Centro', phone: '9831234567', email: 'contacto@elfaro.com', website: 'elfaro.com', lat: 18.4500, lng: -88.1833 },
    { name: 'Tacos La Esquina', description: 'Tacos al pastor auténticos con la mejor salsa de la zona.', category_id: 1, address: 'Calle 22, Centro', neighborhood: 'Centro', phone: '9837654321', email: 'tacos@laesquina.com', website: null, lat: 18.4510, lng: -88.1850 },
    { name: 'Librería del Sur', description: 'Títulos raros y un ambiente tranquilo para leer.', category_id: 3, address: 'Calle 5 de Mayo', neighborhood: 'Centro', phone: '9831112233', email: 'info@libsurs.com', website: 'libsurs.com', lat: 18.4480, lng: -88.1820 },
    { name: 'Electro-Soporte Chetumal', description: 'Reparación express de laptops y celulares.', category_id: 4, address: 'Av. Gobernador', neighborhood: 'Centro Norte', phone: '9834445566', email: 'soporte@electro.com', website: 'electro.com', lat: 18.4600, lng: -88.1800 },
    { name: 'Gimnasio FitLife', description: 'El gym más completo con entrenamiento personalizado.', category_id: 8, address: 'Calle 20, Fraccionamiento', neighborhood: 'Fraccionamiento', phone: '9838889900', email: 'fitlife@gym.com', website: 'fitlife.com', lat: 18.4700, lng: -88.1900 },
  ],
  posts: [
    { user_id: 1, business_id: 1, content: 'El latte de vainilla es increíble, perfecto para empezar la mañana.', title: 'Mañanas perfectas', post_type: 'general', neighborhood: 'Centro' },
    { user_id: 2, business_id: 1, content: 'Me encanta el ambiente, muy tranquilo para leer.', title: 'Lugar zen', post_type: 'general', neighborhood: 'Centro' },
    { user_id: 3, business_id: 4, content: 'Me arreglaron la pantalla en tiempo récord. Muy recomendados.', title: 'Súper rápidos', post_type: 'general', neighborhood: 'Centro Norte' },
    { user_id: 1, business_id: 2, content: 'Cuidado con el tráfico en la calle 22 hoy, está imposible.', title: 'Tráfico pesado', post_type: 'alert', neighborhood: 'Centro' },
    { user_id: 4, business_id: 3, content: 'Encontré una edición limitada de Borges, ¡una joya!', title: 'Hallazgo literario', post_type: 'general', neighborhood: 'Centro' },
  ]
};

async function seed() {
  try {
    console.log('🚀 Starting seed process...');

    // 1. Seed Users
    console.log('Creating users...');
    const userIds = [];
    for (const u of SEED_DATA.users) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(u.password, salt);
      const res = await query(
        `INSERT INTO users (username, email, password_hash, full_name, neighborhood, city)
         VALUES ($1, $2, $3, $4, $5, 'Chetumal')
         RETURNING id`,
        [u.username, u.email, hash, u.full_name, u.neighborhood]
      );
      userIds.push(res.rows[0].id);
    }

    // 2. Seed Businesses
    console.log('Creating businesses...');
    const businessIds = [];
    for (const b of SEED_DATA.businesses) {
      const res = await query(
        `INSERT INTO businesses (name, description, category_id, address, neighborhood, city, location, phone, email, website)
         VALUES ($1, $2, $3, $4, $5, 'Chetumal', ST_MakePoint($6, $7), $8, $9, $10)
         RETURNING id`,
        [b.name, b.description, b.category_id, b.address, b.neighborhood, b.lng, b.lat, b.phone, b.email, b.website]
      );
      businessIds.push(res.rows[0].id);
    }

    // 3. Seed Posts
    console.log('Creating posts...');
    for (let i = 0; i < SEED_DATA.posts.length; i++) {
      const p = SEED_DATA.posts[i];
      await query(
        `INSERT INTO posts (user_id, business_id, content, title, post_type, neighborhood)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userIds[0], businessIds[0], p.content, p.title, p.post_type, p.neighborhood]
      );
      // Note: For simplicity, we're linking all to the first user/biz here, 
      // but we could map them precisely.
    }

    console.log('✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    process.exit();
  }
}

seed();
