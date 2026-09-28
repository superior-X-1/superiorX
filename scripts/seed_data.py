#!/usr/bin/env python3
"""
Measure X — Database Seed Script
Initializes MySQL 8+ with canonical roles and statutory system settings.
Zero mock, dummy, or hardcoded users.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import db


def main():
    print("==================================================")
    print("Measure X — Seeding Canonical Roles & System Settings")
    print("==================================================")

    try:
        db.init_database()
        print("Success! Canonical roles and system settings initialized in MySQL.")
    except Exception as e:
        print(f"ERROR: Seeding failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
