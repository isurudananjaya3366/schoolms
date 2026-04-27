#!/usr/bin/env node

/**
 * Superuser Creation Script
 * 
 * This script creates a superuser for the SchoolMS application.
 * Can be used for initial setup or recovery scenarios.
 * 
 * Usage:
 *   npx ts-node scripts/create-superuser.ts
 *   npm run create-superuser
 */

import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface SuperuserData {
  name: string;
  email: string;
  password: string;
}

/**
 * Prompt user for input
 */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true, message: 'Password is valid' };
}

/**
 * Create superuser
 */
async function createSuperuser(data: SuperuserData): Promise<void> {
  try {
    // Check if email is valid
    if (!isValidEmail(data.email)) {
      console.error('❌ Invalid email format');
      process.exit(1);
    }

    // Validate password strength
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      console.error(`❌ ${passwordValidation.message}`);
      process.exit(1);
    }

    // Check if superadmin already exists
    const existingSuperadmin = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' },
    });

    if (existingSuperadmin) {
      console.error('❌ A superadmin already exists in the database');
      console.error(`   Email: ${existingSuperadmin.email}`);
      console.error('   Please delete this user first or use different credentials');
      process.exit(1);
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      console.error(`❌ Email "${data.email}" is already in use`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create superuser
    const superuser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: passwordHash,
        role: 'SUPERADMIN',
        isActive: true,
      },
    });

    console.log('✅ Superuser created successfully!\n');
    console.log('📋 User Details:');
    console.log(`   Name: ${superuser.name}`);
    console.log(`   Email: ${superuser.email}`);
    console.log(`   Role: ${superuser.role}`);
    console.log(`   Status: ${superuser.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   Created: ${superuser.createdAt.toLocaleString()}`);
    console.log('\n🔐 You can now login with these credentials');
    console.log('📍 Login URL: http://localhost:3000/(auth)/login');
  } catch (error) {
    console.error('❌ Error creating superuser:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(`   ${error}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Interactive mode
 */
async function interactiveMode(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔐 SchoolMS - Superuser Creation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const name = await prompt('👤 Enter superuser name: ');
  if (!name) {
    console.error('❌ Name cannot be empty');
    process.exit(1);
  }

  const email = await prompt('📧 Enter email address: ');
  if (!email) {
    console.error('❌ Email cannot be empty');
    process.exit(1);
  }

  const password = await prompt('🔒 Enter password: ');
  if (!password) {
    console.error('❌ Password cannot be empty');
    process.exit(1);
  }

  const confirmPassword = await prompt('🔒 Confirm password: ');
  if (password !== confirmPassword) {
    console.error('❌ Passwords do not match');
    process.exit(1);
  }

  console.log('\n⏳ Creating superuser...\n');

  await createSuperuser({
    name,
    email,
    password,
  });
}

/**
 * Command-line argument mode
 */
async function argumentMode(args: string[]): Promise<void> {
  if (args.length < 3) {
    console.error('Usage: npx ts-node scripts/create-superuser.ts <name> <email> <password>');
    process.exit(1);
  }

  const [name, email, password] = args;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔐 SchoolMS - Superuser Creation');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('⏳ Creating superuser...\n');

  await createSuperuser({
    name,
    email,
    password,
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Interactive mode
    await interactiveMode();
  } else if (args[0] === '--help' || args[0] === '-h') {
    console.log('SchoolMS - Superuser Creation Script\n');
    console.log('Usage:');
    console.log('  Interactive mode (default):');
    console.log('    npx ts-node scripts/create-superuser.ts\n');
    console.log('  Argument mode:');
    console.log('    npx ts-node scripts/create-superuser.ts <name> <email> <password>\n');
    console.log('Examples:');
    console.log('    npx ts-node scripts/create-superuser.ts "Admin User" "admin@school.com" "SecurePass123"\n');
    console.log('Password requirements:');
    console.log('  - At least 8 characters');
    console.log('  - At least one uppercase letter');
    console.log('  - At least one lowercase letter');
    console.log('  - At least one number');
  } else {
    // Argument mode
    await argumentMode(args);
  }
}

main();
