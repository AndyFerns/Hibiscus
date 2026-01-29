/**
 * ============================================================================
 * Version Bump Script
 * ============================================================================
 * 
 * This script updates the version number across all configuration files.
 * 
 * USAGE:
 *   node scripts/bump-version.js [major|minor|patch]
 *   
 * EXAMPLES:
 *   node scripts/bump-version.js patch   # 0.2.1 → 0.2.2
 *   node scripts/bump-version.js minor   # 0.2.1 → 0.3.0
 *   node scripts/bump-version.js major   # 0.2.1 → 1.0.0
 * 
 * FILES UPDATED:
 *   - version.json (source of truth)
 *   - package.json
 *   - src-tauri/Cargo.toml
 *   - src-tauri/tauri.conf.json
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// Parse command line argument
const bumpType = process.argv[2] || 'patch';

if (!['major', 'minor', 'patch'].includes(bumpType)) {
    console.error('Usage: node scripts/bump-version.js [major|minor|patch]');
    process.exit(1);
}

// Read current version from version.json
const versionFilePath = path.join(__dirname, '..', 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf-8'));
const currentVersion = versionData.version;

// Parse version parts
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Calculate new version
let newVersion;
switch (bumpType) {
    case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
    case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
    case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
}

console.log(`\n🌺 Hibiscus Version Bump`);
console.log(`   ${currentVersion} → ${newVersion}\n`);

// Update version.json
versionData.version = newVersion;
fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2) + '\n');
console.log(`✓ Updated version.json`);

// Update package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
packageData.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
console.log(`✓ Updated package.json`);

// Update src-tauri/Cargo.toml
const cargoPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoContent = fs.readFileSync(cargoPath, 'utf-8');
cargoContent = cargoContent.replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${newVersion}"`
);
fs.writeFileSync(cargoPath, cargoContent);
console.log(`✓ Updated src-tauri/Cargo.toml`);

// Update src-tauri/tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`✓ Updated src-tauri/tauri.conf.json`);

console.log(`\n✅ Version bumped to ${newVersion}\n`);
console.log(`Remember to update the version display in src/App.tsx if needed!`);
