import fs from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import 'log-timestamp';

const jsdom_hook = `
window.JSDOM_HOOK = (function () {
  const hook = {};
  const promise = new Promise(
    (resolve, reject) => {
      hook.resolve = resolve;
      hook.reject = reject;
    },
  );
  hook.promise = promise;
  console.log('hook installed');
  return hook;
})();
`;

async function main() {
  const domain = process.argv[2];
  const html = fs.readFileSync('./dist/index.html', { encoding: 'utf-8' })
    .split('// JSDOM_HOOK').join(jsdom_hook);
  const url = `https://${domain}/audit.html#${domain}/`;
  console.log(`Opening ${url}`);
  const virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console);
  const dom = new JSDOM(
    html,
    {
      url,
      runScripts: "dangerously",
      virtualConsole,
      pretendToBeVisual: true,
      resources: "usable",
    },
  );
  try {
    await dom.window.JSDOM_HOOK.promise;
    console.log('');
    console.log('final result: AUDIT SUCCEEDED');
  } catch (e) {
    console.log('');
    console.log('final result: AUDIT FAILED');
    throw e;
  }
  dom.window.close();
}

process.on('unhandledRejection', up => { throw up; })

main();
