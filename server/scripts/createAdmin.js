import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

async function run() {
  console.log('--- Admin Provisioning Script ---');

  const { ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !MONGODB_URI) {
    console.error('ERROR: ADMIN_EMAIL, ADMIN_PASSWORD, and MONGODB_URI must be set in the environment.');
    process.exit(1);
  }

  if (ADMIN_PASSWORD.length < 8) {
    console.error('ERROR: ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    
    if (existingAdmin) {
      console.log(`User with email ${ADMIN_EMAIL} already exists.`);
      if (existingAdmin.role !== 'ADMIN') {
        console.log('Upgrading user to ADMIN role...');
        existingAdmin.role = 'ADMIN';
        await existingAdmin.save();
        console.log('User upgraded successfully.');
      } else {
        console.log('User is already an ADMIN. No action taken.');
      }
    } else {
      console.log(`Creating new ADMIN user: ${ADMIN_EMAIL}`);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);

      await User.create({
        name: 'System Administrator',
        email: ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      });

      console.log('ADMIN user created successfully.');
    }

  } catch (err) {
    console.error('Error during admin provisioning:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

run();
