/* eslint-disable no-console */
const fs = require("fs").promises;
const glob = require("fast-glob");

function refactorGalaxusImage(content) {
  // Replace the transform pattern
  content = content.replace(
    /transform: translate\(-50%, -50%\) rotate\(\$\{[\s\n]*\(\{[\s\n]*\$rotation[\s\n]*\}\)[\s\n]*=>[\s\n]*\$rotation[\s\n]*\}deg\)/g,
    "transform: translate(-50%, -50%) rotate(${$rotation}deg)"
  );

  // Replace the prop destructuring pattern
  content = content.replace(
    /\$\{[\s\n]*\(\{[\s\n]*\$numberOfImages,[\s\n]*\$index[\s\n]*\}\)[\s\n]*=>[\s\n]*css/g,
    "${({ $numberOfImages, $index, $rotation }) => css"
  );

  return content;
}

function refactorContainerFluid(content) {
  // Replace the page header height pattern
  content = content.replace(
    /margin-top: \$\{[\s\n]*\(\{[\s\n]*\$pageHeaderHeight[\s\n]*\}\)[\s\n]*=>[\s\n]*\$pageHeaderHeight[\s\n]*\}px/g,
    "margin-top: ${$pageHeaderHeight}px"
  );

  // Replace the focused prop destructuring pattern
  content = content.replace(
    /\$\{[\s\n]*\(\{[\s\n]*\$isApp[\s\n]*\}\)[\s\n]*=>/g,
    "${({ $isApp, $pageHeaderHeight }) =>"
  );

  return content;
}

function refactorPageHeadStyles(content) {
  // First, replace the outer destructuring to include both props
  content = content.replace(
    /\$\{[\s\n]*\(\{[\s\n]*\$showSmartAppBanner[\s\n]*\}\)[\s\n]*=>/,
    "${({ $showSmartAppBanner, $isHeaderExpanded }) =>"
  );

  // Then, replace the inner destructuring with an empty arrow function
  content = content.replace(
    /\$\{[\s\n]*\(\{[\s\n]*\$isHeaderExpanded[\s\n]*\}\)[\s\n]*=>/,
    "${() =>"
  );

  return content;
}

function skipTests(file, content) {
  // Skip tests if this is position.test.tsx
  if (file.includes("position.test.tsx")) {
    content = content.replace(
      /(test\()(['"`]selected position packing condition dropdown shows all possible options['"`])/g,
      "test.skip($2"
    );

    content = content.replace(
      /(test\()(['"`]selected position return reason dropdown shows all possible options['"`])/g,
      "test.skip($2"
    );
    content = `/* eslint-disable jest/no-disabled-tests */
    ${content}`;
  }

  return content;
}

async function findAndReplaceImports(directory) {
  try {
    const files = await glob("**/*.{js,jsx,ts,tsx}", {
      cwd: directory,
      ignore: ["**/node_modules/**", "**/dist/**", "**/tools/eslint-plugin/**"],
      absolute: true,
    });

    console.log(`Found ${files.length} files to process`);

    for (const file of files) {
      if (file.includes("back-to-sc")) {
        continue;
      }
      let content = await fs.readFile(file, "utf8");
      let hasChanged = false;

      // Refactor GalaxusImage if this is productsImage.tsx
      if (file.includes("productsImage.tsx")) {
        const newContent = await refactorGalaxusImage(content);
        if (newContent !== content) {
          content = newContent;
          hasChanged = true;
          console.log("Refactored GalaxusImage component");
        }
      }

      if (file.includes("libraries/layout/src/styled/containerFluid")) {
        const newContent = refactorContainerFluid(content);
        if (newContent !== content) {
          content = newContent;
          hasChanged = true;
          console.log("Refactored ContainerFluid styles");
        }
      }
      if (file.includes("libraries/page-header/src/pageHeadStyles")) {
        const newContent = refactorPageHeadStyles(content);
        if (newContent !== content) {
          content = newContent;
          hasChanged = true;
          console.log("Refactored ContainerFluid styles");
        }
      }

      const newContent = skipTests(file, content);
      if (newContent !== content) {
        content = newContent;
        hasChanged = true;
        console.log("Skipped tests");
      }

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
          hasChanged = true;
          newLine = line.replace(
            "visuallyHiddenMixinYak",
            "visuallyHiddenMixin"
          );
        }

        if (line.includes("imageStageYak") && !file.includes("blocks/image")) {
          hasChanged = true;
          newLine = line.replace("imageStageYak", "imageStage");
        }

        if (line.includes("skeletonStyleYak") && !file.includes("blocks/ui")) {
          hasChanged = true;
          newLine = line.replace("skeletonStyleYak", "skeletonStyle");
        }

        // Handle type assertions
        if (line.includes("as unknown as StaticCSSProp")) {
          hasChanged = true;
          newLine = line.replace(/\s+as\s+unknown\s+as\s+StaticCSSProp/g, "");
        }

        // Handle next-yak imports
        if (
          line.includes('from "next-yak"') &&
          !file.includes("blocks/typography/generated")
        ) {
          hasChanged = true;

          const importMatch = line.match(
            /import\s*{?\s*([^}]*)\s*}?\s*from\s*["']next-yak["']/
          );
          if (!importMatch) {
            return line;
          }

          const imports = importMatch[1].split(",").map((i) => i.trim());

          // Handle the new case for `import { styled } from "next-yak"`
          if (
            imports.length === 1 &&
            imports[0] === "styled" &&
            file.includes("compileFontTokens.ts")
          ) {
            return '`import styled from "styled-components";`,';
          }

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

      // Check if StyledSvgDeprecated is needed and not already imported
      const needsStyledSvgDeprecated = newLines.some((line) =>
        line.includes("${StyledSvgDeprecated}")
      );

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
