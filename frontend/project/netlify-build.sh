#!/bin/bash

# This script helps with the Netlify build process

# Install dependencies
npm install

# Build the project
npm run build

# Output success message
echo "Build completed successfully!"