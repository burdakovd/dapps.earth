const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
const variablesBuilder = require('./src/variables.js');

module.exports = () => variablesBuilder().then(
  variables => ({
    entry: './src/index.js',
    output: {
      path: __dirname + '/dist',
      filename: 'index.js',
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        inlineSource: '.(js|css)$',
        README_CSS: variables.README_CSS,
        README_HTML_CONTENT: variables.README,
      }),
      new HtmlWebpackInlineSourcePlugin(),
      new CopyWebpackPlugin([
        {
          from: 'static/*.*',
          to: './',
          flatten: true,
        }
      ], {})
    ],
  })
);
