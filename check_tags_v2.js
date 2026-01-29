const fs = require('fs');
const path = require('path');

function checkTags(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const stack = [];
    const voidTags = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'video', 'textarea', 'Image']); // Adding Image as it might be self-closing or handled differently

    // Improved regex to handle:
    // 1. Opening tags: <div ...>
    // 2. Closing tags: </div>
    // 3. Self-closing tags: <div ... />
    // 4. Exclude comments: {/* ... */}
    // 5. Exclude strings: "..." or '...'
    // 6. Handle TypeScript generic types: <string> or Array<string>
    
    let inComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        let j = 0;
        while (j < line.length) {
            // Handle strings
            if (!inComment && (line[j] === '"' || line[j] === "'")) {
                if (!inString) {
                    inString = true;
                    stringChar = line[j];
                } else if (line[j] === stringChar && line[j-1] !== '\\') {
                    inString = false;
                }
            }

            if (inString) { j++; continue; }

            // Handle comments
            if (line.slice(j, j + 2) === '/*') inComment = true;
            if (line.slice(j, j + 2) === '*/') { inComment = false; j += 2; continue; }
            if (inComment) { j++; continue; }
            if (line.slice(j, j + 3) === '{/*') { inComment = true; j += 3; continue; }
            if (line.slice(j, j + 2) === '//') break; // Skip rest of line

            // Handle tags
            if (line[j] === '<' && line[j+1] !== ' ' && line[j+1] !== '=') {
                // Check if it's a TypeScript type like Array<string> or something<T>
                const prevPart = line.slice(0, j).trim();
                if (prevPart.endsWith('Array') || /^[A-Z][a-zA-Z0-9]*$/.test(prevPart.split(/\s+/).pop())) {
                    // Likely a type parameter, skip
                    j++;
                    continue;
                }

                if (line[j+1] === '/') {
                    // Closing tag
                    const end = line.indexOf('>', j);
                    if (end !== -1) {
                        const tagName = line.slice(j + 2, end).trim().split(' ')[0];
                        if (stack.length === 0) {
                            console.log(`Unexpected closing tag </${tagName}> at line ${i + 1}`);
                        } else {
                            const last = stack.pop();
                            if (last.name !== tagName) {
                                console.log(`Mismatched tag: expected </${last.name}> (from line ${last.line}), found </${tagName}> at line ${i + 1}`);
                            }
                        }
                        j = end + 1;
                        continue;
                    }
                } else {
                    // Opening or self-closing tag
                    const end = line.indexOf('>', j);
                    if (end !== -1) {
                        const tagContent = line.slice(j + 1, end).trim();
                        if (tagContent.endsWith('/') || voidTags.has(tagContent.split(' ')[0])) {
                            // Self-closing
                        } else {
                            const tagName = tagContent.split(' ')[0];
                            if (tagName && !tagName.startsWith('!')) { // Ignore <!DOCTYPE ...>
                                stack.push({ name: tagName, line: i + 1 });
                            }
                        }
                        j = end + 1;
                        continue;
                    }
                }
            }
            j++;
        }
    }

    while (stack.length > 0) {
        const last = stack.pop();
        console.log(`Unclosed tag <${last.name}> from line ${last.line}`);
    }

    if (stack.length === 0) {
        console.log("No tag mismatches found!");
    }
}

const filePath = process.argv[2];
if (filePath) {
    checkTags(filePath);
} else {
    console.log("Please provide a file path.");
}
