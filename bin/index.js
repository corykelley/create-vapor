#! /usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const ora = require("ora");

// Parse command line arguments
const args = process.argv.slice(2);
const helpFlag = args.includes("--help") || args.includes("-h");

if (helpFlag) {
  console.log(`
  Vapor 🧪

  Usage:
    npx create-vapor [theme-name] [options]

  Options:
    --help, -h          Show this help message
    --store, -s         Specify Shopify store URL (e.g., yourstore.myshopify.com)
    --git, -g           Initialize git repository (true/false)
    --install, -i       Install dependencies (true/false)
    --non-interactive   Run in non-interactive mode (requires theme-name)

  Example:
    npx create-vapor my-theme --store=mystore.myshopify.com --git=true --install=true
  `);
  process.exit(0);
}

// Check for non-interactive mode
const nonInteractive = args.includes("--non-interactive");
let themeName = args[0];
let storeUrl = "";
let initGit = true;
let installDeps = true;

// Parse other arguments for non-interactive mode
if (nonInteractive) {
  if (!themeName) {
    console.error("Error: Theme name is required in non-interactive mode");
    process.exit(1);
  }

  args.forEach((arg) => {
    if (arg.startsWith("--store=") || arg.startsWith("-s=")) {
      storeUrl = arg.split("=")[1];
    } else if (arg.startsWith("--git=") || arg.startsWith("-g=")) {
      initGit = arg.split("=")[1].toLowerCase() === "true";
    } else if (arg.startsWith("--install=") || arg.startsWith("-i=")) {
      installDeps = arg.split("=")[1].toLowerCase() === "true";
    }
  });

  // Validate store URL in non-interactive mode
  if (storeUrl && !storeUrl.endsWith(".myshopify.com")) {
    console.error("Error: Store URL must end with .myshopify.com");
    process.exit(1);
  }
} else {
  // Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    return new Promise(async (resolve) => {
      // Prompt 1: Theme name
      const promptThemeName = () => {
        return new Promise((resolveThemeName) => {
          rl.question(
            "What would you like to name your theme? (default: shopify-custom-theme): ",
            (answer) => {
              themeName = answer.trim() || "shopify-custom-theme";
              resolveThemeName();
            }
          );
        });
      };

      // Prompt 2: Store URL
      const promptStoreUrl = () => {
        return new Promise((resolveStoreUrl) => {
          rl.question(
            "What is your Shopify store URL? (yourstore.myshopify.com): ",
            (answer) => {
              const url = answer.trim();
              if (url && !url.endsWith(".myshopify.com")) {
                console.log(
                  "Store URL must end with .myshopify.com. Please try again."
                );
                return promptStoreUrl().then(resolveStoreUrl);
              }
              storeUrl = url || "example-store.myshopify.com";
              resolveStoreUrl();
            }
          );
        });
      };

      // Prompt 3: Git initialization
      const promptGitInit = () => {
        return new Promise((resolveGitInit) => {
          rl.question(
            "Would you like to initialize a git repository? (Y/n): ",
            (answer) => {
              initGit = answer.trim().toLowerCase() !== "n";
              resolveGitInit();
            }
          );
        });
      };

      // Prompt 4: Install dependencies
      const promptInstallDeps = () => {
        return new Promise((resolveInstallDeps) => {
          rl.question(
            "Would you like to install dependencies now? (Y/n): ",
            (answer) => {
              installDeps = answer.trim().toLowerCase() !== "n";
              resolveInstallDeps();
            }
          );
        });
      };

      await promptThemeName();
      await promptStoreUrl();
      await promptGitInit();
      await promptInstallDeps();

      rl.close();
      resolve();
    });
  };

  await promptUser();
}

// Create directory if it doesn't exist
if (!fs.existsSync(themeName)) {
  fs.mkdirSync(themeName);
}

// Function to run commands with error handling
const runCommand = (command, errorMessage) => {
  try {
    execSync(command, { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(`${errorMessage}:`, error.message);
    return false;
  }
};

// Clone repository
console.log(`✨ Creating a new Shopify theme called ${themeName}...`);
const spinner = ora("Cloning repository...").start();

const gitCheckoutCommand = `git clone -b add-accelerator git@github.com:ehousestudio/ehouse-starter-repo.git ${themeName}`;
const success = runCommand(gitCheckoutCommand, "Failed to checkout the repo");

if (!success) {
  spinner.fail("Failed to clone repository");
  process.exit(1);
}

spinner.succeed("Repository cloned successfully");

// Update README and package.json
spinner.text = "Updating project files...";
spinner.start();

try {
  // Update README
  const readmePath = path.join(process.cwd(), themeName, "README.md");
  if (fs.existsSync(readmePath)) {
    let readmeContent = fs.readFileSync(readmePath, "utf8");
    readmeContent = readmeContent.replace(/# .*/, `# ${themeName}`);
    fs.writeFileSync(readmePath, readmeContent);
  }

  // Update package.json
  const packagePath = path.join(process.cwd(), themeName, "package.json");
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    packageJson.name = themeName;

    // Add store URL to package.json if provided
    if (storeUrl) {
      if (!packageJson.config) {
        packageJson.config = {};
      }
      packageJson.config.shopifyStore = storeUrl;
    }

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  }

  spinner.succeed("Project files updated successfully");
} catch (error) {
  spinner.fail(`Failed to update project files: ${error.message}`);
}

// Initialize git repository if selected
if (initGit) {
  spinner.text = "Initializing git repository...";
  spinner.start();

  // Remove existing .git directory
  const gitDir = path.join(process.cwd(), themeName, ".git");
  if (fs.existsSync(gitDir)) {
    if (process.platform === "win32") {
      execSync(`rmdir /s /q "${gitDir}"`, { stdio: "ignore" });
    } else {
      execSync(`rm -rf "${gitDir}"`, { stdio: "ignore" });
    }
  }

  // Initialize new git repository
  const gitInitCommand = `cd ${themeName} && git init && git add . && git commit -m "Initial commit"`;
  if (runCommand(gitInitCommand, "Failed to initialize git repository")) {
    spinner.succeed("Git repository initialized successfully");
  } else {
    spinner.fail("Failed to initialize git repository");
  }
}

// Install dependencies if selected
if (installDeps) {
  spinner.text = "Installing dependencies...";
  spinner.start();

  const installCommand = `cd ${themeName} && npm install`;
  if (runCommand(installCommand, "Failed to install dependencies")) {
    spinner.succeed("Dependencies installed successfully");
  } else {
    spinner.fail("Failed to install dependencies");
  }
}

// Display completion message
console.log(
  `\n🎉 Success! Created ${themeName} at ${process.cwd()}/${themeName}`
);
console.log("\nInside that directory, you can run several commands:");
console.log("  npm run dev     - Start development server");
console.log("  npm run build   - Build for production");
console.log("\nWe suggest that you begin by typing:");
console.log(`  cd ${themeName}`);
if (!installDeps) {
  console.log("  npm install");
}
console.log("  npm run dev\n");
console.log(`Happy coding! 🚀\n`);
