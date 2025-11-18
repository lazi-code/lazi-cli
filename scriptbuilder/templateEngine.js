/**
 * Simple JavaScript version of templateEngine for CLI use
 * Compiles template strings and function strings to generator functions
 */

/**
 * Compiles a template string with {{placeholder}} syntax
 */
export function compileTemplate(template, config, branches) {
  let result = template;

  // Replace {{fieldKey}} with config values
  for (const [key, value] of Object.entries(config)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, String(value ?? ''));
  }

  // Replace {{branches.handleId}} with branch code
  if (branches) {
    for (const [handleId, branchCode] of Object.entries(branches)) {
      const lines = result.split('\n');
      let processedResult = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const placeholderRegex = new RegExp(`\\{\\{branches\\.${handleId}\\}\\}`);

        if (placeholderRegex.test(line)) {
          const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';

          const indentedBranchCode = branchCode
            .split('\n')
            .map((branchLine, idx) => {
              if (idx === 0) return branchLine;
              return leadingWhitespace + branchLine;
            })
            .join('\n');

          processedResult += line.replace(placeholderRegex, indentedBranchCode) + '\n';
        } else {
          processedResult += line + (i < lines.length - 1 ? '\n' : '');
        }
      }

      result = processedResult;
    }
  }

  return result;
}

/**
 * Creates a generator function from a template string
 */
export function createTemplateGenerator(template) {
  return (config, branches) => {
    return compileTemplate(template, config, branches);
  };
}

/**
 * Compiles a function string to a generator function
 */
export function compileFunctionString(functionString) {
  try {
    const trimmed = functionString.trim();

    // Validate it looks like a function
    const isArrowFunction = /^\(.*?\)\s*=>/.test(trimmed) || /^config\s*=>/.test(trimmed);
    const isRegularFunction = /^function\s*\(/.test(trimmed);

    if (!isArrowFunction && !isRegularFunction) {
      throw new Error('Function string must be an arrow function or regular function');
    }

    // Create function using Function constructor
    const generatorFunction = new Function('return ' + functionString)();

    if (typeof generatorFunction !== 'function') {
      throw new Error('Generator must be a function');
    }

    // Wrap to ensure it always returns a string
    return (config, branches) => {
      try {
        const result = generatorFunction(config, branches);
        return String(result ?? '');
      } catch (error) {
        console.error('Error executing generator function:', error);
        return `# Error: ${error.message || 'Unknown error'}`;
      }
    };
  } catch (error) {
    console.error('Error compiling function string:', error);
    return () => `# Error compiling generator: ${error.message || 'Unknown error'}`;
  }
}

/**
 * Auto-detects whether the generator string is a template or function and compiles it
 */
export function compileGenerator(generatorString) {
  const trimmed = generatorString.trim();

  // Check if it's a function string
  const isFunctionString = /^\(.*?\)\s*=>/.test(trimmed) ||
                           /^config\s*=>/.test(trimmed) ||
                           /^function\s*\(/.test(trimmed);

  if (isFunctionString) {
    return compileFunctionString(trimmed);
  } else {
    return createTemplateGenerator(trimmed);
  }
}

/**
 * Generates a default template string based on field definitions
 * Useful for creating starter templates in the UI
 */
export function generateDefaultTemplate(nodeName, fieldKeys, language) {
  const comment = language === 'powershell' ? '#' : '#';

  let template = `${comment} ${nodeName}\n`;

  if (fieldKeys.length > 0) {
    template += fieldKeys.map(key => `{{${key}}}`).join(' ');
  } else {
    template += `${comment} No configuration needed`;
  }

  return template;
}

/**
 * Generates a default function string template
 */
export function generateDefaultFunctionTemplate(nodeName, fieldKeys, language) {
  const comment = language === 'powershell' ? '#' : '#';

  return `(config, branches) => {
  // ${nodeName} - ${language}
  let code = '${comment} ${nodeName}\\n';

  ${fieldKeys.length > 0
    ? `// Use config values\n  ` + fieldKeys.map(key => `// config.${key}`).join('\n  ')
    : '// No configuration fields'
  }

  // For branching nodes, use branches object
  // if (branches?.['handle-id']) {
  //   code += branches['handle-id'];
  // }

  return code;
}`;
}
