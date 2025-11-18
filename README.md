# lazi-core-cli

A command management and automation ecosystem combining a powerful CLI tool and a visual script builder for creating and executing PowerShell and Bash scripts.

## 📦 Components

### [Lazi Core-CLI](./lazi-core-cli/)
A powerful CLI tool to save, manage, and execute your commonly used commands with automatic logging, session tracking, and notes.

**Key Features:**
- 📝 Save commands with descriptive names
- 🔍 Search and filter commands by name, tags, or description
- ⚡ Execute saved commands instantly
- 🎯 Support for parameterized commands with placeholders
- 🏷️ Organize commands with tags
- 📊 Automatic execution logging with session tracking
- 💡 Attach notes to commands and specific executions
- 🔗 Batch execution with `THEN` separator
- 🔌 Preset system for tool integrations

### [Script Builder](./scriptbuilder/)
A visual node-based editor for composing PowerShell and Bash scripts with an interactive canvas interface.

**Key Features:**
- 🎨 Visual canvas with pan/zoom and minimap (powered by React Flow)
- 🔀 Dual script support - Generate PowerShell or Bash from the same workflow
- 🔗 Lazi integration - Access registered commands as nodes
- 🧩 Custom node creation for reusable components
- 📋 Execution history and step logging
- 🎯 28+ built-in operation nodes across multiple categories
- 📝 Live script preview with copy and download
- 💻 Full CLI support for workflow management

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- npm or yarn

### Installation

```bash
# Install all dependencies
cd lazi-core-cli
npm install
npm run build
npm link  # Installs globally as 'lazi'

cd ../scriptbuilder
npm install
```

### Building

**Lazi Core-CLI:**
```bash
cd lazi-core-cli
npm run build        # Compile TypeScript (src/ → bin/)
```

**Script Builder:**
```bash
cd scriptbuilder
npm run build        # Build the application
```

### Usage

**Script Builder via Lazi:**
```bash
lazi setup scriptbuilder     # One-time setup
lazi run scriptbuilder-list  # List workflows
lazi run scriptbuilder-run <workflow-name>  # Run a workflow
```

**Lazi CLI:**
```bash
lazi add <name> <command>    # Save a command
lazi list                    # List all commands
lazi run <name>              # Execute a saved command
lazi search <query>          # Search commands
```

## 📚 Documentation

For detailed documentation on each component, see:
- [Lazi Core-CLI Documentation](./lazi-core-cli/README.md)
- [Script Builder Documentation](./scriptbuilder/README.md)
- [Repository Guidance for Claude](./CLAUDE.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues, questions, or suggestions, please open an issue in the repository.
