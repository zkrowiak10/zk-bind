const path = require("path");

module.exports = {
  mode: "development",
  entry: "./scripts/test_client/playClient.js",
  devtool: 'inline-source-map',
  output: {
    filename: "playScript.js",
    path: path.resolve("./scripts", "dist"),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
};
