#!/bin/bash
# Build the plugin, create a git tag, and publish a GitHub release with plugin assets.
set -e

# Read version from manifest.json
VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "Error: Could not read version from manifest.json"
  exit 1
fi

# Check version consistency
PKG_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
if [ "$VERSION" != "$PKG_VERSION" ]; then
  echo "Error: Version mismatch — manifest.json (${VERSION}) != package.json (${PKG_VERSION})"
  exit 1
fi

# Check if release already exists
if gh release view "${VERSION}" &>/dev/null; then
  echo "Error: Release ${VERSION} already exists on GitHub"
  echo "Update the version in manifest.json and package.json before releasing."
  exit 1
fi

echo "Building plugin v${VERSION}..."
npm run build

echo "Creating git tag ${VERSION}..."
git tag -a "${VERSION}" -m "Release ${VERSION}"
git push origin "${VERSION}"

echo "Creating GitHub release ${VERSION}..."
gh release create "${VERSION}" \
  --title "${VERSION}" \
  --generate-notes \
  main.js manifest.json styles.css

echo "Done! Release ${VERSION} created at:"
gh release view "${VERSION}" --json url --jq '.url'
