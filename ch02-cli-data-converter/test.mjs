// Quick integration test: spawn the CLI and feed it inputs
import { spawn } from "node:child_process";
import { rmSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = join(__dirname, "contacts.csv");

// Clean up previous run
if (existsSync(csvPath)) rmSync(csvPath);

// Use node --import tsx/esm for cross-platform TypeScript execution
const child = spawn(process.execPath, ["--import", "tsx/esm", "index.ts"], {
  cwd: __dirname,
  stdio: ["pipe", "pipe", "pipe"],
});

// Simulate user inputs with small delays (mimics real interactive typing)
const inputs = [
  "",                    // Name:  empty → should re-ask
  "Alice",               // Name:  valid
  "123-456-7890",        // Phone: valid
  "notanemail",          // Email: invalid → should re-ask
  "alice@example.com",   // Email: valid
  "y",                   // Continue? yes
  "Bob",                 // Name:  valid
  "+86 13800138000",     // Phone: valid
  "bob@test.org",        // Email: valid
  "n",                   // Continue? no
];

let i = 0;
const feed = () => {
  if (i < inputs.length) {
    const input = inputs[i++];
    // Small delay so each question() reads exactly one line
    setTimeout(() => {
      child.stdin.write(input + "\n");
      feed();
    }, 50);
  } else {
    child.stdin.end();
  }
};

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
  process.stdout.write(chunk); // echo in real-time
});
child.stderr.on("data", (chunk) => process.stderr.write(chunk));

child.on("close", (code) => {
  console.log("\n─── Exit code:", code, "───");

  // ── Assertions ──
  let passed = 0;
  let failed = 0;

  const check = (label, condition) => {
    if (condition) { passed++; console.log("✅", label); }
    else           { failed++; console.log("❌", label); }
  };

  check("Rejected empty Name",       output.includes("姓名不能为空"));
  check("Rejected invalid Email",    output.includes("邮箱格式必须为"));
  check("Showed success message",    output.includes("联系人已保存"));
  check('Showed "Goodbye!"',         output.includes("再见"));
  check("CSV file exists",           existsSync(csvPath));

  if (existsSync(csvPath)) {
    const csv = readFileSync(csvPath, "utf-8");
    console.log("\n─── contacts.csv contents ───");
    console.log(csv);

    const lines = csv.trim().split("\n");
    check("CSV has header row",       lines[0] === "NAME,PHONE,EMAIL");
    check("CSV has 2 data rows",      lines.length === 3);
    check("Row 1: Alice",             lines[1]?.startsWith("Alice"));
    check("Row 2: Bob",               lines[2]?.startsWith("Bob"));
  }

  console.log(`\n🏁  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
});

// Start feeding after a short delay for tsx to start up
setTimeout(feed, 1200);
