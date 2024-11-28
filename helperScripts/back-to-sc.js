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
  if (content.includes("styled-components")) {
    return content;
  }

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

// function skipTests(file, content) {
//   // Skip tests if this is position.test.tsx
//   if (file.includes("position.test.tsx")) {
//     content = content.replace(
//       /(test\()(['"`]selected position packing condition dropdown shows all possible options['"`])/g,
//       "test.skip($2"
//     );

//     content = content.replace(
//       /(test\()(['"`]selected position return reason dropdown shows all possible options['"`])/g,
//       "test.skip($2"
//     );
//     content = `/* eslint-disable jest/no-disabled-tests */
//     ${content}`;
//   }

//   // Skip tests in overviewFilter.tracking.test
//   if (file.includes("overviewFilter.tracking.test")) {
//     // Add eslint disable comment at the top
//     if (!content.includes("/* eslint-disable jest/no-disabled-tests */")) {
//       content = `/* eslint-disable jest/no-disabled-tests */
// ${content}`;
//     }

//     // Replace it.each with it.skip.each
//     content = content.replace(/it\.each/g, "it.skip.each");
//   }

//   return content;
// }

function refactorTextLinesLimiter(content) {
  // Match the old TextLinesLimiter pattern
  const oldPattern =
    /export\s+const\s+TextLinesLimiter\s*=\s*styled\(HtmlTag\)<ITextLinesLimiterProps>\s*`\s*overflow-wrap:\s*break-word;\s*\$\{\s*\(\{\s*\$skip\s*=\s*false\s*\}\)\s*=>\s*!\$skip\s*&&\s*css`[\s\S]*?`\s*\}\s*`/;

  // The new replacement pattern
  const newPattern = `export const TextLinesLimiter = styled(HtmlTag)<ITextLinesLimiterProps>\`
  overflow-wrap: break-word;

  \${({ $lines, $skip = false }) =>
    !$skip
      ? css\`
          display: -webkit-box;
          -webkit-box-orient: vertical;
          overflow: hidden;

          \${() => {
            if (typeof $lines === "number") {
              return css\`
                -webkit-line-clamp: \${$lines};
                line-clamp: \${$lines};
              \`;
            } else {
              return css\`
                -webkit-line-clamp: \${$lines.mobile};
                line-clamp: \${$lines.mobile};

                \${screenRangeQueries.tabletDesktopWidescreen} {
                  -webkit-line-clamp: \${$lines.desktop};
                  line-clamp: \${$lines.desktop};
                }
              \`;
            }
          }}
        \`
      : ""}\`;`;

  // Replace the pattern
  return content.replace(oldPattern, newPattern);
}

async function findAndReplaceImports(directory) {
  try {
    const files = await glob("**/*.{js,jsx,ts,tsx}", {
      cwd: directory,
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/tools/eslint-plugin/**",
        "**/demo-studio/**",
        "**/typedocs/**",
        "**/typedocs-proptable-mapper/**",
      ],
      absolute: true,
    });

    console.log(`Found ${files.length} files to process`);

    for (const file of files) {
      if (
        file.includes("back-to-sc") ||
        file.includes("getTheme") ||
        file.includes("themeProvider")
      ) {
        continue;
      }
      let content = await fs.readFile(file, "utf8");
      let hasChanged = false;

      // Add TextLinesLimiter refactoring
      if (file.includes("textLinesLimiter.tsx")) {
        const newContent = refactorTextLinesLimiter(content);
        if (newContent !== content) {
          content = newContent;
          hasChanged = true;
          console.log("Refactored TextLinesLimiter component");
        }
      }

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
          console.log("Refactored PageHead styles");
        }
      }

      // const newContent = skipTests(file, content);
      // if (newContent !== content) {
      //   content = newContent;
      //   hasChanged = true;
      //   console.log("Skipped tests");
      // }

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

          // Special case for compileFontTokens.ts
          if (file.includes("compileFontTokens.ts")) {
            if (imports.length === 1 && imports[0] === "styled") {
              return '`import styled from "styled-components";`,';
            }
          }

          // Handle various import combinations
          if (imports.includes("styled")) {
            const otherImports = imports
              .filter((i) => i !== "styled")
              .filter(Boolean);

            if (otherImports.length === 0) {
              return 'import styled from "styled-components";';
            } else {
              return `import styled, { ${otherImports.join(
                ", "
              )} } from "styled-components";`;
            }
          } else {
            // Handle cases without styled
            return `import { ${imports.join(", ")} } from "styled-components";`;
          }
        }

        return newLine;
      });

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
