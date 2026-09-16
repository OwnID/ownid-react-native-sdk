const { withAppBuildGradle } = require('expo/config-plugins');
const REGISTERED_SIGNING_VALUES = Object.freeze([
  {
    defaultPattern: /storeFile\s+file\((['"])debug\.keystore\1\)/g,
    registeredPattern: /storeFile\s+file\((['"])\.\.\/\.\.\/credentials\/ownid-demo-key\.jks\1\)/g,
    replacement: 'storeFile file("../../credentials/ownid-demo-key.jks")',
  },
  {
    defaultPattern: /storePassword\s+(['"])android\1/g,
    registeredPattern: /storePassword\s+(['"])OwnID-Demo-Key\1/g,
    replacement: 'storePassword "OwnID-Demo-Key"',
  },
  {
    defaultPattern: /keyAlias\s+(['"])androiddebugkey\1/g,
    registeredPattern: /keyAlias\s+(['"])ownid-demo-key-alias\1/g,
    replacement: 'keyAlias "ownid-demo-key-alias"',
  },
  {
    defaultPattern: /keyPassword\s+(['"])android\1/g,
    registeredPattern: /keyPassword\s+(['"])OwnID-Demo-Key\1/g,
    replacement: 'keyPassword "OwnID-Demo-Key"',
  },
]);

function withDemoAndroidSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error("Demo signing requires Expo's generated Groovy app build file.");

    const source = mod.modResults.contents;
    const defaultCounts = REGISTERED_SIGNING_VALUES.map(({ defaultPattern }) => countMatches(source, defaultPattern));
    const registeredCounts = REGISTERED_SIGNING_VALUES.map(({ registeredPattern }) => countMatches(source, registeredPattern));

    if (registeredCounts.every((count) => count === 1) && defaultCounts.every((count) => count === 0)) {
      assertSigningConfigReferences(source);
      return mod;
    }
    if (!defaultCounts.every((count) => count === 1) || !registeredCounts.every((count) => count === 0)) {
      throw new Error('Expo generated an unexpected or partially modified Android debug signing block.');
    }

    mod.modResults.contents = REGISTERED_SIGNING_VALUES.reduce(
      (contents, { defaultPattern, replacement }) => contents.replace(defaultPattern, replacement),
      source
    );
    assertSigningConfigReferences(mod.modResults.contents);
    return mod;
  });
}

function countMatches(source, pattern) {
  pattern.lastIndex = 0;
  const count = [...source.matchAll(pattern)].length;
  pattern.lastIndex = 0;
  return count;
}

function assertSigningConfigReferences(source) {
  const referenceCount = countMatches(source, /^\s*signingConfig\s+signingConfigs\.debug\s*$/gm);
  if (referenceCount !== 2) throw new Error('Expo generated unexpected Android debug or release signing configuration references.');
}

module.exports = withDemoAndroidSigning;
