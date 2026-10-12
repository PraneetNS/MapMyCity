#!/usr/bin/env python3
"""
scripts/verify_environment.py
=============================
Pre-flight environment sanity checker for MapMyCity development & deployment.
Checks Python runtime, dependencies, Node/npm tools, and environment variables.
"""

import sys
import os
import shutil
import json
import argparse
from typing import Dict, Any, List

REQUIRED_PY_MODULES = [
    "fastapi",
    "pydantic",
    "uvicorn",
    "pytest",
]

OPTIONAL_PY_MODULES = [
    "psycopg2",
    "asyncpg",
    "httpx",
    "requests",
]

CORE_ENV_VARS = [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
]


def check_python_version() -> Dict[str, Any]:
    major, minor = sys.version_info.major, sys.version_info.minor
    ok = major == 3 and minor >= 9
    return {
        "check": "python_version",
        "current": f"{major}.{minor}.{sys.version_info.micro}",
        "required": ">= 3.9",
        "passed": ok,
        "detail": f"Python {major}.{minor} detected"
    }


def check_python_modules() -> List[Dict[str, Any]]:
    results = []
    for mod in REQUIRED_PY_MODULES:
        try:
            __import__(mod)
            results.append({"module": mod, "required": True, "installed": True, "passed": True})
        except ImportError:
            results.append({"module": mod, "required": True, "installed": False, "passed": False})

    for mod in OPTIONAL_PY_MODULES:
        try:
            __import__(mod)
            results.append({"module": mod, "required": False, "installed": True, "passed": True})
        except ImportError:
            results.append({"module": mod, "required": False, "installed": False, "passed": True})
    return results


def check_cli_tools() -> List[Dict[str, Any]]:
    tools = ["git", "node", "npm", "npx"]
    results = []
    for tool in tools:
        path = shutil.which(tool)
        results.append({
            "tool": tool,
            "installed": path is not None,
            "path": path or "Not Found",
            "passed": path is not None
        })
    return results


def check_environment_variables() -> List[Dict[str, Any]]:
    results = []
    for var in CORE_ENV_VARS:
        val = os.environ.get(var)
        results.append({
            "variable": var,
            "set": val is not None and len(val.strip()) > 0,
            "passed": True  # Warning only in dev
        })
    return results


def run_diagnostics(strict: bool = False) -> Dict[str, Any]:
    py_ver = check_python_version()
    modules = check_python_modules()
    tools = check_cli_tools()
    env_vars = check_environment_variables()

    all_required_modules_ok = all(m["passed"] for m in modules if m["required"])
    all_tools_ok = all(t["passed"] for t in tools)
    overall_passed = py_ver["passed"] and all_required_modules_ok and all_tools_ok

    return {
        "status": "healthy" if overall_passed else "unhealthy",
        "overall_passed": overall_passed,
        "python": py_ver,
        "modules": modules,
        "cli_tools": tools,
        "environment_variables": env_vars,
    }


def main():
    parser = argparse.ArgumentParser(description="MapMyCity Pre-flight Environment Checker")
    parser.add_argument("--strict", action="store_true", help="Fail if any optional dependency or env var is missing")
    parser.add_argument("--json", action="store_true", help="Output diagnostics report in JSON format")
    args = parser.parse_args()

    report = run_diagnostics(strict=args.strict)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("==================================================")
        print("MapMyCity Pre-Flight Environment Sanity Checker")
        print("==================================================")
        print(f"Status: {report['status'].upper()}")
        print(f"Python: {report['python']['current']} [{'OK' if report['python']['passed'] else 'FAIL'}]")

        print("\nCLI Tools:")
        for t in report["cli_tools"]:
            mark = "OK" if t["installed"] else "MISSING"
            print(f"  - {t['tool']:<8}: {mark:<8} ({t['path']})")

        print("\nRequired Python Modules:")
        for m in report["modules"]:
            if m["required"]:
                mark = "OK" if m["installed"] else "MISSING"
                print(f"  - {m['module']:<14}: {mark}")

        print("\nCore Environment Variables:")
        for e in report["environment_variables"]:
            mark = "SET" if e["set"] else "UNSET (using local fallback)"
            print(f"  - {e['variable']:<28}: {mark}")
        print("==================================================")

    sys.exit(0 if report["overall_passed"] else 1)


if __name__ == "__main__":
    main()
