#!/usr/bin/.env python
"""
VectorSurfer 0.0.1 Backend - Run Script

Usage:
    python run.py                 # Run with defaults
    python run.py --reload        # Run with auto-reload (dev)
    python run.py --port 8080     # Custom port
"""

import sys
import os
import argparse

# Add src to path for VectorWave imports
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
src_path = os.path.join(project_root, 'src')

if os.path.exists(src_path):
    sys.path.insert(0, src_path)
    print(f"✅ Added VectorWave SDK path: {src_path}")

# Load ..env from parent (VectorWave config)
from dotenv import load_dotenv
env_path = os.path.join(project_root, 'test_ex', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ Loaded ..env from: {env_path}")
else:
    load_dotenv()
    print("ℹ️  Using default ..env or environment variables")


def main():
    parser = argparse.ArgumentParser(description="Run VectorSurfer 0.0.1 Backend")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    args = parser.parse_args()
    
    import uvicorn
    
    print("\n" + "=" * 50)
    print("🚀 Starting VectorSurfer 0.0.1 Backend")
    print("=" * 50)
    print(f"   Host: {args.host}")
    print(f"   Port: {args.port}")
    print(f"   Reload: {args.reload}")
    print(f"   Docs: http://localhost:{args.port}/docs")
    print("=" * 50 + "\n")
    
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload
    )


if __name__ == "__main__":
    main()
