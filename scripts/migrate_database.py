#!/usr/bin/env python3
"""
Measure X — Non-Destructive Database Schema Migration Script
Applies all schema updates, new tables, and columns to existing MySQL instances
without dropping or altering existing production data.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import db


def migrate():
    print("==================================================")
    print("Measure X — Database Migration & Schema Upgrade")
    print("==================================================")
    try:
        db.run_migrations()
        db.seed_baseline_data()
        print("Success! Database schema successfully updated and seeded.")
    except Exception as e:
        print(f"ERROR: Migration failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    migrate()
