from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend/ directory regardless of where uvicorn is launched from
load_dotenv(Path(__file__).parent.parent / ".env")
