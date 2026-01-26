# Copilot Instructions for AgentCopilot Repository

This document provides essential guidance for AI coding agents working in the AgentCopilot repository. Follow these instructions to ensure productive and context-aware contributions.

---

## Project Overview

AgentCopilot is a structured framework for leveraging AI agents in software development workflows. The repository is organized around distinct roles (e.g., Analyst, Architect, Planner, Engineer, QA, Reviewer, Writer), each with specific mandates and workflows. The goal is to minimize cognitive load, avoid role conflicts, and ensure quality through clear separation of concerns.

Key references:
- [Roles Documentation](../docs/ROLES.md)
- [Workflow Guide](../docs/WORKFLOW.md)
- [Role-Specific Prompts](../docs/COPILOT_PROMPTS.md)

---

## Repository Structure

- **`scripts/`**: Contains PowerShell scripts for setup and maintenance. Example: `doctor.ps1` verifies the development environment.
- **`docs/`**: Comprehensive documentation, including roles, workflows, and release notes.
- **`utils/`**: Utility scripts, such as `memory_utils.py`.
- **`tests/`**: Test cases for utilities and other components.
- **`timer.*`**: Core files for the timer feature (HTML, CSS, JS).

---

## Developer Workflows

### Environment Setup
Run the following command to verify your development environment:
```powershell
./scripts/doctor.ps1
```

### Build and Test
- **Build**: Not explicitly defined; ensure dependencies are installed via `npm install`.
- **Test**: Run `npm test` or use the `Test` task in VS Code.
- **Lint**: Run `npm run lint` or use the `Lint` task in VS Code.

### Running the Application
Start the application locally:
```bash
npm start
```
Alternatively, use the `Run` task in VS Code.

---

## Project-Specific Conventions

1. **Role-Based Prompts**: Use the predefined prompts in `.github/prompts/` to guide your contributions. Select the appropriate role and follow its mandate.
2. **Separation of Concerns**: Maintain clear boundaries between code, tests, and documentation.
3. **Minimal Changes**: Focus on the smallest possible change that achieves the desired outcome.

---

## Key Patterns and Examples

- **Timer Feature**: The `timer.html`, `timer.css`, and `timer.js` files demonstrate modular design for a web-based timer.
- **Utility Functions**: See `utils/memory_utils.py` for reusable Python utilities.
- **Testing**: Tests are located in `tests/` and follow Python's `unittest` framework.

---

## External Dependencies

- **Node.js**: Required for running scripts and tasks.
- **PowerShell**: Used for environment setup scripts.
- **Python**: Utilities and tests rely on Python scripts.

---

## Integration Points

- **VS Code Tasks**: Predefined tasks (`Doctor`, `Test`, `Lint`, `Run`) streamline common workflows.
- **Git**: Ensure all changes are committed and pushed via Git.

---

## Additional Notes

- Always refer to the [README.md](../README.md) for a quickstart guide.
- For detailed role mandates, see [docs/ROLES.md](../docs/ROLES.md).
- Follow the [CONTRIBUTING.md](../CONTRIBUTING.md) for best practices and contribution guidelines.

---

By adhering to these instructions, AI agents can make meaningful and context-aware contributions to the AgentCopilot repository.