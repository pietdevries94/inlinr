# Development Workflow with Agents

This document describes the standard development workflow using GitHub Copilot agents for the inlinr project.

## Quick Start

For any development task, follow these steps:

### 1. Setup (First Time)
```bash
# Install dependencies
pnpm install

# Verify everything works
pnpm run format:check
pnpm run type-check
pnpm run lint
pnpm run test:unit
```

### 2. Development Cycle

#### Step 1: Make Changes
Write your code following TypeScript and Vue.js best practices.

#### Step 2: Format Code (Code Formatter Agent)
```bash
# Auto-format all files
pnpm run format

# Verify formatting
pnpm run format:check
```

#### Step 3: Add Tests (Test Writer Agent)
- Add unit tests for all new functions
- Follow existing test patterns in `src/domain/synchronizer/gmail/fetchAndProcessLabels.spec.ts`
- Cover success, error, and edge cases

```bash
# Run tests
pnpm run test:unit

# Run tests in watch mode during development
pnpm run test:unit -- --watch
```

#### Step 4: Validate (Code Reviewer Agent)
Run all quality checks:

```bash
# Check everything
pnpm run format:check  # Formatting
pnpm run type-check    # TypeScript
pnpm run lint          # ESLint
pnpm run test:unit     # Tests
```

Or run them all at once:
```bash
pnpm run format:check && pnpm run type-check && pnpm run lint && pnpm run test:unit
```

#### Step 5: Commit
Once all checks pass, commit your changes.

## Agent Responsibilities

### Before Committing Code

**Code Formatter Agent** ensures:
- ✅ All files formatted with Prettier
- ✅ Consistent code style
- ✅ No formatting errors

**Test Writer Agent** ensures:
- ✅ All new functions have unit tests
- ✅ Tests cover edge cases
- ✅ All tests pass

**Code Reviewer Agent** ensures:
- ✅ Code quality meets standards
- ✅ No type errors
- ✅ No linting issues
- ✅ Test coverage is adequate

### When Adding Dependencies

**Dependency Manager Agent** ensures:
- ✅ Dependencies are necessary
- ✅ No security vulnerabilities
- ✅ Lock file is updated correctly
- ✅ Compatible with existing packages

## Common Tasks

### Adding a New Feature

1. Write the feature code
2. **Code Formatter Agent**: Format the code
3. **Test Writer Agent**: Add comprehensive tests
4. **Code Reviewer Agent**: Validate quality
5. Commit changes

### Fixing a Bug

1. Write a failing test that reproduces the bug
2. Fix the bug
3. **Code Formatter Agent**: Format the code
4. Verify the test now passes
5. **Code Reviewer Agent**: Validate the fix
6. Commit changes

### Refactoring Code

1. Ensure existing tests pass
2. Make refactoring changes
3. **Code Formatter Agent**: Format the code
4. **Test Writer Agent**: Update or add tests if needed
5. **Code Reviewer Agent**: Validate changes
6. Verify all tests still pass
7. Commit changes

### Updating Dependencies

1. **Dependency Manager Agent**: Check for updates
2. Update dependencies
3. Run all tests
4. Check for breaking changes
5. Update code if necessary
6. **Code Reviewer Agent**: Validate changes
7. Commit lock file changes

## CI/CD Pipeline

The CI workflow runs automatically on push and pull requests:

```yaml
name: CI
on: [push, pull_request]

jobs:
  ci:
    - Install dependencies (with caching)
    - Check format (Prettier)
    - Type check (TypeScript)
    - Lint (ESLint)
    - Run tests (Vitest)
```

All checks must pass before merging.

## Best Practices

### Code Quality
- Write clear, self-documenting code
- Use TypeScript types effectively
- Follow Vue 3 Composition API patterns
- Keep functions small and focused
- Avoid code duplication

### Testing
- Test behavior, not implementation
- Use descriptive test names
- Mock external dependencies
- Keep tests isolated
- Aim for good coverage, not just high numbers

### Git Commits
- Make small, focused commits
- Write clear commit messages
- Commit after each complete feature/fix
- Always ensure tests pass before committing

### Performance
- Minimize re-renders in Vue components
- Use computed properties appropriately
- Optimize database queries
- Be mindful of bundle size

## Tools & Commands Reference

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm run format` | Format code with Prettier |
| `pnpm run format:check` | Check code formatting |
| `pnpm run type-check` | Check TypeScript types |
| `pnpm run lint` | Lint code with ESLint |
| `pnpm run test:unit` | Run unit tests |
| `pnpm run test:unit -- --watch` | Run tests in watch mode |

## Getting Help

- Check agent documentation in `.github/agents/`
- Review existing code for patterns
- Consult project documentation
- Ask specific questions about implementation

## Project-Specific Notes

### Tech Stack
- **Frontend**: Vue 3 (Composition API)
- **Styling**: Tailwind CSS
- **Database**: PGlite (embedded PostgreSQL)
- **Query Builder**: Kysely
- **Testing**: Vitest
- **Build Tool**: Vite
- **Package Manager**: pnpm

### Code Organization
- `src/components/` - Vue components
- `src/composables/` - Reusable composition functions
- `src/data/` - Data layer (database, API clients)
- `src/domain/` - Business logic
- `src/pages/` - Page components
- `src/utils/` - Utility functions

### Testing Strategy
- Unit tests for utilities and domain logic
- Component tests for Vue components
- Integration tests for data layer
- Mock external dependencies (Gmail API, etc.)
