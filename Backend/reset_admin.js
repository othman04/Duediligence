const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash('admin123', salt);
  
  await User.updateOne({ email: 'admin@gmail.com' }, { $set: { password_hash } });
  console.log('Password for admin@gmail.com reset to: admin123');
  
  process.exit(0);
}
main().catch(console.error);
