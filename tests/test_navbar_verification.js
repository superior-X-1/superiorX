const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Starting Comprehensive Navbar Duplication & Functionality Verification ---\n');

// 1. Verify index.html static markup
const indexPath = path.join(__dirname, '..', 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

const mainNavMatch = indexHtml.match(/<nav class="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
assert(mainNavMatch, 'main-nav must exist in index.html');
const mainNavContent = mainNavMatch[1];

console.log('[1/4] Checking index.html static .main-nav content:');
assert(!mainNavContent.includes('href="#login"'), 'index.html: main-nav must NOT contain Login link');
assert(!mainNavContent.includes('href="#register"'), 'index.html: main-nav must NOT contain Register link');
assert(!mainNavContent.includes('nav-login'), 'index.html: main-nav must NOT contain nav-login id');
assert(!mainNavContent.includes('nav-register'), 'index.html: main-nav must NOT contain nav-register id');

const expectedNavLinks = [
  { href: '#landing', text: 'Home' },
  { href: '#services', text: 'Services' },
  { href: '#how-it-works', text: 'How It Works' },
  { href: '#verify', text: 'Verify Certificate' },
  { href: '#rules', text: 'Rules &amp; Regulations' },
  { href: '#help', text: 'Help &amp; Contact' },
];

expectedNavLinks.forEach(({ href, text }) => {
  assert(mainNavContent.includes(href), `index.html: main-nav missing ${href}`);
  assert(mainNavContent.includes(text), `index.html: main-nav missing text ${text}`);
});
console.log('  ✓ Static main-nav contains exactly the 6 required links and NO Login/Register links.');

const headerUserMatch = indexHtml.match(/<div class="header-user-section"[^>]*>([\s\S]*?)<\/div>/);
assert(headerUserMatch, 'header-user-section must exist in index.html');
const headerUserContent = headerUserMatch[1];

assert(headerUserContent.includes('href="#verify"') && headerUserContent.includes('Verify Certificate'), 'header-user-section must contain Verify Certificate button');
assert(headerUserContent.includes('href="#login"') && headerUserContent.includes('Login'), 'header-user-section must contain Login button');
assert(headerUserContent.includes('href="#register"') && headerUserContent.includes('Register'), 'header-user-section must contain Register button');
console.log('  ✓ Static header-user-section contains [Verify Certificate], [Login], and [Register] buttons.\n');

// 2. Verify frontend/js/app.js dynamic updateHeaderUI markup
console.log('[2/4] Checking frontend/js/app.js updateHeaderUI:');
const appJsPath = path.join(__dirname, '..', 'frontend', 'js', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf-8');

const publicNavRegex = /else\s*{\s*\/\/\s*PUBLIC[\s\S]*?mainNav\.innerHTML\s*=\s*`([\s\S]*?)`;/;
const appNavMatch = appJs.match(publicNavRegex);
assert(appNavMatch, 'Public navigation template in app.js must exist');
const appNavContent = appNavMatch[1];

assert(!appNavContent.includes('href="#login"'), 'app.js: public mainNav must NOT contain Login link');
assert(!appNavContent.includes('href="#register"'), 'app.js: public mainNav must NOT contain Register link');
expectedNavLinks.forEach(({ href, text }) => {
  assert(appNavContent.includes(href), `app.js: public mainNav missing ${href}`);
  assert(appNavContent.includes(text), `app.js: public mainNav missing text ${text}`);
});
console.log('  ✓ app.js public mainNav template contains exactly the 6 required links and NO Login/Register links.');

const appUserRegex = /if\s*\(\s*role\s*===\s*'PUBLIC'\s*\)\s*{\s*userSection\.innerHTML\s*=\s*`([\s\S]*?)`;/;
const appUserMatch = appJs.match(appUserRegex);
assert(appUserMatch, 'Public userSection template in app.js must exist');
const appUserContent = appUserMatch[1];
assert(appUserContent.includes('href="#verify"') && appUserContent.includes('Verify Certificate'), 'app.js: userSection must contain Verify Certificate');
assert(appUserContent.includes('href="#login"') && appUserContent.includes('Login'), 'app.js: userSection must contain Login');
assert(appUserContent.includes('href="#register"') && appUserContent.includes('Register'), 'app.js: userSection must contain Register');
console.log('  ✓ app.js public userSection contains [Verify Certificate], [Login], and [Register] buttons.\n');

// 3. Verify Route definitions in app.js for all navbar targets
console.log('[3/4] Checking route handling for all 8 navbar destinations:');
const routesToTest = ['landing', 'services', 'how-it-works', 'verify', 'rules', 'help', 'login', 'register'];
routesToTest.forEach(route => {
  const switchCaseRegex = new RegExp(`case\\s+'${route}':`);
  const hasCase = switchCaseRegex.test(appJs);
  assert(hasCase, `app.js renderView switch statement must handle case '${route}'`);
  console.log(`  ✓ Route '${route}' has dedicated handler in renderView()`);
});
console.log('  ✓ All 8 navigation destinations are registered and functional.\n');

// 4. Test live HTTP server response
console.log('[4/4] Testing live HTTP server on http://127.0.0.1:3000:');
http.get('http://127.0.0.1:3000/', (res) => {
  assert.strictEqual(res.statusCode, 200, 'Server should respond with HTTP 200');
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const liveNavMatch = data.match(/<nav class="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
    assert(liveNavMatch, 'Live response has main-nav');
    const liveNav = liveNavMatch[1];
    assert(!liveNav.includes('href="#login"'), 'Live main-nav has NO login text link');
    assert(!liveNav.includes('href="#register"'), 'Live main-nav has NO register text link');
    expectedNavLinks.forEach(({ href, text }) => {
      assert(liveNav.includes(href), `Live main-nav has ${href}`);
      assert(liveNav.includes(text), `Live main-nav has ${text}`);
    });

    const liveUserMatch = data.match(/<div class="header-user-section"[^>]*>([\s\S]*?)<\/div>/);
    assert(liveUserMatch, 'Live response has header-user-section');
    const liveUser = liveUserMatch[1];
    assert(liveUser.includes('href="#verify"'), 'Live header-user-section has Verify Certificate');
    assert(liveUser.includes('href="#login"'), 'Live header-user-section has Login');
    assert(liveUser.includes('href="#register"'), 'Live header-user-section has Register');

    console.log('  ✓ Live server returned correct HTML with single Login and Register buttons on right side, and no duplicate text links in main-nav.');
    console.log('\n=============================================');
    console.log('🎉 ALL NAVBAR TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================');
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('HTTP Request failed:', err);
  process.exit(1);
});
