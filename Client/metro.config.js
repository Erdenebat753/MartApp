// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Allow loading binary 3D assets (GLB/GLTF/FBX) for Viro
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  "glb",
  "gltf",
  "fbx",
];

module.exports = config;
