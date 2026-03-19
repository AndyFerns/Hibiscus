#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const command = process.argv[2];

const scripts = {
    'dev': 'npm run tauri dev',
    'build': 'npm run tauri build',
    'test': 'node scripts/hibiscus.cjs test:ui && node scripts/hibiscus.cjs test:backend',
    'test:ui': 'npm run test:run',
    'test:backend': 'cargo test --manifest-path src-tauri/Cargo.toml',
    'docs': 'mkdocs serve',
    'bump': 'node scripts/bump-version.cjs',
}

function run(cmd) {
    if (!scripts[cmd]) {
        console.error(`Unknown command: ${cmd}`);
        console.log('\nAvailable commands:');
        Object.keys(scripts).forEach(k => console.log(`  ${k}`));
        process.exit(1);
    }

    try {
        console.log(`\n> Running: ${scripts[cmd]}\n`);
        execSync(scripts[cmd], { stdio: 'inherit' });
    } catch (e) {
        console.error(`\nCommand failed with code ${e.status}`);
        process.exit(e.status);
    }
}

if (!command) {
    console.log(`Hibiscus CLI Helper\n-------------------`);
    Object.keys(scripts).forEach(k => console.log(`  node scripts/hibiscus.cjs ${k}`));
} else {
    run(command);
}
