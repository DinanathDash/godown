#!/bin/bash
set -e
run_with_retry() {
  local test_file=$1
  for i in {1..5}; do
    echo "Running $test_file (Attempt $i)..."
    if npx vitest run $test_file; then
      echo "$test_file PASSED!"
      return 0
    else
      echo "$test_file FAILED, retrying in 5s..."
      sleep 5
    fi
  done
  return 1
}

run_with_retry tests/orders.test.ts
run_with_retry tests/rbac.test.ts
run_with_retry tests/transfers.test.ts
