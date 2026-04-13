# env

## Overview

Typed access to Vite environment variables. Exports a single `ENV` object with `mode`, `dev`, and `prod` fields.

## Usage

Components and services should import from here rather than reading `import.meta.env` directly — keeps env access consistent and testable.
