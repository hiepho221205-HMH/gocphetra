async function check() {
  const res = await fetch('https://gocphetra.hiepho-221205.workers.dev');
  const text = await res.text();
  console.log('HTTP Status:', res.status);
  const matches = text.match(/assets\/[a-zA-Z0-9_\-\.]+/g);
  console.log('Production assets:', matches);
  
  // Also check local dist/index.html
  const fs = await import('fs');
  const localHtml = fs.readFileSync('dist/index.html', 'utf8');
  const localMatches = localHtml.match(/assets\/[a-zA-Z0-9_\-\.]+/g);
  console.log('Local dist assets:', localMatches);
}

check().catch(console.error);
