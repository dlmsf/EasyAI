import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// Configuration
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per part (adjust as needed)
const INPUT_FILE = process.argv[2]; // Get input file from command line

if (!INPUT_FILE) {
    console.error('Please provide a .gguf file path');
    console.error('Usage: node splitter.js path/to/model.gguf');
    process.exit(1);
}

if (!INPUT_FILE.endsWith('.gguf')) {
    console.error('Error: Input file must have .gguf extension');
    process.exit(1);
}

const OUTPUT_DIR = path.dirname(INPUT_FILE);
const BASENAME = path.basename(INPUT_FILE, '.gguf');

console.log(`📁 Splitting file: ${INPUT_FILE}`);
console.log(`📦 Chunk size: ${CHUNK_SIZE / (1024 * 1024)}MB`);

// Create SHA-256 hash of the original file for verification
const fileHash = crypto.createHash('sha256');
const fileStream = fs.createReadStream(INPUT_FILE);
fileStream.on('data', chunk => fileHash.update(chunk));

fileStream.on('end', () => {
    const originalHash = fileHash.digest('hex');
    
    // Split file into chunks
    const chunkFiles = [];
    let partNumber = 1;
    const fd = fs.openSync(INPUT_FILE, 'r');
    const stats = fs.statSync(INPUT_FILE);
    const totalParts = Math.ceil(stats.size / CHUNK_SIZE);
    
    console.log(`📊 Total parts to create: ${totalParts}`);
    
    const buffer = Buffer.alloc(CHUNK_SIZE);
    let bytesRead;
    
    while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, (partNumber - 1) * CHUNK_SIZE)) > 0) {
        const chunkFileName = `${BASENAME}.part.${String(partNumber).padStart(3, '0')}.gguf`;
        const chunkPath = path.join(OUTPUT_DIR, chunkFileName);
        
        // Write only the actual bytes read
        fs.writeFileSync(chunkPath, buffer.slice(0, bytesRead));
        
        // Calculate hash of this chunk for verification
        const chunkHash = crypto.createHash('sha256')
            .update(buffer.slice(0, bytesRead))
            .digest('hex');
        
        chunkFiles.push({
            name: chunkFileName,
            size: bytesRead,
            hash: chunkHash
        });
        
        console.log(`✅ Created part ${partNumber}/${totalParts}: ${chunkFileName} (${bytesRead} bytes)`);
        partNumber++;
    }
    
    fs.closeSync(fd);
    
    // Create the reconstruction script
    createReconstructionScript(OUTPUT_DIR, BASENAME, chunkFiles, originalHash, totalParts);
    
    console.log('\n✨ Splitting completed successfully!');
    console.log(`🔢 Total parts created: ${totalParts}`);
    console.log(`📝 Reconstruction script created: ${BASENAME}_reconstruct.sh`);
    console.log(`\nTo reconstruct the original file, run:`);
    console.log(`   cd ${OUTPUT_DIR}`);
    console.log(`   chmod +x ${BASENAME}_reconstruct.sh`);
    console.log(`   ./${BASENAME}_reconstruct.sh`);
});

function createReconstructionScript(outputDir, basename, chunkFiles, originalHash, totalParts) {
    const scriptPath = path.join(outputDir, `${basename}_reconstruct.sh`);
    
    // Create verification data
    const partsInfo = chunkFiles.map((f, i) => ({
        part: i + 1,
        file: f.name,
        size: f.size,
        hash: f.hash
    }));
    
    const scriptContent = `#!/bin/bash

# Auto-generated reconstruction script for ${basename}.gguf
# Total parts: ${totalParts}
# Original file hash: ${originalHash}

echo "🔧 Starting reconstruction of ${basename}.gguf from ${totalParts} parts..."
echo "----------------------------------------"

# Check if all parts exist
MISSING_FILES=0
for i in $(seq -f "%03g" 1 ${totalParts}); do
    PART_FILE="${basename}.part.$i.gguf"
    if [ ! -f "$PART_FILE" ]; then
        echo "❌ Missing part: $PART_FILE"
        MISSING_FILES=1
    fi
done

if [ $MISSING_FILES -eq 1 ]; then
    echo "❌ Error: Some parts are missing. Please ensure all part files are in the current directory."
    exit 1
fi

echo "✅ All parts found"

# Reconstruct the file
echo "🔄 Reconstructing file..."
> ${basename}.gguf

for i in $(seq -f "%03g" 1 ${totalParts}); do
    PART_FILE="${basename}.part.$i.gguf"
    echo "   Adding part $i/${totalParts}: $PART_FILE"
    cat "$PART_FILE" >> ${basename}.gguf
done

echo "✅ Reconstruction complete!"

# Verify the reconstructed file
echo "🔍 Verifying file integrity..."

# Calculate hash of reconstructed file
if command -v sha256sum &> /dev/null; then
    RECONSTRUCTED_HASH=$(sha256sum ${basename}.gguf | cut -d' ' -f1)
elif command -v shasum &> /dev/null; then
    RECONSTRUCTED_HASH=$(shasum -a 256 ${basename}.gguf | cut -d' ' -f1)
else
    echo "⚠️  Warning: Cannot verify file hash (sha256sum/shasum not found)"
    RECONSTRUCTED_HASH="unknown"
fi

if [ "$RECONSTRUCTED_HASH" = "${originalHash}" ]; then
    echo "✅ Hash verification successful! File is intact."
else
    echo "⚠️  Warning: Hash mismatch! The reconstructed file may be corrupted."
    echo "   Expected: ${originalHash}"
    echo "   Got:      $RECONSTRUCTED_HASH"
fi

# Display file info
FILESIZE=$(stat -f%z "${basename}.gguf" 2>/dev/null || stat -c%s "${basename}.gguf" 2>/dev/null)
echo "📊 File size: $FILESIZE bytes"
echo "📁 Output file: ${basename}.gguf"

echo "----------------------------------------"
echo "✨ Done!"
`;

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
}
