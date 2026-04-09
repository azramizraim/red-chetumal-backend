import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

async function setup() {
  console.log('--- 🛠️ Configuración de Red Social Local ---');
  
  try {
    const uri = await ask('1. Pega tu URI de Supabase (la de Session puerto 5432): ');
    const password = await ask('2. Escribe tu contraseña de Supabase: ');
    
    // Clean the URI and replace password placeholder
    // Handle common cases like [YOUR-PASSWORD] or :password
    const finalUri = uri
      .replace(/\[YOUR-PASSWORD\]/gi, password)
      .replace(/:password\//gi, `:${password}/`)
      .replace(/:password$/, `:${password}`);

    const envContent = `DATABASE_URL=${finalUri}
JWT_SECRET=red_chetumal_secret_2024
PORT=3001
NODE_ENV=development
`;

    fs.writeFileSync('.env', envContent);
    
    console.log('\n--------------------------------------------');
    console.log('✅ .env configurado correctamente.');
    console.log('🚀 Ahora ejecuta: node src/db/seed.js');
    console.log('--------------------------------------------\n');

  } catch (error) {
    console.error('❌ Error configurando el archivo .env:', error);
  } finally {
    rl.close();
  }
}

setup();
