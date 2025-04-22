const webpack = require('webpack');

module.exports = function override(config) {
  // Handle node: scheme imports
  config.module.rules.unshift({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
      fallback: {
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer/"),
        "util": require.resolve("util/"),
        "crypto": require.resolve("crypto-browserify"),
        "path": require.resolve("path-browserify"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "url": require.resolve("url/"),
        "zlib": require.resolve("browserify-zlib"),
        "assert": require.resolve("assert/"),
        "process": require.resolve("process/browser"),
        "fs": false,
        "child_process": false,
        "net": false,
        "tls": false
      }
    }
  });

  // Add additional resolve configuration
  config.resolve = {
    ...config.resolve,
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "util": require.resolve("util/"),
      "crypto": require.resolve("crypto-browserify"),
      "path": require.resolve("path-browserify"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "url": require.resolve("url/"),
      "zlib": require.resolve("browserify-zlib"),
      "assert": require.resolve("assert/"),
      "process": require.resolve("process/browser"),
      "fs": false,
      "child_process": false,
      "net": false,
      "tls": false
    },
    alias: {
      ...config.resolve.alias,
      'stream': 'stream-browserify',
      'buffer': 'buffer',
      'util': 'util',
      'process': 'process/browser',
      'path': 'path-browserify'
    }
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
      const mod = resource.request.replace(/^node:/, '');
      resource.request = mod;
    })
  ];

  return config;
}; 