# Run script

execute `node back-to-sc.js && yarn build:packages && yarn depcheck --fix`

we could delete several steps from the pipeline to make it even easier:

- no lint checks
- no tests
- no depcheck
- no build:packages check

but then our script needs to build the typography package explicitly to switch typography back to SC
