# lazi-core-cli

A command management and automation ecosystem combining a powerful CLI tool with a workflow script builder for creating and executing PowerShell and Bash scripts.

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
A CLI tool for composing PowerShell and Bash scripts using JSON workflow definitions with template-based code generation.

**Key Features:**
- 🔀 Dual script support - Generate PowerShell or Bash from the same workflow
- 🔗 Lazi integration - Execute registered commands as workflow steps
- 📋 Execution history and step logging with event tracking
- 🔧 Custom node creation for reusable components
- 💻 Complete CLI for workflow and node management
- 📝 Template engine for code generation
- 🏗️ Build scripts from execution history steps

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- npm or yarn

### Setup

```bash
# Install all dependencies
cd lazi-core-cli
npm install
npm run build
npm link  # Installs globally as 'lazi'

cd ../scriptbuilder
npm install
```

**Script Builder link to Lazi:**
```bash
lazi setup scriptbuilder     # One-time setup (registers scriptbuilder commands)
```

### Usage

**Lazi CLI:**
```bash
lazi add <name> <command>    # Save a command
lazi list                    # List all commands
lazi run <name>              # Execute a saved command
lazi logs -n 10              # View execution history
```

**Script Builder Usage when setup via Lazi:**
```bash
lazi run scriptbuilder-list  # List workflows
lazi run scriptbuilder-run <workflow-name>  # Run a workflow
```

**Script Builder Direct CLI:**
```bash
cd scriptbuilder
node cli.js list             # List workflows
node cli.js create my-workflow -t powershell
node cli.js run my-workflow
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
