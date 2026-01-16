import { runMigrationTests } from "./test-migration";

/**
 * Script per eseguire i test di migrazione
 * npm run test:migration
 */

async function main() {
  console.log("🧪 Testing migration for 3 users scenario...\n");

  try {
    await runMigrationTests();
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main();
