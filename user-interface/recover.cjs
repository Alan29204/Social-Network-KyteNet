const fs = require('fs');
const path = require('path');

const logFile = "C:\\Users\\Dell\\.gemini\\antigravity-ide\\brain\\dc0574df-5676-41dc-b5d5-164286089429\\.system_generated\\logs\\transcript.jsonl";
const outFile = "c:\\Users\\Dell\\Desktop\\DATN\\social-network-cnet\\user-interface\\src\\features\\chats\\pages\\messages-page.tsx";

let lines_1_800 = "";
let lines_801_1600 = "";
let lines_1601_1847 = "";

const fileContent = fs.readFileSync(logFile, 'utf-8');
const lines = fileContent.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    const content = data.content || "";
    if (content.includes("Showing lines 1 to 800")) {
      lines_1_800 = content;
    } else if (content.includes("Showing lines 801 to 1600")) {
      lines_801_1600 = content;
    } else if (content.includes("Showing lines 1601 to 1847")) {
      lines_1601_1847 = content;
    }
  } catch (e) {
    // Ignore parse errors
  }
}

function cleanLines(text) {
  const result = [];
  const textLines = text.split('\n');
  for (const line of textLines) {
    const match = line.match(/^\s*(\d+):\s(.*)/);
    if (match) {
      result.push(match[2]);
    }
  }
  return result;
}

const cleaned_1 = cleanLines(lines_1_800);
const cleaned_2 = cleanLines(lines_801_1600);
const cleaned_3 = cleanLines(lines_1601_1847);

console.log(`Read ${cleaned_1.length} + ${cleaned_2.length} + ${cleaned_3.length} lines`);

if (cleaned_1.length > 0 && cleaned_2.length > 0 && cleaned_3.length > 0) {
  const fullContent = [...cleaned_1, ...cleaned_2, ...cleaned_3].join('\n');
  fs.writeFileSync(outFile, fullContent, 'utf-8');
  console.log("Successfully recovered the file!");
} else {
  console.log("Failed to find some chunks.");
}
