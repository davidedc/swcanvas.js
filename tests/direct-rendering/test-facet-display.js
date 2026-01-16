// Test facet display integration
// Extends DirectRenderingTestRunner.createTestSections to show parsed test parameters

(function() {
  // Initialize parser
  const testNameParser = new TestNameParser();

  // Store original createTestSections to extend it
  const originalCreateTestSections = DirectRenderingTestRunner.createTestSections;

  // Override createTestSections to add facet parsing
  DirectRenderingTestRunner.createTestSections = function() {
    // Call original method
    const result = originalCreateTestSections.call(this);

    // Add facet information to each test
    DIRECT_RENDERING_TESTS.forEach(test => {
      const section = this.testElements.get(test.name);

      if (section && test.name) {
        // Find the description element
        const descElement = section.querySelector('.test-description');

        if (descElement) {
          // Parse the test filename (add -test.js to match actual filename)
          const filename = test.name + '-test.js';
          const parseResult = testNameParser.parseTestName(filename);

          // Display parsing errors if any
          if (parseResult.errors && parseResult.errors.length > 0) {
            const errorHtml = `<div style="margin-top: 10px; padding: 8px; background-color: #ffebee; border-left: 4px solid #f44336; font-size: 12px; color: #c62828;">
              <strong>Filename Parsing Errors:</strong><br>
              ${parseResult.errors.map(error => `&bull; ${error}`).join('<br>')}
            </div>`;
            descElement.insertAdjacentHTML('afterend', errorHtml);
          }

          // Check if test supports performance testing
          const isPerfTest = test.metadata && test.metadata.performanceTestSupported === true;
          const perfIndicatorHtml = `<div style="margin-top: 8px; padding: 6px 10px; background-color: ${isPerfTest ? '#e8f5e9' : '#fafafa'}; border-left: 3px solid ${isPerfTest ? '#4caf50' : '#bdbdbd'}; font-size: 13px; display: inline-block;">
            <strong>Also a performance test:</strong> ${isPerfTest ? '<span style="color: #2e7d32;">Yes</span>' : '<span style="color: #757575;">No</span>'}
          </div>`;

          const facetHtml = testNameParser.formatFacets(parseResult);
          descElement.insertAdjacentHTML('afterend', facetHtml);
          descElement.insertAdjacentHTML('afterend', perfIndicatorHtml);
        }
      }
    });

    return result;
  };
})();
