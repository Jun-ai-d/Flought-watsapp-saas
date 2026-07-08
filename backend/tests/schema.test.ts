import fs from 'fs';
import path from 'path';

describe('Schema Constraints vs Code', () => {
  let migrationFiles: string[] = [];
  let migrationsContent = '';

  beforeAll(() => {
    const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations');
    migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    migrationsContent = migrationFiles.map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf-8')).join('\n');
  });

  test('message_type constraint includes all used types', () => {
    // We expect the CHECK constraint to contain all these types
    const expectedTypes = ['text', 'image', 'document', 'audio', 'template', 'interactive', 'catalog', 'order'];
    expectedTypes.forEach(type => {
      // Very basic check to see if the type string exists in the migration dumps
      expect(migrationsContent.includes(`'${type}'`)).toBe(true);
    });
  });

  test('tier constraint includes all used tiers', () => {
    const expectedTiers = ['standard', 'growth', 'vip'];
    expectedTiers.forEach(tier => {
      expect(migrationsContent.includes(`'${tier}'`)).toBe(true);
    });
  });

  test('bsp_provider constraint includes widget', () => {
    expect(migrationsContent.includes("'widget'")).toBe(true);
  });
});
