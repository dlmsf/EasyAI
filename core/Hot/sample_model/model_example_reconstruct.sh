#!/bin/bash

# Auto-generated reconstruction script for model_example.gguf
# Total parts: 63
# Original file hash: 2f82233630c349ccf6b8daccf48f9a7865713d9f08a2eadfa456cebe9b97c7f5

echo "🔧 Starting reconstruction of model_example.gguf from 63 parts..."
echo "----------------------------------------"

# Check if all parts exist
MISSING_FILES=0
for i in $(seq -f "%03g" 1 63); do
    PART_FILE="model_example.part.$i.gguf"
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
> model_example.gguf

for i in $(seq -f "%03g" 1 63); do
    PART_FILE="model_example.part.$i.gguf"
    echo "   Adding part $i/63: $PART_FILE"
    cat "$PART_FILE" >> model_example.gguf
done

echo "✅ Reconstruction complete!"

# Verify the reconstructed file
echo "🔍 Verifying file integrity..."

# Calculate hash of reconstructed file
if command -v sha256sum &> /dev/null; then
    RECONSTRUCTED_HASH=$(sha256sum model_example.gguf | cut -d' ' -f1)
elif command -v shasum &> /dev/null; then
    RECONSTRUCTED_HASH=$(shasum -a 256 model_example.gguf | cut -d' ' -f1)
else
    echo "⚠️  Warning: Cannot verify file hash (sha256sum/shasum not found)"
    RECONSTRUCTED_HASH="unknown"
fi

if [ "$RECONSTRUCTED_HASH" = "2f82233630c349ccf6b8daccf48f9a7865713d9f08a2eadfa456cebe9b97c7f5" ]; then
    echo "✅ Hash verification successful! File is intact."
else
    echo "⚠️  Warning: Hash mismatch! The reconstructed file may be corrupted."
    echo "   Expected: 2f82233630c349ccf6b8daccf48f9a7865713d9f08a2eadfa456cebe9b97c7f5"
    echo "   Got:      $RECONSTRUCTED_HASH"
fi

# Display file info
FILESIZE=$(stat -f%z "model_example.gguf" 2>/dev/null || stat -c%s "model_example.gguf" 2>/dev/null)
echo "📊 File size: $FILESIZE bytes"
echo "📁 Output file: model_example.gguf"

echo "----------------------------------------"
echo "✨ Done!"
