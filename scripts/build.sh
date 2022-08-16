#!/bin/bash

set -e

watch=""
if [ "$1" == "watch" ]; then
    watch="--watch"
fi

for x in `ls packages/`; do
  babel $watch \
    --ignore '**/*.test.ts' \
    -x '.js,.jsx,.es6,.es,.mjs,.cjs,.ts,.tsx' \
    --source-maps true \
    ./packages/$x/src \
    --out-dir ./packages/$x/dist &
done

for job in `jobs -p`
do
    wait $job
done
