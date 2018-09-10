const fs = require('fs');
const showdown  = require('showdown');
const purify = require("purify-css")

module.exports = () => new Promise(function(resolve) {
  const markdown_css = fs.readFileSync(
    './node_modules/github-markdown-css/github-markdown.css',
    'utf-8',
  ).split('markdown-body').join('m-b');

  const converter = new showdown.Converter();
  const readme = fs.readFileSync('./src/README.md', 'utf8')
    .split('https://dapps.earth/').join('/');
  const html = '<div class="m-b">' + converter.makeHtml(readme) + '</div>';

  purify(html, markdown_css, { info: true, minify: true }, pure => resolve({
    README: html,
    README_CSS: pure,
  }));
});
