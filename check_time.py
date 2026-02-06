#!/usr/bin/env python3
"""
Simple script to check and display the current time
"""

from datetime import datetime

def check_time():
    """Display the current date and time in various formats"""
    now = datetime.now()

    print("Current Time Information")
    print("=" * 40)
    print(f"Full datetime: {now}")
    print(f"Date: {now.strftime('%Y-%m-%d')}")
    print(f"Time (24-hour): {now.strftime('%H:%M:%S')}")
    print(f"Time (12-hour): {now.strftime('%I:%M:%S %p')}")
    print(f"Day of week: {now.strftime('%A')}")
    print(f"Month: {now.strftime('%B')}")
    print(f"Year: {now.year}")

if __name__ == "__main__":
    check_time()
