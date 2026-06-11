const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
        resolve(httpsGet(redirectUrl));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Timeout')); });
  });
}

async function main() {
  // 测试多个 URL
  const urls = [
    'https://www.smogon.com/dex/bw/pokemon/abra/lc/',
    'https://www.smogon.com/dex/xy/pokemon/abra/lc/',
    'https://www.smogon.com/dex/sm/pokemon/abra/lc/',
  ];

  for (const url of urls) {
    console.log('\n========== URL:', url, '==========');
    try {
      const html = await httpsGet(url);
      console.log('Page length:', html.length);
      
      // 1. 找 injectRundown
      const injectRe = /dexSettings\.injectRundown\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*([\s\S]+?)\s*\)\s*;/;
      const m = html.match(injectRe);
      if (m) {
        console.log('Found injectRundown!');
        console.log('  gen:', m[1]);
        console.log('  format:', m[2]);
        console.log('  data length:', m[3].length);
        console.log('  data starts with:', m[3].substring(0, 200));
        // 尝试解析
        try {
          const data = eval('(' + m[3] + ')');
          console.log('  Parsed! Keys:', Object.keys(data));
          if (data.sets) {
            console.log('  sets count:', data.sets.length);
            if (data.sets.length > 0) {
              console.log('  first set:', JSON.stringify(data.sets[0], null, 2).substring(0, 500));
            }
          }
        } catch (e) {
          console.log('  eval error:', e.message);
        }
      } else {
        console.log('NO injectRundown. Looking for other patterns...');
        // 打印包含 "sets" 的 script 片段
        const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
        if (scriptTags) {
          for (let i = 0; i < scriptTags.length; i++) {
            if (scriptTags[i].includes('sets') || scriptTags[i].includes('inject')) {
              console.log('  Script', i, '(first 300):', scriptTags[i].substring(0, 300));
              console.log('  ---');
            }
          }
        }
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

main();
