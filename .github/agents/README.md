# GitHub Copilot Agents Configuration

This directory contains specialized agent configurations for the inlinr project. Each agent is responsible for specific aspects of the development workflow.

## Available Agents

### 1. Code Formatter Agent (`code-formatter.md`)
**Purpose**: Ensures all code follows consistent formatting standards using Prettier

**When to use**:
- Before committing any code changes
- When formatting issues are detected in CI
- To maintain code consistency across the project

**Key responsibilities**:
- Run Prettier on all files
- Verify formatting compliance
- Enforce project style guidelines

---

### 2. Test Writer Agent (`test-writer.md`)
**Purpose**: Writes comprehensive unit tests for new and existing functionality

**When to use**:
- When adding new functions or features
- To improve test coverage
- When bugs are found that lack test coverage

**Key responsibilities**:
- Write unit tests following project patterns
- Cover success, error, and edge cases
- Ensure all tests pass

---

### 3. Code Reviewer Agent (`code-reviewer.md`)
**Purpose**: Reviews code changes for quality, correctness, and adherence to standards

**When to use**:
- Before merging pull requests
- During code reviews
- To ensure quality standards

**Key responsibilities**:
- Check code quality and style
- Verify test coverage
- Ensure security best practices
- Validate type safety

---

### 4. Dependency Manager Agent (`dependency-manager.md`)
**Purpose**: Manages project dependencies safely and keeps them up to date

**When to use**:
- When adding new dependencies
- During dependency updates
- To audit security vulnerabilities

**Key responsibilities**:
- Add/update dependencies safely
- Check for security vulnerabilities
- Maintain lock file integrity
- Document dependency decisions

---

## How to Use Agents

### Option 1: Direct Reference
Reference an agent by mentioning their role in your request:
```
@copilot using the Test Writer agent, add tests for the fetchAndProcessEmails function
```

### Option 2: Workflow-Based
Follow the standard development workflow which automatically involves the appropriate agents:

1. **Development Phase**: Write code following project standards
2. **Formatting Phase**: Code Formatter agent ensures style compliance
3. **Testing Phase**: Test Writer agent adds comprehensive tests
4. **Review Phase**: Code Reviewer agent validates changes
5. **Dependency Phase**: Dependency Manager agent handles package updates

## Development Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     Development Cycle                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Write Code      │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Format Code     │ ◄── Code Formatter Agent
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Add Tests       │ ◄── Test Writer Agent
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Run Checks      │
                    │  - format:check  │
                    │  - type-check    │
                    │  - lint          │
                    │  - test:unit     │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Code Review     │ ◄── Code Reviewer Agent
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Merge           │
                    └──────────────────┘
```

## Quality Standards

All agents enforce these non-negotiable standards:

1. ✅ **Code must be formatted with Prettier** - Run `pnpm run format`
2. ✅ **All new code must have unit tests** - Follow existing test patterns
3. ✅ **No linting errors** - Must pass `pnpm run lint`
4. ✅ **Type-safe** - Must pass `pnpm run type-check`
5. ✅ **All tests pass** - Must pass `pnpm run test:unit`

## CI/CD Integration

The CI workflow (`.github/workflows/ci.yml`) enforces these standards:

```yaml
- Format check (Prettier)
- Type check (TypeScript)
- Lint (ESLint)
- Unit tests (Vitest)
```

Dependency caching is configured for optimal performance using pnpm.

## Notes

- Each agent file (`.md`) contains detailed instructions for that agent's role
- Agents work together to maintain code quality
- The workflow ensures consistency and reliability
- All agents follow the project's tech stack and conventions
