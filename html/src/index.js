import readme from './README.md';
import 'github-markdown-css';

document.getElementById('root').innerHTML = readme.split('https://dapps.earth/').join('/');
