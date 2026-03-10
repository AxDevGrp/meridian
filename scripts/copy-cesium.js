#!/usr/bin/env node

/**
 * Copy Cesium static assets to public folder
 * This script runs before next build to ensure Cesium assets are available
 */

const fs = require('fs');
const path = require('path');

const CESIUM_SOURCE = path.join(__dirname, '../node_modules/cesium/Build/Cesium');
const PUBLIC_DIR = path.join(__dirname, '../public');
const CESIUM_DEST = path.join(PUBLIC_DIR, 'cesium');

// Directories to copy
const DIRS_TO_COPY = ['Workers', 'ThirdParty', 'Assets', 'Widgets'];

function copyDirSync(src, dest) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    // Read source directory
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function main() {
    console.log('Copying Cesium static assets to public folder...');

    // Create public/cesium directory if it doesn't exist
    if (!fs.existsSync(CESIUM_DEST)) {
        fs.mkdirSync(CESIUM_DEST, { recursive: true });
    }

    // Copy each directory
    for (const dir of DIRS_TO_COPY) {
        const srcPath = path.join(CESIUM_SOURCE, dir);
        const destPath = path.join(CESIUM_DEST, dir);

        if (fs.existsSync(srcPath)) {
            console.log(`  Copying ${dir}...`);
            copyDirSync(srcPath, destPath);
        } else {
            console.warn(`  Warning: ${dir} not found in Cesium package`);
        }
    }

    console.log('Cesium assets copied successfully!');
}

main();
