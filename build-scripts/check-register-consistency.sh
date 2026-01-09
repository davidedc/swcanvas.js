#!/bin/sh
#
# This script checks all test files (ending with "-test.js")
# to ensure their registerDirectRenderingTest call has the correct filename
# as the first parameter.
#
# It verifies that the first parameter in the registerDirectRenderingTest() call
# matches the actual filename of the test (without the .js extension).
#
# This is a read-only script and does not modify any files.
#
# Usage:
#   sh build-scripts/check-register-consistency.sh
#

set -e

# --- Configuration ---
TEST_CASE_DIR="tests/direct-rendering/cases"

# --- Script Logic ---
echo "Checking registerDirectRenderingTest consistency for test files..."
echo ""

# Find all files that follow the naming convention (ending with "-test.js")
TEST_FILES=$(find "$TEST_CASE_DIR" -type f -name '*-test.js')

if [ -z "$TEST_FILES" ]; then
  echo "No test files following the naming convention (*-test.js) were found."
  exit 0
fi

errors_found=0
files_checked=0

for file_path in $TEST_FILES; do
  files_checked=$((files_checked + 1))
  actual_filename=$(basename "$file_path")
  # SWCanvas uses test name without .js extension
  actual_filename_no_ext=$(echo "$actual_filename" | sed 's/\.js$//')

  # Extract the first parameter from registerDirectRenderingTest call
  # Use a more robust approach that can handle multi-line calls
  # First, find the line with registerDirectRenderingTest, then look for the quoted string in the following lines
  registered_filename=""

  # Find line number of registerDirectRenderingTest
  register_line=$(grep -n "registerDirectRenderingTest" "$file_path" | head -n 1 | cut -d: -f1 || true)

  if [ -n "$register_line" ]; then
    # Look at the next few lines after registerDirectRenderingTest to find the first quoted string
    registered_filename=$(sed -n "${register_line},$(($register_line + 5))p" "$file_path" | grep -o "['\"][^'\"]*['\"]" | head -n 1 | sed "s/['\"]//g" || true)
  fi

  # SWCanvas convention: registered name is without -test suffix
  # e.g., file: arc-sgl-szMix-fOpaq-test.js -> registered: arc-sgl-szMix-fOpaq
  actual_without_test=$(echo "$actual_filename_no_ext" | sed 's/-test$//')

  if [ -z "$registered_filename" ]; then
    echo "[ERROR]   $file_path"
    echo "  - Cannot find registerDirectRenderingTest call or extract filename parameter."
    errors_found=$((errors_found + 1))
  elif [ "$registered_filename" = "$actual_filename_no_ext" ]; then
    echo "[OK]      $file_path"
  elif [ "$registered_filename" = "$actual_filename" ]; then
    # Also accept with .js extension
    echo "[OK]      $file_path"
  elif [ "$registered_filename" = "$actual_without_test" ]; then
    # Accept registration without -test suffix (SWCanvas convention)
    echo "[OK]      $file_path"
  else
    echo "[MISMATCH] $file_path"
    echo "  - Actual filename:     '$actual_filename_no_ext'"
    echo "  - Registered filename: '$registered_filename'"
    echo "  - Expected one of: '$actual_filename_no_ext', '$actual_without_test'"
    errors_found=$((errors_found + 1))
  fi
done

echo ""
echo "--------------------------------------------------"
echo "Check complete. Scanned $files_checked file(s)."

if [ "$errors_found" -eq 0 ]; then
  echo "All test files have consistent registerDirectRenderingTest parameters."
else
  echo "Found $errors_found issue(s). Please fix the file(s) listed above."
  exit 1
fi
