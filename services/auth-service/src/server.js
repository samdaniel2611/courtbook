require('dotenv').config();
const app = require('./app');
const connectDB = require('../db');

const PORT = process.env.PORT || 4001;

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`auth-service listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});