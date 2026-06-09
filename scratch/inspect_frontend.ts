import fs from 'fs';
import path from 'path';

const htmlPath = 'C:\\Users\\Amit pandey\\Desktop\\Fruits\\sun-cured-savories.html';
if (fs.existsSync(htmlPath)) {
  const content = fs.readFileSync(htmlPath, 'utf8');
  console.log('File size:', content.length, 'characters');
  
  // Let's find script tags
  const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
  let match;
  let count = 0;
  while ((match = scriptRegex.exec(content)) !== null) {
    count++;
    console.log(`\n--- Script Tag ${count} (Length: ${match[1].length}) ---`);
    if (match[1].length < 1500) {
      console.log(match[1]);
    } else {
      console.log(match[1].substring(0, 1000) + '\n... TRUNCATED ...\n' + match[1].substring(match[1].length - 500));
    }
  }
} else {
  console.log('File does not exist at path:', htmlPath);
}
