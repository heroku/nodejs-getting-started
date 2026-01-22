# Gitleaks Secret Scanning Pipeline (GitHub Actions)

This document explains how **Gitleaks** is integrated into our CI/CD pipeline using **GitHub Actions** to detect hard-coded secrets early in the development lifecycle.

---

## What is Gitleaks?

**Gitleaks** is a secret scanning tool used to detect sensitive information such as:
- AWS access keys
- GitHub tokens
- API keys
- Database passwords

It helps prevent accidental secret leaks into source code repositories.

---

## Why Use Gitleaks in CI/CD?

- Detect secrets **before merge**
- Block insecure code automatically
- Enforce **Shift-Left Security**
- Reduce risk of credential compromise

---

## Pipeline Overview

The pipeline runs:
- On every **push**
- On every **pull request**

If a secret is detected:
- ❌ Pipeline fails
- ❌ Pull request is blocked

If no secrets are found:
- Pipeline passes

---

## Gitleaks GitHub Actions Workflow

```yaml
name: Gitleaks Secret Scan

on:
  push:
  pull_request:

jobs:
  gitleaks:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Gitleaks (full scan)
        uses: gitleaks/gitleaks-action@v2
        with:
          args: detect --source . --log-opts="--all"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
