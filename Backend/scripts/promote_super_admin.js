// Usage: node scripts/promote_super_admin.js admin@exemple.ma
// Promotion explicite et locale : aucun compte ne devient superAdmin automatiquement.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: node scripts/promote_super_admin.js email@exemple.ma');

  await mongoose.connect(process.env.MONGO_URL);
  const result = await User.updateOne({ email }, { $set: { role: 'superAdmin' } });
  if (!result.matchedCount) throw new Error('Aucun utilisateur ne correspond à cet email.');
  console.log(`${email} est désormais superAdmin.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
