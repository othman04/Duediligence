const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  const users = await User.find({});
  console.log(users.map(u => ({ email: u.email, role: u.role })));
  process.exit(0);
}
main().catch(console.error);
