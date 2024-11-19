# Run script

execute `node back-to-sc.js && yarn lint && yarn build:packages && yarn depcheck --fix && yarn test -u`
then skip two tests (don't ask me why), in `position.test.tsx`:

- "selected position packing condition dropdown shows all possible options"
- "selected position return reason dropdown shows all possible options"

and then fix the interface in `BlurContainer.tsx` of instant-search-legacy
