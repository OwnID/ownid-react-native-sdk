import { createRequire, Module } from 'node:module';

// Node cannot parse React Native's Flow entry point. Existing source-runtime tests
// need only Platform; an unsupported platform keeps their actual sender offline.
const requireFromTest = createRequire(import.meta.url);
const reactNativePath = requireFromTest.resolve('react-native');
const platformModule = new Module(reactNativePath);
platformModule.exports = Object.freeze({
  Platform: Object.freeze({ OS: 'node', select: () => undefined }),
});
platformModule.loaded = true;
requireFromTest.cache[reactNativePath] = platformModule;
