#!/usr/bin/env python3
"""
Measure X — Database Setup & Table Migration Script
Creates all 14 MySQL 8+ tables, indexes, constraints, and initial roles.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import db, Base


def setup():
    print("==================================================")
    print("Measure X — MySQL 8+ Database Initialization")
    print("==================================================")

    print("Connecting to MySQL and creating all 14 relational tables...")
    try:
        db.init_database()
        print("Success! 14 relational tables, indexes, foreign keys, and baseline roles initialized.")
    except Exception as e:
        print(f"ERROR: Database initialization failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    setup()
