const path = require('path');

// npm puede dejar babel-preset-expo anidado en expo/node_modules en lugar de izarlo:
// se resuelve primero de forma normal y, si no, desde el propio paquete expo.
function resolveBabelPresetExpo() {
  try {
    return require.resolve('babel-preset-expo');
  } catch {
    return require.resolve('babel-preset-expo', {
      paths: [path.dirname(require.resolve('expo/package.json'))],
    });
  }
}

module.exports = function (api) {
  api.cache(true);

  return {
    presets: [resolveBabelPresetExpo()],
  };
};
