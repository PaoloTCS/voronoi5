const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupEnvironment() {
  console.log('Setting up environment variables...\n');

  // Check if .env.local exists
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envExamplePath = path.join(__dirname, '..', '.env.example');

  if (fs.existsSync(envLocalPath)) {
    const answer = await question('A .env.local file already exists. Do you want to overwrite it? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }

  // Read example file
  const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
  const lines = exampleContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  // Create new environment variables
  const newEnvVars = [];
  
  for (const line of lines) {
    const [key] = line.split('=');
    const value = await question(`Enter value for ${key}: `);
    newEnvVars.push(`${key}=${value}`);
  }

  // Write to .env.local
  const content = newEnvVars.join('\n');
  fs.writeFileSync(envLocalPath, content);
  
  console.log('\nEnvironment setup complete!');
  console.log('Created/updated .env.local with your values.');
  console.log('\nNext steps:');
  console.log('1. Start the development server with: npm start');
  console.log('2. Check the console for any environment validation warnings');
  
  rl.close();
}

// Run setup
setupEnvironment().catch(console.error); 