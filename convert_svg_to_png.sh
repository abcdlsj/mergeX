#!/bin/bash

# Script to convert SVG to PNG in various sizes using sips (macOS built-in tool)
# Usage: ./convert_svg_to_png.sh

# Source SVG file
SOURCE_SVG="public/icons/logo.svg"

# Check if source file exists
if [ ! -f "$SOURCE_SVG" ]; then
  echo "Error: Source SVG file $SOURCE_SVG not found!"
  exit 1
fi

# Create output directory if it doesn't exist
mkdir -p public/img

# Define sizes to convert
SIZES=(16 32 34 48 128)

# Convert SVG to PNG for each size
for SIZE in "${SIZES[@]}"; do
  OUTPUT_PNG="public/img/logo-${SIZE}.png"
  echo "Converting to ${SIZE}x${SIZE}..."
  
  # First convert SVG to a temporary PNG
  sips -s format png "$SOURCE_SVG" --out temp.png
  
  # Then resize the temporary PNG to the desired size
  sips -z "$SIZE" "$SIZE" temp.png --out "$OUTPUT_PNG"
  
  if [ $? -eq 0 ]; then
    echo "Created $OUTPUT_PNG"
  else
    echo "Error creating $OUTPUT_PNG"
  fi
done

# Clean up temporary file
rm -f temp.png

echo "Conversion complete!"