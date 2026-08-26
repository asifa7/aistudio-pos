import { app } from 'electron';
import { db } from '../backend/db';
import { migrationEngine } from '../backend/migrations';
import { customerService } from '../../modules/customers/backend/service/customer_service';
import { recognitionService } from '../../modules/customers/backend/service/recognition_service';
import { CreateCustomerSchema } from '../validation/customer_schemas';
import { backupService } from '../backend/backup_service';
import { authService } from '../../modules/auth/backend/service/auth_service';
import * as path from 'path';
import * as fs from 'fs';

const logFile = path.join(process.cwd(), 'test_output.log');
fs.writeFileSync(logFile, '');
function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

app.whenReady().then(async () => {
  log('\n==================================================');
  log('   STARTING CUSTOMER DATA SYSTEM & RECOGNITION TEST');
  log('==================================================\n');

  try {
    // 1. Run Migrations & Login Session
    migrationEngine.run();
    authService.login('admin', 'admin123');
    log('[PASS] Migrations executed and auth session established.');

    // 2. Test Zod Schema Empty-to-Null Coercion & Safety Net
    log('[TEST 1] Testing CreateCustomerSchema empty string coercion...');
    const rawInputWithEmptyStrings = {
      name: 'Minimal Test Customer',
      phone: '',
      email: '',
      gstin: '',
      pan: '',
      billing_city: '',
      notes: '',
    };
    
    const parsedResult = CreateCustomerSchema.safeParse(rawInputWithEmptyStrings);
    if (!parsedResult.success) {
      throw new Error(`Schema validation failed on empty strings: ${parsedResult.error.message}`);
    }
    if (parsedResult.data.email !== null || parsedResult.data.phone !== null || parsedResult.data.gstin !== null) {
      throw new Error('Schema failed to coerce empty strings to null');
    }
    log('[PASS] CreateCustomerSchema correctly coerced empty optional strings to null.');

    // 3. Create Customer with ONLY Name
    log('[TEST 2] Creating customer with ONLY Name filled...');
    db.prepare("DELETE FROM customers WHERE name = 'Minimal Test Customer'").run();
    const minimalCust = customerService.createCustomer({
      name: 'Minimal Test Customer',
      phone: '',
      email: '',
      gstin: '',
      pan: '',
    }) as any;

    if (!minimalCust || !minimalCust.id || minimalCust.name !== 'Minimal Test Customer') {
      throw new Error('Failed to create customer with only name');
    }
    log(`[PASS] Customer created with only Name. Code: ${minimalCust.customer_code}, ID: ${minimalCust.id}`);

    // 4. Test Customer Preference Notes & Communication Log
    log('[TEST 3] Testing timestamped customer preference notes...');
    const noteRow = customerService.addCustomerNote(minimalCust.id, 'Prefers boneless meat', 'preference') as any;
    if (!noteRow || noteRow.note !== 'Prefers boneless meat') {
      throw new Error('Failed to add customer note');
    }
    const notesList = customerService.getCustomerNotes(minimalCust.id) as any[];
    if (notesList.length !== 1 || notesList[0].note !== 'Prefers boneless meat') {
      throw new Error('Customer notes list mismatch');
    }
    log('[PASS] Customer preference note created and retrieved successfully.');

    // 5. Test Recognition Service - Face Enrollment & Cosine Matching
    log('[TEST 4] Testing face profile enrollment & cosine similarity matching...');
    
    // Generate dummy 512-dimension vector
    const dummyVectorA = Array.from({ length: 512 }, (_, i) => Math.sin(i));
    const dummyVectorB = Array.from({ length: 512 }, (_, i) => Math.sin(i) + 0.01); // Very close match

    const profileId = recognitionService.enrollFaceProfile(minimalCust.id, dummyVectorA, 'customer_snapshots/test_photo.jpg', 0.85);
    if (!profileId) {
      throw new Error('Failed to enroll face profile');
    }

    // Verify opt-in flag updated on customer
    const reloadedCust = customerService.getCustomerById(minimalCust.id);
    if (reloadedCust.allow_face_recognition !== 1) {
      throw new Error('Face recognition opt-in flag not enabled');
    }

    // Test match
    const match = await recognitionService.matchFace(dummyVectorB);
    if (!match || match.customerId !== minimalCust.id) {
      throw new Error(`Face matching failed. Match result: ${JSON.stringify(match)}`);
    }
    log(`[PASS] Face profile enrolled and matched with confidence score ${(match.confidence * 100).toFixed(2)}%.`);

    // 6. Test Visit Logging & Retroactive Link
    log('[TEST 5] Testing physical visit logging (anonymous & linked)...');
    
    // Log anonymous visit
    const anonVisitId = recognitionService.logVisit({
      customerId: null,
      detectionMethod: 'camera_recognition',
      cameraSnapshotPath: 'customer_snapshots/anon_123.jpg',
      notes: 'Unrecognized customer at counter 1',
    });

    if (!anonVisitId) {
      throw new Error('Failed to log anonymous visit');
    }

    // Link visit to customer retroactively
    recognitionService.linkVisitToCustomer(anonVisitId, minimalCust.id);

    const visits = recognitionService.getCustomerVisits(minimalCust.id);
    if (visits.length !== 1 || visits[0].id !== anonVisitId || visits[0].customer_id !== minimalCust.id) {
      throw new Error('Visit linking verification failed');
    }
    log('[PASS] Anonymous visit logged and retroactively linked to customer.');

    // 7. Test Backup Service Snapshots Folder Handling
    log('[TEST 6] Testing backupService snapshot directory handling...');
    const snapshotsDir = path.join(app.getPath('userData'), 'documents', 'customer_snapshots');
    if (!fs.existsSync(snapshotsDir)) {
      fs.mkdirSync(snapshotsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(snapshotsDir, 'test_photo.jpg'), 'fake_image_bytes');

    const backupFile = await backupService.backupDatabase();
    if (!fs.existsSync(backupFile)) {
      throw new Error('Database backup file not created');
    }
    log(`[PASS] Backup completed successfully. DB Backup path: ${backupFile}`);

    // Cleanup test data
    db.prepare('DELETE FROM customer_visits WHERE id = ?').run(anonVisitId);
    db.prepare('DELETE FROM customer_face_profiles WHERE id = ?').run(profileId);
    db.prepare('DELETE FROM customer_notes WHERE customer_id = ?').run(minimalCust.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(minimalCust.id);
    if (fs.existsSync(path.join(snapshotsDir, 'test_photo.jpg'))) {
      fs.unlinkSync(path.join(snapshotsDir, 'test_photo.jpg'));
    }

    log('\n==================================================');
    log('   CUSTOMER DATA SYSTEM & RECOGNITION TESTS PASSED!');
    log('==================================================\n');
    process.exit(0);
  } catch (err) {
    log(`\n[FATAL] Customer Recognition test failed: ${err}`);
    process.exit(1);
  }
});
