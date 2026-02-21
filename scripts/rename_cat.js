const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '..', 'public');
const upper = path.join(pub, 'Cat.png');
const lower = path.join(pub, 'cat.png');
const temp = path.join(pub, 'cat-temp.png');

try {
  if (fs.existsSync(upper)) {
    try {
      if (fs.existsSync(lower)) {
        fs.unlinkSync(lower);
      }
      fs.renameSync(upper, temp);
      fs.renameSync(temp, lower);
      console.log('Renamed Cat.png -> cat.png');
      process.exit(0);
    } catch (e) {
      console.error('Rename failed:', e.message);
      process.exit(1);
    }
  } else if (fs.existsSync(lower)) {
    console.log('Already named cat.png');
    process.exit(0);
  } else {
    console.error('Cat.png not found in public folder');
    process.exit(1);
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
