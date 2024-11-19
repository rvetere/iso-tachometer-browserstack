/* eslint-disable no-console */
const fs = require("fs").promises;
const glob = require("fast-glob");

async function findAndReplaceImports(directory) {
  try {
    const files = await glob("**/*.{js,jsx,ts,tsx}", {
      cwd: directory,
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/*.test.tsx",
        "**/*.test.ts",
      ],
      absolute: true,
    });

    console.log(`Found ${files.length} files to process`);

    for (const file of files) {
      if (file.includes("back-to-sc")) {
        continue;
      }
      let content = await fs.readFile(file, "utf8");
      let hasChanged = false;

      // Handle complete content replacements first
      if (file.includes("baseLinkStyles")) {
        const typeBlockRegex =
          /type\s+StaticCSSProp\s*=\s*{\s*className:\s*string;\s*style\?:\s*CSSProperties;\s*};/g;
        const typeAssertionRegex = /\s+as\s+unknown\s+as\s+StaticCSSProp/g;

        if (
          content.match(typeBlockRegex) ||
          content.match(typeAssertionRegex)
        ) {
          if (content.match(typeBlockRegex)) {
            content = content.replace(typeBlockRegex, "");
            console.log(`Removed StaticCSSProp type from: ${file}`);
            hasChanged = true;
          }
          if (content.match(typeAssertionRegex)) {
            content = content.replace(typeAssertionRegex, "");
            console.log(`Removed StaticCSSProp type assertions from: ${file}`);
            hasChanged = true;
          }
        }
      }

      // Process remaining replacements line by line
      const lines = content.split("\n");
      const newLines = lines.map((line) => {
        let newLine = line;

        if (
          line.includes("visuallyHiddenMixinYak") &&
          !file.includes("blocks/theme")
        ) {
          // just replace visuallyHiddenMixinYak with visuallyHiddenMixin
          hasChanged = true;
          newLine = line.replace(
            "visuallyHiddenMixinYak",
            "visuallyHiddenMixin"
          );
        }

        // Handle type assertions
        if (line.includes("as unknown as StaticCSSProp")) {
          hasChanged = true;
          newLine = line.replace(/\s+as\s+unknown\s+as\s+StaticCSSProp/g, "");
        }

        // Handle next-yak imports
        if (line.includes('from "next-yak"')) {
          hasChanged = true;

          const importMatch = line.match(
            /import\s*{?\s*([^}]*)\s*}?\s*from\s*["']next-yak["']/
          );
          if (!importMatch) {
            return line;
          }

          const imports = importMatch[1].split(",").map((i) => i.trim());

          if (imports.length === 1) {
            if (imports[0] === "styled") {
              return 'import styled from "styled-components";';
            } else if (imports[0] === "css") {
              return 'import { css } from "styled-components";';
            }
          } else if (
            imports.length === 2 &&
            imports.includes("styled") &&
            imports.includes("css")
          ) {
            return 'import styled, { css } from "styled-components";';
          }
        }

        // Handle StyledSvg imports
        if (
          line.includes('StyledSvg"') &&
          line.includes('from "@blocks/icons"')
        ) {
          hasChanged = true;
          return line.replace('StyledSvg"', 'StyledSvgDeprecated"');
        }

        // Handle StyledSvg in template literals
        if (line.includes("${StyledSvg}")) {
          hasChanged = true;
          newLine = line.replace(
            /\$\{StyledSvg\}\s*([{,])/g,
            "${StyledSvgDeprecated}$1"
          );
        }

        return newLine;
      });

      // Check if StyledSvgDeprecated is actually needed and not already imported
      const needsStyledSvgDeprecated = newLines.some((line) =>
        line.includes("${StyledSvgDeprecated}")
      );

      // More thorough check for existing import, including multi-line imports
      const hasStyledSvgDeprecatedImport = (() => {
        let insideIconsImport = false;
        for (const line of newLines) {
          const trimmedLine = line.trim();

          if (
            trimmedLine.includes("StyledSvgDeprecated") &&
            trimmedLine.includes('from "@blocks/icons"')
          ) {
            return true;
          }

          if (
            trimmedLine.startsWith("import {") &&
            !trimmedLine.includes("} from") &&
            line.includes("@blocks/icons")
          ) {
            insideIconsImport = true;
            if (trimmedLine.includes("StyledSvgDeprecated")) {
              return true;
            }
            continue;
          }

          if (insideIconsImport && !trimmedLine.includes("} from")) {
            if (trimmedLine.includes("StyledSvgDeprecated")) {
              return true;
            }
            continue;
          }

          if (insideIconsImport && trimmedLine.includes("} from")) {
            insideIconsImport = false;
            if (trimmedLine.includes("StyledSvgDeprecated")) {
              return true;
            }
          }
        }
        return false;
      })();

      if (needsStyledSvgDeprecated && !hasStyledSvgDeprecatedImport) {
        let lastImportIndex = -1;
        let insideMultilineImport = false;

        for (let i = 0; i < newLines.length; i++) {
          const line = newLines[i].trim();

          if (line.startsWith("import {") && !line.includes("} from")) {
            insideMultilineImport = true;
            lastImportIndex = i;
            continue;
          }

          if (insideMultilineImport && line.includes("} from")) {
            insideMultilineImport = false;
            lastImportIndex = i;
            continue;
          }

          if (line.startsWith("import ") && line.includes(" from ")) {
            lastImportIndex = i;
          }
        }

        if (lastImportIndex !== -1) {
          newLines.splice(
            lastImportIndex + 1,
            0,
            'import { StyledSvgDeprecated } from "@blocks/icons";'
          );
          hasChanged = true;
        }
      }

      if (hasChanged) {
        const newContent = newLines.join("\n");
        await fs.writeFile(file, newContent, "utf8");
        console.log(`Updated imports/selectors in: ${file}`);
      }
    }

    console.log("Replacement completed successfully!");
  } catch (error) {
    console.error("Error processing files:", error);
  }
}

// Get the directory path from command line argument or use current directory
const targetDirectory = process.argv[2] || process.cwd();

// Run the script
findAndReplaceImports(targetDirectory);
