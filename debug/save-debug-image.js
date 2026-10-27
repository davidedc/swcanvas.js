// Writes a debug script's image next to the scripts, in debug/, whatever the
// current directory - so .gitignore's debug/*.png covers it. Returns the path.
const fs = require('fs');
const path = require('path');

module.exports = function saveDebugImage(filename, encodedImage) {
    const filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, Buffer.from(encodedImage));
    return filePath;
};
