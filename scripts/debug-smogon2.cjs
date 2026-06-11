const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000,
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
  const html = await httpsGet('https://www.smogon.com/dex/bw/pokemon/abra/lc/');
  const dexMatch = html.match(/dexSettings\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/);
  if (dexMatch) {
    try {
      const data = JSON.parse(dexMatch[1]);
      console.log('dexSettings keys:', Object.keys(data));
      if (data.injectRpcs) {
        console.log('injectRpcs count:', data.injectRpcs.length);
        // 打印每个 RPC 的第一个参数
        for (let i = 0; i < data.injectRpcs.length; i++) {
          const rpc = data.injectRpcs[i];
          console.log(`\n--- RPC[${i}] ---`);
          console.log('  params[0] (request):', typeof rpc[0], rpc[0].substring(0, 150));
          if (rpc[1]) {
            const resp = rpc[1];
            if (Array.isArray(resp)) {
              console.log('  params[1] (response): array of', resp.length, 'items');
              console.log('  first item keys:', Array.isArray(resp[0]) ? 'array' : JSON.stringify(Object.keys(resp[0])));
            } else if (typeof resp === 'object') {
              console.log('  params[1] keys:', Object.keys(resp));
            }
          }
        }
        // 查找包含 "sets" 的 RPC
        for (let i = 0; i < data.injectRpcs.length; i++) {
          const rpc = data.injectRpcs[i];
          const jsonStr = JSON.stringify(rpc);
          if (jsonStr.includes('"sets"') || jsonStr.includes('"moves"') || jsonStr.includes('"items"')) {
            console.log(`\n=== Found sets/moves/items in RPC[${i}] ===`);
            const resp = rpc[1];
            // 尝试解析第一个参数
            try {
              const req = JSON.parse(rpc[0]);
              console.log('  Request:', JSON.stringify(req));
            } catch(e) {
              console.log('  Request(raw):', rpc[0]);
            }
            // 打印响应
            if (typeof resp === 'object' && !Array.isArray(resp)) {
              console.log('  Response keys:', Object.keys(resp));
            }
            // 查找 sets 字段
            const findSets = (obj, depth = 0, path = '') => {
              if (depth > 5 || !obj) return;
              if (typeof obj !== 'object') return;
              if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) findSets(obj[i], depth + 1, path + '[' + i + ']');
                return;
              }
              for (const key of Object.keys(obj)) {
                const newPath = path ? path + '.' + key : key;
                if (key === 'sets' || key === 'movesets' || key === 'abilities' || key === 'items' || key === 'evs') {
                  console.log('  Found', key, 'at', newPath, '-', JSON.stringify(obj[key]).substring(0, 300));
                }
                findSets(obj[key], depth + 1, newPath);
              }
            };
            findSets(resp);
          }
        }
      }
    } catch(e) {
      console.log('JSON parse error:', e.message);
      // 打印部分原始内容
      console.log(dexMatch[1].substring(0, 1000));
    }
  } else {
    console.log('dexSettings not found');
  }
}

main();
