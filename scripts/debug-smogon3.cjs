const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search,
      method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000,
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout')));
  });
}

async function main() {
  const urls = [
    'https://www.smogon.com/dex/bw/pokemon/abra/lc/',
    'https://www.smogon.com/dex/sm/pokemon/porygon/lc/',
  ];
  
  for (const url of urls) {
    console.log('\n============', url, '============');
    const html = await httpsGet(url);
    const dexMatch = html.match(/dexSettings\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/);
    if (!dexMatch) { console.log('not found'); continue; }
    const data = JSON.parse(dexMatch[1]);
    
    // 查找 dump-pokemon RPC
    for (const rpc of data.injectRpcs) {
      try {
        const reqStr = rpc[0];
        if (reqStr.includes('dump-pokemon')) {
          const req = JSON.parse(reqStr);
          const resp = rpc[1];
          console.log('Request gen:', req.gen, 'alias:', req.alias);
          console.log('Response keys:', Object.keys(resp));
          if (resp.strategies) {
            console.log('strategies count:', resp.strategies.length);
            for (let i = 0; i < resp.strategies.length; i++) {
              const s = resp.strategies[i];
              console.log(`  strategy[${i}]: name="${s.name}", movesets=${s.movesets ? s.movesets.length : 0}`);
              if (s.movesets && s.movesets.length > 0) {
                console.log('   Sample set:', JSON.stringify(s.movesets[0], null, 2).substring(0, 800));
              }
            }
          }
        }
      } catch(e) { /* skip */ }
    }
  }
}

main();
