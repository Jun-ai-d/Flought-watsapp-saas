const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
    page.on('requestfailed', request => {
      console.log('BROWSER_REQUEST_FAILED:', request.url(), request.failure().errorText);
    });

    console.log("Navigating to http://localhost:5173 ...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 10000 });
    
    // Wait a bit to ensure React mounts and crashes
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
  } catch (err) {
    console.error("PUPPETEER_ERROR:", err.message);
  }
})();
