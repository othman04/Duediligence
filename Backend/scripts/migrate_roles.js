// Migration des anciens rôles. Les analyst deviennent admin ; aucun superAdmin n'est créé automatiquement.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  const result = await mongoose.connection.collection('users').updateMany(
    { role: 'analyst' },
    { $set: { role: 'admin' } },
  );
  console.log(`${result.modifiedCount} compte(s) analyst migré(s) vers admin.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
